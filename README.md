# Kindred

A wellbeing game. You write a journal entry, you answer a short daily check-in,
and Kindred builds a picture of how you are actually doing. That picture drives
everything else: a companion that responds to what you wrote, a shared 3D world
where you can be around other people at whatever pace you want, and suggestions
for real activities near you.

Built with React 18, Vite, Supabase, three.js and Leaflet.

## Quick start

```bash
npm install
cp .env.example .env    # fill in your Supabase project details
npm run dev
```

The Groq API key belongs in the Supabase Edge Function, not in a `VITE_`
variable. Anything prefixed `VITE_` is compiled into the browser bundle and is
readable by anyone who opens devtools.

```bash
npm test           # analysis + ventures tests
npm run test:avatar  # avatar self, silhouette and game-camera checks (72)
npm run check      # everything, then a production build
```

`node --test src/lib/analysis/__tests__/` reports a false failure without the
`*.test.js` glob. Use the npm scripts.

## The app

Five tabs, each a full-screen view rendered into a fixed 1280x605 canvas that is
uniformly scaled to the viewport.

| Tab | Source | What it does |
| --- | --- | --- |
| Home | `src/home/` | An illustrated scene of your cottage at the edge of the Grove. The sky, the lit window and where your avatar stands all read your current state. Lanterns along the path light from entries written, check-ins done and goals set. |
| Reflect | `src/components/WellnessView.jsx` | Journal, daily check-in, My Journey. Where the analysis layer runs. |
| Kingdom | `src/components/LandView.jsx` | Your own private land. Nobody else arrives here. |
| Grove | `src/grove/` | The shared 3D world. Districts, shops you can walk into, other people. |
| Ventures | `src/components/RealWorldView.jsx` | A full-screen map of real activities, with a hosting flow. |

Kingdom and Grove are deliberately different places. Kingdom is private; Grove is
where other users are.

## How Kindred reads you

`src/lib/analysis/`. Kindred owns its reasoning rather than handing a journal
entry to a general model and trusting the answer. Nothing here produces a
clinical term and nothing here is a diagnosis.

| Module | Responsibility |
| --- | --- |
| `emotion-space.js` | Emotion as VAD coordinates. Labels are for display, coordinates are for maths. |
| `text-features.js` | Deterministic, no model call: hedging, minimisation, somatic idioms, self-discrepancy cues, absolutist words. |
| `dialect/` | Variety identification and a Singlish lexicon. |
| `checkin-scoring.js` | Weighted graded scoring of the 7 items, with bands derived from the model. |
| `state-filter.js` | Ornstein-Uhlenbeck continuous-time Kalman filter, so skipped days are handled exactly. |
| `baseline.js` | Dual-timescale EWMAs, 28 and 90 day trend slopes, CUSUM changepoints. |
| `cold-start.js` | Bayesian shrinkage toward population priors, and the gates for when to say nothing. |
| `cultural-calibration.js` | Per-cluster calibration with a minimum-N gate. |
| `residency.js` | Where the user actually lives, so travel does not recalibrate them. |
| `crisis-detection.js` | Runs before any model call. Routes to human resources, never to the model. |
| `index.js` | `analyseUser(history, entry, context)`, returning one result with a confidence and a `sayNothing` flag. |

### The drift trap

Any adaptive personal baseline tracks a slow decline as faithfully as it tracks
stability. Someone losing 0.05 points a day for 60 days is down 3 points, and a
single re-anchoring baseline reports nothing unusual on any individual day.

`baseline.js` runs two EWMAs, fast at a 3 day half-life and slow at 34 days, and
treats **the gap between them** as the signal. Trend tests run at both 28 and 90
days, because a smooth quarter-long decline slips past a 28 day window that
keeps re-anchoring. A test simulates exactly this decline and asserts the drift
signal fires while a naive z-score does not.

### Cultural calibration

A model trained on Western English misreads other people in specific ways:

- **Somatisation.** "My chest is tight and I cannot sleep" is a direct distress
  report in much of the world. Named idioms are in the lexicon: hwa-byung,
  shenjing shuairuo, ataque de nervios, "thinking too much".
- **Ideal affect.** East Asian norms value low-arousal positive states. Scoring
  "calm" below "excited" under-scores people who are fine.
- **Dialectical affect.** Positive and negative co-occurring is coherent, not
  confused, and must not collapse onto one bipolar axis.
- **Understatement.** Suppressed language is not evidence of lower severity.

Signals are soft and never identity: locale, coarse region, writing variety.
Kindred never asks for an ethnicity and never stores one. Below a minimum-N gate
per cluster it falls back to the general model with **wider** uncertainty rather
than silently to the majority.

`residency.js` handles travel. A region needs 45 days to become home; displacing
an established home takes a 60 day unbroken run plus a 20 day margin, or a 90 day
run alone. A holiday cannot recalibrate anyone, a real relocation eventually
does, and how someone writes outranks where their phone is.

### Dialect

In Singlish the emotional content rides on the particles while the content words
look neutral. "Nvm lor, used to it already" contains no negative word and is
often quiet despair. In a wellbeing app the false negatives are the dangerous
direction.

`dialect/singlish.js` is a curated lexicon of particles, emotional vocabulary,
aspect markers and reduplication, each with valence and arousal shifts and a
masks-distress flag, including spelling variants since Singlish has no fixed
orthography. `identifyVariety()` then `analyseDialect()` run through a registry,
so other varieties are added as siblings rather than special cases. Only matched
tokens are injected into the companion's prompt.

Particles are not treated as fixed emotion words. Research on Colloquial
Singapore English shows that particles carry pragmatic stance and can change
function with speech act, context and intonation. Written journals do not retain
that intonation, so standalone `lor`, `lah`, `meh`, `leh` and `sia` are used as
stance or intensity evidence. Emotional direction comes from surrounding words
and context-specific constructions such as `nvm lor`, `fine lah`, `sian ah` and
`no choice lor`. This prevents both failures: missing understated distress and
turning every local particle into distress.

### How the companion uses the analysis

The Groq model is a **realisation layer**, not the scoring model. Kindred does
not fine-tune Groq or let a completion alter the stored VAD coordinates,
confidence, trend, or wellbeing score.

1. `text-features.js` deterministically measures affect, thought-language cues
   (hedging, minimisation, self-discrepancy, absolutist and temporal wording),
   behaviour/coping cues (agency and constraint), and clause-level appraisal
   (anticipated effort, situational constraint, future threat, task aversion,
   goal obstruction, pressure and physical discomfort).
2. `response-strategy.js` deterministically selects a support mode from those
   measurements: tentative clarification, understatement reflection,
   both/and reflection, frustration-and-task-aversion, contain-and-clarify,
   low-demand presence, specific affirmation, or positive savouring.
3. Groq receives the measured reading, matched dialect glossary, explicit
   emotion cause requirement, and the selected response strategy. It writes
   concise prose but cannot reverse the deterministic emotion direction.
4. `validateCompanionResponse()` rejects generic empathy clichés, clinical or
   model language, unsolicited advice, lists, excessive questions and responses
   outside the length contract. Invalid output falls back to local copy.

Appraisal evidence is combined with exponential saturation,
`E = 1 - exp(-Σwᵢ)`. It is bounded, monotone and has diminishing returns, so
repeating one slang word cannot grow a score indefinitely. A fixed,
versioned affine map then nudges VAD from the appraisal dimensions. This lets
the system distinguish low-arousal sadness from compound frustration,
activation resistance, environmental discomfort and anticipatory dread. The coefficients are
transparent research-informed engineering priors, not fitted clinical
parameters; production calibration should use consented, user-corrected
examples and report subgroup error rather than claiming universal semantics.

Short-form normalisation and construction matching happen before appraisal.
Surface spellings and replacements are retained for audit. Event transitions,
obligations, workload, activation resistance and environmental discomfort are
matched independently and then composed; no complete journal sentence is
stored as a runtime special case. Neither the deterministic layer nor Groq is
allowed to replace a cause-rich composition with a generic mood label.

### Compositional informal-language model

`informal-pragmatics.js` separates lexical affect from pragmatic function.
Fixed-affect shorthand (`fml`, `smh`, `yikes`, `slay`) contributes a bounded
VAD vector. Polyfunctional forms (`lol`, `lmao`, `wtf`, `wth`, `omg`, `gg`,
`bruh`) first receive a function such as laughter/softening, exclamation,
outcome framing or address/exasperation. Their direction is then resolved
against the surrounding proposition. Laughter beside a setback therefore
does not automatically become happiness, while the same exclamation can
intensify either a positive or negative clause.

For affect-bearing spans `xᵢ = (vᵢ,aᵢ,dᵢ)`, the lexical composition is:

```text
             Σᵢ wᵢ · mᵢ · cᵢ · xᵢ
x_lexical =  ─────────────────────────
                  κ + Σᵢ wᵢmᵢcᵢ
```

`κ = 2` is the neutral prior, `mᵢ` contains scoped negation and degree
modification, and `cᵢ` is discourse weight. A final contrastive clause receives
weight `1.18`; material before it receives `0.82`. Negated valence is shifted
and attenuated rather than mirrored. Prefix intensifiers and postfix forms such
as `af` are multiplicative and capped. Repeated punctuation and expressive
lengthening add bounded arousal only when other affect evidence exists.

Contextual markers add an explicit interaction term. An exclamation's valence
is `b + 0.18·sign(V_clause)`, where `b` is a small marker-specific bias;
laughter receives positive valence in positive context but functions mainly
as softening and arousal in negative context. The lexical result is combined
with the bounded appraisal offsets above. Every matched span, operator,
multiplier, normalization and glossary entry is returned for audit.

This is an interpretable approximation of semantic composition, not a claim
that a finite dictionary understands every possible word, community, irony or
new slang term. Neural compositional models learn phrase functions from
annotated trees or contextual embeddings; Kindred keeps the stored wellbeing
measurement deterministic and uses Groq only to realise language grounded in
inspectable features.

The response contract follows a reflection-first pattern: mention one concrete
detail, offer a tentative interpretation, then use at most one specific
exploration when it helps. A question is not compulsory. The model is told not
to imitate Singlish, infer identity from language, diagnose, overstate hidden
feelings, or jump from acknowledgement straight into solutions.

### Follow-up conversation model

`conversation-response.js` plans every “talk more” turn before Groq writes any
prose. The journal entry is background rather than a script: the latest user
turn leads, prior user turns provide continuity, and prior companion turns are
used to prevent repetition and serial questioning. Duplicate boundary turns
are removed before prompting.

For user turn `i`, the context affect vector is an evidence-adjusted,
exponentially decayed mean:

```text
w_i = exp(-0.55 age_i) · (0.35 + 0.65 confidence_i)
C_t = Σ_i w_i VAD_i / Σ_i w_i
Δ_t = VAD_latest - C_(t-1)
```

The new-information ratio is `N_t = 1 - |T_latest ∩ T_prior| / |T_latest|`,
using content-token sets after stop-word removal. The planner combines `N_t`,
`Δ_t`, the latest appraisal causes, conversational frames (for example
self-criticism, evaluation pressure, unreliable support and competing goals),
and the latest communicative intent. It then selects a reflection depth and a
hard question budget. A user who just answered a question receives a
reflection rather than another question; corrections trigger repair; direct
advice requests are answered before exploration.

Performance setbacks are represented separately from interpersonal anger.
The appraisal layer now estimates demanding-experience evidence `E`,
outcome-shortfall evidence `S`, and forward-looking hope `H` with the same
bounded saturation function used by the other dimensions:

```text
sat(x) = 1 - exp(-x)
outcomeDiscrepancy = sat(S + .35E)
goalObstruction = sat(.55 workload + .65 discomfort + .35 transition
                      + .55E + .70S)
```

A high outcome discrepancy supports disappointment; effort plus obstruction
can add frustration. It does not select an anger response unless the text also
supplies anger-relevant evidence such as blame, violation or interpersonal
conflict. Hope for a better next attempt remains a separate signal rather than
erasing the setback. Explicit user corrections (for example rejecting an
emotion the companion inferred) override stored labels and previous assistant
language; the repair is rebuilt from the user's own event and cause frames.

`conversation-memory.js` supplies selective cross-entry memory. It stores only
user-authored journal and follow-up text as evidence; earlier AI responses are
excluded so a model guess cannot become a persistent fact. For past memory `j`:

```text
R_j = .50 topic_j + .22 cause_j + .13 affect_j + .15 recency_j
recency_j = exp(-ln(2) · ageDays_j / 45)
```

Topic similarity is symmetric token overlap, cause similarity is Jaccard
overlap between appraisal frames, and affect similarity is normalized VAD
distance. A memory must pass a topical-or-causal gate as well as `R_j >= .16`;
similar mood alone cannot retrieve an unrelated entry. At most three memories
are supplied. Their combined influence on conversational VAD is capped at 30%,
so current-session language always retains at least 70% of the weight. No
eligible memory returns “no relevant memory” rather than a fabricated pattern.

This is retrieval-augmented personalization, not hidden fine-tuning: saved
entries provide relevant in-context evidence at response time. The companion
must not announce memory retrieval, infer a fixed personality, claim “you
always” from isolated entries, or repeat an old interpretation after the user
corrects it. If deployment sends retrieved text to Groq, that data handling must
be disclosed alongside the existing journal privacy controls.

Candidate replies receive an inspectable contextual-fit score:

```text
U = .35 grounding + .20 reflective inference + .18 non-repetition
  + .15 question-budget fit + .12 advice-policy fit - genericity penalty
```

A completion below `U = 0.50`, one that ignores the newest detail, or one that
breaks a hard safety/style gate is revised once. If it still fails—or Groq is
unavailable—the deterministic local response uses the same latest-turn anchor
and cause frames. It never falls back to “tell me more” copy. These coefficients
are transparent engineering priors, not learned clinical parameters; they
should eventually be calibrated against consented user ratings and corrections.

For public deployments, Groq belongs behind the authenticated Supabase Edge
Function in `supabase/functions/analyse`; `VITE_GROQ_API_KEY` remains a local
development fallback and must not be shipped in a production browser bundle.

### Research basis

The implementation translates the following findings into bounded engineering
rules; it does not treat group-level findings as facts about an individual.

- Bajpai, Poria, Ho & Cambria, *Developing a concept-level knowledge base for
  sentiment analysis in Singlish* (2017): Singlish sentiment benefits from
  concept-level and multiword expressions rather than Standard-English word
  polarity alone. [Paper](https://arxiv.org/abs/1707.04408)
- Hafiz, *Sociolinguistic variation in Colloquial Singapore English sia*
  (2024): a 6.9-million-word message corpus shows `sia`, `sial`, `siak` and
  `siol` across strong and weak illocutionary contexts. These are treated as
  context-sensitive intensity and stance, not fixed negativity.
  [Study](https://doi.org/10.1111/weng.12700)
- Wong et al., *Particle stacking in Singlish* (2023): Singlish particles
  combine and can target the addressee's attention. This supports
  longest-construction-first matching rather than isolated-particle scoring.
  [Study](https://www.sciencedirect.com/science/article/pii/S0024384123000372)
- van der Goot, *An In-depth Analysis of the Effect of Lexical Normalization
  on the Dependency Parsing of Social Media* (W-NUT 2019): normalization
  improves processing of noisy social text, while small replacement
  differences matter. Kindred retains every original surface and replacement.
  [Paper](https://aclanthology.org/D19-5515/)
- Kiritchenko & Mohammad, *The Effect of Negators, Modals, and Degree
  Adverbs on Sentiment Composition* (WASSA 2016): contextual valence
  shifters have term-specific effects. This motivates scoped attenuated
  negation and bounded degree multipliers.
  [Paper](https://aclanthology.org/W16-0410/)
- Socher et al., *Recursive Deep Models for Semantic Compositionality Over a
  Sentiment Treebank* (EMNLP 2013): phrase-level annotations show that
  longer-phrase sentiment cannot be recovered from independent word scores
  alone. Kindred uses auditable composition while Groq handles grounded
  linguistic realization. [Paper](https://aclanthology.org/D13-1170/)
- Eisenstein, *What to do about bad language on the internet* (NAACL 2013):
  forms such as `lmao` and `smh` behave as constituents and discourse cues,
  not merely misspellings. [Paper](https://aclanthology.org/N13-1037/)
- Cachola et al., *Expressively vulgar* (COLING 2018): vulgarity performs
  several pragmatic functions and modelling it explicitly improves sentiment
  analysis. Profanity is therefore an intensity operator, not automatically
  anger. [Paper](https://aclanthology.org/C18-1248/)
- Zhang et al., *Emotion classification on code-mixed text messages*
  (WASSA 2023): multilingual mixing and non-literal cues make emotion
  classification difficult, while explicit treatment of non-literal signals
  improves results. [Paper](https://aclanthology.org/2023.wassa-1.57/)
- Gustilo & Dino, *A Pragmatic Analysis of Discourse Particles in Filipino
  Computer-Mediated Communication* (2017): Filipino online particles and
  interjections carry functions such as warning, sighing, laughter and
  sarcasm. Initial Filipino entries are contextual and never infer identity.
  [Paper](https://www.researchgate.net/publication/309538627_A_Pragmatic_Analysis_of_Discourse_Particles_in_Filipino_Computer_Mediated_Communication)
- Smith & Ellsworth, *Patterns of cognitive appraisal in emotion* (1985):
  pleasantness, anticipated effort, certainty, attention, agency and
  situational control differentiate emotional experiences. These motivate
  Kindred's explicit appraisal dimensions rather than a sentiment-only score.
  [Study](https://pubmed.ncbi.nlm.nih.gov/3886875/)
- Troiano et al., *Appraisal Theories for Emotion Classification in Text*
  (COLING 2020): appraisal variables supply useful structure for text emotion
  classification beyond broad emotion labels. Kindred uses this as a design
  basis for interpretable cause-and-appraisal features.
  [Paper](https://aclanthology.org/2020.coling-main.11/)
- Anderson, Anderson, Dorr, DeNeve & Flanagan, *Temperature and aggression*
  (1995): uncomfortable heat increased hostile affect in controlled studies.
  Kindred therefore treats explicit oppressive heat as physical-discomfort
  and irritability evidence, never as proof of anger by itself.
  [Study](https://doi.org/10.1177/0146167295215002)
- Blunt & Pychyl, *Task aversiveness and procrastination* (2000): perceived
  task aversiveness varies over a project and relates to procrastination.
  This supports separating reluctance to begin an unwanted workload from
  sadness or a moral judgement of “laziness.”
  [Study](https://doi.org/10.1016/S0191-8869(99)00091-4)
- Li, Lorenz & Siemund, *The ages of pragmatic particles in Colloquial
  Singapore English* (2023): `ah`, `lah`, `leh`, `lor` and `meh` are productive
  pragmatic particles in real Singaporean speech. This supports parsing them as
  interactional signals, not tokenizer noise. [Study](https://doi.org/10.1075/eww.21016.li)
- Khoo, *An Analysis of Colloquial Singapore English lah and Its Interpretation
  across Speech Acts* (2022): the effect of `lah` emerges from semantics,
  speech act and contextual inference, so a fixed positive/negative score is
  unjustified without context. [Study](https://doi.org/10.3390/languages7030203)
- Zhang & Pell, *Cultural differences in vocal expression analysis* (2022):
  emotion recognition showed a native-language in-group advantage and cultural
  display rules affected inference. Kindred therefore uses writing variety as
  soft evidence while explicitly preserving uncertainty.
  [Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9550067/)
- Sun & Lau, *Exploring Cultural Differences in Expressive Suppression and
  Emotion Recognition* (2018): expression/suppression and its meaning vary with
  cultural context, but broad group differences were limited. This is why
  understatement raises a hypothesis and a check-back, not a culturally
  determined conclusion. [Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6205196/)
- Sharma et al., *A Computational Approach to Understanding Empathy Expressed
  in Text-Based Mental Health Support* (EMNLP 2020): strong text empathy combines
  emotional reaction, specific interpretation and specific exploration;
  advice-only responses are not empathic. These become Kindred's response-plan
  fields. [Paper](https://aclanthology.org/2020.emnlp-main.425/)
- Gao et al., *Improving Empathetic Response Generation by Recognizing Emotion
  Cause in Conversations* (2021): an emotion label alone is insufficient;
  identifying the cause improves relevant empathetic responses. Groq must now
  ground its reflection in an explicit situation from the entry or leave the
  cause empty. [Paper](https://aclanthology.org/2021.findings-emnlp.70/)
- Kim, Kim & Kim, *Perspective-taking and Pragmatics for Generating Empathetic
  Responses Focused on Emotion Causes* (EMNLP 2021): identifying cause words
  and steering generation toward those words improved focused empathy in both
  automatic and human evaluation. This motivates latest-turn anchors and the
  grounding component of Kindred's contextual-fit score.
  [Paper](https://aclanthology.org/2021.emnlp-main.170/)
- Seehausen et al., *Effects of empathic paraphrasing—extrinsic emotion
  regulation in social conflict* (2012): participants reported less-negative
  affect after empathic paraphrases than after the note-taking control. Kindred
  therefore requires a meaning-focused reflection before optional exploration,
  while preserving tentative language rather than claiming perfect empathy.
  [Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3495333/)
- Naar-King et al., *Does the quality of SafeTalk motivational interviewing
  counseling predict sexual behavior outcomes?* (2016): a higher ratio of
  reflections to questions predicted better outcomes in that study. Kindred
  uses a hard question budget and suppresses a new question immediately after
  the user has answered one. This is a conversational design signal, not a
  claim of therapeutic efficacy. [Study](https://pubmed.ncbi.nlm.nih.gov/27567497/)
- Ouyang et al., *Training language models to follow instructions with human
  feedback* (2022): demonstrations, preference rankings and an explicit reward
  model improved instruction following; scale alone did not guarantee it.
  Kindred analogously supplies an explicit response plan and evaluates the
  generated candidate instead of assuming a base model will infer the desired
  behaviour unaided. [Paper](https://cdn.openai.com/papers/Training_language_models_to_follow_instructions_with_human_feedback.pdf)
- Bai et al., *Constitutional AI: Harmlessness from AI Feedback* (2022): written
  principles plus critique-and-revision can steer assistant behaviour. Kindred
  uses a narrower inference-time version—a response constitution, deterministic
  checks and one targeted revision—without claiming to fine-tune Groq.
  [Paper](https://arxiv.org/abs/2212.08073)
- Li et al., *Hello Again! LLM-powered Personalized Agent for Long-term
  Dialogue* (NAACL 2025): multi-session dialogue memory combines semantic
  relevance, topic overlap and exponential time decay, with a retrieval
  threshold when no suitable memory exists. Kindred uses an auditable lexical
  analogue and caps history below current-session evidence.
  [Paper](https://aclanthology.org/2025.naacl-long.272/)
- Tan et al., *In Prospect and Retrospect: Reflective Memory Management for
  Long-term Personalized Dialogue Agents* (ACL 2025): irrelevant historical
  context can distract generation, motivating
  selective retrieval and reranking rather than placing every journal in the
  prompt. [Paper](https://aclanthology.org/2025.acl-long.413/)
- Anthropic, *Contextual Retrieval* (2024): contextualized retrieval and
  reranking reduced retrieval failures in its experiments, while adding more
  context can eventually distract a model. Kindred therefore retrieves a small,
  scored set rather than relying on context-window size alone.
  [Research](https://www.anthropic.com/engineering/contextual-retrieval)
- Nook et al., *Emotion Naming Impedes Both Cognitive Reappraisal and Mindful
  Acceptance Strategies of Emotion Regulation* (2021): naming an emotion before
  reappraisal sometimes made regulation less effective. Together with mixed
  affect-labeling findings, this cautions against forcing an emotion verdict in
  every reply. Kindred keeps emotion metadata internal by default and instead
  reflects the situation, conflict or blocked need, unless the user asks for
  help naming the feeling. [Study](https://pubmed.ncbi.nlm.nih.gov/36043172/)
- Motivational Interviewing Network of Trainers, *Understanding Motivational
  Interviewing* (2019): reflective listening, open questions, autonomy and
  permission before information-sharing guide the no-unsolicited-advice and
  reflection-before-question rules. [Guide](https://motivationalinterviewing.org/sites/default/files/understanding_mi_aug_2019.pdf)
- Groq, *Prompt Basics* and *Structured Outputs*: explicit role, instructions,
  context and output contracts improve consistency; JSON Object Mode provides
  valid JSON for `llama-3.3-70b-versatile`. Kindred uses a lower temperature and
  JSON Object Mode for its journal result.
  [Prompting](https://console.groq.com/docs/prompting) ·
  [Structured Outputs](https://console.groq.com/docs/structured-outputs)

## Ventures

`src/ventures/`. Turns the analysis into real activity suggestions on a
full-screen map with glowing pins and a side panel.

Activities are matched on **capacity, not diagnosis**. Reading "low mood and
isolated" and offering a group class is the classic failure; depleted people
need low-demand solo options first, and the graded exposure cap of one rung is a
hard constraint rather than a weight. At most 3 options at a time, one always
no-commitment, invitation framing.

Evidence weights are ranked honestly. Exercise is strongest, green and blue
space real but modest, volunteering good only when chosen, arts weakly
evidenced.

Supply comes from OpenStreetMap Overpass, which is free worldwide and needs no
key, and data.gov.sg. Users can host their own activity by dropping a pin on the
map.

Safety is enforced in code: first meetups default to public daytime venues,
hosts need visible history, new accounts have a cooling period, and block and
report are primitives.

## Grove

`src/grove/`. The shared 3D world.

**Social design.** Six rungs from solo through ghost, ambient, emote-only, chat
and group. Moving up always needs consent; moving down is one tap from anywhere
and is never framed as failure. No leaderboards, no sociability score, and
district unlocks depend on community totals so nobody is ever behind.

**The mall.** Four enterable buildings. Exteriors and interiors are separate
cells swapped by a door trigger behind a short fade, and only the active
interior is mounted. Interaction is proximity-based rather than raycast, since
camera hover does not map to a joystick: nearest interactable each frame, a
constant subtle bob so the world reads alive, a glow ring on approach, and the
avatar plays a real pick-up animation so the world visibly responds.

**Economy.** Cosmetics only, 20 to 110 coins, stock rotating daily. No countdown
timers, no loot boxes, no pay-to-skip, no spending leaderboards. Buying is
physical: walk to a shelf, select, confirm, and the item appears in your hands.

**Story.** A ten beat arc gated on real progress rather than time, delivered
after actions rather than blocking play. A 40 task bank tagged by emotional
tone, selected against a capacity band from the analysis layer, where social and
playful tasks are hard-excluded at low or unknown capacity. Six NPCs have
dialogue pools keyed by context, daily waypoint schedules and a friendship
counter.

The streak dims and never resets, with a floor it cannot fall below. Every task
is skippable at no cost, and showing up is worth as much as performing.

**Rendering.** Half-Lambert diffuse so round forms never crush to black, shadows
tinted cool blue-violet rather than grey, one key light plus a sky fill, and a
long 32 degree lens. Fog is set to exactly the sky dome's horizon colour, which
is the single setting that stops the scene looking washed out.

**Controls.** Arrow keys or WASD, camera-relative. The on-screen joystick is off
by default and can be turned on in Settings.

## Avatars

`src/avatar/`. One module shared by Grove and Kingdom, so a wardrobe change
appears in both without duplicated state.

```js
import { createAvatar, applyDescriptor, adaptLegacyDescriptor } from "./avatar";

const avatar = createAvatar({ species: "fox", palette, wardrobe });
applyDescriptor(avatar, next);   // diffs in place, no rebuild
```

Everything is procedural, so the repository carries no binary model assets.
Eight species, each with one defining silhouette element rather than a pile of
detail, at chibi proportions near 1:2.4. Abilities cover walk, run, jump, sit,
sleep, pick up, carry, place, wave, point, nod, shake head, clap, cheer and
dance.

Three tests guard it, and they exist because earlier versions passed a numeric
self-test while looking visibly broken. `silhouetteTest.mjs` rasterises each
species and asserts they are actually distinguishable from one another, and
`gameCameraTest.mjs` renders through the real 32 degree game camera and asserts
the eyes are present and high contrast.

## Data

Supabase Postgres with row level security on every table. Migrations are in
`supabase/migrations/`. The analysis and ventures tables currently ride the
generic `user_state` key-value store, which falls back to local storage when
offline.

`supabase/functions/analyse/` is the Edge Function that keeps the model API key
server side.

## Layout

```
src/
  analysis lives in lib/analysis/    how Kindred reads you
  avatar/                            procedural characters, shared by Grove and Kingdom
  components/                        the tab views
  grove/                             the 3D world: scene, player, interiors, economy, story
  home/                              the Lanternfall scene
  ventures/                          recommendation engine and activity supply
supabase/
  functions/analyse/                 server-side model calls
  migrations/                        schema and RLS
```

## License

MIT. See `LICENSE`.
