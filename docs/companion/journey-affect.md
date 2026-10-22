# Journey emotion summaries

The Journey label is a compact description of a period, not a diagnosis or a measure of wellbeing.

For an entry, Kindred uses the user's journal and chat language as a valence, arousal and dominance (VAD) reading. A grounded model observation can contribute at most 35% of the entry vector, with the user-language reading contributing 65%. Semantic labels are kept as nuance for the conversation, while the saved display label is one of Kindred's short emotion names. A bare acknowledgement contributes no new affect evidence. Historical entries with only a saved label are projected from that label's VAD anchor.

For date `d` with `n_d` entries, the day vector is the arithmetic mean of the entry vectors:

`V_d = (1 / n_d) Σ_i V_(d,i)`

The seven day summary uses one vector per day with entries, so a day with many entries has the same weight as a day with one:

`V_week = (1 / |D|) Σ_(d in D) V_d`

Only the seven local calendar dates shown in the chart belong to `D`. An empty day contributes nothing. Opposing readings whose mean is close to zero can display **Mixed** instead of **Neutral**. VAD is averaged before the short label is chosen; labels are never averaged or counted as votes.

This follows the valence/arousal representation of affect in [Russell's original circumplex paper](https://doi.org/10.1037/h0077714) and the practice of constructing day-level means from within-day observations in [daily-life affect measurement](https://pmc.ncbi.nlm.nih.gov/articles/PMC10213137/). The particular anchors, cutoffs and blending weights in Kindred are application heuristics, not validated estimates of a person's true emotion. The daily chart and weekly label should be read as tentative summaries of the words the user chose to record.
