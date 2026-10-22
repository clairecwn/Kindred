# Conversation continuity and journal interpretation

Updated 2026-10-07.

The problem is conversational function: a paraphrase can acknowledge a person
without giving them a useful next turn. A short answer can confirm understanding,
continue a topic, or close it. Its meaning depends on the preceding exchange;
word count and fixed question quotas cannot reliably distinguish these cases.

## Evidence and application

- [A sequential analysis of motivational interviewing technical skills and client responses](https://pmc.ncbi.nlm.nih.gov/articles/PMC6250061/)
  distinguishes questions, reflections and later user elaboration. Open questions
  and complex reflections were associated with particular kinds of exploration.
  Application: assess what a response adds and what it invites, rather than
  treating a restatement as topic completion. This clinical, behaviour-change
  setting does not validate the same effect for a journaling chatbot.
- [The interactive work of narrative elicitation in person-centred care](https://pmc.ncbi.nlm.nih.gov/articles/PMC9122427/)
  examines how recipients repeatedly hand conversational initiative back and
  how questions can fail to elicit a narrative. Application: a short reply is
  interpreted in its sequence; ask about a concrete unanswered part of the
  experience, and do not make the user invent a new topic or explain an unknown
  cause.
- [What to take up from the patient's talk?](https://pmc.ncbi.nlm.nih.gov/articles/PMC11224953/)
  analyzes different responses to subjective experiences during intake.
  Application: preserve the user's perspective and choose a responsive next
  action rather than routinely moving from summary to advice. Intake interviews
  are not ordinary friendships; Kindred uses the conversation principles without
  adopting a clinical role.
- [Towards Coherent and Engaging Spoken Dialog Response Generation Using Automatic Conversation Evaluators](https://aclanthology.org/W19-8608/)
  studies turn-level coherence and engagement evaluation. Application: test actual
  generated continuations for relevance and progress, in addition to testing
  deterministic calculations. Lexical overlap alone cannot prove understanding.

## Implementation and limits

The semantic assessor extracts grounded topics and qualitative observations on
every chat request. Exact-source evidence validation rejects invented quotations;
it does not prove the interpretation of a quote is correct. The mathematical
ranker maps these observations to explicit scores. The same model call writes a candidate for each grounded topic. The deterministic
ranker selects the candidate corresponding to its chosen focus. Validation may
request a revision using that selected agenda and opening purpose. All prose is
model-generated. No example-specific replies are used.

A question is justified by a missing aspect that could help the user reflect,
not a desire to maximize message count. A settled concern or explicit goodbye
can close naturally. Reflection-only turns must add a new tentative perspective.
The initial journal, ongoing user chat and relevant past memories have distinct
roles: current evidence dominates, prior memories supply context, and the
assistant's own claims are not affect observations.

Verification includes evidence rejection, new-topic priority, settled-topic
priority reduction, linked focus, closure, persisted affect and empty-label
regressions, plus live synthetic exchanges. These tests establish specific
behaviours; neither the weights nor the semantic ratings have been empirically
calibrated, and they do not establish therapeutic effectiveness.

## Question repair and transitions (2026-10-08)

- [Drew and Holt, topic termination/transition sequences](https://eprints.hud.ac.uk/id/eprint/3594/)
  describes summaries initiating possible closure, including cases where closure
  fails. Application: give a tentative takeaway before a new-topic bridge, and let
  the user reply to the takeaway. A generated summary does not mark resolution.
- [Soni et al., An Empirical Study of Topic Transition in Dialogue](https://aclanthology.org/2022.codi-1.12/)
  studied 215 conversations and found no fixed temporal pattern for transitions.
  Application: use current evidence and a switching margin, not a turn counter or
  a filler-word trigger. The chosen coefficients are engineering heuristics, not
  parameters validated by this study.
- [SAMHSA TIP 35](https://library.samhsa.gov/sites/default/files/d7/priv/pep19-02-01-003_0.pdf)
  discusses the question-and-answer trap. Its clinical advice is not a validated
  chatbot protocol. Application: when an answer reaches the limit of what the user
  can specify, contribute a useful reflection instead of another diagnostic question.

5W1H is a menu of possible unknowns, not a schedule of question words. Changing
“which” to “how” cannot make an answered question new. The implementation supplies
paired assistant prompts and user answers to an independent review pass. It can
replace a repeated question with a grounded contribution. All prose remains generated.

Verification: automated tests cover question-answer pairing, replies to earlier
bubbles, transition hysteresis and two-part output, unanswerable questions, mixed
affect, hypothetical/past-memory exclusion, and persistence. Live synthetic tests
exercise automatic opening and a repeated narrowing-question history. Browser UI
tests use controlled responses and a simulated first-request failure; these test
rendering/retry/save behaviour separately from language quality. Model judgements
remain fallible; exact quote validation cannot prove an emotional interpretation.

## Processing, questions, and voice (2026-10-08)

- [Huang et al., *It Doesn't Hurt to Ask*](https://www.hbs.edu/ris/Publication%20Files/Huang%20et%20al%202017_6945bc5e-3b3e-4c0a-addd-254c9e603c60.pdf) found that relevant follow-up questions in ordinary conversations were associated with perceived responsiveness and liking. This does not support asking a question every turn. We use it to prefer a question that actually follows the user's meaning and can be answered over a formulaic question or a statement that simply ends the exchange.
- [Elwyn et al., *Shared Decision Making and Motivational Interviewing*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4018376/) describes engaging, focusing, evoking and planning as overlapping processes. This is a clinical context. We borrow the practical sequencing insight: task planning follows expressed readiness or a request for it; a casual journal debrief is not assumed to be a planning session.
- [Muir et al., *Linguistic style accommodation shapes impression formation and rapport in computer-mediated communication*](https://researchspace.bathspa.ac.uk/13172/) reports that accommodation and impressions depend on context and social roles. We adapt broad register, pace and level of expressiveness from recent user text while avoiding parroting dialect markers. Matching every slang word has no evidence of improving this product.
- [Official OpenAI prompt engineering guidance](https://developers.openai.com/api/docs/guides/prompt-engineering) describes how high-level instructions specify tone and how conversation turns supply context. ChatGPT's private internal adaptation algorithm is not documented there. Kindred runs through Groq, so we implement and evaluate our own user-text style cues rather than claiming to copy ChatGPT internals.

The semantic model now proposes an information gap for each topic and estimates a candidate question's gain, relevance, user effort and repetition. A deterministic utility score is
`0.9·gain + 0.8·relevance − 0.65·effort − 1.1·repetition − 1.4·unrequested-task-direction`, with a small penalty (at most 0.30, or 0.12 for high relevance) for a repeated question dimension. A candidate below 0.85 becomes a reflection. These weights are heuristic. The 5W1H dimension represents the kind of missing information; a different question word by itself adds no value.

The latest user message has to explicitly ask for a plan or practical advice before the model may turn a debrief into task steps. Naming a possible step or agreeing to one remains part of the user's experience. Reflection turns also pass the independent reviewer so they need a concrete conversational opening, even without a question. Voice cues describe recent user message length, informal markers and expressiveness; they do not infer personality, ethnicity or clinical state.

The latest implementation uses a second compact review for any exploratory reply, including a reflection without a question. It rejects narrow task probes after stated difficulty, unsupported abstract links between unrelated events, and proposed task steps when no practical planning was requested. When a low-value candidate question is removed from an open conversation, generation seeks a different experience-focused opening. The user can still end the conversation or say they cannot answer a narrower question; those do not force a new question. Bounded compact revisions reduce the token footprint relative to resending the full prompt. Live model output remains variable and the Groq rate limit can still affect availability.

A narrow formatting repair retains the first model-written question when a second request is joined with "and" behind one question mark. The resulting message is checked again against relevance, repetition and advice constraints. The independent review is optional if its service call fails; the locally checked draft and compact revisions still run. The opening skips this extra review to limit latency. These measures reduce failures but cannot guarantee that a language model will always produce a helpful reply.

The repetition count uses the actual question words in recent assistant turns, including answers generated after a revision, rather than assuming the planner’s original question word was used. A relevant question can still use the same word again.
