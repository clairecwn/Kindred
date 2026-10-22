# Kindred

Kindred is a cozy life-sim game about finding your words. Players build their own island, explore a lively town with shops and games, keep a private journal with a companion who helps them talk through their day, and find real activities to try nearby.

It is designed, in the long run, for children aged about 7 to 12, especially quieter kids who find joining in hard. The game is meant to be fun first. Underneath, it gives players low-pressure chances to name what they feel, practise saying it, play alongside other people, and carry that into real life:

```text
reflect  →  rehearse  →  play alongside  →  collaborate  →  connect in real life
```

Players set their own pace and can always step back. The app never forces them to stop playing, and it counts as a success when it becomes one helpful tool among friends, family and school, never a replacement for them.

> **Status:** working prototype. Kindred is not yet ready for children: age assurance, guardian controls, moderation and server-side model access must be finished first (see [Limits and safety](#limits-and-safety)).

## Contents

- [The game](#the-game)
- [Design principles](#design-principles)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Where things live](#where-things-live)
- [Art pipeline](#art-pipeline)
- [Journal companion](#journal-companion)
- [Limits and safety](#limits-and-safety)
- [Documentation](#documentation)
- [License](#license)
- [References](#references)

## The game

| Area | What players do |
| --- | --- |
| **Home** | The map room: continue the story, pick a route for today, jump to any world. |
| **Reflect** | Write or talk about the day. A companion responds like a friend, and My Journey shows how the days and weeks have felt. |
| **Kingdom** | Build and decorate a personal island that starts almost empty. Plants grow over real days and never wither. |
| **Grove** | A bright mall and park on an island in the sea: twelve shops, cooperative games, and other players at whatever distance feels comfortable. |
| **Ventures** | Free and low-cost real activities in Singapore to try with family, and later organised, parent-approved group events. |

Parts of this are still being built; the [blueprint](docs/product/KINDRED-VISION-AND-GAMEPLAY-BLUEPRINT.md) tracks what is planned. A storyline ties the areas together. The Grove's festival clock has twelve jammed doors, one per shop. Players open them by working out what the town's residents actually need, and each door wakes up a shop, a game and a piece of the mystery.

## Design principles

- **A game first.** Fun comes first; wellbeing comes from what players do in it.
- **Nothing is gated on feelings.** Story progress comes from finishing quests and games, never from sharing private thoughts.
- **Solo is always enough.** Every chapter can be finished alone; playing with others adds extra scenes and rewards.
- **No pressure loops.** No streaks, gacha, loot boxes, countdown timers, player rankings or guilt about time away.
- **Safety before social.** Free chat only between approved friends; strangers can only use preset emotes and phrases.
- **Honest about limits.** Emotion readings are prompts for conversation, not diagnoses.

## Getting started

Requires Node.js 20 or later.

```bash
npm install
cp .env.example .env     # add VITE_GROQ_API_KEY, then restart Vite after any .env change
npm run dev     
```

Supabase is optional for local use; without it, saves stay in the browser on one device. A `VITE_` key is visible in the browser bundle, so use one only for local testing.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build to `dist/` |
| `npm test` | All application tests |
| `npm run test:analysis` | Journal, emotion, memory and conversation policy tests |
| `npm run test:avatar` | Character model checks |
| `npm run check` | Tests, avatar checks and a production build |
| `npm run db:start` / `db:stop` | Run Supabase locally |
| `npm run db:push` | Apply migrations |
| `npm run functions:deploy` | Deploy Edge Functions |

Run every command from the repository root.

## Repository layout

```text
Kindred/
├── frontend/              Web app (React, Vite, three.js)
│   ├── index.html
│   ├── src/               App code, grouped by feature
│   └── public/            Static files served as-is, including exported 3D models
├── backend/
│   └── supabase/          Migrations, row-level security, Edge Functions, config
├── assets/                Source art: Blender files and the scripts that build them
│   ├── characters/        The five playable characters and the dressing room
│   ├── grove/             Grove mall and park
│   ├── kingdom/           Kingdom island
│   └── items/             Buyable item models shared by Grove and Kingdom
├── tools/
│   ├── blender/           Older Blender build scripts
│   ├── blender-mcp-addon/
│   └── scripts/           Node utilities
├── docs/
│   ├── product/           Vision and gameplay blueprint
│   └── companion/         Journal companion design notes and research
├── package.json           One package for the whole repo
└── vite.config.js         Points Vite at frontend/ and builds to dist/
```

## Where things live

| Area | Code | Purpose |
| --- | --- | --- |
| App shell | `frontend/src/App.jsx` | Tabs, session and shared state |
| Home | `frontend/src/home/`, `frontend/src/components/HomeView.jsx` | Map room and launch point |
| Reflect and My Journey | `frontend/src/components/WellnessView.jsx` | Journal entries, companion chat, day and week summaries |
| Companion | `frontend/src/lib/journal-ai.js` | Builds each turn, calls the assessor and writer, revises rejected drafts |
| Analysis | `frontend/src/lib/analysis/` | Text and appraisal features, topic state, memory, voice, reply checks, crisis detection |
| Model transport | `frontend/src/lib/groq.js` | Timeouts, bounded retries, fallback models and an optional Gemini route |
| Kingdom | `frontend/src/kingdom/` | Island scene, placement grid, ownership, creatures, water |
| Grove | `frontend/src/grove/` | 3D mall and park, movement and camera, interiors, economy, story, presence |
| Characters | `frontend/src/avatar/`, `frontend/src/components/CharacterView.jsx` | The five playable characters and the character screen |
| Ventures | `frontend/src/ventures/` | Activity matching, safety filters and map supply |
| Persistence | `frontend/src/hooks/useDatabaseState.js`, `backend/supabase/` | Local fallback, account storage, migrations and row-level security |
| Server analysis | `backend/supabase/functions/analyse/` | Authenticated Edge Function; the starting point for moving model calls off the client |

## Art pipeline

Every world, character and item is modelled in Blender, then exported as glTF into `frontend/public/models/`, where the game loads it.

1. Edit the source file in `assets/` (for example `assets/kingdom/blender/kingdom_island.blend`).
2. Run that area's export pass; it writes models and layout data straight into `frontend/public/models/`.
3. Run `npm test`; the Kingdom, Grove and item tests check the exported data.

The Grove, Kingdom and item `.blend` files link to each other by absolute paths under `assets/`, so keep those folders where they are.

## Journal companion

The companion is built to make someone feel heard and help them talk through what happened, in their own voice, including entries that cover several things at once. It runs as a pipeline:

```text
journal entry + latest message + earlier messages + relevant past entries
  → deterministic text, appraisal and affect features
  → semantic assessor: grounded topics, links, open questions, affect
  → dialogue policy: focus, dialogue action, question budget
  → writer: a short reply in the user's own register
  → reply critic: grounding, repetition, question purpose, advice, style
  → saved turn, updated affect and memory
```

The assessor must quote the user's exact words for every topic. Older memories can support a current concern but cannot create one, and the companion's own past guesses never count as evidence about the user. Topics persist across turns, so answering one question does not erase the rest of the entry.

The policy picks one dialogue action per turn: `VALIDATE`, `REFLECT`, `EXPLORE`, `DEEPEN`, `SHIFT`, `SUMMARISE`, `REPAIR` or `SOFT_CLOSE`. A soft close is a landing, not an ending: a new concern reopens the conversation.

The language model is used as an assessor and writer; it is not fine-tuned. The formulas below are transparent routing heuristics with hand-set weights. They are not calibrated probabilities of what a person feels or needs.

### Topic priority

Each turn, `dialogue-policy.js` scores every topic $i$ from features in $[0, 1]$: salience $S_i$, emotional intensity $I_i$, unresolvedness $U_i$, engagement $E_i$, new information $N_i$, exploration depth $D_i$, recency $R_i$ and closure readiness $C_i$.

$$
\begin{aligned}
P_i ={} & 1.50\,S_i + 1.25\,I_i + 1.15\,U_i + 0.80\,E_i + 0.55\,N_i + 0.35\,(1 - D_i) + 1.10\,R_i \\
& + 0.45\,F_i + 0.30\,L_i + \alpha_t\,A_i \\
& - 1.20\,C_i - 1.80\,\mathbb{1}_{\text{incidental}} - \nu_i - 5\,\mathbb{1}_{\text{declined}}
\end{aligned}
$$

- $F_i \in \{0, 1\}$ marks the previous focus.
- $L_i \in \{0, 1\}$ marks an explicit link to another topic.
- $A_i \in [0, 1]$ is how closely the topic matches the journal line the user opened with. Its weight is $\alpha_t = 0.6$ before the companion's first reply and $0.3$ after.
- $\nu_i = 1.7$ when a task topic has used up its question budget and the user has not asked for planning help; otherwise $0$.

Priorities become relative weights through a softmax with temperature $\tau = 0.8$:

$$
w_i = \frac{\exp\!\big((P_i - P_{\max}) / \tau\big)}{\sum_j \exp\!\big((P_j - P_{\max}) / \tau\big)}
$$

These weights rank the current agenda. They are **not** the probability that a topic is the user's real priority. Recent explicit direction from the user wins, and a switching margin stops the focus from jumping around.

Threads that matter but have not been explored carry a coverage debt:

$$
B_i = (S_i + I_i)\,U_i\,(1 - D_i)\,(1 - 0.5\,C_i)
$$

After two low-information turns on one thread, the policy can shift to the thread with the highest debt, with a closing thought and a bridge grounded in the user's words. One brief "yeah" alone does not trigger a shift.

### When to ask a question

A follow-up question needs an exact quote to ground it, a specific unknown, and a purpose. `conversation-guidance.js` scores each candidate question $q$:

$$
Q_q = 0.90\,G_q + 0.80\,R_q - 0.65\,E_q - 1.10\,P_q - 1.40\,T_q - 1.40\,K_q - 1.10\,M_q - V_q
$$

| Symbol | Meaning |
| --- | --- |
| $G_q$, $R_q$, $E_q \in \{0, 0.5, 1\}$ | Information gain, relevance, effort for the user |
| $P_q \in [0, 1]$ | Repeats something already asked or answered |
| $T_q \in \{0, 1\}$ | Task coaching the user did not ask for |
| $K_q \in \{0, 1\}$ | Low-value purpose: coping tips, mood lifting, tasks or filler |
| $M_q \in \{0, 1\}$ | No information gap named |
| $V_q = \min(v_{\max},\ 0.12\,k)$ | Variety penalty; $k$ is how often the same angle appeared in the last three questions, $v_{\max} = 0.12$ if $R_q = 1$, else $0.30$ |

The companion asks only if $Q_q \ge 0.85$ and the chosen dialogue action allows a question. Otherwise it offers a concrete thought and leaves room to reply.

### Affect

Affect is held as a vector $\mathbf{v} = (v, a, d)$ of valence, arousal and dominance (Russell's circumplex, extended). Repeated cues saturate, so repetition cannot inflate a score without limit:

$$
\operatorname{sat}(x) = \begin{cases} 1 - e^{-x} & x > 0 \\ 0 & \text{otherwise} \end{cases}
$$

`conversation-affect.js` updates from the user's own turns only. With $\hat{\mathbf{v}}_t$ the reading of turn $t$ and $c_t \in [0, 1]$ its confidence:

$$
g_t = \min\!\big(0.78,\ 0.22 + 0.64\,c_t\big), \qquad
\mathbf{v}_t = (1 - g_t)\,\mathbf{v}_{t-1} + g_t\,\hat{\mathbf{v}}_t
$$

The first supported reading sets $\mathbf{v}_1 = \hat{\mathbf{v}}_1$. A bare acknowledgement, or a turn with no affect evidence, leaves the state unchanged.

My Journey (`journey-affect.js`) averages entries within each day, then averages the days in the week, so every day gets one vote however many entries it has. For a week with entry days $\mathcal{D}$, where day $d$ has $n_d$ entries:

$$
\bar{\mathbf{v}}_d = \frac{1}{n_d} \sum_{k=1}^{n_d} \mathbf{v}_{d,k}, \qquad
\bar{\mathbf{v}}_{\text{week}} = \frac{1}{|\mathcal{D}|} \sum_{d \in \mathcal{D}} \bar{\mathbf{v}}_d
$$

Opposing readings can show as *Mixed* instead of averaging out to *Neutral*.

### Memory

`conversation-memory.js` ranks past text the user wrote by topic similarity $\sigma^{\text{topic}}_m$, shared causes $\sigma^{\text{cause}}_m$, affect similarity $\sigma^{\text{affect}}_m$ and recency $r_m$, where $\Delta t_m$ is the entry's age in days (a 45-day half-life):

$$
\text{rel}_m = 0.50\,\sigma^{\text{topic}}_m + 0.22\,\sigma^{\text{cause}}_m + 0.13\,\sigma^{\text{affect}}_m + 0.15\,r_m,
\qquad r_m = 2^{-\Delta t_m / 45}
$$

A topic or cause match is required, so a similar mood alone never pulls up an unrelated entry. `personal-memory.js` keeps source quotes for things the user states about themselves, people they name, their own terms and their communication preferences. What the user says now always outranks history.

### Voice

The writer matches how the user writes: casing, shorthand, sentence rhythm, punctuation, laughter, and casual or regional words they have actually used. Short replies carry little weight, so a single "ok" does not reset the voice. `companion-style.js` rejects therapist-style phrasing, slang the user never used, and slang pasted onto formal prose. It matches writing habits without guessing age, identity or personality.

## Limits and safety

- Text signals are hypotheses for conversation, not diagnoses. Missing context, sarcasm, dialect and model mistakes can all change a reading.
- The tests cover known failure patterns, including topic fixation, repeated questions, unsupported interpretations, style drift, and productivity prompts after someone says they are worn out. They cannot prove every live reply will feel natural.
- Crisis detection runs before any ordinary companion reply.
- **Before a public or child-facing release:**
  - model calls must move behind the server function, and players must be told clearly how journal text is sent to model providers;
  - age assurance, guardian linking, moderation, and server-enforced social permissions must be in place.

## Documentation

- [Vision and gameplay blueprint](docs/product/KINDRED-VISION-AND-GAMEPLAY-BLUEPRINT.md): audience, game loop, social and safety design, architecture and delivery plan.
- [Conversation voice and questions](docs/companion/conversation-voice-and-questions.md)
- [Dialogue policy redesign](docs/companion/research/dialogue-policy-redesign.md)
- [My Journey affect](docs/companion/journey-affect.md)
- Grove and Kingdom build notes: `assets/grove/docs/`, `assets/kingdom/docs/`

## License

MIT. See [`LICENSE`](LICENSE).

## References

This research informed the design. The coefficients above are Kindred's own, uncalibrated heuristics.

- Svikhnushina et al. (2022), [A Taxonomy of Empathetic Questions in Social Dialogs](https://aclanthology.org/2022.acl-long.211/): question purpose and function.
- Huang et al. (2017), [It Doesn't Hurt to Ask: Question-Asking Increases Liking](https://dash.harvard.edu/entities/publication/73120379-2eb6-6bd4-e053-0100007fdf3b): responsive follow-up questions.
- Welivita and Pu (2020), [A Taxonomy of Empathetic Response Intents in Human Social Conversations](https://aclanthology.org/2020.coling-main.429/): response moves beyond paraphrase.
- [Dynamic Topic Tracking and Recommendation for Long Conversations](https://aclanthology.org/2024.inlg-main.43/) (INLG 2024): noticing when a conversation shifts.
- [Language Style Matching in Large Language Models](https://aclanthology.org/2025.sigdial-1.50/) (SIGDIAL 2025): style alignment needs explicit attention.
- [Lexical Entrainment for Conversational Systems](https://aclanthology.org/2023.findings-emnlp.22/) (Findings of EMNLP 2023): adapting language in dialogue.
- Rashkin et al. (2019), [EmpatheticDialogues](https://github.com/facebookresearch/EmpatheticDialogues): corpus and baseline for grounded replies.
- Russell (1980), [A circumplex model of affect](https://doi.org/10.1037/h0077714): continuous affect representation.
