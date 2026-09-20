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
