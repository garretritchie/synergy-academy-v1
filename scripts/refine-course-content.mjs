import fs from 'node:fs';
import { moduleQuestions } from '../content/assessment-cases.mjs';
import { finalQuestions } from '../content/final-cases.mjs';
import { packets,rubric } from '../content/practice-packets.mjs';
import { matchingQuestion } from '../content/matching-cases.mjs';
const target=process.argv[2]??'src/content/ai-business-essentials.json';
const content=JSON.parse(fs.readFileSync(target,'utf8'));
content.course.version='3.8-lms-2.0';
const intro=content.modules[0].screens;
intro[4]={id:intro[4].id,type:'simple',eyebrow:'Your academy',title:'Where to find your work',lead:'Learning holds each module, its activity and its practice check in one place.',bullets:['Assessments holds graded checkpoints, the midterm and the final exam.','Assignments holds homework, capstone files and submissions.','Discussion Board is for class conversations. Resources holds course files. Live Meetings holds joining links.','Your main dashboard and Messages keep course updates and questions together.']};
intro[5]={id:intro[5].id,type:'simple',eyebrow:'Your learning path',title:'Learn it, Do it, Assess it',lead:'Follow the steps in the module outline. The next step opens when the required work is complete.',bullets:['Learn it: read one topic at a time. Use Notes to record ideas and questions.','Do it: use the supplied practice input, save your work and submit the activity.','Assess it: take the 10-question practice check. Review and retake as often as you need.','Some courses have only learning. Steps that are not part of a course do not appear.'],callout:'Introduction has no activity or check. Continue directly to Module 1.'};
intro[10].lead='These are the official course grade weights.';
intro[10].cards[1].body='Three checkpoints, including the midterm, together are worth 40%.';
intro[13].bullets=['Each numbered module includes a 10-question practice check. Introduction has no check.','Graded checkpoint 1 opens after Module 3. The midterm opens after Module 6.','Graded checkpoint 3 opens after Module 9. The final opens after the Module 12 learning path.','Finish the required Learn, Do and Assess steps before a graded assessment opens.','Graded checkpoints and exams allow one attempt unless your instructor approves another. Resume your attempt or review completed answers.'];
intro[13].callout='Practice checks have unlimited attempts and do not affect your grade. Checked answers are saved. Graded assessment time continues if you leave the page.';
intro[14].bullets=['Read the goals and one topic at a time.','Explain the example in your own words and keep notes.','Complete the linked activity and save your evidence.','Take the practice check, review mistakes and try again.','Complete homework and build your capstone in Assignments.'];
intro[15].bullets[1]='You know where learning, graded assessments, assignments and course support are located.';
for(let i=1;i<content.modules.length;i++){
 const module=content.modules[i],packet=packets[i-1];
 module.screens=module.screens.filter(s=>s.id!==`${module.id}-worked-example`);
 module.screens.splice(module.screens.length-1,0,{id:`${module.id}-worked-example`,type:'simple',eyebrow:'Worked example',title:packet.title,lead:packet.example,bullets:['Your activity includes safe starting input and a template. No private workplace data is needed.',packet.check],callout:'Next, use Do it to practice. Then use Assess it to check what you learned.'});
 const last=module.screens.at(-1);last.callout='Finish the learning, complete the linked activity, then take the practice check. Stay in the same learning path.';last.next_label='Continue to activity';
}
const graded={
 'graded-quiz-1':[0,1,2].flatMap(i=>moduleQuestions(i,true).slice(0,5)),
 'midterm-exam':[0,1,2,3,4,5].flatMap(i=>moduleQuestions(i,true).slice(i<3?5:0,i<3?10:5)),
 'graded-quiz-3':[6,7,8].flatMap(i=>moduleQuestions(i,true).slice(0,5)),
 'final-exam':finalQuestions,
};
for(const a of content.assessments){const index=Number(a.unlockModule.slice(-2))-1;a.questions=a.kind==='module_check'?[...moduleQuestions(index).slice(0,9),matchingQuestion(index)]:graded[a.id];a.maxAttempts=a.kind==='module_check'?2147483647:1;}
content.activities=content.activities.filter(a=>a.module!=='introduction').map((a,i)=>({...a,instructions:[...a.instructions.filter(t=>!packets.some(p=>p.check===t)),packets[i].check],rubric,rubricWeight:0,practicePacket:packets[i]}));
content.assignments=content.assignments.map(a=>({...a,rubric,gradingNote:a.id==='capstone-final'?'Required capstone evidence; feedback-only. The presentation contributes 20% of the official grade.':a.type==='homework'?'The four homework submissions together contribute 10% of the official grade.':a.id.includes('presentation')?'The capstone presentation contributes 20% of the official grade.':'Capstone milestone: feedback-only; keep it for your final package.'}));
fs.writeFileSync(target,JSON.stringify(content,null,2)+'\n');
fs.writeFileSync('src/content/practice-packets.json',JSON.stringify({packets,rubric},null,2)+'\n');
// Preview content has learning material only: never include assessment answer keys.
fs.writeFileSync('src/content/ai-business-preview.json',JSON.stringify({...content,assessments:content.assessments.map(({questions,...a})=>({...a,questions:questions.map(({answer,explanation,...q})=>q)}))},null,2)+'\n');
console.log(`Built ${content.modules.length} modules, ${content.modules.reduce((n,m)=>n+m.screens.length,0)} screens, ${content.assessments.reduce((n,a)=>n+a.questions.length,0)} authored questions and ${packets.length} practice packets.`);
