import fs from 'node:fs';
import assert from 'node:assert/strict';
const legacy=JSON.parse(fs.readFileSync('src/content/ai-business-essentials.json','utf8'));
for(const m of legacy.modules)m.screens=m.screens.filter(s=>!s.id.endsWith('-worked-example'));
legacy.activities.unshift({module:'introduction',title:'Retired introduction activity'});
for(const a of legacy.assessments)for(const [i,q]of a.questions.entries())q.question='Legacy '+a.id+' question '+i;
export async function seed(db){
 const one=async(sql,args=[])=> (await db.query(sql,args)).rows[0];
 const admin='00000000-0000-4000-8000-000000000001',student='00000000-0000-4000-8000-000000000002';
 await db.query(`INSERT INTO auth.users(id,email) VALUES ($1,'qa-admin@example.invalid'),($2,'qa-student@example.invalid')`,[admin,student]);
 await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='administrator'`,[admin]);
 await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='student'`,[student]);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[admin]);
 const course=await one(`INSERT INTO courses(title,slug,is_published) VALUES('AI Business Essentials','ai-business-essentials',true) RETURNING id`);
 const cohort=await one(`INSERT INTO cohorts(course_id,name,slug) VALUES($1,'QA cohort','qa-cohort') RETURNING id`,[course.id]);
 const enrol=await one(`INSERT INTO enrolments(cohort_id,student_id) VALUES($1,$2) RETURNING id`,[cohort.id,student]);
 const modules={},lessons={},checks={};
 for(const m of legacy.modules){
  modules[m.id]=(await one(`INSERT INTO modules(course_id,title,display_order,is_published,metadata) VALUES($1,$2,$3,true,$4) RETURNING id`,[course.id,m.title,m.order,{content_key:m.id}])).id;
  lessons[m.id]=(await one(`INSERT INTO lessons(module_id,title,display_order,is_published,metadata) VALUES($1,$2,1,true,$3) RETURNING id`,[modules[m.id],m.title,{content_key:m.id}])).id;
  for(const [i,s]of m.screens.entries())await db.query(`INSERT INTO lesson_blocks(lesson_id,block_type,content,display_order) VALUES($1,'storyboard_screen',$2,$3)`,[lessons[m.id],{...s,part_id:s.id},i+1]);
  await db.query(`INSERT INTO progress_records(enrolment_id,student_id,cohort_id,lesson_id,status,progress_percent) VALUES($1,$2,$3,$4,'completed',100)`,[enrol.id,student,cohort.id,lessons[m.id]]);
 }
 for(const a of legacy.assessments){
  checks[a.id]=(await one(`INSERT INTO assessments(cohort_id,module_id,lesson_id,title,assessment_type,is_published,max_attempts,passing_score,time_limit_minutes) VALUES($1,$2,$3,$4,$5,true,1,70,30) RETURNING id`,[cohort.id,modules[a.unlockModule],lessons[a.unlockModule],a.title,a.kind==='module_check'?'practice':'exam'])).id;
  for(const [i,q] of a.questions.entries())await db.query(`INSERT INTO assessment_questions(assessment_id,question_text,options,correct_answer,explanation,display_order) VALUES($1,$2,$3,$4,$5,$6)`,[checks[a.id],q.question,q.options,q.answer,q.explanation,i+1]);
  if(a.kind==='module_check')await db.query(`INSERT INTO assessment_attempts(assessment_id,enrolment_id,student_id,status,completed_at,percentage,answers) VALUES($1,$2,$3,'completed',now(),100,'{}')`,[checks[a.id],enrol.id,student]);
 }
 for(const a of legacy.activities){
  const assignment=await one(`INSERT INTO assignments(cohort_id,module_id,lesson_id,title,assignment_type,is_published,max_attempts) VALUES($1,$2,$3,$4,'activity',true,1) RETURNING id`,[cohort.id,modules[a.module],lessons[a.module],a.title]);
  if(a.module!=='introduction')await db.query(`INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content,submitted_at,attempt_count) VALUES($1,$2,$3,'submitted',$4,now(),1)`,[assignment.id,enrol.id,student,JSON.stringify({work:'Fixture work',selfCheck:[true]})]);
 }
 return{admin,student,course:course.id,cohort:cohort.id,enrol:enrol.id,checks,lessons};
}
export async function tests(db,f){
 const one=async(sql,args=[])=> (await db.query(sql,args)).rows[0];
 const scalar=async(sql,args=[])=>(Object.values(await one(sql,args)))[0];
 assert.equal(Number(await scalar(`SELECT count(*) FROM lesson_blocks`)),298);
 assert.equal(Number(await scalar(`SELECT count(*) FROM assignments WHERE is_published`)),12);
 assert.equal(Number(await scalar(`SELECT count(*) FROM assessment_attempts WHERE question_snapshot IS NULL`)),0);
 console.log('PASS curriculum migration updates existing course; preserves and snapshots 12 legacy attempts');
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 const a=f.checks['graded-quiz-1'];
 const start=()=>scalar(`SELECT begin_assessment_session($1,$2)`,[a,f.enrol]);
 const first=await start(),resume=await start();assert.equal(first.id,resume.id);assert.equal(first.expires_at,resume.expires_at);
 const questions=(await db.query(`SELECT * FROM assessment_questions WHERE assessment_id=$1 ORDER BY display_order`,[a])).rows;
 const q=questions[0];
 await db.query(`SELECT check_assessment_answer($1,$2)`,[q.id,q.correct_answer]);
 const changed=await scalar(`SELECT check_assessment_answer($1,$2)`,[q.id,'fake changed answer']);assert.equal(changed.correct,true);
 for(const q of questions.slice(1))await db.query(`SELECT check_assessment_answer($1,$2)`,[q.id,q.correct_answer]);
 const result=await scalar(`SELECT submit_assessment_attempt($1,$2,'{}')`,[a,f.enrol]);assert.equal(Number(result.percentage),100);
 assert.deepEqual(await scalar(`SELECT submit_assessment_attempt($1,$2,'{}')`,[a,f.enrol]),result);
 await assert.rejects(start,/allowed attempt/);
 await assert.rejects(()=>scalar(`SELECT authorize_assessment_attempt($1,$2,'Approved retry',gen_random_uuid())`,[a,f.enrol]),/Only the assigned/);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
 const request='00000000-0000-4000-8000-000000000030';
 await db.query(`SELECT authorize_assessment_attempt($1,$2,'QA approved retry',$3)`,[a,f.enrol,request]);
 await db.query(`SELECT authorize_assessment_attempt($1,$2,'QA approved retry',$3)`,[a,f.enrol,request]);
 assert.equal(Number(await scalar(`SELECT count(*) FROM assessment_attempt_authorizations`)),1);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 const second=await start();assert.notEqual(second.id,first.id);
 await db.query(`UPDATE assessment_sessions SET expires_at=now()-interval '1 minute' WHERE id=$1`,[second.id]);
 await assert.rejects(()=>scalar(`SELECT check_assessment_answer($1,$2)`,[q.id,q.correct_answer]),/Time has ended/);
 const expired=await scalar(`SELECT submit_assessment_attempt($1,$2,'{}')`,[a,f.enrol]);assert.equal(Number(expired.percentage),0);
 await assert.rejects(start,/allowed attempt/);
 const review=await scalar(`SELECT review_assessment_session($1)`,[a]);assert.equal(review.questions.length,15);assert.equal(review.questions[0].correct_answer,undefined);
 console.log('PASS graded begin/resume, immutable checked answers, authoritative grade, idempotent finish, one-attempt lock, instructor grant, idempotent grant, timed expiry, second-attempt cap and review');
 const practice=f.checks['module-01-check'];
 for(let i=0;i<3;i++){await scalar(`SELECT begin_assessment_session($1,$2)`,[practice,f.enrol]);for(const question of (await db.query(`SELECT * FROM assessment_questions WHERE assessment_id=$1`,[practice])).rows)await scalar(`SELECT check_assessment_answer($1,$2)`,[question.id,question.correct_answer]);await scalar(`SELECT submit_assessment_attempt($1,$2,'{}')`,[practice,f.enrol]);}
 console.log('PASS repeatable practice including matching questions');
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
 const activity=await one(`INSERT INTO assignments(cohort_id,lesson_id,title,assignment_type,is_published,max_attempts) VALUES($1,$2,'Draft integrity test','activity',true,3) RETURNING id`,[f.cohort,f.lessons['module-01']]);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 const draft=await one(`INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content) VALUES($1,$2,$3,'draft',$4) RETURNING id,attempt_count`,[activity.id,f.enrol,f.student,JSON.stringify({work:'My work',selfCheck:[true]})]);
 assert.equal(draft.attempt_count,0);
 await db.query(`UPDATE submissions SET content=$1 WHERE id=$2`,[JSON.stringify({work:'Edited draft',selfCheck:[true]}),draft.id]);
 assert.equal(Number(await scalar(`SELECT attempt_count FROM submissions WHERE id=$1`,[draft.id])),0);
 await db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[draft.id]);
 assert.equal(Number(await scalar(`SELECT attempt_count FROM submissions WHERE id=$1`,[draft.id])),1);
 await assert.rejects(()=>db.query(`UPDATE submissions SET status='draft' WHERE id=$1`,[draft.id]),/submitted work is preserved/);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
 await db.query(`UPDATE submissions SET status='returned',feedback='Please revise' WHERE id=$1`,[draft.id]);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 await db.query(`UPDATE submissions SET status='draft',rubric_scores='{"task":25}' WHERE id=$1`,[draft.id]);
 assert.deepEqual(await scalar(`SELECT rubric_scores FROM submissions WHERE id=$1`,[draft.id]),{});
 await db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[draft.id]);
 assert.equal(Number(await scalar(`SELECT count(*) FROM submission_versions WHERE submission_id=$1`,[draft.id])),2);
 console.log('PASS drafts consume no attempt, submitted work cannot be withdrawn by students, staff return permits revision, rubric scores protected, submission history preserved');
 await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated; SET ROLE authenticated;`);
 await assert.rejects(()=>db.query(`INSERT INTO assessment_attempt_authorizations(assessment_id,enrolment_id,authorized_by,reason) VALUES($1,$2,$3,'Unauthorized retry')`,[a,f.enrol,f.student]),/row-level security/);
 await assert.rejects(()=>db.query(`INSERT INTO assessment_sessions(assessment_id,enrolment_id,student_id) VALUES($1,$2,$3)`,[a,f.enrol,f.student]),/row-level security/);
 await assert.rejects(()=>db.query(`INSERT INTO assessment_attempts(assessment_id,enrolment_id,student_id,status) VALUES($1,$2,$3,'completed')`,[a,f.enrol,f.student]),/row-level security/);
 await assert.rejects(()=>db.query(`SELECT finalize_assessment_grade_internal($1,$2,'{}')`,[a,f.enrol]),/permission denied/);
 await db.exec('RESET ROLE');
 console.log('PASS student RLS blocks direct attempt grants, sessions and scores; private grade function is not callable');
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
 const resource=await one(`INSERT INTO resources(course_id,cohort_id,title,url,release_mode,release_at,show_before_release) VALUES($1,$2,'Timed QA resource','storage:private-test','scheduled',now()+interval '1 day',true) RETURNING id`,[f.course,f.cohort]);
 const post=await one(`INSERT INTO discussions(cohort_id,author_id,title,body) VALUES($1,$2,'QA discussion','Fictional classroom post') RETURNING id`,[f.cohort,f.student]);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 await db.exec('SET ROLE authenticated');
 assert.equal(Number(await scalar(`SELECT count(*) FROM resources WHERE id=$1`,[resource.id])),0);
 const upcoming=(await db.query(`SELECT * FROM get_upcoming_course_resources($1)`,[f.cohort])).rows;assert.equal(upcoming.length,1);assert.equal(upcoming[0].url,undefined);
 await db.query(`INSERT INTO discussion_reports(discussion_id,cohort_id,reporter_id,reason) VALUES($1,$2,$3,'Please review this classroom post')`,[post.id,f.cohort,f.student]);
 await assert.rejects(()=>db.query(`UPDATE discussions SET is_hidden=true WHERE id=$1`,[post.id]),/Only teaching staff/);
 await db.exec('RESET ROLE');
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
 await db.query(`UPDATE discussions SET is_hidden=true WHERE id=$1`,[post.id]);
 await db.query(`UPDATE resources SET release_at=now()-interval '1 minute' WHERE id=$1`,[resource.id]);
 await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
 await db.exec('SET ROLE authenticated');
 assert.equal(Number(await scalar(`SELECT count(*) FROM resources WHERE id=$1`,[resource.id])),1);
 assert.equal(Number(await scalar(`SELECT count(*) FROM discussions WHERE id=$1`,[post.id])),0);
 await db.exec('RESET ROLE');
 console.log('PASS timed resource read lock and release, safe upcoming metadata, student report, staff-only moderation and hidden-post protection');
}
