import assert from 'node:assert/strict';
export async function seedSubmissionRepair(db, f) {
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [f.admin]);
  const assignment = await one(`INSERT INTO assignments(cohort_id,lesson_id,title,assignment_type,is_published,max_attempts) VALUES($1,$2,'First submission regression','activity',true,1) RETURNING id`, [f.cohort,f.lessons['module-01']]);
  const definition = (await one(`SELECT pg_get_functiondef('public.protect_submission_academic_fields()'::regprocedure) AS definition`)).definition;
  // Reproduce the deployed legacy defect in this isolated database only.
  await db.exec(definition.replace("new_attempt boolean := TG_OP = 'INSERT' AND NEW.status = 'submitted';", "new_attempt boolean := TG_OP = 'INSERT';"));
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [f.student]);
  const draft = await one(`INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content) VALUES($1,$2,$3,'draft',$4) RETURNING id,attempt_count`, [assignment.id,f.enrol,f.student,JSON.stringify({work:'Preserve my first attempt',selfCheck:[true]})]);
  assert.equal(draft.attempt_count,1);
  await assert.rejects(() => db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[draft.id]), /Maximum submission attempts reached/);
  await db.exec(definition);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [f.admin]);
  return draft.id;
}
export async function testSubmissionRepair(db,f,id) {
  const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  assert.equal((await one(`SELECT attempt_count FROM submissions WHERE id=$1`,[id])).attempt_count,0);
  assert.equal((await one(`SELECT previous_attempt_count FROM submission_attempt_repairs WHERE submission_id=$1`,[id])).previous_attempt_count,1);
  assert.ok((await db.query(`SELECT id FROM submissions WHERE status='submitted' AND attempt_count=1`)).rows.length >= 12);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
  for(let i=0;i<3;i++) await db.query(`UPDATE submissions SET status='draft',submitted_at=NULL WHERE id=$1`,[id]);
  assert.equal((await one(`SELECT attempt_count FROM submissions WHERE id=$1`,[id])).attempt_count,0);
  await db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[id]);
  assert.equal((await one(`SELECT attempt_count FROM submissions WHERE id=$1`,[id])).attempt_count,1);
  assert.equal((await one(`SELECT count(*)::int AS n FROM submission_versions WHERE submission_id=$1`,[id])).n,1);
  await assert.rejects(()=>db.query(`UPDATE submissions SET status='draft' WHERE id=$1`,[id]),/submitted work is preserved/);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
  await db.query(`UPDATE submissions SET status='returned' WHERE id=$1`,[id]);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.student]);
  await assert.rejects(()=>db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[id]),/Maximum submission attempts reached/);
  // Keep this extra fixture out of the curriculum's published-activity count.
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[f.admin]);
  await db.query(`UPDATE assignments SET is_published=false WHERE id=(SELECT assignment_id FROM submissions WHERE id=$1)`,[id]);
  console.log('PASS reproduced first-submit failure; repaired draft; repeated saves cost zero attempts; first submit succeeds; real attempt cap and history remain intact.');
}
