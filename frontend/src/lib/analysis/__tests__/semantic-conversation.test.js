import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSemanticConversation,applySemanticConversation,compactJournalText,compactConversationKnowledge,semanticPromptContext} from '../semantic-conversation.js';
import {buildConversationResponsePlan,validateConversationReply} from '../conversation-response.js';
import {composeExperienceDescription,buildExperienceProfile} from '../experience-profile.js';
import {analyseText} from '../text-features.js';
import {updateJournalConversation} from '../journal-conversation-state.js';
import {EmotionDetector} from '../../journal-ai.js';
const sources=[{id:'journal',text:'My manager blamed me for the delay. Painting tonight is my reward.'},{id:'latest',text:'mhm'},{id:'memory-0',text:'I have struggled to speak up to my manager before.'}];
const topic=(id,quote,extra={})=>({id,summary:id,evidence:[{source:'journal',quote}],state:'open',engagement:'none',unresolved:'high',importance:'medium',coverage:'untouched',reply:`Candidate for ${id}`,opening:'what was left unsaid',questionStatus:'novel',question:{dimension:'what',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false},...extra});
test('unexplored meaning outranks a settled reward after acknowledgement without inventing topics',()=>{
 const plan=evaluateSemanticConversation({intent:'explore',openingMode:'question',topics:[topic('painting','Painting tonight is my reward.',{state:'settled',unresolved:'low',coverage:'developed'}),topic('blame','My manager blamed me for the delay.'),topic('invented','My manager fired me')]},sources);
 assert.equal(plan.focusIds[0],'blame');assert.equal(plan.topics.length,2);assert.equal(plan.reply,'Candidate for blame');
 assert.ok(Math.abs(plan.topics.reduce((n,t)=>n+t.relativePriority,0)-1)<1e-10);
});
test('new elaboration outranks untouched topics and memory alone cannot create an agenda item',()=>{
 const more=[...sources,{id:'latest',text:'Painting is complicated because I feel guilty taking the time.'}].filter((s,i,a)=>s.id!=='latest'||i===a.length-1);
 const plan=evaluateSemanticConversation({topics:[topic('blame','My manager blamed me for the delay.'),topic('painting','Painting tonight is my reward.',{engagement:'elaborating',evidence:[{source:'latest',quote:more.at(-1).text}]}),topic('past','',{evidence:[{source:'memory-0',quote:sources[2].text}]})]},more);
 assert.equal(plan.focusIds[0],'painting');assert.ok(!plan.topics.some(t=>t.id==='past'));
});
test('user closure disables prompts and explicit connections preserve joint focus',()=>{
 const topics=[topic('blame','My manager blamed me for the delay.'),topic('painting','Painting tonight is my reward.')];
 const linked=evaluateSemanticConversation({intent:'explore',topics,links:[{from:'blame',to:'painting',support:'explicit',meaning:'reward helps with a difficult day',evidence:[{source:'journal',quote:'Painting tonight is my reward.'}]}]},sources);
 assert.equal(linked.focusIds.length,2);
 const closed=evaluateSemanticConversation({intent:'close',topics},sources);assert.equal(closed.openingMode,'none');
});
test('live question contract needs a grounded unknown and screens coping prompts',()=>{
 const current=[{id:'journal',text:'I felt embarrassed when the chair squeaked, and now I am worn out before revision.'},
  {id:'latest',text:'I felt embarrassed when the chair squeaked, and now I am worn out before revision.'}];
 const base=topic('embarrassment','I felt embarrassed when the chair squeaked',{evidence:[{source:'journal',quote:'I felt embarrassed when the chair squeaked'}],
  question:{dimension:'how',purpose:'experience',informationGap:'whether the embarrassment stayed with them afterwards',
    groundingQuote:'I felt embarrassed',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false}});
 const accepted=evaluateSemanticConversation({enforceGroundedQuestions:true,topics:[base]},current);
 assert.equal(accepted.openingMode,'question');
 const ungrounded=evaluateSemanticConversation({enforceGroundedQuestions:true,topics:[{...base,question:{...base.question,groundingQuote:'a detail nobody wrote'}}]},current);
 assert.equal(ungrounded.openingMode,'reflection');
 const diverted=evaluateSemanticConversation({enforceGroundedQuestions:true,topics:[{...base,question:{...base.question,purpose:'mood-lift'}}]},current);
 assert.equal(diverted.openingMode,'reflection');
});
test('semantic intent enables a purposeful follow-up independent of short-reply rules',()=>{
 const plan=buildConversationResponsePlan({originalEntry:sources[0].text,chatHistory:[{role:'ai',text:'Painting is a reward at the end of a difficult day.'}],userMessage:'I am looking forward to it.'});
 applySemanticConversation(plan,evaluateSemanticConversation({intent:'explore',openingMode:'question',topics:[topic('blame','My manager blamed me for the delay.')]},sources));
 assert.equal(plan.continuationRequired,true);
 assert.equal(validateConversationReply('Painting is a reward at the end of a difficult day.',plan).ok,false);
 assert.equal(validateConversationReply('Being blamed after giving notice leaves something unanswered. What did you want your manager to understand about the delay?',plan).ok,true);
 assert.equal(validateConversationReply('If you could change one thing to make the situation better, what would it be?',plan).ok,false);
 assert.equal(validateConversationReply('That irritation can show up as a tight spot. Where do you feel it most right now?',plan).ok,false);
});
test('emotion descriptions never become blank across sparse and mixed experiences',()=>{
 for(const text of ['The train was crowded, but I finished my project.', 'I woke up late and had to rush.', 'The sky is blue.', 'I feel relieved but exhausted.']){
  assert.ok(composeExperienceDescription(buildExperienceProfile(analyseText(text),text)).trim());
  assert.ok(new EmotionDetector().analyze(text).emotion.trim());
 }
});
test('persisted conversation updates affect on evidence and preserves emotion on fillers',()=>{
 const entry={id:'entry',text:'I was worried about the interview.',emotion:'anxious'};
 const updated=updateJournalConversation(entry,[{role:'user',text:'I feel relieved and happy now that it is over.'},{role:'ai',text:'What went better than you expected?'}]);
 assert.equal(updated.conversationAffect.userTurns,1);assert.equal(updated.initialEmotion,'anxious');
 const ack=updateJournalConversation(updated,[...updated.aiChat,{role:'user',text:'mhm'}]);
 assert.equal(ack.emotion,updated.emotion);assert.equal(ack.aiChat.length,3);
});

test('foregrounded concern wins when the user answers then redirects; ungrounded focus has no bonus',()=>{
 const current=[{id:'latest',text:'The walk was relaxing, but I still want to talk about the argument.'}];
 const topics=[topic('walk','',{evidence:[{source:'latest',quote:'The walk was relaxing'}],engagement:'elaborating',importance:'medium'}),topic('argument','',{evidence:[{source:'latest',quote:'I still want to talk about the argument.'}],engagement:'elaborating',importance:'medium'})];
 const selected=evaluateSemanticConversation({intent:'explore',latestFocusId:'argument',topics},current);
 assert.equal(selected.focusIds[0],'argument');assert.equal(selected.reply,'Candidate for argument');
 const noFocus=evaluateSemanticConversation({topics},current);
 const unknown=evaluateSemanticConversation({latestFocusId:'invented',topics},current);
 assert.deepEqual(unknown.topics.map(t=>t.score),noFocus.topics.map(t=>t.score));
});

test('bounded model context keeps the beginning, middle, end, and recent answer pairs',()=>{
 const journal=`START ${'a'.repeat(3000)} MIDDLE ${'b'.repeat(3000)} END`;
 const compact=compactJournalText(journal);
 assert.ok(compact.length<2500);
 assert.match(compact,/START/);assert.match(compact,/MIDDLE/);assert.match(compact,/END/);
 const history=Array.from({length:39},(_,i)=>({role:i%2?'user':'ai',text:`turn ${i} ${'x'.repeat(500)}`}));
 const latest='I actually want to talk about studying now';
 const knowledge=compactConversationKnowledge(history,latest,'');
 assert.ok(knowledge.exchanges.length<=4);
 assert.equal(knowledge.exchanges.at(-1).response.text,latest);
 const plan={originalEntry:journal,currentMessage:latest,history,promptHistory:history,memory:{memories:[]}};
 const context=semanticPromptContext(plan,[{id:'journal',text:journal},{id:'latest',text:latest}],null);
 assert.ok(JSON.stringify(context).length<8500);
 assert.match(context.sources[0].text,/MIDDLE/);
 assert.equal(context.exchange.length,8);
});

test('the assessor gets shorthand glosses while preserving exact user evidence',()=>{
 const journal='omggg tdy the plans changed again?? wthelly brah';
 const latest='js got home and im annoyed';
 const plan={originalEntry:journal,currentMessage:latest,history:[],promptHistory:[],memory:{memories:[]}};
 const context=semanticPromptContext(plan,[{id:'journal',text:journal},{id:'latest',text:latest}],null);
 assert.equal(context.sources[0].text,journal);
 assert.match(context.readingAid.find(item=>item.id==='journal').expanded,/oh my god today/);
 assert.match(context.readingAid.find(item=>item.id==='journal').expanded,/what the hell bro/);
 assert.match(context.readingAid.find(item=>item.id==='latest').expanded,/just got home/);
});
