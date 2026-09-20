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
