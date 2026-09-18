import assert from "node:assert/strict";
import { moduleOne } from "../../content/companion/module-01.mjs";
export async function testCompanionOperations(db, f) {
  const value = async (sql, args = []) =>
    Object.values((await db.query(sql, args)).rows[0])[0];
  const as = async (id) => {
    await db.exec("RESET ROLE");
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [id]);
    await db.exec("SET ROLE authenticated");
  };
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.admin,
  ]);
  const student2 = "50000000-0000-4000-8000-000000000001",
    teacher = "50000000-0000-4000-8000-000000000002";
  await db.query(
    `INSERT INTO auth.users(id,email) VALUES($1,'companion-other@example.invalid'),($2,'companion-teacher@example.invalid')`,
    [student2, teacher],
  );
  await db.query(
    `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='student'`,
    [student2],
  );
  await db.query(
    `INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE name='instructor'`,
    [teacher],
  );
  const course = await value(
    `INSERT INTO courses(title,slug,is_published) VALUES('Operations QA','operations-qa',true) RETURNING id`,
  );
  const cohort = await value(
    `INSERT INTO cohorts(course_id,name,slug,start_date) VALUES($1,'Operations','operations-qa',current_date) RETURNING id`,
    [course],
  );
  const other = await value(
    `INSERT INTO cohorts(course_id,name,slug,start_date) VALUES($1,'Other delivery','operations-qa-other',current_date) RETURNING id`,
    [course],
  );
  const module = await value(
    `INSERT INTO modules(course_id,title,is_published) VALUES($1,'Operations module',true) RETURNING id`,
    [course],
  );
  const enrol = await value(
    `INSERT INTO enrolments(cohort_id,student_id) VALUES($1,$2) RETURNING id`,
    [cohort, f.student],
  );
  const enrol2 = await value(
    `INSERT INTO enrolments(cohort_id,student_id) VALUES($1,$2) RETURNING id`,
    [cohort, student2],
  );
  await db.query(
    `INSERT INTO cohort_instructors(cohort_id,instructor_id) VALUES($1,$2)`,
    [cohort, teacher],
  );
  await db.query(`SELECT companion_initialize($1)`, [cohort]);
  await db.query(`SELECT companion_set_mode($1,true)`, [cohort]);
  await as(teacher);
  await assert.rejects(
    () =>
      value(`SELECT companion_set_release($1,$2,'released')`, [other, module]),
    /Not authorized/,
  );
  await db.query(
    `SELECT companion_set_release($1,$2,'scheduled',now()+interval '1 hour')`,
    [cohort, module],
  );
  assert.equal(
    (await value(`SELECT companion_outline($1,$2)`, [cohort, f.student]))
      .modules[0].available,
    false,
    "Instructor roster must reflect student release",
  );
  await db.query(`SELECT companion_set_release($1,$2,'relative',NULL,0)`, [
    cohort,
    module,
  ]);
  const activity = await value(
    `SELECT companion_author_item($1,$2,'activity',$3)`,
    [cohort, module, moduleOne.activity],
  );
  const quiz = await value(
    `SELECT companion_author_item($1,$2,'assessment',$3)`,
    [cohort, module, { ...moduleOne.assessment, graded: true }],
  );
  assert.equal(
    await value(
      `SELECT count(*)::int FROM assessment_questions WHERE assessment_id=$1`,
      [quiz],
    ),
    10,
  );
  await db.query(
    `UPDATE module_components SET is_published=true WHERE module_id=$1 AND type IN ('activity','assessment','live_session','resources')`,
    [module],
  );
  const comp = await value(
    `SELECT id FROM module_components WHERE module_id=$1 AND type='activity'`,
    [module],
  );
  const liveComp = await value(
    `SELECT id FROM module_components WHERE module_id=$1 AND type='live_session'`,
    [module],
  );
  const live = await value(
    `INSERT INTO live_sessions(cohort_id,title,scheduled_start,scheduled_end,instructor_id) VALUES($1,'QA class',now(),now()+interval '1 hour',$2) RETURNING id`,
    [cohort, teacher],
  );
  await db.query(
    `INSERT INTO component_bindings(component_id,cohort_id,live_session_id) VALUES($1,$2,$3)`,
    [liveComp, cohort, live],
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO component_bindings(component_id,cohort_id,assignment_id) VALUES($1,$2,$3)`,
        [comp, other, activity],
      ),
    /match module and cohort/,
  );
  await as(f.student);
  assert.equal(
    (await value(`SELECT companion_outline($1)`, [cohort])).modules[0]
      .available,
    true,
  );
  await assert.rejects(
    () => value(`SELECT companion_save_progress($1,$2,0,true)`, [comp, cohort]),
    /not available/,
  );
  await assert.rejects(
    () => value(`SELECT companion_outline($1,$2)`, [cohort, student2]),
    /Not authorized/,
  );
  await assert.rejects(
    () => value(`SELECT companion_gradebook($1,$2)`, [cohort, student2]),
    /Not authorized/,
  );
  await assert.rejects(
    () => value(`SELECT companion_mark_present($1)`, [live]),
    /Assigned instructor/,
  );
  const submission = await value(
    `INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content,max_grade) VALUES($1,$2,$3,'draft',$4,100) RETURNING id`,
    [
      activity,
      enrol,
      f.student,
      JSON.stringify({
        version: 1,
        work: "My checklist and table",
        selfCheck: [true],
      }),
    ],
  );
  const filePath = `${f.student}/${submission}/evidence.pdf`;
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO submission_files(submission_id,file_path,file_name,file_size) VALUES($1,$2,'evidence.pdf',10)`,
        [submission, filePath],
      ),
    /Upload the evidence file/,
  );
  await db.exec("RESET ROLE");
  await db.query(
    `INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('assignment-submissions',$1,$2,'{"size":100}')`,
    [filePath, f.student],
  );
  await as(f.student);
  await db.query(
    `INSERT INTO submission_files(submission_id,file_path,file_name,file_size) VALUES($1,$2,'evidence.pdf',1)`,
    [submission, filePath],
  );
  assert.equal(
    Number(
      await value(
        `SELECT file_size FROM submission_files WHERE submission_id=$1`,
        [submission],
      ),
    ),
    100,
  );
  await db.query(
    `UPDATE submissions SET status='submitted',submitted_at=now() WHERE id=$1`,
    [submission],
  );
  assert.equal(
    await value(`SELECT companion_component_state($1,$2)`, [comp, enrol]),
    "completed",
  );
  await as(student2);
  assert.equal(
    await value(`SELECT count(*)::int FROM submissions WHERE id=$1`, [
      submission,
    ]),
    0,
  );
  assert.equal(
    await value(
      `SELECT count(*)::int FROM submission_files WHERE submission_id=$1`,
      [submission],
    ),
    0,
  );
  await as(teacher);
  await db.query(
    `UPDATE grade_categories SET weight=100 WHERE cohort_id=$1 AND name='Activities'`,
    [cohort],
  );
  await db.query(
    `UPDATE submissions SET status='graded',grade=0,graded_at=now(),feedback='Revise your facts' WHERE id=$1`,
    [submission],
  );
  assert.equal(
    Number(
      (await value(`SELECT companion_gradebook($1,$2)`, [cohort, f.student]))
        .current_grade,
    ),
    0,
    "Zero is a recorded grade",
  );
  await db.query(
    `UPDATE submissions SET status='returned',grade=NULL,graded_at=NULL,feedback='Please correct the quantities' WHERE id=$1`,
    [submission],
  );
  const returned = await value(`SELECT companion_gradebook($1,$2)`, [
    cohort,
    f.student,
  ]);
  assert.equal(returned.current_grade, null);
  assert.equal(
    returned.items.find((i) => i.title === moduleOne.activity.title).status,
    "Resubmission required",
  );
  assert.equal(
    await value(`SELECT companion_component_state($1,$2)`, [comp, enrol]),
    "in_progress",
  );
  await db.query(
    `INSERT INTO attendance_records(live_session_id,student_id,enrolment_id,status,recorded_by) VALUES($1,$2,$3,'excused',$4)`,
    [live, student2, enrol2, teacher],
  );
  await db.query(`SELECT companion_mark_present($1)`, [live]);
  assert.equal(
    await value(
      `SELECT status FROM attendance_records WHERE live_session_id=$1 AND student_id=$2`,
      [live, student2],
    ),
    "excused",
  );
  assert.equal(
    await value(`SELECT companion_component_state($1,$2)`, [liveComp, enrol]),
    "completed",
  );
  await db.query(
    `UPDATE attendance_records SET status='absent' WHERE live_session_id=$1 AND student_id=$2`,
    [live, f.student],
  );
  assert.equal(
    await value(`SELECT companion_component_state($1,$2)`, [liveComp, enrol]),
    "not_started",
  );
  await assert.rejects(
    () =>
      value(`SELECT companion_set_release($1,$2,'locked')`, [cohort, module]),
    /Confirm relocking/,
  );
  await db.exec("RESET ROLE");
  console.log(
    "PASS v2 authoring with real Module 1 package, instructor scope, student isolation, relative/scheduled release, actual-object evidence, zero grade, returned-work grade exclusion, attendance correction and bulk preservation.",
  );
}
