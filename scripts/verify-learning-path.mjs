import fs from 'node:fs';import ts from 'typescript';import assert from 'node:assert/strict';
const output=ts.transpileModule(fs.readFileSync('src/lib/learningPath.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {buildLearningPath,pathProgress}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const m=(id,order,lessons)=>({id,title:id,display_order:order,lessons:lessons.map((id,i)=>({id,title:id,display_order:i,is_published:true}))});
const modules=[m('a',2,['l1','l2']),m('b',10,['l3'])];const released=new Set(['l1','l2','l3']);
const activity={id:'d1',title:'Practice',module_id:'a',submissions:[]};const check={id:'q1',title:'Check',module_id:'a',passing_score:70,assessment_attempts:[]};
for(const [activities,checks,kinds] of [[[],[],['learn','learn','learn']],[[activity],[],['learn','learn','do','learn']],[[],[check],['learn','learn','assess','learn']],[[activity],[check],['learn','learn','do','assess','learn']]]){
 const path=buildLearningPath('cohort',modules,activities,checks,new Set(),released);assert.deepEqual(path.map(s=>s.kind),kinds);assert.equal(path.filter(s=>s.available).length,1);assert.equal(pathProgress(path).next.id,'l1');
}
let path=buildLearningPath('cohort',modules,[activity],[check],new Set(['l1','l2']),released);assert.equal(pathProgress(path).next.id,'d1');assert.equal(pathProgress(path).percentage,40);
path=buildLearningPath('cohort',modules,[{...activity,submissions:[{status:'draft'}]}],[check],new Set(['l1','l2']),released);assert.equal(path.find(s=>s.id==='q1').available,false);
path=buildLearningPath('cohort',modules,[{...activity,submissions:[{status:'submitted'}]}],[check],new Set(['l1','l2']),released);assert.equal(pathProgress(path).next.id,'q1');
path=buildLearningPath('cohort',modules,[],[{...check,passing_score:0,assessment_attempts:[{status:'completed',percentage:null}]}],new Set(['l1','l2']),released);assert.equal(path.find(s=>s.id==='q1').done,false);
path=buildLearningPath('cohort',modules,[],[{...check,assessment_attempts:[{status:'completed',percentage:80}]}],new Set(['l1','l2']),released);assert.equal(pathProgress(path).next.id,'l3');
path=buildLearningPath('cohort',modules,[],[],new Set(),new Set());assert.equal(pathProgress(path).next,undefined);
console.log('PASS optional Learn/Do/Assess combinations, multiple lessons, order gaps, draft gates, score gates, release gates, percentage and next step.');
