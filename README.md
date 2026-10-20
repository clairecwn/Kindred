# Kindred

Kindred is a journaling and wellbeing game. A journal entry opens a companion chat; My Journey shows tentative emotion summaries; Home, Kingdom, Grove, and Ventures turn reflection into private and shared activities. The companion aims to help people talk through what happened in their own voice, including entries with several concerns at once.

Built with React, Vite, Three.js, Leaflet, and optional Supabase storage. The companion currently calls Groq from the browser in local development, with an optional Gemini fallback. Its analysis and conversation rules live in this repository; the language model writes the final wording.

## Run locally

```bash
npm install
cp .env.example .env
# Add VITE_GROQ_API_KEY to .env, then restart Vite after any .env change.
npm run dev
```

Supabase URL and anon key are optional for local use. Without them, saves use browser storage on one device. A `VITE_` model key is visible in the browser bundle: use it only for local testing. The authenticated Edge Function in `supabase/functions/analyse/` is the server-side starting point for a public deployment; the current companion transport in `src/lib/groq.js` has not been moved behind it.

```bash
npm run test:analysis  # journal, emotion, memory, and conversation policy
npm test               # all application tests
npm run check          # tests, avatar checks, and production build
```

## Where things live

| Area | Code | Purpose |
| --- | --- | --- |
| Journal and Journey | `src/components/WellnessView.jsx` | Saves entries, opens chat, and displays day and week emotion summaries. |
| Companion | `src/lib/journal-ai.js` | Builds each turn, calls the assessor and writer, revises rejected drafts. |
| Analysis | `src/lib/analysis/` | Text and appraisal features, topic state, memory, voice, reply checks, and longitudinal signals. |
| Model transport | `src/lib/groq.js` | Timeouts, bounded retries, fallback models and optional Gemini route. |
| Home and Kingdom | `src/home/`, `src/kingdom/`, `src/avatar/` | Private world and shared avatar system. |
| Grove | `src/grove/` | Shared 3D world, interaction, economy, and story. |
| Ventures | `src/ventures/` | Activity matching and map supply. |
| Persistence | `src/hooks/useDatabaseState.js`, `supabase/` | Local fallback, account storage, migrations, and RLS. |

## Companion architecture

```text
Journal + latest user chat + earlier user chat + relevant past entries
  → deterministic text/appraisal and VAD features
  → semantic assessor: grounded topics, links, unresolved questions, affect
  → debrief policy: focus + dialogue action + question budget
  → writer: a short reply in the user's observed register
  → reply critic: grounding, repetition, question purpose, advice, style
  → saved chat turn + updated conversation affect and memory
```

The assessor must cite exact user text for each topic. Older memories can support a current concern but cannot create one; previous assistant guesses never become user evidence. The topic ledger persists across turns, so answering one question does not erase other parts of the entry. The policy chooses from `VALIDATE`, `REFLECT`, `EXPLORE`, `DEEPEN`, `SHIFT`, `SUMMARISE`, `REPAIR`, and `SOFT_CLOSE`. A soft close is a landing: a new user concern reopens the conversation. Topic shifts have a closing thought and a bridge.

The language model is an assessor and writer, not a trained Kindred model. We have not fine-tuned its weights. The equations below are transparent routing heuristics, not calibrated probabilities of a person's emotions or needs.

### Topic and question selection

For each topic, `dialogue-policy.js` updates salience `S`, emotional intensity `I`, unresolvedness `U`, engagement `E`, new information `N`, exploration depth `D`, recency `R`, and closure readiness `C` on every turn. Its priority is:

```text
P = 1.50S + 1.25I + 1.15U + 0.80E + 0.55N + 0.35(1-D)
  + 1.10R + 0.45 previous-focus + 0.30 explicit-link
  - 1.20C - 1.80 incidental - task-narrowing penalty
```

Settled and declined topics receive further penalties. A softmax turns priorities into relative weights for the current agenda; those weights are **not** probabilities that a topic is the user's true priority. Recent explicit direction wins, while continuity and a switch margin prevent random jumps. Linked concerns can be discussed together. An untouched meaningful thread can become the next focus before the chat lands.

Unvisited meaningful threads carry `coverageDebt = (S + I) × U × (1-D) × (1-0.5C)`. After two low-information turns on one thread, the policy can shift to a high-debt thread with a closing thought and an evidence-backed bridge. One brief agreement alone does not trigger a shift.

A possible follow-up must identify an exact grounding quote, a specific unknown, and a purpose. `conversation-guidance.js` scores information gain `G`, relevance `R`, user effort `E`, repetition `P`, task coaching `T`, low-value coping/task/mood-lift/filler purpose `C`, missing information gap `M`, and question-word repetition `V`:

```text
Q = 0.90G + 0.80R - 0.65E - 1.10P - 1.40T - 1.40C - 1.10M - V
ask only if Q ≥ 0.85 and the dialogue action permits a question
```

A relevant topic alone does not justify a question. After policy selects a focus, its grounded information gap goes to the writer with the question budget. The critic also rejects repeated, already answered, generic comfort, and unrequested productivity prompts. When a question would add little, the companion can offer a concrete thought with room to reply.

### Affect, language, and memory

`text-features.js` reads lexical, appraisal, informal-language, and dialect cues as bounded evidence. Repeated evidence saturates as `sat(x) = 1 - exp(-x)`, so repetition cannot grow a score without limit. Affect is held as valence, arousal, and dominance (VAD); mixed feelings and their causes remain separate in the experience profile. `conversation-affect.js` updates from **user** turns only:

```text
gain = min(0.78, 0.22 + 0.64 × reading_confidence)
VAD_new = (1-gain) × VAD_old + gain × VAD_user_turn
```

A first supported reading initializes the state. A bare acknowledgement or turn with no affect evidence leaves it unchanged. In My Journey, `journey-affect.js` averages entry vectors within each day, then averages the days with entries in the displayed week. This gives each day one vote regardless of entry count; opposing readings can display *Mixed* instead of *Neutral*.

`conversation-memory.js` ranks past **user-authored** journal and chat text by topic similarity, appraisal-cause overlap, VAD similarity, and recency:

```text
memory relevance = 0.50 topic + 0.22 cause + 0.13 affect + 0.15 recency
recency = exp(-ln(2) × age_days / 45)
```

A topical or causal match is required; similar mood alone cannot recall an unrelated entry. `personal-memory.js` keeps source quotes for explicit self-reports, named people, user-defined terms, communication preferences, and a compact writing profile. Its cache rebuilds when source entries change. Current words and corrections outrank historical context.

`conversation-guidance.js` measures the user's register from their entry and recent **user** turns: casing, shorthand, sentence rhythm, expressive spelling, punctuation, laughter, and observed casual or regional terms. Short answers receive little weight, so “ok” does not reset the voice. The writer gets a few user-authored style examples. `companion-style.js` checks for polished therapist language, token slang pasted onto formal prose, and slang the user did not use. It matches writing habits without inferring age, identity, or a fixed personality.

For detailed design and test rationale, see [`docs/conversation-voice-and-questions.md`](docs/conversation-voice-and-questions.md), [`docs/research/dialogue-policy-redesign.md`](docs/research/dialogue-policy-redesign.md), and [`docs/journey-affect.md`](docs/journey-affect.md).

## Limits and safety

These text signals are hypotheses for conversation, not diagnosis. Missing context, sarcasm, dialect variation, and model mistakes can change the reading. The tests cover known failure patterns, including topic fixation, repeated questions, unsupported interpretations, style drift, and productivity prompts after someone says they are worn out; they do not prove that every live model reply will feel natural. The crisis route runs before ordinary companion generation. Public deployment still needs server-side model transport and clear disclosure of how journal text is sent to providers.

## License

MIT. See `LICENSE`.

## References

The research informed design choices; the coefficients above are Kindred's own uncalibrated heuristics.

- [A Taxonomy of Empathetic Questions in Social Dialogs](https://aclanthology.org/2022.acl-long.211/) — question purpose and communicative function.
- [It Doesn't Hurt to Ask: Question-Asking Increases Liking](https://dash.harvard.edu/entities/publication/73120379-2eb6-6bd4-e053-0100007fdf3b) — responsive follow-up questions in human conversation.
- [A Taxonomy of Empathetic Response Intents in Human Social Conversations](https://aclanthology.org/2020.coling-main.429/) — varying response moves beyond paraphrase.
- [Towards Effective Long Conversation Generation with Dynamic Topic Tracking and Recommendation](https://aclanthology.org/2024.inlg-main.43/) — tracking when a conversation evolves or shifts.
- [Language Style Matching in Large Language Models](https://aclanthology.org/2025.sigdial-1.50/) — evidence that style alignment needs explicit attention.
- [Lexical Entrainment for Conversational Systems](https://aclanthology.org/2023.findings-emnlp.22/) — language adaptation in dialogue.
- [EmpatheticDialogues project](https://github.com/facebookresearch/EmpatheticDialogues) — research corpus and baseline for grounded social replies.
- [OpenAI's public Model Spec](https://openai.com/index/sharing-the-latest-model-spec/) and [Claude prompting guidance](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prompt-templates-and-variables) — public guidance on adaptable style and examples; neither publishes its complete conversation-control internals.
- [Russell's circumplex model of affect](https://doi.org/10.1037/h0077714) — continuous affect representation.
- [GitHub's README guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes) and [Google's README style guide](https://github.com/google/styleguide/blob/gh-pages/docguide/READMEs.md) — README structure.
