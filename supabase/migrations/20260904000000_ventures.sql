-- Kindred Ventures schema.
--
-- Backs src/ventures/*.js and the reworked src/components/RealWorldView.jsx.
-- Ventures closes the loop between the analysis pipeline (checkin_scores,
-- user_state_estimates -- see 20260903000000_analysis.sql) and real-world
-- activities: recommend at most 3 options matched to a user's current
-- capacity, log what was shown and what happened, and enforce the safety
-- rules in src/ventures/safety.js at the data layer too (defense in depth,
-- not just client-side checks).

-- ---------------------------------------------------------------------------
-- activities: user-hosted ventures. Live-supply (OSM/data.gov.sg) results
-- are NOT stored here -- they are fetched and cached client-side per
-- src/ventures/supply/*.js and are ephemeral, public, free data with no
-- per-user state to persist.
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id                      uuid primary key default gen_random_uuid(),
  host_id                 uuid not null references auth.users(id) on delete cascade,
  title                   text not null,
  description             text default '',
  evidence_category       text not null check (evidence_category in
                            ('exercise', 'green_blue_space', 'volunteering',
                             'arts_creative', 'social_connection', 'behavioural_activation')),
  energy_demand           text not null check (energy_demand in ('minimal', 'low', 'moderate', 'high')),
  social_intensity        smallint not null check (social_intensity between 0 and 4),
  duration_minutes        int not null default 30 check (duration_minutes > 0),
  structure               text not null default 'scheduled' check (structure in ('drop_in', 'scheduled', 'ongoing')),
  no_commitment           boolean not null default false,
  cost_amount             numeric not null default 0 check (cost_amount >= 0),
  cost_currency           text not null default 'SGD',
  indoor                  boolean not null default false,
  outdoor                 boolean not null default true,
  country                 text not null default 'SG',
  location_name           text not null default '',
  lat                     double precision,
  lng                     double precision,
  is_public_venue         boolean not null default true,
  is_daytime              boolean not null default true,
  transit_nearby          boolean not null default true,
  wheelchair_accessible   boolean,
  mobility_level_required text not null default 'any' check (mobility_level_required in ('any', 'low', 'moderate', 'high')),
  language_codes          text[] not null default array['en'],
  starts_at               timestamptz,
  capacity                int check (capacity is null or capacity > 0),
  status                  text not null default 'open' check (status in ('open', 'full', 'cancelled', 'completed')),
  created_at              timestamptz not null default now()
);

create index if not exists activities_host_idx on public.activities (host_id);
create index if not exists activities_country_idx on public.activities (country);
create index if not exists activities_starts_at_idx on public.activities (starts_at);
create index if not exists activities_status_idx on public.activities (status) where status = 'open';

-- ---------------------------------------------------------------------------
-- activity_participants: who joined what. Rosters are visible to other
-- participants before committing (safety.js visibleParticipantRoster), so
-- select policy is "anyone who can see the activity can see the roster",
-- not just the participant themself.
-- ---------------------------------------------------------------------------
create table if not exists public.activity_participants (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references public.activities(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  brought_friend boolean not null default false,
  joined_at     timestamptz not null default now(),
  attended      boolean, -- null = unknown/upcoming, set after the fact
  unique (activity_id, user_id)
);

create index if not exists activity_participants_activity_idx on public.activity_participants (activity_id);
create index if not exists activity_participants_user_idx on public.activity_participants (user_id);

-- ---------------------------------------------------------------------------
-- recommendations_shown: every recommendation set actually shown to a user,
-- with the context vector used to generate it. Feeds recommendation_outcomes
-- and the future LinUCB bandit (src/ventures/recommender.js LinUCBBandit).
-- ---------------------------------------------------------------------------
create table if not exists public.recommendations_shown (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  shown_at          timestamptz not null default now(),
  activity_ref      text not null, -- activities.id (uuid) or a live-supply id like 'osm-node-123'
  activity_source   text not null default 'user' check (activity_source in ('user', 'osm', 'datagovsg', 'seed')),
  rank              smallint not null, -- 0..2, position among the <=3 shown
  score             real,
  context_vector    jsonb not null default '{}'::jsonb, -- userContext snapshot at scoring time
  is_no_commitment  boolean not null default false
);

create index if not exists recommendations_shown_user_time_idx
  on public.recommendations_shown (user_id, shown_at desc);

-- ---------------------------------------------------------------------------
-- recommendation_outcomes: what happened afterwards. mood_before/after are
-- the wellbeing_graded values from checkin_scores nearest each timestamp,
-- copied here so bandit training doesn't need a join against a table that
-- may since have changed scoring_model_version.
-- ---------------------------------------------------------------------------
create table if not exists public.recommendation_outcomes (
  id                    uuid primary key default gen_random_uuid(),
  recommendation_id     uuid not null references public.recommendations_shown(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  joined                boolean not null default false,
  mood_before           real,
  mood_after            real,
  days_elapsed          real,
  recorded_at           timestamptz not null default now()
);

create index if not exists recommendation_outcomes_user_idx on public.recommendation_outcomes (user_id);
create index if not exists recommendation_outcomes_rec_idx on public.recommendation_outcomes (recommendation_id);

-- ---------------------------------------------------------------------------
-- host_history: visible-before-joining track record (safety.js
-- summariseHostHistory). One row per hosted activity's final status.
-- ---------------------------------------------------------------------------
create table if not exists public.host_history (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users(id) on delete cascade,
  activity_id   uuid references public.activities(id) on delete set null,
  status        text not null check (status in ('completed', 'cancelled', 'no_show')),
  created_at    timestamptz not null default now()
);

create index if not exists host_history_host_idx on public.host_history (host_id);

-- ---------------------------------------------------------------------------
-- blocks: unilateral, immediate, no justification required.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  id           uuid primary key default gen_random_uuid(),
  blocker_id   uuid not null references auth.users(id) on delete cascade,
  blocked_id   uuid not null references auth.users(id) on delete cascade,
  reason       text,
  created_at   timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);

-- ---------------------------------------------------------------------------
-- reports: never requires a matching block first.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  reported_id   uuid not null references auth.users(id) on delete cascade,
  activity_id   uuid references public.activities(id) on delete set null,
  category      text not null check (category in ('harassment', 'unsafe_venue', 'no_show', 'other')),
  details       text default '',
  status        text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  created_at    timestamptz not null default now()
);

create index if not exists reports_reported_idx on public.reports (reported_id);
create index if not exists reports_status_idx on public.reports (status) where status = 'open';

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- ---------------------------------------------------------------------------
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;
alter table public.recommendations_shown enable row level security;
alter table public.recommendation_outcomes enable row level security;
alter table public.host_history enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- activities: readable by any authenticated user (it's the whole point --
-- discoverability), writable only by the host.
create policy "activities readable by authenticated users" on public.activities
  for select using (auth.role() = 'authenticated');
create policy "host can insert own activity" on public.activities
  for insert with check (auth.uid() = host_id);
create policy "host can update own activity" on public.activities
  for update using (auth.uid() = host_id) with check (auth.uid() = host_id);
create policy "host can delete own activity" on public.activities
  for delete using (auth.uid() = host_id);

-- activity_participants: visible to any authenticated user (roster must be
-- visible before joining, per safety.js), but a row can only be written by
-- the participant themself.
create policy "rosters readable by authenticated users" on public.activity_participants
  for select using (auth.role() = 'authenticated');
create policy "user can join as self" on public.activity_participants
  for insert with check (auth.uid() = user_id);
create policy "user can update own participation" on public.activity_participants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user can leave" on public.activity_participants
  for delete using (auth.uid() = user_id);

-- recommendations_shown / recommendation_outcomes: strictly own-rows, same
-- posture as the analysis tables -- this is derived behavioural data.
create policy "own recommendations select" on public.recommendations_shown
  for select using (auth.uid() = user_id);
create policy "own recommendations insert" on public.recommendations_shown
  for insert with check (auth.uid() = user_id);

create policy "own outcomes select" on public.recommendation_outcomes
  for select using (auth.uid() = user_id);
create policy "own outcomes insert" on public.recommendation_outcomes
  for insert with check (auth.uid() = user_id);
create policy "own outcomes update" on public.recommendation_outcomes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- host_history: visible to all (track record must be visible before
-- committing to host/join), written only via the host's own completed
-- activities.
create policy "host history readable by authenticated users" on public.host_history
  for select using (auth.role() = 'authenticated');
create policy "host can insert own history" on public.host_history
  for insert with check (auth.uid() = host_id);

-- blocks: only the blocker can see or manage their own block list. A
-- blocked user never gets to see who blocked them.
create policy "own blocks select" on public.blocks
  for select using (auth.uid() = blocker_id);
create policy "own blocks insert" on public.blocks
  for insert with check (auth.uid() = blocker_id);
create policy "own blocks delete" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- reports: the reporter can see and create their own reports; nobody can
-- read a report made about them (that would defeat the point).
create policy "own reports select" on public.reports
  for select using (auth.uid() = reporter_id);
create policy "own reports insert" on public.reports
  for insert with check (auth.uid() = reporter_id);
