import test from 'node:test';
import assert from 'node:assert/strict';
import {buildConversationKnowledge,evaluateSemanticAffect} from '../conversation-knowledge.js';
import {evaluateSemanticConversation,applySemanticConversation} from '../semantic-conversation.js';
import {buildConversationResponsePlan,validateConversationReply,sanitiseConversationHistory} from '../conversation-response.js';
import {updateJournalConversation} from '../journal-conversation-state.js';

const sources=[{id:'journal',text:'I am exhausted from travel. The interview was frustrating. I have rehearsal later.'},{id:'latest',text:'I cannot narrow it down. The whole interview felt unfamiliar.'}];
const topics=[{id:'interview',summary:'interview confusion',evidence:[{source:'journal',quote:'The interview was frustrating.'}],state:'exploring',unresolved:'high',importance:'medium',coverage:'surface',reply:'That leaves you with little useful feedback about what to prepare next.',openingMode:'reflection'},
{id:'rehearsal',summary:'rehearsal later',evidence:[{source:'journal',quote:'I have rehearsal later.'}],state:'open',unresolved:'high',importance:'high',coverage:'untouched',reply:'With rehearsal still ahead, how much room is left in your evening?',openingMode:'question',questionStatus:'novel',question:{dimension:'how',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false},closing:'The unfamiliar questions made it difficult to judge your preparation.'}];
test('question-answer bank retains broad answers and explicit replies to earlier bubbles',()=>{
 const history=[{role:'user',text:'journal',isJournal:true},{role:'ai',text:'Which detail was unclear?'},{role:'user',text:'All of it.'},{role:'ai',text:'That leaves little to build on.'},{role:'ai',text:'When is rehearsal?'}];
 const bank=buildConversationKnowledge(history,'I still want to understand it.','That leaves little to build on.');
 assert.equal(bank.exchanges[0].response.text,'All of it.');
 assert.equal(bank.exchanges[1].prompts[0].text,'That leaves little to build on.');
 assert.equal(sanitiseConversationHistory(history).some(t=>t.isJournal),false);
});
test('continuity and switch margin prevent small score changes from causing topic churn',()=>{
 const selected=evaluateSemanticConversation({topics,intent:'explore'},sources,{focusIds:['interview']});
 assert.equal(selected.focusIds[0],'interview');assert.equal(selected.transitioning,false);
 const redirected=evaluateSemanticConversation({topics:[{...topics[0],state:'settled'},topics[1]],intent:'explore'},sources,{focusIds:['interview']});
 assert.equal(redirected.focusIds[0],'rehearsal');assert.equal(redirected.closing,topics[1].closing);
 const closed=evaluateSemanticConversation({topics,intent:'close',directReply:'We can leave it here.'},sources,{focusIds:['other']});
 assert.equal(closed.transitioning,false);
 const plan=buildConversationResponsePlan({originalEntry:sources[0].text,userMessage:sources[1].text});
 applySemanticConversation(plan,redirected);
 assert.equal(validateConversationReply(topics[1].reply,plan).reason,'missing-topic-transition-takeaway-and-bridge');
 assert.equal(validateConversationReply(`${redirected.closing}\n\n${topics[1].reply}`,plan).ok,true);
});
test('an unanswerable opening changes action and repeated question wording is rejected',()=>{
 const selected=evaluateSemanticConversation({topics:[{...topics[0],questionStatus:'unanswerable',openingMode:'question'}]},sources);
 const plan=buildConversationResponsePlan({originalEntry:sources[0].text,chatHistory:[{role:'ai',text:'Which detail of the interview was most confusing?'}],userMessage:sources[1].text});
 applySemanticConversation(plan,selected);
 assert.equal(plan.questionBudget,0);
 assert.equal(validateConversationReply('Which detail of the interview felt confusing?',plan).ok,false);
 assert.equal(validateConversationReply(topics[0].reply,plan).ok,true);
 assert.equal(validateConversationReply('Give yourself a tiny break first, then pick one small piece to explore later.',plan).ok,false);
});
test('grounded mixed affect distinguishes fatigue from sadness and ignores hypotheticals and memory',()=>{
 const input=[...sources,{id:'memory-0',text:'I was sad last month.'}];
 const evidenceFor=items=>(items??[]).filter(e=>input.some(s=>s.id===e.source&&s.text.includes(e.quote)));
 const obs=(label,quote,source='journal',time='current')=>({label,strength:'high',time,evidence:[{source,quote}]});
 const affect=evaluateSemanticAffect([obs('tired','I am exhausted from travel.'),obs('frustrated','The interview was frustrating.'),obs('sad','I was sad last month.','memory-0'),obs('sad','I cannot narrow it down.','latest','hypothetical'),obs('sad','fabricated')],input,evidenceFor);
 assert.equal(affect.label,'tired and frustrated');assert.equal(affect.distribution.sad,undefined);
 const entry={id:'e',text:sources[0].text,emotion:'sad',aiChat:[]};
 const saved=updateJournalConversation(entry,[{role:'user',text:entry.text,isJournal:true},{role:'ai',text:topics[0].reply}],[],{affect});
 assert.equal(saved.emotion,'mixed');assert.equal(saved.conversationAffect.semantic.label,'tired and frustrated');assert.equal(saved.conversationAffect.userTurns,0);
 const laterAffect={label:'relieved',hasLatestEvidence:true,observations:[{label:'relieved'}]};
 const later=updateJournalConversation(saved,[...saved.aiChat,{role:'user',text:'I feel relieved now.'}],[],{affect:laterAffect});
 assert.match(later.emotion,/^(?:happy|excited|grateful|content|calm|neutral|tired|anxious|angry|sad|mixed)$/);
 const ack=updateJournalConversation(later,[...later.aiChat,{role:'user',text:'okay'}],[],{affect:{...affect,hasLatestEvidence:false}});
 assert.equal(ack.emotion,later.emotion);
});
