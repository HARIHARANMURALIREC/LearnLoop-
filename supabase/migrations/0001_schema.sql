-- LearnLoop schema. Timestamps use timestamptz (spec says "timestamp"; tz-aware is safer for decay math).

create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  goal_title text not null,
  domain_type text check (domain_type in ('technical','language','non-technical')),
  declared_level text check (declared_level in ('beginner','intermediate','advanced')),
  created_at timestamptz default now()
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  skill_name text not null,
  weight numeric check (weight between 0 and 1),
  decay_rate numeric default 1.0,
  created_at timestamptz default now()
);

create table skill_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  current_level text check (current_level in ('beginner','intermediate','advanced')),
  mastery_score numeric default 0 check (mastery_score between 0 and 100),
  last_practiced_at timestamptz,
  updated_at timestamptz default now(),
  unique (user_id, skill_id)
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  question_text text,
  answer_given text,
  correct boolean,
  confidence_rating int check (confidence_rating between 1 and 5),
  error_type text check (error_type in ('concept_gap','careless','misread')),
  is_high_confidence_wrong boolean generated always as (confidence_rating >= 4 and correct = false) stored,
  created_at timestamptz default now()
);

create table explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  style text check (style in ('analogy','step_by_step','visual')),
  explanation_text text,
  user_explained_back text,
  passed_feynman_check boolean,
  created_at timestamptz default now()
);

create table pods (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete set null,
  pod_name text,
  join_code text unique,
  created_at timestamptz default now()
);

create table pod_members (
  pod_id uuid references pods(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (pod_id, user_id)
);

create table group_challenges (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid not null references pods(id) on delete cascade,
  skill_id uuid references skills(id) on delete set null,
  question_text text,
  created_at timestamptz default now()
);

create table group_challenge_answers (
  challenge_id uuid references group_challenges(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  correct boolean,
  answered_at timestamptz default now(),
  primary key (challenge_id, user_id)
);

create table simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  simulation_type text check (simulation_type in ('conversation','client_call','interview_behavioral','interview_coding','reverse_tutor')),
  transcript jsonb default '[]'::jsonb,
  audio_url text,
  overall_feedback text,
  score numeric,
  high_confidence_wrong_moment_flagged boolean default false,
  created_at timestamptz default now()
);

create table coding_round_submissions (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references simulations(id) on delete cascade,
  problem_statement text,
  code_submitted text,
  language text,
  execution_output text,
  execution_passed boolean,
  ai_review_notes text,
  created_at timestamptz default now()
);

create table resume_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  resume_text text,
  verified_claims jsonb,
  unclaimed_practiced jsonb,
  unproven_claims jsonb,
  created_at timestamptz default now()
);

create table proof_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid references skills(id) on delete set null,
  proof_type text check (proof_type in ('practice','peer_taught','simulation_passed','explain_back_passed')),
  evidence_summary text,
  verified_at timestamptz default now()
);

create index on goals (user_id);
create index on skills (goal_id);
create index on skill_states (user_id);
create index on attempts (user_id, skill_id, created_at);
create index on proof_ledger (user_id, verified_at);

-- Auto-create profile on signup
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- RLS ----------
-- security definer helpers avoid recursive policy evaluation on pod_members
create function is_pod_member(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pod_members where pod_id = p and user_id = auth.uid())
$$;

create function shares_pod_with(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from pod_members a join pod_members b on a.pod_id = b.pod_id
    where a.user_id = auth.uid() and b.user_id = u)
$$;

create function owns_goal(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from goals where id = g and user_id = auth.uid())
$$;

alter table profiles enable row level security;
alter table goals enable row level security;
alter table skills enable row level security;
alter table skill_states enable row level security;
alter table attempts enable row level security;
alter table explanations enable row level security;
alter table pods enable row level security;
alter table pod_members enable row level security;
alter table group_challenges enable row level security;
alter table group_challenge_answers enable row level security;
alter table simulations enable row level security;
alter table coding_round_submissions enable row level security;
alter table resume_analyses enable row level security;
alter table proof_ledger enable row level security;

-- own-row tables
create policy own on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy pod_peers_read on profiles for select using (shares_pod_with(id));
create policy own on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on attempts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on simulations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on resume_analyses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on proof_ledger for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on explanations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on skill_states for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- skills: owner of the goal, plus pod-mates whose pod is tied to that goal-derived skill map
create policy own on skills for all using (owns_goal(goal_id)) with check (owns_goal(goal_id));
create policy pod_read on skills for select using (
  exists (select 1 from pods p where p.goal_id = skills.goal_id and is_pod_member(p.id)));

create policy own on coding_round_submissions for all
  using (exists (select 1 from simulations s where s.id = simulation_id and s.user_id = auth.uid()))
  with check (exists (select 1 from simulations s where s.id = simulation_id and s.user_id = auth.uid()));

-- pod-scoped
create policy pod_read on skill_states for select using (shares_pod_with(user_id));
create policy pod_read on explanations for select using (passed_feynman_check and shares_pod_with(user_id));

create policy member_read on pods for select using (is_pod_member(id));
create policy create_pod on pods for insert with check (auth.uid() is not null);

create policy member_read on pod_members for select using (is_pod_member(pod_id));
create policy join_self on pod_members for insert with check (user_id = auth.uid());
create policy leave_self on pod_members for delete using (user_id = auth.uid());

create policy member_all on group_challenges for all
  using (is_pod_member(pod_id)) with check (is_pod_member(pod_id));
create policy member_read on group_challenge_answers for select
  using (exists (select 1 from group_challenges c where c.id = challenge_id and is_pod_member(c.pod_id)));
create policy answer_self on group_challenge_answers for insert
  with check (user_id = auth.uid()
    and exists (select 1 from group_challenges c where c.id = challenge_id and is_pod_member(c.pod_id)));

-- Join by code: pods are only readable by members, so joining goes through this RPC.
create function join_pod_by_code(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from pods where join_code = upper(code);
  if pid is null then raise exception 'Invalid join code'; end if;
  insert into pod_members (pod_id, user_id) values (pid, auth.uid()) on conflict do nothing;
  return pid;
end $$;

-- Realtime for live group challenges
alter publication supabase_realtime add table group_challenge_answers, group_challenges;

-- Private bucket for resumes; objects live under <user_id>/...
insert into storage.buckets (id, name, public) values ('resumes','resumes', false) on conflict do nothing;
create policy resumes_own on storage.objects for all
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
