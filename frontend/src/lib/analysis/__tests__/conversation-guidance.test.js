import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceProfile, mergeHistoricalVoice, normaliseUserTextForUnderstanding, explicitlyRequestsPlanning, questionUtility, questionDimensionsFromHistory } from '../conversation-guidance.js';
import { evaluateSemanticConversation, applySemanticConversation } from '../semantic-conversation.js';
import { buildConversationResponsePlan, validateConversationReply, simplifyStackedQuestion } from '../conversation-response.js';
import { casualVoicePenalty } from '../companion-style.js';

const entry='The long shift wore me out. I have to finish a report tonight, and my friend invited me to a show.';
const topic={id:'report',summary:'report pressure',evidence:[{source:'journal',quote:'I have to finish a report tonight'}],state:'open',engagement:'none',importance:'high',unresolved:'high',coverage:'surface',questionStatus:'novel',openingMode:'question',reply:'That is a lot for one evening. What would make the report feel less daunting?'};
const sources=latest=>[{id:'journal',text:entry},{id:'latest',text:latest}];

test('naming a step or accepting one does not authorize task planning',()=>{
 for(const text of ['I will open the file after my shower.', 'The first section, I guess.', 'Yeah, I can try that.']) assert.equal(explicitlyRequestsPlanning(text),false);
 assert.equal(explicitlyRequestsPlanning('Can you help me plan the report?'),true);
 assert.equal(explicitlyRequestsPlanning('What should I do first?'),true);
 const current='The first section, I guess.';
 const raw={intent:'advice',topics:[{...topic,evidence:[...topic.evidence,{source:'latest',quote:current}],question:{dimension:'what',informationGain:'low',relevance:'low',userEffort:'high',repetitionRisk:'high',taskDirected:true}}]};
 const selected=evaluateSemanticConversation(raw,sources(current));
 assert.equal(selected.intent,'explore');assert.equal(selected.openingMode,'reflection');assert.ok(selected.questionFit.score<0);
 const plan=buildConversationResponsePlan({originalEntry:entry,userMessage:current});applySemanticConversation(plan,selected);
 assert.equal(plan.adviceRequested,false);assert.equal(plan.needsAlternativeOpening,false);assert.equal(plan.continuationRequired,false);assert.equal(validateConversationReply('What is the tiniest thing you could do now?',plan).ok,false);
 assert.equal(validateConversationReply('Maybe sketch an outline. Does that feel doable?',plan).ok,false);
 assert.equal(validateConversationReply('What is the trickiest piece you are stuck on?',plan).ok,false);
 const difficultyPlan=buildConversationResponsePlan({originalEntry:entry,userMessage:'The report is hard and I just want to sleep.'});
 applySemanticConversation(difficultyPlan,evaluateSemanticConversation({topics:[{...topic,evidence:[...topic.evidence,{source:'latest',quote:'The report is hard'}],question:{dimension:'what',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false}}]},sources('The report is hard and I just want to sleep.')));
 assert.equal(validateConversationReply('What part of it is tripping you up the most?',difficultyPlan).reason,'narrowing-task-difficulty-instead-of-processing');
 assert.equal(validateConversationReply('How does seeing your friend shape what the report means to you?',difficultyPlan).reason,'abstract-unsupported-cross-topic-link');
 assert.equal(validateConversationReply('What feels most draining about the report right now?',difficultyPlan).reason,'asks-user-to-restate-known-feeling');
 assert.equal(validateConversationReply('Do you have any parts drafted that you could flesh out quickly before you rest?',plan).ok,false);
 plan.questionBudget=1;plan.continuationRequired=true;
 assert.equal(validateConversationReply('The report can wait until your head is clearer. Is the deadline what has you worried, or are you mostly spent from the shift?',plan).ok,true);
});

test('a relevant low-burden question beats a repetitive task prompt regardless of question word',()=>{
 const impact=questionUtility({questionStatus:'novel',question:{dimension:'how',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false}},['what','what'],false);
 const task=questionUtility({questionStatus:'novel',question:{dimension:'what',informationGain:'low',relevance:'low',userEffort:'high',repetitionRisk:'high',taskDirected:true}},['what','what'],false);
 assert.ok(impact.score>task.score);assert.ok(task.actionPenalty>0);
 const equallyRelevant=questionUtility({questionStatus:'novel',question:{dimension:'what',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false}},['what','what'],false);
 assert.ok(impact.score-equallyRelevant.score<=.121);
});

test('question utility discounts coping and productivity prompts despite high self-rated relevance',()=>{
 const base={dimension:'what',informationGap:'whether the public awkwardness lasted after leaving',
  informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false};
 const experience=questionUtility({questionStatus:'novel',question:{...base,purpose:'experience'}},[],false);
 for(const purpose of ['task-action','coping-action','mood-lift','filler']) {
  const diverted=questionUtility({questionStatus:'novel',question:{...base,purpose}},[],false);
  assert.ok(diverted.score<.85, purpose);
  assert.ok(experience.score>diverted.score, purpose);
 }
});

test('a superficial casual token cannot excuse a polished reply or generic study prompt',()=>{
 const journal='omggg tdy was so paiseh sia... the chair kept making weird noises and i just froze there leh. now my brain is gone and i lowk wanna stare into space first haisss';
 const voice=buildVoiceProfile(journal,[],journal);
 const veneer='damn, all those little incidents added up and it was quite an exhausting day. what would help you feel more confident before you return to your revision?';
 assert.ok(casualVoicePenalty(veneer,voice)>=.5);
 const plan=buildConversationResponsePlan({originalEntry:journal,userMessage:journal});
 plan.voice=voice;plan.questionBudget=1;plan.continuationRequired=true;
 assert.equal(validateConversationReply('wah after that chair thing i also would be done sia. what would help you feel ready before you dive back into studying?',plan).reason,'unrequested-task-readiness-question');
 assert.equal(validateConversationReply('wah, what is the one tiny thing that could help you feel better?',plan).reason,'low-value-comfort-or-meta-question');
});

test('a casual opener does not hide an interview-style ranking question',()=>{
 const journal='tdy was damn messy sia, my stomach made noise on the bus and everyone looked... then laptop update when the group needed my file brah. now got work waiting but im so shag alr haisss';
 const voice=buildVoiceProfile(journal,[],journal);
 assert.ok(casualVoicePenalty('bro, out of all that chaos, which moment hit you hardest?',voice)>=.5);
 assert.ok(casualVoicePenalty('wah your laptop chose the worst timing sia, esp with everyone waiting for your file.',voice)<.5);
});

test('voice cues follow user messages only and remain style cues',()=>{
 const casual=buildVoiceProfile('Long day.',[{role:'ai',text:'A very formal response to your communication.'},{role:'user',text:'omg lol idk why im sooo tired sia'}],'js wanna sleep fr');
 assert.equal(casual.register,'casual');assert.equal(casual.pace,'brief');
 const plain=buildVoiceProfile('The meeting was productive.',[], 'I would like to discuss the results tomorrow.');
 assert.equal(plain.register,'plain');
});

test('substantial Singlish writing sets a voice target beyond lowercase',()=>{
 const journal='wah tdy damn shag sia. class drag until so long then now still got work leh, lowk just wanna go home HAHAHA';
 const voice=buildVoiceProfile(journal,[{role:'ai',text:'Your experience sounds exhausting and emotionally complex.'}], 'ya lor');
 assert.equal(voice.register,'casual');
 assert.ok(voice.singlishParticleRate>=.008);
 assert.ok(voice.colloquialMarkers.includes('wah'));
 assert.ok(voice.userExamples[0].includes('wah tdy'));
 assert.ok(casualVoicePenalty('the day sounds tiring, and your work is still waiting. It is understandable that you want to take a break now.',voice)>=.5);
 assert.ok(casualVoicePenalty('wah, it makes sense that you feel overwhelmed after such a difficult day sia.',voice)>=.5);
 assert.ok(casualVoicePenalty('it makes sense that you feel overwhelmed.',voice)>=.5);
 assert.ok(casualVoicePenalty('wah, after that class still got work waiting sia. no wonder you wanna go home first.',voice)<.5);
 const plan=buildConversationResponsePlan({originalEntry:journal,userMessage:'ya lor'});
 plan.voice=voice;plan.debriefState={action:'REFLECT',focusIds:['class'],topics:[{id:'class',incidental:false}]};
 plan.questionBudget=0;plan.continuationRequired=false;
 assert.equal(validateConversationReply('the class went on for ages and you still have work waiting at home. a break sounds understandable.',plan).reason,'voice-drift-from-user');
});

test('expressive friend-texting style works without regional particles',()=>{
 const journal='omggg my friends changed the plan again?? that is so crazyyy HAHAHA brah what are they even on';
 const voice=buildVoiceProfile(journal,[],'wait WHAT');
 assert.equal(voice.register,'casual');
 assert.equal(voice.expressiveness,'animated');
 assert.equal(voice.particles.length,0);
 assert.ok(voice.stretchRate>0);
 assert.ok(voice.emphasisRate>0);
 assert.ok(voice.colloquialMarkers.includes('omg'));
 assert.ok(voice.colloquialMarkers.includes('brah'));
 assert.ok(casualVoicePenalty('the change in plans sounds frustrating, and you must be feeling disappointed about it.',voice)>=.5);
 assert.ok(casualVoicePenalty('omg, they changed it AGAIN when you already sorted everything??',voice)<.5);
 assert.ok(casualVoicePenalty('omg, they changed it AGAIN lah when you already sorted everything??',voice)>=.5);
 const formal=buildVoiceProfile('I would like to discuss the schedule change and its impact on my work.',[],'I feel disappointed by the delay.');
 assert.equal(formal.register,'plain');
 assert.equal(casualVoicePenalty('I can see why the delay matters to you.',formal),0);
 assert.ok(casualVoicePenalty('omg bruh that deadline move is wild',formal)>=.5);
 const oneWord=buildVoiceProfile('',[],'omggg');
 assert.ok(oneWord.styleConfidence<.18);
 assert.equal(casualVoicePenalty('the plans changed and that seems to have caught you by surprise.',oneWord),0);
});

test('new chat turns can change the voice profile after a plain journal',()=>{
 const voice=buildVoiceProfile('Today I attended class and completed my work on time.',[
  {role:'ai',text:'The day appears to have been productive.'},
  {role:'user',text:'omggg my friend just changed the plan again HAHAHA thats crazyyy'},
  {role:'user',text:'brah what are they even on?? i was so ready'},
 ],'i cant believe it lol');
 assert.equal(voice.register,'casual');
 assert.equal(voice.particles.length,0);
 assert.ok(voice.colloquialMarkers.includes('brah'));
 assert.equal(voice.userExamples.at(-1),'brah what are they even on?? i was so ready');
});

test('understanding aid expands known shorthand and emphasis but leaves unknown slang intact',()=>{
 assert.equal(normaliseUserTextForUnderstanding('omggg tdy was crazyyy, js got home brah'),
   'oh my god today was crazy, just got home bro');
 assert.equal(normaliseUserTextForUnderstanding('wthelly what are they on'),
   'what the hell what are they on');
 assert.equal(normaliseUserTextForUnderstanding('newslangword is odd'), 'newslangword is odd');
 assert.equal(normaliseUserTextForUnderstanding('coffeeee is nice'), 'coffeeee is nice');
});

test('historical writing style is a weak prior only when the new entry is sparse',()=>{
 const past={sourceCount:12,style:{register:'casual',lowercaseShare:.99}};
 const sparse=mergeHistoricalVoice(buildVoiceProfile('okay',[],'okay'),past,'okay');
 assert.equal(sparse.register,'casual');
 assert.ok(sparse.historicalVoiceWeight>0);
 const detailed='I would like to discuss the results of the meeting in detail tomorrow because the timeline and budget require a careful decision from everyone involved.';
 const substantive=buildVoiceProfile(detailed,[],'');
 assert.deepEqual(mergeHistoricalVoice(substantive,past,detailed),substantive);
});

test('historical Singlish markers support a brief new turn without overruling a full new entry',()=>{
 const past={sourceCount:16,style:{register:'casual',lowercaseShare:.99,singlishParticleRate:.045,colloquialRate:.075,
  styleConfidence:.9,particles:['sia'],colloquialMarkers:['wah','lowk']}};
 const sparse=mergeHistoricalVoice(buildVoiceProfile('',[],'ok'),past,'ok');
 assert.equal(sparse.register,'casual');
 assert.ok(sparse.colloquialRate>=.02);
 assert.ok(sparse.styleConfidence>=.18);
 assert.deepEqual(sparse.colloquialMarkers,['wah','lowk']);
 assert.ok(casualVoicePenalty('the delay appears to have been difficult and you might want a moment to take a break.',sparse)>=.5);
});

test('a combined model question keeps its first request and is revalidated',()=>{
 const plan=buildConversationResponsePlan({originalEntry:entry,userMessage:'I am tired and worried about the report.'});
 applySemanticConversation(plan,evaluateSemanticConversation({topics:[{...topic,evidence:[...topic.evidence,{source:'latest',quote:'I am tired and worried about the report.'}],question:{dimension:'when',informationGain:'high',relevance:'high',userEffort:'low',repetitionRisk:'low',taskDirected:false}}]},sources('I am tired and worried about the report.')));
 const draft='That report is on your mind. Is the deadline close, and how much time is left?';
 assert.equal(validateConversationReply(draft,plan).reason,'stacked-questions');
 const repaired=simplifyStackedQuestion(draft);
 assert.equal(repaired,'That report is on your mind. Is the deadline close?');
 assert.equal(validateConversationReply(repaired,plan).ok,true);
});

test('question diversity reads actual assistant turns rather than assuming the proposed dimension was used',()=>{
 assert.deepEqual(questionDimensionsFromHistory([
  {role:'ai',text:'What made that day tiring?'},{role:'user',text:'The commute.'},
  {role:'ai',text:'Given that, what stayed on your mind?'},{role:'ai',text:'How much did the delay matter?'}
 ]),['what','what','how']);
 const repeated=questionUtility({questionStatus:'novel',question:{dimension:'what',informationGain:'high',relevance:'medium',userEffort:'low',repetitionRisk:'low',taskDirected:false}},['what','what'],false);
 const fresh=questionUtility({questionStatus:'novel',question:{dimension:'how',informationGain:'high',relevance:'medium',userEffort:'low',repetitionRisk:'low',taskDirected:false}},['what','what'],false);
 assert.ok(fresh.score>repeated.score);
});
