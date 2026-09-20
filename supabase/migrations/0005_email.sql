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
