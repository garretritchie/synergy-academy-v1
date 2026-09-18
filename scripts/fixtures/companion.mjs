import assert from "node:assert/strict";
export async function testCompanion(db, f) {
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const val = async (sql, args = []) => Object.values(await one(sql, args))[0];
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.admin,
  ]);
  const course = await val(
    `INSERT INTO courses(title,slug,is_published) VALUES('Companion QA','companion-qa',true) RETURNING id`,
  );
  const cohort = await val(
    `INSERT INTO cohorts(course_id,name,slug,start_date) VALUES($1,'Companion QA','companion-qa',current_date) RETURNING id`,
    [course],
  );
  const enrol = await val(
    `INSERT INTO enrolments(cohort_id,student_id) VALUES($1,$2) RETURNING id`,
    [cohort, f.student],
  );
  const module = await val(
    `INSERT INTO modules(course_id,title,is_published) VALUES($1,'Released by instructor',true) RETURNING id`,
    [course],
  );
  const lesson = await val(
    `INSERT INTO lessons(module_id,title,is_published) VALUES($1,'Recap',true) RETURNING id`,
    [module],
  );
  await db.query(
    `INSERT INTO lesson_blocks(lesson_id,block_type,content,display_order) VALUES($1,'storyboard_screen','{"title":"First"}',1),($1,'storyboard_screen','{"title":"Last"}',2)`,
    [lesson],
  );
  const resource = await val(
    `INSERT INTO resources(course_id,module_id,title,url,resource_type) VALUES($1,$2,'Media','https://example.invalid/audio.m4a','audio') RETURNING id`,
    [course, module],
  );
  const activity = await val(
    `INSERT INTO assignments(cohort_id,module_id,title,is_published,assignment_type,evidence_required,max_points) VALUES($1,$2,'Private activity',true,'homework',true,100) RETURNING id`,
    [cohort, module],
  );
  const assessment = await val(
    `INSERT INTO assessments(cohort_id,module_id,title,is_published,assessment_type,max_attempts,passing_score) VALUES($1,$2,'Check',true,'quiz',2,70) RETURNING id`,
    [cohort, module],
  );
  const q1 = await val(
    `INSERT INTO assessment_questions(assessment_id,question_text,question_type,options,correct_answer) VALUES($1,'Choose both','multiple_select','["A","B","C"]','["A","B"]') RETURNING id`,
    [assessment],
  );
  const q2 = await val(
    `INSERT INTO assessment_questions(assessment_id,question_text,question_type,options,correct_answer) VALUES($1,'True?','true_false','["True","False"]','True') RETURNING id`,
    [assessment],
  );
  await db.query(`SELECT companion_initialize($1)`, [cohort]);
  await db.query(`SELECT companion_set_mode($1,true)`, [cohort]);
  await db.query(
    `UPDATE module_components SET is_published=true,resource_id=CASE WHEN type IN ('audio','video') THEN $1::uuid END WHERE module_id=$2`,
    [resource, module],
  );
  const recap = await val(
    `SELECT id FROM module_components WHERE module_id=$1 AND type='ebook_recap'`,
    [module],
  );
  const audio = await val(
    `SELECT id FROM module_components WHERE module_id=$1 AND type='audio'`,
    [module],
  );
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.student,
  ]);
  await db.exec("SET ROLE authenticated");
  const outline = await val(`SELECT companion_outline($1)`, [cohort]);
  assert.equal(outline.modules[0].available, false);
  assert.equal(outline.modules[0].components.length, 7);
  assert.equal(outline.modules[0].components[0].lesson_id, undefined);
  assert.equal(
    await val(`SELECT count(*)::int FROM lessons WHERE id=$1`, [lesson]),
    0,
  );
  assert.equal(
    await val(`SELECT count(*)::int FROM assignments WHERE id=$1`, [activity]),
    0,
  );
  assert.equal(
    await val(`SELECT count(*)::int FROM assessments WHERE id=$1`, [
      assessment,
    ]),
    0,
  );
  assert.equal(
    await val(`SELECT count(*)::int FROM resources WHERE id=$1`, [resource]),
    0,
  );
  await assert.rejects(
    () => val(`SELECT get_assessment_for_student($1)`, [assessment]),
    /not available/,
  );
  await assert.rejects(
    () => val(`SELECT companion_save_progress($1,$2,1,true)`, [recap, cohort]),
    /not available/,
  );
  await assert.rejects(
    () =>
      val(`SELECT companion_set_release($1,$2,'released')`, [cohort, module]),
    /Not authorized/,
  );
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.admin,
  ]);
  await db.query(`SELECT companion_set_release($1,$2,'released')`, [
    cohort,
    module,
  ]);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.student,
  ]);
  await db.exec("SET ROLE authenticated");
  assert.equal(
    await val(`SELECT count(*)::int FROM lessons WHERE id=$1`, [lesson]),
    1,
  );
  await assert.rejects(
    () => val(`SELECT companion_save_progress($1,$2,0,true)`, [recap, cohort]),
    /final recap page/,
  );
  await db.query(`SELECT companion_save_progress($1,$2,1,true)`, [
    recap,
    cohort,
  ]);
  assert.equal(
    await val(`SELECT companion_component_state($1,$2)`, [recap, enrol]),
    "completed",
  );
  assert.equal(
    await val(`SELECT companion_component_state($1,$2)`, [audio, enrol]),
    "not_started",
  );
  await db.query(`SELECT companion_save_progress($1,$2,45,false)`, [
    audio,
    cohort,
  ]);
  assert.equal(
    await val(
      `SELECT position FROM component_progress WHERE component_id=$1 AND enrolment_id=$2`,
      [audio, enrol],
    ),
    "45",
  );
  await db.query(
    `UPDATE component_progress SET status='completed' WHERE component_id=$1`,
    [audio],
  );
  assert.equal(
    await val(`SELECT companion_component_state($1,$2)`, [audio, enrol]),
    "in_progress",
  );
  const sub = await val(
    `INSERT INTO submissions(assignment_id,enrolment_id,student_id,status,content,max_grade) VALUES($1,$2,$3,'draft','My evidence',100) RETURNING id`,
    [activity, enrol, f.student],
  );
  await assert.rejects(
    () =>
      db.query(
        `UPDATE submissions SET status='submitted',submitted_at=now() WHERE id=$1`,
        [sub],
      ),
    /required evidence/,
  );
  const session = await val(`SELECT begin_assessment_session($1,$2)`, [
    assessment,
    enrol,
  ]);
  assert.ok(session.id);
  await assert.rejects(
    () => val(`SELECT check_assessment_answer($1,'True')`, [q2]),
    /Submit the assessment/,
  );
  await db.query(`SELECT companion_save_answer($1,$2,'["B","A"]')`, [
    assessment,
    q1,
  ]);
  const answers = { [q1]: ["B", "A"], [q2]: "True" };
  const result = await val(`SELECT submit_assessment_attempt($1,$2,$3)`, [
    assessment,
    enrol,
    answers,
  ]);
  assert.equal(Number(result.percentage), 100);
  assert.deepEqual(
    await val(`SELECT submit_assessment_attempt($1,$2,$3)`, [
      assessment,
      enrol,
      answers,
    ]),
    result,
  );
  assert.equal(
    (await val(`SELECT review_assessment_session($1)`, [assessment])).feedback,
    undefined,
  );
  await db.query(`SELECT begin_assessment_session($1,$2)`, [assessment, enrol]);
  const fail = await val(`SELECT submit_assessment_attempt($1,$2,$3)`, [
    assessment,
    enrol,
    { [q1]: ["A", "C"], [q2]: "False" },
  ]);
  assert.equal(Number(fail.percentage), 0);
  await assert.rejects(
    () => val(`SELECT begin_assessment_session($1,$2)`, [assessment, enrol]),
    /allowed attempt/,
  );
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.admin,
  ]);
  await assert.rejects(
    () => val(`SELECT companion_set_release($1,$2,'locked')`, [cohort, module]),
    /Confirm relocking/,
  );
  await db.query(
    `SELECT companion_set_release($1,$2,'locked',NULL,NULL,true)`,
    [cohort, module],
  );
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.student,
  ]);
  await db.exec("SET ROLE authenticated");
  assert.equal(
    await val(`SELECT count(*)::int FROM lesson_blocks WHERE lesson_id=$1`, [
      lesson,
    ]),
    0,
  );
  assert.equal(
    await val(`SELECT companion_component_state($1,$2)`, [recap, enrol]),
    "completed",
  );
  await db.exec("RESET ROLE");
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.admin,
  ]);
  await db.query(`SELECT companion_set_mode($1,false)`, [cohort]);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [
    f.student,
  ]);
  assert.equal(
    await val(`SELECT is_lesson_released($1,$2)`, [lesson, cohort]),
    true,
  );
  await db.exec("RESET ROLE");
  console.log(
    "PASS v2 safe outline, locked direct reads/RPCs, independent recap/audio completion, resume persistence, evidence requirement, multiple-select grading, configured attempts, hidden keys, relock retention and v1 mode rollback.",
  );
}
