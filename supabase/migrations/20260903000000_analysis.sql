-- Kindred analysis backend schema.
--
-- Backs src/lib/analysis/*.js (see docs/backend/01-statistics-and-modelling.md
-- and docs/backend/03-architecture-and-behavioural-design.md). One row per
-- user per relevant event/day for each table below. All writes for the
-- internal/derived tables (checkin_scores, user_state_estimates, baselines,
-- text_features) are expected to come from a server-side job or Edge
-- Function using the service role, mirroring the posture already documented
-- for wellbeing_metrics in the statistics spec — the client may read its own
-- rows but should not be the sole writer of anything that feeds gating or
-- calibration decisions.
--
-- ---------------------------------------------------------------------------
-- ENCRYPTION NOTE — journal text is the most sensitive data in this product.
-- ---------------------------------------------------------------------------
-- None of these tables stores raw journal text (that already lives in
-- journal_entries per the NLP strategy doc, or in the legacy user_state
-- blob). They store DERIVED signals from it: VAD numbers, item scores,
-- filter states, feature counts, and short lexicon match spans (a matched
-- phrase like "chest tightness", not the surrounding sentence). That is a
-- deliberate scope reduction, but match spans are still potentially
-- sensitive on their own, so options for defense in depth, roughly in order
-- of effort:
--   1. Column-level encryption via pgsodium/pgcrypto (Supabase's Vault):
--      encrypt free-text columns (text_features.matches, if ever added
--      as a payload column) with a per-project or per-user key managed
--      through Supabase Vault, decrypted only in a server-side function.
--      Cheapest to add later without a schema rewrite if columns are kept
--      as `bytea`/`jsonb` with a documented "may be encrypted at rest via
--      Vault" note now.
--   2. Application-level envelope encryption: encrypt the sensitive JSON
--      payload client-side or Edge-Function-side with a per-user data key,
--      itself wrapped by a project master key in Vault. Strongest privacy
--      property (Postgres never sees plaintext) but breaks server-side
--      aggregation (population priors, cluster calibration in
--      cultural-calibration.js) unless aggregation is redesigned around
--      secure enclaves or client-side pre-aggregation.
--   3. At minimum, rely on Supabase's at-rest disk encryption plus the RLS
--      policies below, and treat `matches` payloads as short spans only
--      (never full sentences) to bound exposure if a row ever leaks.
-- Decide before shipping match-span storage in text_features at scale;
-- until then keeping only counts/ratios (no spans) in that table is the
-- safer default and is what the schema below does.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- emotion_readings: VAD points from any source (quiz, journal lexicon,
-- journal encoder, fused). See src/lib/analysis/emotion-space.js.
-- ---------------------------------------------------------------------------
create table if not exists public.emotion_readings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  entry_id     uuid,                     -- optional pointer to a journal entry row, no FK (owned elsewhere)
  recorded_at  timestamptz not null default now(),
  source       text not null check (source in ('quiz', 'journal_lexicon', 'journal_encoder', 'journal_fused')),
  valence      real not null check (valence between -1 and 1),
  arousal      real not null check (arousal between -1 and 1),
  dominance    real check (dominance between -1 and 1),
  label        text,                     -- nearest discrete emotion, display-only projection
  confidence   real check (confidence between 0 and 1),
  created_at   timestamptz not null default now()
);

create index if not exists emotion_readings_user_time_idx
  on public.emotion_readings (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- checkin_responses: raw per-item 0-3 answers, one row per (user, day, item).
-- ---------------------------------------------------------------------------
create table if not exists public.checkin_responses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  checkin_date  date not null,
  item_key      text not null check (item_key in
                  ('energy', 'mood', 'meaning', 'connection', 'accomplishment', 'sleep', 'resilience')),
  raw_score     smallint not null check (raw_score between 0 and 3),
  emotion_label text,
  created_at    timestamptz not null default now(),
  unique (user_id, checkin_date, item_key)
);

create index if not exists checkin_responses_user_date_idx
  on public.checkin_responses (user_id, checkin_date desc);

-- ---------------------------------------------------------------------------
-- checkin_scores: the derived scores for a day's check-in. See
-- src/lib/analysis/checkin-scoring.js. checkins_to_date drives the
-- cold-start gates directly (src/lib/analysis/cold-start.js).
-- ---------------------------------------------------------------------------
create table if not exists public.checkin_scores (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  checkin_date         date not null,
  wellbeing_raw        smallint,                 -- 0-21, never overwritten once written
  wellbeing_weighted   real,                      -- checkin-scoring.js weightedSum()
  wellbeing_graded     real,                      -- checkin-scoring.js gradedResponseScore()
  band                 text check (band in ('struggling', 'navigating', 'flourishing')),
  scoring_model_version text not null default 'v1-provisional-weights',
  checkins_to_date     int not null default 0,
  created_at           timestamptz not null default now(),
  unique (user_id, checkin_date)
);

create index if not exists checkin_scores_user_date_idx
  on public.checkin_scores (user_id, checkin_date desc);

-- ---------------------------------------------------------------------------
-- user_state_estimates: the OU-Kalman latent mood filter's per-day output.
-- See src/lib/analysis/state-filter.js.
-- ---------------------------------------------------------------------------
create table if not exists public.user_state_estimates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  estimate_date date not null,
  theta         real not null,   -- filtered latent mood estimate
  p_variance    real not null,   -- filter's own uncertainty about theta
  kappa         real not null,   -- mean-reversion rate used for this step
  sigma         real not null,   -- OU process volatility used for this step
  dt_days       real not null,   -- gap since the previous estimate
  innovation    real,            -- x_t - theta_pred, for offline diagnostics
  created_at    timestamptz not null default now(),
  unique (user_id, estimate_date)
);

create index if not exists user_state_estimates_user_date_idx
  on public.user_state_estimates (user_id, estimate_date desc);

-- ---------------------------------------------------------------------------
-- baselines: the two-timescale EWMA drift-trap fix, plus CUSUM state and
-- trend slopes. See src/lib/analysis/baseline.js.
-- ---------------------------------------------------------------------------
create table if not exists public.baselines (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  as_of                 date not null,
  fast_mean             real not null,
  slow_mean             real not null,
  fast_var              real not null,
  slow_var              real not null,
  drift_signal          real not null,   -- fast_mean - slow_mean
  cusum_pos             real not null default 0,
  cusum_neg             real not null default 0,
  changepoint_flag      text check (changepoint_flag in (null, 'up', 'down')),
  trend_slope_28d       real,
  trend_slope_se_28d    real,
  trend_slope_90d       real,
  trend_slope_se_90d    real,
  created_at            timestamptz not null default now(),
  unique (user_id, as_of)
);

create index if not exists baselines_user_date_idx
  on public.baselines (user_id, as_of desc);
create index if not exists baselines_changepoint_idx
  on public.baselines (as_of) where changepoint_flag is not null;

-- ---------------------------------------------------------------------------
-- text_features: deterministic NLP layer outputs. See
-- src/lib/analysis/text-features.js and cultural-calibration.js. Counts and
-- ratios only, per the encryption note above — no raw match spans stored.
-- ---------------------------------------------------------------------------
create table if not exists public.text_features (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  entry_id                uuid,           -- optional pointer to a journal entry row
  computed_at             timestamptz not null default now(),
  hedging_count           int not null default 0,
  minimisation_count      int not null default 0,
  somatic_count           int not null default 0,
  self_discrepancy_count  int not null default 0,
  absolutist_count        int not null default 0,
  absolutist_ratio        real,
  first_person_density    real,
  negation_count          int not null default 0,
  cultural_cluster        text check (cultural_cluster in ('general', 'high-context-indirect', 'dialectical-affect')),
  cluster_confidence      real check (cluster_confidence between 0 and 1),
  feature_version         text not null default 'v1',
  created_at              timestamptz not null default now()
);

create index if not exists text_features_user_time_idx
  on public.text_features (user_id, computed_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security. Every table above is per-user and must never leak
-- across users via the anon/authenticated roles.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'emotion_readings', 'checkin_responses', 'checkin_scores',
    'user_state_estimates', 'baselines', 'text_features'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$
      create policy "own rows select" on public.%I for select using (auth.uid() = user_id);
      create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id);
      create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id);
    $p$, t, t, t, t);
  end loop;
end $$;
