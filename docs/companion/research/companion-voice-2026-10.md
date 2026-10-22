# Understanding slang and replying like a friend, October 2026

## Research used
- LLMs read text as subword tokens; a contextual vector per token is built by attention, so a word's meaning is a weighted mix of its neighbours. New slang is understood from context or from definitions placed in the prompt. [Tokenization Falling Short](https://arxiv.org/pdf/2406.11687)
- Author intent beyond literal meaning is modelled by the Rational Speech Act framework; (RSA)² adds a latent rhetorical strategy (literal, hyperbole, irony) and marginalises over it. Most of its gain came from the meaning prior. [(RSA)²](https://arxiv.org/pdf/2506.09301)
- LLMs still miss new slang without context; masking the term and inferring from context helps (FOCUS). [SLANG](https://arxiv.org/html/2401.12585v1); slang interpretation by contextual fit plus semantic plausibility: [Sun et al.](https://aclanthology.org/people/zhewei-sun/)
- Models imitate everyday informal style poorly from rules; a few real samples help most. [Catch Me If You Can](https://arxiv.org/html/2509.14543v1)
- Friend personas raise co-rumination and agreement with distorted conclusions. [What Users Cannot See](https://arxiv.org/pdf/2605.21569)
- Asking a question is worth it only when expected information gain is high. [BED-LLM](https://arxiv.org/html/2508.21184v1)
- Current youth slang: [6 7](https://www.scmp.com/lifestyle/article/3331917/gen-alpha-slang-6-7-takes-over-world-and-it-holds-more-meaning-you-think), [scuba, crine (Sept 2026)](https://brobible.com/culture/article/google-reveals-most-searched-teen-slang-of-2026-and-most-used-emojis-of-the-past-7-years/). Child language models: [KidLM](https://aclanthology.org/2024.emnlp-main.277).
- Minors: California SB 243 (AI disclosure, break reminders every 3 hours, published self-harm protocol, from 1 Jan 2026) [summary](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-regulatory-update-californias-sb-243-mandates-companion-ai-safety-and-accoun.html); Singapore PDPC children's data guidelines [summary](https://www.privacyworld.blog/2024/04/singapore-issues-privacy-guidelines-for-childrens-online-safety/).

## Implemented
- `sense-model.js`: each slang/Singlish/meme term has senses; posterior = Dirichlet prior (global × age decay + community + user counts) × log-linear context cues × interpreter likelihood ratio. Outputs expected VAD, variance, entropy, masked-distress probability, strategy mass (play, hyperbole, irony).
- `dialect/singlish-senses.js`, `youth-slang.js`: multi-sense data (sian, lor, ok lor, die liao, so free, 6 7, scuba, cooked, im crying, aura...). Dated memes fade unless still used.
- `spelling.js`: kids' and texting spellings (phonetic map + guarded edit distance). `text-features.js` reports unknown slang-shaped words.
- `expression-norm.js`: per-user y = tau + lambda·z fitted on same-day check-in/journal pairs (conjugate Bayesian regression with a group prior). `index.js` inflates R by sense variance and unknown rate, fuses a stored interpretation as an observation with learned noise, and corrects for the user's expression norm.
- `interpretation.js`: assessor returns gloss, sense choices, mode and need; validated against the user's own text and real candidates, then applied as likelihood ratios. Model readings never update user counts; only the user's own explanations do (`personal-memory.js`).
- `writer-prompt.js` + `reply-selection.js`: persona, style card, the user's own messages, reading of the message, six principles; two drafts scored by utility (heard, voice, need fit, novelty, length, age fit) behind the existing validators.
- `crisis-detection.js`: youth euphemisms (kms, unalive, sewerslide, wanna die). A joke reading never cancels a crisis match.

## Open
- No age setting exists yet; `ageBand` is supported end to end but not collected. Collecting age for under-13s needs parental consent under PDPC guidance.
- Bullying signals such as "kys" aimed at the user need their own path, not the crisis screen.
- Utility weights and lexicon priors are starting values; refit from logged draft choices and user reactions, and grow the eval set with real labelled messages from each group.

## Follow-up, 21 October 2026
- Safety: follow-up chat turns were not crisis-checked, and the resource numbers were never shown. Now every turn is checked (alone and joined with the previous message) in a normalised "skeleton" space (stretched letters, spaced letters, number-for-letter, one-letter typos), and the reviewed resources appear as a second message. `crisis-detection.js` v4.
- `term-learning.js`: new slang is read by the interpreter from context, then learned per person when their next message accepts the reading (Beta posterior, seen in 2+ entries); corrections block it. Known multi-sense terms gain implicit sense counts at half weight.
- `open-loops.js`: upcoming events from the user's words (interpreter followUps plus patterns), due dates from the entry date, resolved when later mentioned; offered to the writer a few days after.
- `wellbeing-context.js`: the Kalman state relative to the person's own baseline (z = (theta - mu)/2.46) and the gated 28-day trend, described in words only above evidence thresholds.
- `relationship.js`: Beta posteriors of "they kept talking" after questions, playful replies and long replies, relative to their own typical length; used by reply selection and the writer.
- `dialogue-policy.js`: brief-reply thresholds scale with the person's typical message length.
- Not done: community-level learning (needs a server table aggregating confirmed senses across users with a minimum user count), and learned policy weights (needs logged outcomes).

## Processing moves and Journey emotions, 21 October 2026
Research: MI competency thresholds (reflections:questions 1:1 fair, 2:1 good; 40-50% complex reflections) [Lyssn MITI guide](https://knowledge.lyssn.io/knowledge/lyssn-miti-metrics-guide); follow-up questions increase liking via perceived responsiveness [Huang et al. 2017](https://www.hks.harvard.edu/centers/cpl/publications/it-doesnt-hurt-ask-question-asking-increases-liking); LLMs over-use reassurance, are near-random at strategy choice and weakest at exploration, and self-refinement makes it worse [Kang et al. 2024](https://arxiv.org/abs/2402.13211v2); human supporters combine strategies in ~18% of turns [ESConv analysis](https://arxiv.org/html/2505.15316v1); specific, empathic reframes beat overly positive ones [Sharma et al. ACL 2023](https://aclanthology.org/2023.acl-long.555); emotional granularity aids regulation [Kashdan, Barrett & McKnight 2015](https://www.affective-science.org/pubs/2015/kashdan-et-all-unpacking-emotion-differentiation-2015.pdf); end-of-day affect tracks the daily mean with small negative peak/end effects [Neubauer et al. JPSP 2020](https://www.pedocs.de/volltexte/2021/22888/pdf/JPSP_2020_1_Neubauer_et_al_How_was_your_day_A.pdf); [GoEmotions](https://arxiv.org/abs/2005.00547v2) for a fine-grained taxonomy.

Implemented:
- `processing-moves.js`: processing ladder (told, felt, understood, settled) and ten moves (follow-up, choice, name-feeling, wonder, connect, continue, take, reframe, play, pick-thread) chosen by utility; the top two moves become the two drafts. Hook strength, unhedged-cause detection and question quality feed `reply-selection.js`. Style failures now rank instead of disqualify; slang accommodation target lowered to ~70% of the user's density.
- `emotion-taxonomy.js` (41 feelings with family, VAD, self-report wording incl. Singlish) and `emotion-profile.js`: per-entry distribution from self-report (negation, hope/expectation, other people's feelings excluded; "i feel X" and entry endings weighted up), assessor observations, appraisal and VAD; one or two words chosen from the distribution; days weighted by evidence and intensity with small negative peak/end weights; week and all-time count each day once with recurring feelings favoured. `entry.emotion` stays a family key for avatar/world; `entry.emotionLabel` holds the specific words. Journey shows This Week and Since You Started.

## Live testing against Groq, 21 October 2026
Six scenarios run live (gpt-oss-120b, free tier): the original restless/unmotivated test over five turns, a child with memes and misspellings, good news, venting about a friend, harsh self-talk, and a crisis message mid-chat. Fixes made from what failed:
- Assessor moved to gpt-oss-120b: the 20b model merged threads and invented causes in its summary. Interpretation gloss told never to add a cause.
- Speaking as the user ("i wish i could just disappear" in child mode) is now a hard rejection (`speaksAsUser`), and the continue move must address the person as "you".
- Escalation (adding "never", "waste of time" to harsh self-talk) penalised; continue/wonder blocked when the latest message is self-judgment; reframe may repeat.
- Deterministic cues override the model's need: short meme message -> play; clear good news -> celebrate; anger in their words -> vent. "idk whats wrong w me" is puzzlement, not self-judgment.
- No menus after a broad answer ("both", "idk"); build on an answered option instead of re-asking.
- Writer: react instead of repeating the user's sentence; stay on the focus thread; no guessing other people's motives; plain words; temperature 0.55.
- Selection and repair: style-only failures accepted without a rewrite unless the draft narrates feelings formally; tag questions ("huh?") don't spend the question budget; emoji the user hasn't used are stripped, not grounds for rejection; "ya lor"/"ok lah" count as acknowledgements; "you could…" counts as unasked advice; last-resort trim handles "…".
- Emotion profile: good-news, failure and self-doubt wording; "but" weighting stops at a comma.
- Free tier note: one turn is 2 to 3 calls and gpt-oss-120b allows about 8k tokens per minute, so consecutive turns under a minute apart can hit 429s. groq.js falls back to smaller models; a paid tier removes this.

## Conversation flow: reading the latest turn, 22 October 2026
Research: grounding (Clark & Brennan 1991): a contribution is presented then accepted, and the strongest evidence of understanding is a relevant next turn [summary](https://en.wikipedia.org/wiki/Grounding_in_communication); open-class repair initiators ("huh?", "what?") treat the whole previous turn as the problem, typically after an abrupt topic shift or off-key response [Drew 1997](https://emcawiki.net/Drew1997); LLMs lose 39% on average in multi-turn chat, over-rely on their own earlier answers and under-use middle turns [Laban et al. 2025](https://arxiv.org/pdf/2505.06120); double-sided reflections are the MI move for ambivalence [MI pocket guide](https://www.wigan.gov.uk/Docs/PDF/Business/Professionals/Early-Help/MI-pocket-Guide.pdf); stepwise topic transition (Jefferson 1984): topics move through shared content.

Implemented:
- `turn-act.js`: classifies the latest message against Kindred's last one (repair, pushback, ack, option a/b, both, neither, broad, answer, elaboration, play) and detects ambivalence ("wanna X but also Y") and new content.
- `processing-moves.js`: new moves double-sided, repair, land. Repair/pushback force repair; menus blocked after an answer; ack moves to an untouched heavy thread; connect needs shared content with the target thread.
- `reply-selection.js`: uptake component (takes up the latest answer, or the confirmed options for "both"/"the first one"); penalties for re-asking an earlier question, a menu built from their answer, generic reassurance, re-summarising Kindred's own last reflection, repairs that wander. "No question after a short answer" ranks rather than disqualifies.
- `writer-prompt.js`: what-just-happened block (last message, their reply, what it did), a ledger of everything they've said this chat, explicit topic-switch instruction, the untouched thread, the confirmed options as focus.
- `journal-ai.js`: a substantive answer keeps the conversation on its thread (no policy SHIFT away); landing has its own move.
- Bugs found live: engagement cues fired on the journal itself ("havent even started" read as a timing correction, putting openings into repair mode with no move); untouched-thread cutoff excluded journal-only threads; "speaks as user" false positives on "i feel that", "i just meant", quoted inner speech; tag questions; structural advice ("think about one tiny chunk", "maybe tell mum") added to the advice check.

## Round: fixing the remaining imperfections (2026-10-22)

- **Metaphors/length.** LLM metaphor handling tracks surface cues such as lexical overlap and length (arXiv 2507.15357), so the fix is a surface check, not more prompting. `figurativeLanguage()` flags similes and stock metaphor vehicles the user never used; `overLength()` adds cost past ~2x their usual length. `tightenReply()` drops the figurative sentence and long middle sentences in code, with no extra model call. The writer gets a concrete word cap (`wordCap`, 15 to 45 words, from typicalWords) instead of "keep it short".
- **Paraphrased repeats.** `paraphrase.js` maps words to concept groups, then computes sim = max(Jaccard(concepts), 0.85·cos(char-trigrams)). The threshold is 0.45, which separated paraphrases (≥0.51) from related-but-new questions (≤0.34) in tests. It is used for the reasksQuestion and restatesOwnReflection checks. Upgrade path: @huggingface/transformers with Xenova/all-MiniLM-L6-v2 (384-dim) in a worker, if the bundle and latency budget allow.
- **Rate limits.**
  - The writer prompt is reordered so that static text (persona, principles, rules) comes first. Groq prompt caching on gpt-oss needs an exact prefix, gives a 50% discount, and cached tokens don't count toward rate limits.
  - groq.js now reads x-ratelimit-remaining/reset-tokens. It routes to a model with budget, or waits up to 12s instead of failing.
  - qwen is skipped when the output asked for exceeds its 1000-token OTPM. The old code forced 1600, which guaranteed a 429.
  - Quick consecutive chat bubbles are coalesced into one turn (2.2s quiet gap, up to 9s while typing).
- **Finding:** the binding limit is tokens per day: 200k on each of 120b and 20b, and the client key is shared by all users. At roughly 8 to 12k tokens a turn, that is about 20 turns a day per model. Real users need a server-side key on the paid Developer tier (120b costs $0.15/$0.60 per M tokens, about $0.002 to $0.004 a turn), or the Batch/Flex options.

### Follow-up (same day)
- Free-tier Groq returned no cached_tokens in usage on repeated identical prefixes, so prompt caching does not appear to help on the free plan.
- groq.js is now a provider chain: local (Ollama/LM Studio, OpenAI-compatible), Groq, OpenRouter :free, Gemini. It also has an optional response cache hook (globalThis.__KINDRED_LLM_CACHE__) for repeatable test runs.
- Opening fix:
  - name-feeling and choice are penalised on the first reply (troubles-telling: show you took in the trouble first);
  - emotion-word menus and ungrounded first replies are penalised;
  - the dialogue policy adds a feeling-anchor bonus to the concern just before the entry's "i feel ..." statement;
  - drafts over the question budget are trimmed instead of discarded.
- Live result: the entry ending "applied to 12 places n got ghosted by all. idk i feel so behind sia" now opens on the ghosting/behind thread, where it previously opened on "frustrated or regret?".
