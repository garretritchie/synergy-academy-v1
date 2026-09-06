import assert from 'node:assert/strict';

export async function testUngradedRevisions(db, f) {
  const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  const asUser = id => db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);
  for (const kind of ['activity','homework','project']) {
    await asUser(f.admin);
    const assignment = await one(`INSERT INTO assignments(cohort_id,lesson_id,title,assignment_type,is_published,max_attempts) VALUES($1,$2,$3,$4,true,1) RETURNING id`,[f.cohort,f.lessons['module-01'],`Revision test ${kind}`,kind]);
    const content = n => kind==='activity' ? JSON.stringify({work:`Revision ${n}`,selfCheck:[true]}) : `Revision ${n}`;
    await asUser(f.student);
    const submission = await one(`INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content) VALUES($1,$2,$3,'draft',$4) RETURNING id,attempt_count`,[assignment.id,f.enrol,f.student,content(0)]);
    assert.equal(submission.attempt_count,0);
    for(let n=1;n<=3;n++) {
      await db.query(`UPDATE submissions SET status='submitted',content=$1,submitted_at=clock_timestamp() WHERE id=$2`,[content(n),submission.id]);
      assert.equal((await one(`SELECT attempt_count FROM submissions WHERE id=$1`,[submission.id])).attempt_count,n);
    }
    assert.equal((await one(`SELECT count(*)::int AS n FROM submission_versions WHERE submission_id=$1`,[submission.id])).n,3);
    assert.equal((await one(`SELECT content FROM submission_versions WHERE submission_id=$1 AND attempt_number=1`,[submission.id])).content,content(1));
    await assert.rejects(()=>db.query(`UPDATE submissions SET status='draft' WHERE id=$1`,[submission.id]),/submitted work is preserved/);
    await assert.rejects(()=>db.query(`UPDATE submissions SET student_id=$1 WHERE id=$2`,[f.admin,submission.id]),/ownership and assignment cannot be changed/);
    // A student cannot award their own grade while editing ungraded work.
    await db.query(`UPDATE submissions SET grade=100,graded_at=now() WHERE id=$1`,[submission.id]);
    assert.equal((await one(`SELECT grade FROM submissions WHERE id=$1`,[submission.id])).grade,null);
    const evidence = await one(`INSERT INTO submission_files(submission_id,file_name,file_path) VALUES($1,'evidence.txt','fixture/evidence.txt') RETURNING id`,[submission.id]);
    await asUser(f.admin);
    await db.query(`UPDATE submissions SET grade=0,graded_at=now(),status='graded' WHERE id=$1`,[submission.id]);
    await asUser(f.student);
    await assert.rejects(()=>db.query(`UPDATE submissions SET status='submitted',grade=NULL,graded_at=NULL,content='stale browser change' WHERE id=$1`,[submission.id]),/has been graded/);
    await assert.rejects(()=>db.query(`INSERT INTO submission_files(submission_id,file_name,file_path) VALUES($1,'late.txt','fixture/late.txt')`,[submission.id]),/evidence is locked/);
    await assert.rejects(()=>db.query(`DELETE FROM submission_files WHERE id=$1`,[evidence.id]),/evidence is locked/);
    // Even an inconsistent status must not unlock an existing zero grade.
    await asUser(f.admin);
    await db.query(`UPDATE submissions SET status='submitted' WHERE id=$1`,[submission.id]);
    await asUser(f.student);
    await assert.rejects(()=>db.query(`UPDATE submissions SET content='attempted bypass' WHERE id=$1`,[submission.id]),/has been graded/);
    await asUser(f.admin);
    await db.query(`UPDATE submissions SET status='returned',grade=NULL,graded_at=NULL,graded_by=NULL WHERE id=$1`,[submission.id]);
    await asUser(f.student);
    await db.query(`UPDATE submissions SET status='submitted',content=$1 WHERE id=$2`,[content(4),submission.id]);
    assert.equal((await one(`SELECT attempt_count FROM submissions WHERE id=$1`,[submission.id])).attempt_count,4);
  }
  console.log('PASS activity/homework/project unlimited ungraded revisions, immutable history, zero-grade lock, stale update rejection, graded evidence protection and instructor reopening.');
}
