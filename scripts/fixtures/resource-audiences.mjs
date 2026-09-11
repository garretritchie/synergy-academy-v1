import assert from 'node:assert/strict';

export async function testResourceAudiences(db, f) {
  const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  const asUser = async id => { await db.exec('RESET ROLE'); await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]); };
  const visible = async cohort => (await db.query(`SELECT id FROM get_available_course_resources($1)`,[cohort])).rows.map(row=>row.id);
  await asUser(f.admin);
  const shared = await one(`INSERT INTO resources(course_id,title,url) VALUES($1,'Program guide','https://example.invalid/program') RETURNING id`,[f.course]);
  const own = await one(`INSERT INTO resources(course_id,cohort_id,title,url) VALUES($1,$2,'Cohort guide','https://example.invalid/cohort') RETURNING id`,[f.course,f.cohort]);
  // Create a cohort after the program resource; no copying or reseeding is needed.
  const future = await one(`INSERT INTO cohorts(course_id,name,slug) VALUES($1,'Future cohort','future-resource-cohort') RETURNING id`,[f.course]);
  const futureOnly = await one(`INSERT INTO resources(course_id,cohort_id,title,url) VALUES($1,$2,'Future cohort only','https://example.invalid/future') RETURNING id`,[f.course,future.id]);
  const gated = await one(`INSERT INTO resources(course_id,title,url,release_mode,release_checkpoint_type,release_checkpoint_id,show_before_release) VALUES($1,'Shared progress guide','https://example.invalid/gated','checkpoint','lesson',$2,true) RETURNING id`,[f.course,f.lessons['module-01']]);
  await asUser(f.student); await db.exec('SET ROLE authenticated');
  assert.ok((await visible(f.cohort)).includes(shared.id));
  assert.ok((await visible(f.cohort)).includes(own.id));
  assert.ok(!(await visible(f.cohort)).includes(futureOnly.id));
  assert.equal((await visible(future.id)).length,0,'Unregistered future cohorts do not expose resources');
  await asUser(f.admin);
  await db.query(`INSERT INTO enrolments(cohort_id,student_id) VALUES($1,$2)`,[future.id,f.student]);
  await asUser(f.student); await db.exec('SET ROLE authenticated');
  const futureVisible = await visible(future.id);
  assert.ok(futureVisible.includes(shared.id),'Future enrolment inherits program library');
  assert.ok(futureVisible.includes(futureOnly.id));
  assert.ok(!futureVisible.includes(own.id),'Multi-cohort student sees the chosen cohort only');
  assert.ok((await visible(f.cohort)).includes(gated.id));
  assert.ok(!futureVisible.includes(gated.id),'Completion in an earlier cohort does not release a future-cohort checkpoint');
  const previews=(await db.query(`SELECT * FROM get_upcoming_course_resources($1)`,[future.id])).rows;
  assert.ok(previews.some(row=>row.id===gated.id && !('url' in row)));

  await asUser(f.admin);
  const teacher='00000000-0000-4000-8000-000000000030';
  await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'resource-teacher@example.invalid')`,[teacher]);
  await db.query(`INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='instructor'`,[teacher]);
  await db.query(`INSERT INTO cohort_instructors(cohort_id,instructor_id) VALUES($1,$2)`,[f.cohort,teacher]);
  await asUser(teacher); await db.exec('SET ROLE authenticated');
  assert.equal((await db.query(`SELECT id FROM resources WHERE id=$1`,[futureOnly.id])).rows.length,0);
  await db.query(`INSERT INTO resources(course_id,cohort_id,title,url) VALUES($1,$2,'Instructor cohort link','https://example.invalid/teacher')`,[f.course,f.cohort]);
  await db.query(`INSERT INTO resources(course_id,title,url) VALUES($1,'Instructor program link','https://example.invalid/shared')`,[f.course]);
  await assert.rejects(()=>db.query(`INSERT INTO resources(course_id,cohort_id,title,url) VALUES($1,$2,'Wrong cohort','https://example.invalid/denied')`,[f.course,future.id]),/row-level security/);
  await assert.rejects(()=>db.query(`INSERT INTO resources(course_id,title,url,release_mode,release_checkpoint_type,release_checkpoint_id) VALUES($1,'Invalid shared exam gate','https://example.invalid/denied','checkpoint','assessment',$2)`,[f.course,f.checks['graded-quiz-1']]),/matching cohort/);
  await db.exec('RESET ROLE; SET ROLE anon');
  await assert.rejects(()=>visible(f.cohort),/permission denied/);
  await db.exec('RESET ROLE');
  console.log('PASS resource audiences: cohort isolation, future inheritance, multi-enrolment context, per-cohort drip gates, instructor scope and anonymous denial.');
}
