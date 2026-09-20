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
