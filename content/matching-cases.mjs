const pairs=[
 ['AI capabilities',{'Flag orders above a fixed $500 limit':'Rules','Write a new welcome message':'Generation'},'Rules apply a fixed condition; generation creates new content.'],
 ['CIDI prompt parts',{'The audience is new staff':'Context','The approved workshop facts':'Input'},'Context explains the situation. Input is the material the tool works from.'],
 ['Tool selection',{'The app and its sharing controls':'Product','The system inside that creates responses':'Model'},'A product packages features and access; a model provides underlying AI capabilities.'],
 ['Drafting stages',{'A first version that still needs checking':'Draft','A checked version cleared by the right person':'Approved work'},'A polished draft still needs the required checks and approval.'],
 ['Communication audiences',{'An internal manager deciding next steps':'Decision-focused update','A customer waiting for an order':'Clear customer update'},'Use facts and actions that fit each reader without changing the truth.'],
 ['Accessible media',{'Important meaning of a visual in words':'Text alternative','Spoken audio written out':'Transcript'},'Both provide access without relying on just one sense.'],
 ['Evidence and reasoning',{'The memo says twelve staff registered':'Source fact','Six seats may remain if no one else registered':'Inference'},'The first comes from a source; the second depends on reasoning and an assumption.'],
 ['Data values',{'The amount has not been recorded':'Missing','The checked amount is exactly nothing':'Zero'},'Unknown values and confirmed zero values have different meanings.'],
 ['Meeting records',{'Finance approved the purchase':'Decision','Could we buy a printer?':'Proposal'},'A proposal is an option to discuss, not an approved decision.'],
 ['Pilot measures',{'Current work takes ten hours':'Baseline','The pilot should take six hours with no extra errors':'Target'},'The baseline is the starting measure; the target is the desired result.'],
 ['Automation controls',{'Limits what the tool may access':'Permissions','Records actions and results':'Log'},'Permissions limit authority. Logs make actions traceable.'],
 ['Course assessment types',{'A repeatable module knowledge check':'Practice','The final exam with one attempt':'Graded assessment'},'Practice checks help you improve; graded assessments contribute to the official grade.'],
];
export function matchingQuestion(index){const [topic,map,explanation]=pairs[index],keys=Object.keys(map),values=Object.values(map);return {id:`module-${index+1}-matching`,type:'matching',question:`Match the examples for ${topic.toLowerCase()}. Choose a different label for each row.`,options:[JSON.stringify(map),JSON.stringify({[keys[0]]:values[1],[keys[1]]:values[0]})],answer:JSON.stringify(map),explanation};}
