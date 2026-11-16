-- A server-side generation invalidates previously issued SDR HMAC sessions.
alter table public.sdrs
  add column if not exists session_version integer not null default 1;

-- Rows that existed before this migration start at 1, invalidating tokens
-- already issued without an `sv` claim (which is interpreted as version 0).
-- New SDR rows use version 0 after this migration.
alter table public.sdrs
  alter column session_version set default 0;

update public.sdrs
set session_version = 0
where session_version is null;

alter table public.sdrs
  alter column session_version set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sdrs'::regclass
      and conname = 'sdrs_session_version_nonnegative'
  ) then
    alter table public.sdrs
      add constraint sdrs_session_version_nonnegative
      check (session_version >= 0);
  end if;
end;
$$;
