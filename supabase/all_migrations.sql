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
alter table attempts add column difficulty text check (difficulty in ('beginner','intermediate','advanced'));
alter table simulations add column evaluation jsonb;

-- Overall-readiness history; feeds the deterministic Time-to-Ready projection and the progress chart.
create table mastery_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  overall numeric not null,
  created_at timestamptz default now()
);
create index on mastery_snapshots (user_id, goal_id, created_at);
alter table mastery_snapshots enable row level security;
create policy own on mastery_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pod members can see the goal their pod is built on (so they can take its diagnostic).
create policy pod_goal_read on goals for select using (
  exists (select 1 from pods p where p.goal_id = goals.id and is_pod_member(p.id)));

-- Pod creation must add the creator as a member atomically (pods are only readable by members).
create function create_pod(p_name text, p_goal uuid) returns pods
language plpgsql security definer set search_path = public as $$
declare rec pods;
begin
  if not owns_goal(p_goal) then raise exception 'Not your goal'; end if;
  insert into pods (goal_id, pod_name, join_code)
    values (p_goal, p_name, upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)))
    returning * into rec;
  insert into pod_members (pod_id, user_id) values (rec.id, auth.uid());
  return rec;
end $$;
drop policy create_pod on pods;
-- Spaced-repetition flashcards (Leitner boxes) built from questions the learner got wrong.
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  skill_id uuid references skills(id) on delete cascade,
  question_text text not null,
  correct_answer text not null,
  wrong_answer text,
  box int not null default 1 check (box between 1 and 5),
  due_at timestamptz not null default now(),
  reps int not null default 0,
  lapses int not null default 0,
  created_at timestamptz default now(),
  unique (user_id, question_text)
);
create index on flashcards (user_id, due_at);
alter table flashcards enable row level security;
create policy own on flashcards for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Saved weekly study plans.
create table study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  hours_per_week numeric,
  plan jsonb not null,
  created_at timestamptz default now()
);
create index on study_plans (user_id, goal_id, created_at);
alter table study_plans enable row level security;
create policy own on study_plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Peer mock interviews inside a pod.
create table peer_sessions (
  id uuid primary key default gen_random_uuid(),
  pod_id uuid not null references pods(id) on delete cascade,
  interviewer_id uuid not null references profiles(id) on delete cascade,
  interviewee_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'done')),
  questions jsonb not null default '[]'::jsonb,
  evaluation jsonb,
  created_at timestamptz default now(),
  check (interviewer_id <> interviewee_id)
);
create table peer_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references peer_sessions(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('interviewer', 'interviewee')),
  text text not null check (length(text) between 1 and 2000),
  created_at timestamptz default now()
);
create index on peer_messages (session_id, created_at);

create function is_peer_participant(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from peer_sessions where id = s and auth.uid() in (interviewer_id, interviewee_id))
$$;

alter table peer_sessions enable row level security;
alter table peer_messages enable row level security;
create policy pod_read on peer_sessions for select using (is_pod_member(pod_id));
create policy create_in_pod on peer_sessions for insert with check (
  interviewer_id = auth.uid() and is_pod_member(pod_id)
  and exists (select 1 from pod_members m where m.pod_id = peer_sessions.pod_id and m.user_id = interviewee_id));
-- Only the interviewer ends/scores a session, so the interviewee can't edit their own result.
create policy interviewer_update on peer_sessions for update using (auth.uid() = interviewer_id);
create policy participants_read on peer_messages for select using (is_peer_participant(session_id));
create policy participants_send on peer_messages for insert with check (sender_id = auth.uid() and is_peer_participant(session_id));
alter publication supabase_realtime add table peer_messages, peer_sessions;

-- Public, read-only snapshots of a learner's proof ledger. A snapshot (not a live view) so no private tables are exposed.
create table shared_proofs (
  slug text primary key check (slug ~ '^[a-z0-9]{8,16}$'),
  user_id uuid not null references profiles(id) on delete cascade,
  display_name text,
  goal_title text,
  entries jsonb not null,
  created_at timestamptz default now()
);
alter table shared_proofs enable row level security;
create policy public_read on shared_proofs for select to anon, authenticated using (true);
create policy owner_write on shared_proofs for insert with check (user_id = auth.uid());
create policy owner_delete on shared_proofs for delete using (user_id = auth.uid());
-- Per-user hourly usage limits, so one account can't burn the shared (free-tier) AI and voice quotas.
create table ai_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  bucket text not null,
  hour timestamptz not null,
  calls int not null default 0,
  primary key (user_id, bucket, hour)
);
alter table ai_usage enable row level security; -- no policies: only consume_quota() can touch it

-- Atomically counts one call for the signed-in user; returns false once they exceed p_limit this hour.
create function consume_quota(p_bucket text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then return false; end if;
  insert into ai_usage (user_id, bucket, hour, calls) values (auth.uid(), p_bucket, date_trunc('hour', now()), 1)
    on conflict (user_id, bucket, hour) do update set calls = ai_usage.calls + 1
    returning calls into c;
  if random() < 0.01 then delete from ai_usage where hour < now() - interval '2 days'; end if; -- housekeeping
  return c <= p_limit;
end $$;
revoke all on function consume_quota(text, int) from public, anon;
grant execute on function consume_quota(text, int) to authenticated;
-- Signup field + email preferences (welcome / reminder mails sent by the `email` Edge Function).
alter table profiles
  add column field text,
  add column welcomed_at timestamptz,
  add column email_reminders boolean not null default true,
  add column last_reminded_at timestamptz;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name, field)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          nullif(left(new.raw_user_meta_data->>'field', 60), ''));
  return new;
end $$;

-- users may not flip their own welcomed_at / last_reminded_at (the Edge Function uses the service role)
revoke update on profiles from authenticated;
grant update (display_name, field, email_reminders) on profiles to authenticated;
