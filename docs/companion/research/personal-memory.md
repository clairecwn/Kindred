# Personal memory design, October 2026

Kindred already persisted journals and user chat turns and retrieved up to a few similar episodes. This missed durable communication cues and explicit self-reports when a new entry used different topic words. The new layer is a compact, rebuildable index on top of those saved sources.

## Research decisions

- [LoCoMo](https://aclanthology.org/2024.acl-long.747/) evaluates long conversations across factual recall, event summaries, and dialogue generation. A memory system needs more than a large prompt window or one recent-summary score.
- [Reflective Memory Management](https://aclanthology.org/2025.acl-long.413/) motivates storing different granularities of memory and retrieving selectively. Kindred retains source episodes and adds a compact cross-entry index rather than appending every old journal to each prompt.
- [Personalized assistants with evolving conditional memory](https://aclanthology.org/2025.coling-main.254/) evaluates continuing dialogue, learning user knowledge, and using user feedback. Kindred therefore keeps current corrections above historical claims and rebuilds its cache after source changes.
- [Fine-Tuning or Retrieval?](https://aclanthology.org/2024.emnlp-main.15.pdf) compares changing model weights with retrieving external knowledge. For private, changing user facts, retrieval keeps evidence inspectable and erasable. Kindred does not train a model on journal entries. Fine-tuning might later help a general response style, but would be a separate opt-in data and evaluation decision.
- [MADial-Bench](https://aclanthology.org/2025.naacl-long.499/) points out that retrieval accuracy alone misses dialogue quality. We test provenance, topical relevance, deletion, voice continuity, and whether a historical memory improperly sets current affect or starts a topic.

## Implementation

`personal-memory.js` reads only authored journal text and user chat turns. It saves a fingerprinted cache with historical voice features, dated self-report excerpts, user-defined slang meanings, person mentions, and short humor examples used as rhythm cues only. It does not infer diagnoses or immutable personality traits. A source edit or deletion changes the fingerprint and rebuilds the cache. Per-turn retrieval scores candidate items by query overlap and admits only relevant items; the current turn and journal override past context. The existing episode retriever remains available for details about past events.

The semantic assessor receives relevant profile quotes as historical evidence. Historical evidence may support a current topic but cannot create one and cannot label current emotion. The writer receives at most a few relevant excerpts and the style summary. No additional model call is required for memory extraction, and no journal data is used to update model weights.

The cache is persisted through the existing `user_state` key-value row, which already uses user ownership policies and row level security. [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) applies to that table; this change creates no new table or policy. A production privacy review should include the fact that relevant historical excerpts are sent to the configured generation provider along with the current entry.
