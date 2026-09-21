-- ===========================================================================
-- Ayanda Infant School — portal database for Supabase (or any Postgres)
-- ---------------------------------------------------------------------------
-- This is the same design as server/db.js, in Postgres, so a site published
-- from a GitHub branch can share one school between every account without
-- running a server of its own.
--
-- Nothing is reachable with the anon key except the portal_* functions below.
-- Every one of them resolves the caller's session to a member of staff and
-- checks the same permissions the portal draws its menus from, so a request
-- typed by hand gets the same answer as the interface.
--
-- Run this once in the Supabase SQL editor, then run seed.sql.
-- ===========================================================================

create extension if not exists pgcrypto;

-- --- storage ---------------------------------------------------------------
create table if not exists records (
  collection text not null,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted    boolean not null default false,
  primary key (collection, id)
);
create index if not exists records_collection_idx on records (collection) where not deleted;
create index if not exists records_class_idx      on records ((data->>'classId')) where not deleted;
create index if not exists records_pupil_idx      on records ((data->>'pupilId')) where not deleted;

create table if not exists settings (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- the live feed: Realtime publishes inserts here and every browser re-reads
create table if not exists changes (
  seq        bigserial primary key,
  collection text not null,
  id         text,
  op         text not null,
  by         text,
  at         timestamptz not null default now()
);

create table if not exists sessions (
  token      text primary key,
  staff_id   text not null,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_staff_idx on sessions (staff_id);

-- Passwords live here and are never selectable through any portal_* function
create table if not exists credentials (
  staff_id      text primary key,
  password_hash text not null,
  must_change  boolean not null default false,
  failed       int not null default 0,
  locked_until timestamptz
);

-- role -> permission, generated from js/permissions.js by tools/build_sql.js
-- so the database and the interface can never drift apart
create table if not exists role_permissions (
  role       text not null,
  permission text not null,
  primary key (role, permission)
);
create table if not exists locked_permissions (permission text primary key);

-- role -> tier, also generated from js/permissions.js. The tier is what stops
-- an Office Admin issuing the Head Teacher a new password and signing in as
-- her, so it belongs in the database rather than only in the interface.
create table if not exists role_tiers (
  role       text primary key,
  tier       int  not null,
  governance boolean not null default false
);

-- Attempts at a door code, by address. Postgres has no request context of its
-- own, so the address comes from the forwarded header Supabase passes through.
create table if not exists gate_attempts (
  ip       text not null,
  audience text not null,
  at       timestamptz not null default now()
);
create index if not exists gate_attempts_idx on gate_attempts (ip, audience, at);

-- --- lock everything down --------------------------------------------------
alter table records            enable row level security;
alter table settings           enable row level security;
alter table changes            enable row level security;
alter table sessions           enable row level security;
alter table credentials        enable row level security;
alter table role_permissions   enable row level security;
alter table locked_permissions enable row level security;
alter table role_tiers         enable row level security;
alter table gate_attempts      enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- The one thing a browser may read directly is the change feed, so Realtime
-- can push it. It carries only a collection name and an id — never content.
create policy changes_read on changes for select to anon, authenticated using (true);
grant select on changes to anon, authenticated;

alter publication supabase_realtime add table changes;

-- ===========================================================================
-- Helpers
-- ===========================================================================

-- The token arrives as a request header set by js/api.js.
create or replace function portal_token() returns text language sql stable as $$
  select nullif(current_setting('request.headers', true)::json->>'x-portal-token', '')
$$;

create or replace function portal_staff() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_staff_id text; v_row jsonb;
begin
  select staff_id into v_staff_id from sessions
   where token = portal_token() and expires_at > now();
  if v_staff_id is null then return null; end if;
  select data into v_row from records
   where collection = 'staff' and id = v_staff_id and not deleted;
  if v_row is null or coalesce((v_row->>'active')::boolean, false) = false then return null; end if;
  return v_row;
end $$;

create or replace function portal_require_staff() returns jsonb
language plpgsql stable as $$
declare v jsonb;
begin
  v := portal_staff();
  if v is null then
    /* A guardian's token resolves to nothing here, and that is the point: it
       cannot reach a staff function by being passed to one. */
    if portal_guardian() is not null then
      raise exception 'The family portal does not reach that part of the school.' using errcode = '42501';
    end if;
    raise exception 'Please sign in again.' using errcode = '28000';
  end if;
  return v;
end $$;

-- --- the family portal's side of a session --------------------------------
-- A guardian's account is not a staff record. It lives in its own collection,
-- shares the session and credential tables, and reaches nothing but the
-- children named on it.
create or replace function portal_guardian() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_id text; v_row jsonb;
begin
  select staff_id into v_id from sessions
   where token = portal_token() and expires_at > now();
  if v_id is null then return null; end if;
  select data into v_row from records
   where collection = 'guardians' and id = v_id and not deleted;
  if v_row is null or coalesce((v_row->>'active')::boolean, false) = false then return null; end if;
  return v_row;
end $$;

create or replace function portal_require_guardian() returns jsonb
language plpgsql stable as $$
declare v jsonb;
begin
  v := portal_guardian();
  if v is null then raise exception 'Please sign in again.' using errcode = '28000'; end if;
  return v;
end $$;

-- Which children this account may reach, and nothing else in the school.
create or replace function portal_family_owns(p_guardian jsonb, p_pupil_id text) returns boolean
language sql immutable as $$
  select coalesce(p_guardian->'pupilIds' ? p_pupil_id, false)
$$;

-- role defaults + grants - revokes, with locked permissions following the role
create or replace function portal_can(p_staff jsonb, p_permission text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_has boolean; v_locked boolean;
begin
  if p_permission is null then return true; end if;
  select exists (select 1 from locked_permissions where permission = p_permission) into v_locked;
  select exists (
    select 1 from role_permissions
     where role = p_staff->>'role' and permission = p_permission
  ) into v_has;
  if v_locked then return v_has; end if;
  if p_staff->'revokes' ? p_permission then return false; end if;
  if p_staff->'grants'  ? p_permission then return true;  end if;
  return v_has;
end $$;

create or replace function portal_require(p_staff jsonb, p_permission text) returns void
language plpgsql stable as $$
begin
  if not portal_can(p_staff, p_permission) then
    raise exception 'Your role does not include "%".', p_permission using errcode = '42501';
  end if;
end $$;

create or replace function portal_note(p_collection text, p_id text, p_op text, p_by text) returns bigint
language sql security definer set search_path = public as $$
  insert into changes (collection, id, op, by) values (p_collection, p_id, p_op, p_by) returning seq
$$;

create or replace function portal_audit(p_staff jsonb, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id text := 'au_' || replace(gen_random_uuid()::text, '-', '');
begin
  insert into records (collection, id, data, updated_by)
  values ('audit', v_id, jsonb_build_object('id', v_id, 'at', now(), 'by', p_staff->>'id', 'action', p_action), p_staff->>'id');
  perform portal_note('audit', v_id, 'put', p_staff->>'id');
end $$;

-- --- which classes a person may work with ---------------------------------
create or replace function portal_scope(p_staff jsonb) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v_all text[]; v_scope text; v_out text[];
begin
  select array_agg(c->>'id') into v_all from jsonb_array_elements((select data from settings where key = 'classes')) c;
  select case when p_staff->>'role' in ('director','secretary','head','deputy','hr','bursar') then 'all' else 'own' end into v_scope;
  if v_scope = 'all' or p_staff->'grants' ? 'scope.all' then return v_all; end if;

  -- own class, plus every class they teach through a teaching team
  select array_agg(distinct x) into v_out from (
    select c->>'id' as x from jsonb_array_elements((select data from settings where key = 'classes')) c
     where c->>'teacherId' = p_staff->>'id' or c->>'assistantId' = p_staff->>'id'
    union
    select cls.key from jsonb_each((select data from settings where key = 'timetable')) cls,
         jsonb_each(cls.value) day, jsonb_array_elements(day.value) cell
     where cell->>'t' in (
       select t->>'id' from jsonb_array_elements((select data from settings where key = 'teams')) t
        where t->>'teacherId' = p_staff->>'id' or t->>'assistantId' = p_staff->>'id')
  ) s;
  return coalesce(v_out, '{}');
end $$;

-- ===========================================================================
-- The API — the only things a browser may call
-- ===========================================================================

-- Sign in with the school email address and a password. The comparison happens
-- inside the database; the hash never travels. A wrong address and a wrong
-- password give the same answer, so this cannot be used to find out who works
-- here.
create or replace function portal_login(p_email text, p_password text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cred credentials%rowtype; v_who jsonb; v_kind text; v_token text;
  v_same constant text := 'Those sign-in details are not recognised.';
begin
  -- Staff first: somebody who both works here and has a child here signs in to
  -- the staff account, which is the wider of the two.
  select data into v_who from records
   where collection = 'staff' and not deleted
     and lower(data->>'email') = lower(trim(p_email));
  v_kind := 'staff';

  if v_who is null then
    select data into v_who from records
     where collection = 'guardians' and not deleted
       and lower(data->>'email') = lower(trim(p_email));
    v_kind := 'family';
  end if;

  if v_who is null or coalesce((v_who->>'active')::boolean, false) = false then
    perform crypt(p_password, gen_salt('bf', 12));   -- same work, so the timing says nothing
    return jsonb_build_object('error', v_same);
  end if;

  select * into v_cred from credentials where staff_id = v_who->>'id';
  if not found then
    perform crypt(p_password, gen_salt('bf', 12));
    return jsonb_build_object('error', v_same);
  end if;

  if v_cred.locked_until is not null and v_cred.locked_until > now() then
    return jsonb_build_object('error', 'This account is locked after repeated failed attempts. Try again shortly.');
  end if;

  if v_cred.password_hash <> crypt(p_password, v_cred.password_hash) then
    update credentials set failed = failed + 1,
           locked_until = case when failed + 1 >= 6 then now() + interval '15 minutes' else null end
     where staff_id = v_who->>'id';
    return jsonb_build_object('error', v_same);
  end if;

  update credentials set failed = 0, locked_until = null where staff_id = v_who->>'id';
  v_token := encode(gen_random_bytes(32), 'base64');
  insert into sessions (token, staff_id, expires_at) values (v_token, v_who->>'id', now() + interval '14 days');

  if v_kind = 'family' then
    update records set data = data || jsonb_build_object('lastSeen', now())
     where collection = 'guardians' and id = v_who->>'id';
    return jsonb_build_object('token', v_token, 'kind', 'family',
      'account', v_who - 'pin' - 'password', 'mustChange', v_cred.must_change);
  end if;

  perform portal_audit(v_who, 'Signed in');
  return jsonb_build_object('token', v_token, 'kind', 'staff',
    'staff', v_who - 'pin' - 'password', 'mustChange', v_cred.must_change);
end $$;

-- --- handing out a way in --------------------------------------------------
-- The same rule as js/permissions.js: you may issue an account at your own
-- tier or below and never above, and the governance tier stays sealed to the
-- governance tier.
create or replace function portal_can_issue_role(p_actor jsonb, p_role text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_actor_tier int; v_role_tier int; v_gov boolean; v_actor_gov boolean;
begin
  if not portal_can(p_actor, 'accounts.manage') then return false; end if;
  select tier, governance into v_role_tier, v_gov from role_tiers where role = p_role;
  if v_role_tier is null then return false; end if;
  select coalesce(tier, 99), coalesce(governance, false) into v_actor_tier, v_actor_gov
    from role_tiers where role = p_actor->>'role';
  if v_gov then return coalesce(v_actor_gov, false); end if;
  return v_role_tier >= coalesce(v_actor_tier, 99);
end $$;

create or replace function portal_can_issue_account(p_actor jsonb, p_target jsonb) returns boolean
language sql stable as $$
  select case when p_actor->>'id' = p_target->>'id' then false
              else portal_can_issue_role(p_actor, p_target->>'role') end
$$;

-- A password chosen by whoever is issuing it, or generated when they leave the
-- field empty. Always must-change, so it lives only until its first use.
create or replace function portal_issued_password(p_chosen text) returns text
language plpgsql volatile as $$
declare v text := coalesce(trim(p_chosen), '');
begin
  if v = '' then
    return lower(encode(gen_random_bytes(9), 'hex')) || (10 + floor(random() * 90))::int::text;
  end if;
  if length(v) < 8 or v !~ '[a-zA-Z]' or v !~ '[0-9]' then
    raise exception 'A password must be at least 8 characters and include a letter and a number.';
  end if;
  return v;
end $$;

create or replace function portal_logout() returns jsonb
language sql security definer set search_path = public as $$
  delete from sessions where token = portal_token(); select '{"ok":true}'::jsonb;
$$;

-- Changing your own needs the current one. A colleague's can only be replaced
-- with a temporary one — chosen or generated, but always must-change, so
-- nobody sets a password somebody else will keep, and nobody reads one back.
create or replace function portal_set_password(p_staff_id text, p_password text, p_current text default null,
                                              p_must_change boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_self boolean; v_cred credentials%rowtype; v_target jsonb; v_issued text;
begin
  v_me := portal_require_staff();
  /* Changing your own comes through with no id at all, so an absent one means
     yourself. Left as null it would fall to the other branch and look for an
     account that does not exist. */
  if coalesce(p_staff_id, '') = '' then p_staff_id := v_me->>'id'; end if;
  v_self := (v_me->>'id') = p_staff_id;

  if v_self then
    if length(p_password) < 8 or p_password !~ '[a-zA-Z]' or p_password !~ '[0-9]' then
      raise exception 'A password must be at least 8 characters and include a letter and a number.';
    end if;
    select * into v_cred from credentials where staff_id = p_staff_id;
    if v_cred.password_hash <> crypt(coalesce(p_current, ''), v_cred.password_hash) then
      raise exception 'Your current password is not correct.' using errcode = '42501';
    end if;
    v_issued := p_password;
  else
    select data into v_target from records where collection = 'staff' and id = p_staff_id and not deleted;
    if v_target is null then raise exception 'That account does not exist.'; end if;
    -- Not permissions.manage: issuing a sign-in is the office's job, and the
    -- tier is what stops it travelling upwards.
    if not portal_can_issue_account(v_me, v_target) then
      raise exception '% % sits at or above your own level, so you cannot reset their sign-in.',
        v_target->>'first', v_target->>'last' using errcode = '42501';
    end if;
    v_issued := portal_issued_password(p_password);
    delete from sessions where staff_id = p_staff_id;
  end if;

  -- Changing your own never forces anything. Issuing somebody else's forces
  -- it only when the issuer asked: a password the office chose is one the
  -- office knows, but whether that warrants a forced change is the school's
  -- call per account rather than a rule imposed on everybody.
  insert into credentials (staff_id, password_hash, must_change)
  values (p_staff_id, crypt(v_issued, gen_salt('bf', 12)),
          case when v_self then false else coalesce(p_must_change, false) end)
    on conflict (staff_id) do update set password_hash = excluded.password_hash,
      must_change = excluded.must_change, failed = 0, locked_until = null;

  perform portal_audit(v_me, case when v_self then 'Changed own password'
    else 'Reset the sign-in for ' || (v_target->>'first') || ' ' || (v_target->>'last') end);

  if v_self then return '{"ok":true}'::jsonb; end if;
  return jsonb_build_object('ok', true, 'temporaryPassword', v_issued,
    'email', v_target->>'email', 'name', (v_target->>'first') || ' ' || (v_target->>'last'));
end $$;

-- A guardian changing their own. There is no other branch: a family account is
-- reset from the pupil's record by the office, not from here.
create or replace function portal_family_set_password(p_current text, p_password text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_g jsonb; v_cred credentials%rowtype;
begin
  v_g := portal_require_guardian();
  if length(p_password) < 8 or p_password !~ '[a-zA-Z]' or p_password !~ '[0-9]' then
    raise exception 'A password must be at least 8 characters and include a letter and a number.';
  end if;
  select * into v_cred from credentials where staff_id = v_g->>'id';
  if v_cred.password_hash <> crypt(coalesce(p_current, ''), v_cred.password_hash) then
    raise exception 'Your current password is not correct.' using errcode = '42501';
  end if;
  update credentials set password_hash = crypt(p_password, gen_salt('bf', 12)),
    must_change = false, failed = 0, locked_until = null
   where staff_id = v_g->>'id';
  return '{"ok":true}'::jsonb;
end $$;

-- --- reading the world -----------------------------------------------------
-- Exactly what this person may see, already narrowed to their classes, in the
-- shape the browser expects. What is withheld is not sent at all.
create or replace function portal_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me jsonb; v_out jsonb := '{}'::jsonb; v_scope text[]; v_med boolean;
  v_access jsonb := '{
    "staff":"staff.view","pupils":"pupils.view","attendance":"attendance.view","messages":"messages.view",
    "channels":"messages.view","documents":"documents.view","events":"calendar.view","welfare":"welfare.view",
    "vacancies":"recruitment.view","candidates":"recruitment.view","applicants":"admissions.view",
    "assessments":"gradebook.view","invoices":"billing.view","payments":"billing.view","comms":"comms.view",
    "alumni":"alumni.view","integrations":"integrations.manage","board":"governance.view",
    "statutory":"governance.statutory","budget":"finance.oversight","projects":"strategy.manage","audit":"audit.view",
    "guardians":"portal.view","absences":"attendance.view"}'::jsonb;
  v_scoped text[] := array['pupils','attendance','assessments','welfare'];
  k text; v_perm text; v_rows jsonb;
begin
  v_me := portal_require_staff();
  v_scope := portal_scope(v_me);
  v_med := portal_can(v_me, 'pupils.view_medical');

  -- single documents everyone needs to render a page
  for k in select key from settings loop
    -- The door codes are hashed, but a hash is still a thing to attack offline
    -- and nothing on any page needs it. It is never in a response to begin with.
    if k = 'gate' then
      continue;
    elsif k = 'reads' then
      select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_rows
        from settings s, jsonb_each(s.data) e where s.key = 'reads' and e.key like (v_me->>'id') || '|%';
      v_out := v_out || jsonb_build_object('reads', v_rows);
    else
      v_out := v_out || jsonb_build_object(k, (select data from settings where key = k));
    end if;
  end loop;

  foreach k in array array(select jsonb_object_keys(v_access)) loop
    v_perm := v_access->>k;
    if not portal_can(v_me, v_perm) then v_out := v_out || jsonb_build_object(k, '[]'::jsonb); continue; end if;

    if k = 'attendance' then
      select coalesce(jsonb_object_agg(r.id, r.data), '{}'::jsonb) into v_rows
        from records r
        join records p on p.collection = 'pupils' and p.id = split_part(r.id, '|', 3) and not p.deleted
       where r.collection = 'attendance' and not r.deleted and (p.data->>'classId') = any(v_scope);
      v_out := v_out || jsonb_build_object('attendance', v_rows);
      continue;
    end if;

    select coalesce(jsonb_agg(
             case when k = 'pupils' and not v_med
                  then data || '{"medical":{"allergies":"","conditions":"","doctor":"","restricted":true}}'::jsonb
                  when k = 'staff' then data - 'pin'
                  else data end), '[]'::jsonb) into v_rows
      from records
     where collection = k and not deleted
       and (not (k = any(v_scoped)) or (data->>'classId') = any(v_scope) or data->>'classId' is null);
    v_out := v_out || jsonb_build_object(k, v_rows);
  end loop;

  -- names are needed to render anything, even without staff.view
  if jsonb_array_length(v_out->'staff') = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('id', data->>'id','first',data->>'first','last',data->>'last',
      'title',data->>'title','role',data->>'role','active',data->'active',
      'grants','[]'::jsonb,'revokes','[]'::jsonb,'extraClasses','[]'::jsonb)), '[]'::jsonb) into v_rows
      from records where collection = 'staff' and not deleted;
    v_out := v_out || jsonb_build_object('staff', v_rows);
  end if;

  -- absence notes name a pupil rather than a class, so they are scoped here
  if portal_can(v_me, 'attendance.view') then
    select coalesce(jsonb_agg(a.data), '[]'::jsonb) into v_rows
      from records a
      join records p on p.collection = 'pupils' and p.id = a.data->>'pupilId' and not p.deleted
     where a.collection = 'absences' and not a.deleted and (p.data->>'classId') = any(v_scope);
    v_out := v_out || jsonb_build_object('absences', v_rows);
  end if;

  -- whether each door has a code, for the Settings page. Never the code.
  if portal_can(v_me, 'settings.manage') then
    v_out := v_out || jsonb_build_object('gateStatus', portal_gate_detail());
  end if;

  return v_out || jsonb_build_object('me', v_me->>'id', 'serverSeq', coalesce((select max(seq) from changes), 0), 'now', now());
end $$;

-- --- writing ---------------------------------------------------------------
create or replace function portal_put(p_collection text, p_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me jsonb; v_write text; v_existing jsonb; v_scope text[]; v_issued text;
  v_writes jsonb := '{
    "staff":"staff.manage","pupils":"pupils.edit","attendance":"attendance.mark","messages":"messages.send",
    "channels":"messages.broadcast","documents":"documents.upload","events":"calendar.manage","welfare":"welfare.log",
    "vacancies":"recruitment.manage","candidates":"recruitment.manage","applicants":"admissions.manage",
    "assessments":"gradebook.mark","invoices":"billing.manage","payments":"billing.manage","comms":"comms.send",
    "alumni":"alumni.manage","integrations":"integrations.manage","board":"governance.manage",
    "statutory":"governance.statutory","budget":"finance.oversight","projects":"strategy.manage",
    "guardians":"portal.manage","absences":"attendance.mark"}'::jsonb;
begin
  v_me := portal_require_staff();
  if p_collection = 'audit' then raise exception 'The audit log is written by the system, not by hand.'; end if;
  v_write := v_writes->>p_collection;
  if v_write is null then raise exception 'Unknown collection "%".', p_collection; end if;

  select data into v_existing from records where collection = p_collection and id = p_id and not deleted;

  -- Setting somebody up is its own permission, which the office holds and
  -- which carries no right to change anyone's role afterwards.
  if p_collection = 'staff' and v_existing is null then
    perform portal_require(v_me, 'accounts.manage');
    if not portal_can_issue_role(v_me, p_data->>'role') then
      raise exception 'You can set up an account at your own level or below, not above it.' using errcode = '42501';
    end if;
    if coalesce(trim(p_data->>'email'), '') = '' then
      raise exception 'A school email address is needed — it is how they sign in.';
    end if;
    if exists (select 1 from records where collection in ('staff','guardians') and not deleted
                and lower(data->>'email') = lower(trim(p_data->>'email'))) then
      raise exception 'That email address is already in use at the school.';
    end if;
    v_issued := portal_issued_password(p_data->>'password');
    p_data := (p_data - 'password') || jsonb_build_object('active', true,
      'grants', '[]'::jsonb, 'revokes', '[]'::jsonb, 'extraClasses', '[]'::jsonb);
    insert into records (collection, id, data, updated_by) values ('staff', p_id, p_data, v_me->>'id');
    insert into credentials (staff_id, password_hash, must_change)
    values (p_id, crypt(v_issued, gen_salt('bf', 12)), coalesce((p_data->>'mustChange')::boolean, false))
      on conflict (staff_id) do update set password_hash = excluded.password_hash,
        must_change = excluded.must_change, failed = 0, locked_until = null;
    perform portal_note('staff', p_id, 'put', v_me->>'id');
    perform portal_audit(v_me, 'Added ' || (p_data->>'first') || ' ' || (p_data->>'last') || ' as ' || (p_data->>'role'));
    return p_data || jsonb_build_object('temporaryPassword', v_issued);
  end if;

  perform portal_require(v_me, v_write);

  -- classes you do not work with stay out of reach
  if p_collection = 'absences' then
    v_scope := portal_scope(v_me);
    if not exists (select 1 from records p where p.collection = 'pupils' and not p.deleted
                    and p.id = coalesce(p_data->>'pupilId', v_existing->>'pupilId')
                    and (p.data->>'classId') = any(v_scope)) then
      raise exception 'That record is outside the classes you work with.' using errcode = '42501';
    end if;
  end if;
  if p_collection in ('pupils','assessments','welfare') then
    v_scope := portal_scope(v_me);
    if coalesce(p_data->>'classId', v_existing->>'classId') is not null
       and not (coalesce(p_data->>'classId', v_existing->>'classId') = any(v_scope)) then
      raise exception 'That record is outside the classes you work with.' using errcode = '42501';
    end if;
  end if;

  -- a role-locked permission follows the role and is not grantable
  if p_collection = 'staff' then
    if exists (select 1 from locked_permissions lp
                where (p_data->'grants') ? lp.permission or (p_data->'revokes') ? lp.permission) then
      raise exception 'That permission follows the role and cannot be granted or revoked.' using errcode = '42501';
    end if;
    if (v_existing->>'role') in ('director','secretary') and (v_me->>'role') not in ('director','secretary') then
      raise exception 'You cannot change this person''s access.' using errcode = '42501';
    end if;
    p_data := p_data - 'pin';
  end if;

  insert into records (collection, id, data, updated_by)
  values (p_collection, p_id, coalesce(v_existing, '{}'::jsonb) || p_data, v_me->>'id')
  on conflict (collection, id) do update
    set data = records.data || excluded.data, updated_at = now(), updated_by = excluded.updated_by, deleted = false;

  perform portal_note(p_collection, p_id, 'put', v_me->>'id');
  return (select data from records where collection = p_collection and id = p_id);
end $$;

create or replace function portal_delete(p_collection text, p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me jsonb;
begin
  v_me := portal_require_staff();
  if p_collection in ('staff','audit') then raise exception 'That record cannot be deleted.'; end if;
  perform portal_require(v_me, 'pupils.add');
  update records set deleted = true, updated_at = now(), updated_by = v_me->>'id'
   where collection = p_collection and id = p_id;
  perform portal_note(p_collection, p_id, 'delete', v_me->>'id');
  perform portal_audit(v_me, 'Deleted ' || p_collection || ' ' || p_id);
  return '{"ok":true}'::jsonb;
end $$;

create or replace function portal_setting(p_key text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_perm text;
begin
  v_me := portal_require_staff();
  if p_key = 'reads' then
    update settings set data = data || p_data, updated_at = now() where key = 'reads';
    return p_data;
  end if;
  v_perm := (('{"school":"settings.manage","classes":"staff.manage","teams":"timetable.manage",
    "timetable":"timetable.manage","gradeScale":"gradebook.scale","feeItems":"config.manage",
    "feeRules":"config.manage","docCategories":"documents.manage","commTemplates":"comms.send",
    "intakes":"config.manage","strategy":"strategy.manage"}'::jsonb)->>p_key);
  if v_perm is null then raise exception 'Unknown setting "%".', p_key; end if;
  perform portal_require(v_me, v_perm);
  insert into settings (key, data, updated_by) values (p_key, p_data, v_me->>'id')
    on conflict (key) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by;
  perform portal_note('settings', p_key, 'put', v_me->>'id');
  perform portal_audit(v_me, 'Updated ' || p_key);
  return p_data;
end $$;

-- ===========================================================================
-- The family & student portal
-- ---------------------------------------------------------------------------
-- The staff read above starts from the whole school and removes what the
-- person may not see. This one starts from a named list of pupil ids and adds
-- nothing else, so there is no query a signed-in parent can make that reaches
-- another family's child: the school is never assembled in the first place.
--
-- It is the same payload js/family.js builds for the Node server and for demo
-- mode, so the portal cannot behave one way published and another way locally.
-- ===========================================================================

create or replace function portal_staff_name(p_id text) returns text
language sql stable security definer set search_path = public as $$
  select trim(coalesce(data->>'title','') || ' ' || (data->>'first') || ' ' || (data->>'last'))
    from records where collection = 'staff' and id = p_id and not deleted
$$;

-- Attendance this term. The headline is morning registration, because that is
-- the figure the school reports; the list underneath is every period the child
-- was not marked present, which is the one a parent asks about.
create or replace function portal_family_attendance(p_pupil_id text, p_term jsonb, p_today date, p_periods jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_start date; v_present int; v_total int; v_counts jsonb; v_marks jsonb; v_days int;
begin
  v_start := nullif(p_term->>'start', '')::date;
  if v_start is null then v_start := p_today; end if;

  select count(*) filter (where r.data->>'status' in ('P','L')), count(*),
         jsonb_build_object(
           'P', count(*) filter (where r.data->>'status' = 'P'),
           'A', count(*) filter (where r.data->>'status' = 'A'),
           'L', count(*) filter (where r.data->>'status' = 'L'),
           'E', count(*) filter (where r.data->>'status' = 'E'))
    into v_present, v_total, v_counts
    from records r
   where r.collection = 'attendance' and not r.deleted
     and split_part(r.id, '|', 3) = p_pupil_id
     and split_part(r.id, '|', 2) = 'reg'
     and split_part(r.id, '|', 1)::date between v_start and p_today;

  -- newest first, and the cut happens after the sort rather than before it
  select coalesce(jsonb_agg(s.m order by s.d desc, s.t), '[]'::jsonb) into v_marks
    from (
      select split_part(r.id, '|', 1) as d,
             coalesce(lp.e->>'start', '') as t,
             jsonb_build_object(
               'date', split_part(r.id, '|', 1),
               'periodId', split_part(r.id, '|', 2),
               'period', coalesce(lp.e->>'label', split_part(r.id, '|', 2)),
               'time', coalesce(lp.e->>'start', ''),
               'status', r.data->>'status',
               'note', coalesce(r.data->>'note', '')) as m
        from records r
        left join lateral (
          select e from jsonb_array_elements(p_periods) e
           where e->>'id' = split_part(r.id, '|', 2) limit 1
        ) lp on true
       where r.collection = 'attendance' and not r.deleted
         and split_part(r.id, '|', 3) = p_pupil_id
         and r.data->>'status' <> 'P'
         and split_part(r.id, '|', 1)::date >= v_start
       order by split_part(r.id, '|', 1) desc, coalesce(lp.e->>'start', '')
       limit 60
    ) s;

  select count(*) into v_days
    from generate_series(v_start, p_today, interval '1 day') d
   where extract(isodow from d) < 6;

  return jsonb_build_object(
    'present', coalesce(v_present, 0), 'total', coalesce(v_total, 0),
    'counts', coalesce(v_counts, '{"P":0,"A":0,"L":0,"E":0}'::jsonb),
    'schoolDays', coalesce(v_days, 0),
    'pct', case when coalesce(v_total, 0) = 0 then 0 else round(v_present::numeric * 100 / v_total) end,
    'marks', coalesce(v_marks, '[]'::jsonb));
end $$;

-- Marks, weighted exactly as the gradebook weights them, with every assessment
-- behind the figure rather than only the figure.
create or replace function portal_family_subjects(p_pupil_id text, p_class_id text, p_grade text,
  p_scale jsonb, p_assessed jsonb, p_kinds jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_band text; v_out jsonb := '[]'::jsonb; v_subject text;
  v_pieces jsonb; v_num numeric; v_den numeric; v_pct int; v_grade jsonb;
begin
  v_band := case when p_grade like 'ECD%' then 'ecd' else 'grade' end;

  for v_subject in select jsonb_array_elements_text(p_assessed->v_band) loop
    select coalesce(jsonb_agg(x.piece order by x.date), '[]'::jsonb),
           sum(x.weighted), sum(x.weight)
      into v_pieces, v_num, v_den
      from (
        select a.data->>'date' as date,
               ((a.data->'marks'->>p_pupil_id)::numeric / (a.data->>'max')::numeric)
                 * coalesce((k.e->>'weight')::numeric, 1) as weighted,
               coalesce((k.e->>'weight')::numeric, 1) as weight,
               jsonb_build_object(
                 'id', a.data->>'id', 'name', a.data->>'name', 'date', a.data->>'date',
                 'kind', coalesce(k.e->>'label', a.data->>'kind'),
                 'mark', (a.data->'marks'->>p_pupil_id)::numeric,
                 'max', (a.data->>'max')::numeric,
                 'pct', round((a.data->'marks'->>p_pupil_id)::numeric * 100 / (a.data->>'max')::numeric)) as piece
          from records a
          left join lateral (
            select e from jsonb_array_elements(p_kinds) e where e->>'id' = a.data->>'kind' limit 1
          ) k on true
         where a.collection = 'assessments' and not a.deleted
           and a.data->>'classId' = p_class_id
           and a.data->>'subject' = v_subject
           and a.data->'marks' ? p_pupil_id
           and (a.data->>'max')::numeric > 0
      ) x;

    if coalesce(v_den, 0) = 0 then
      v_pct := null; v_grade := null;
    else
      v_pct := round(v_num * 100 / v_den);
      select e into v_grade from jsonb_array_elements(p_scale) e
       where v_pct >= (e->>'min')::int order by (e->>'min')::int desc limit 1;
      if v_grade is null then
        select e into v_grade from jsonb_array_elements(p_scale) e order by (e->>'min')::int limit 1;
      end if;
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'subject', v_subject, 'pct', v_pct, 'grade', v_grade,
      'assessments', coalesce(v_pieces, '[]'::jsonb)));
  end loop;
  return v_out;
end $$;

-- The fee account, exactly as the office holds it. A balance a parent cannot
-- check is a balance the office ends up explaining on the telephone.
create or replace function portal_family_fees(p_pupil_id text, p_today date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_inv jsonb; v_paid numeric; v_due numeric; v_over numeric; v_next jsonb; v_pay jsonb; v_total numeric;
begin
  select data into v_inv from records
   where collection = 'invoices' and not deleted and data->>'pupilId' = p_pupil_id limit 1;
  if v_inv is null then return null; end if;

  select coalesce(sum((data->>'amount')::numeric), 0),
         coalesce(jsonb_agg(jsonb_build_object('date', data->>'date', 'amount', (data->>'amount')::numeric,
           'method', data->>'method', 'ref', coalesce(data->>'ref','')) order by data->>'date'), '[]'::jsonb)
    into v_paid, v_pay
    from records where collection = 'payments' and not deleted and data->>'pupilId' = p_pupil_id;

  select coalesce(sum((i->>'amount')::numeric), 0) into v_due
    from jsonb_array_elements(v_inv->'instalments') i where (i->>'due')::date <= p_today;

  select i into v_next from jsonb_array_elements(v_inv->'instalments') i
   where (i->>'due')::date > p_today order by (i->>'due')::date limit 1;

  v_total := (v_inv->>'total')::numeric;
  v_over := greatest(0, round(v_due - v_paid, 2));

  return jsonb_build_object(
    'term', v_inv->>'term', 'issued', v_inv->>'issued', 'items', v_inv->'items',
    'discount', v_inv->'discount', 'discountReason', v_inv->>'discountReason',
    'total', v_total, 'instalments', v_inv->'instalments',
    'paid', round(v_paid, 2), 'balance', round(v_total - v_paid, 2),
    'overdue', v_over, 'next', v_next,
    'status', case when v_paid >= v_total then 'settled' when v_over > 0 then 'arrears' else 'on track' end,
    'payments', v_pay);
end $$;

-- The week as the child has it: subject, time and who teaches it. Not the
-- staff timetable, which is the school's business.
create or replace function portal_family_week(p_class_id text, p_periods jsonb, p_teams jsonb, p_tt jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '{}'::jsonb; v_day text; v_row jsonb;
begin
  foreach v_day in array array['mon','tue','wed','thu','fri'] loop
    -- A timetable row holds one cell per *lesson*, so break and lunch are
    -- numbered out before the two are lined up against each other.
    with all_periods as (
      select e, ord from jsonb_array_elements(p_periods) with ordinality as x(e, ord)
    ), lessons as (
      select e, row_number() over (order by ord) as ord from all_periods where e->>'kind' is null
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'time', l.e->>'start',
             'subject', coalesce(slot.c->>'s', ''),
             'teacher', coalesce(portal_staff_name(
               (select t->>'teacherId' from jsonb_array_elements(p_teams) t
                 where t->>'id' = slot.c->>'t' limit 1)), '')
           ) order by l.ord), '[]'::jsonb) into v_row
      from lessons l
      left join lateral (
        select c from jsonb_array_elements(coalesce(p_tt->p_class_id->v_day, '[]'::jsonb))
          with ordinality as y(c, n)
         where n = l.ord limit 1
      ) slot on true;
    v_out := v_out || jsonb_build_object(v_day, coalesce(v_row, '[]'::jsonb));
  end loop;
  return v_out;
end $$;

-- Everything a guardian may see, assembled from their own children outward.
create or replace function portal_family_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_g jsonb; v_today date; v_school jsonb; v_term jsonb;
  v_periods jsonb; v_day_labels jsonb; v_scale jsonb; v_assessed jsonb; v_kinds jsonb;
  v_classes jsonb; v_teams jsonb; v_tt jsonb;
  v_children jsonb := '[]'::jsonb; v_child jsonb; v_p jsonb; v_cls jsonb;
  v_seen text; v_msgs jsonb; v_unread int; v_notes jsonb;
  v_class_ids text[]; v_notices jsonb; v_events jsonb; v_docs jsonb;
  v_pupil_id text;
begin
  v_g := portal_require_guardian();
  v_today := current_date;

  select data into v_school  from settings where key = 'school';
  select data into v_periods from settings where key = 'periods';
  select data into v_day_labels from settings where key = 'dayLabels';
  select data into v_scale   from settings where key = 'gradeScale';
  select data into v_assessed from settings where key = 'assessed';
  select data into v_kinds   from settings where key = 'assessmentKinds';
  select data into v_classes from settings where key = 'classes';
  select data into v_teams   from settings where key = 'teams';
  select data into v_tt      from settings where key = 'timetable';
  v_term := coalesce(v_school->'term', '{}'::jsonb);

  select array_agg(distinct p.data->>'classId') into v_class_ids
    from records p
   where p.collection = 'pupils' and not p.deleted and v_g->'pupilIds' ? p.id;

  for v_pupil_id in select jsonb_array_elements_text(v_g->'pupilIds') loop
    select data into v_p from records
     where collection = 'pupils' and id = v_pupil_id and not deleted;
    continue when v_p is null;

    select c into v_cls from jsonb_array_elements(v_classes) c
     where c->>'id' = v_p->>'classId' limit 1;
    v_cls := coalesce(v_cls, '{}'::jsonb);

    v_seen := coalesce(v_g->'seen'->>v_pupil_id, '1970-01-01');

    select coalesce(jsonb_agg(m.row order by m.at desc), '[]'::jsonb),
           count(*) filter (where m.dir = 'out' and m.at > v_seen)
      into v_msgs, v_unread
      from (
        select c.data->>'sentAt' as at,
               case when coalesce((c.data->>'fromGuardian')::boolean, false) then 'in' else 'out' end as dir,
               case when coalesce((c.data->>'fromGuardian')::boolean, false) then
                 jsonb_build_object('id', c.data->>'id', 'at', c.data->>'sentAt', 'channel', 'portal',
                   'subject', coalesce(c.data->>'subject',''), 'body', c.data->>'body',
                   'from', coalesce(c.data->>'fromName', v_g->>'name'), 'direction', 'in',
                   'read', (c.data->>'readAt') is not null,
                   'readBy', coalesce(portal_staff_name(c.data->>'readBy'), ''),
                   'readAt', coalesce(c.data->>'readAt', ''))
               else
                 jsonb_build_object('id', c.data->>'id', 'at', c.data->>'sentAt',
                   'channel', c.data->>'channel', 'subject', coalesce(c.data->>'subject',''),
                   'body', c.data->>'body',
                   'from', coalesce(nullif(portal_staff_name(c.data->>'sentBy'), ''), 'The school office'),
                   'direction', 'out')
               end as row
          from records c
         where c.collection = 'comms' and not c.deleted and c.data->>'pupilId' = v_pupil_id
         order by c.data->>'sentAt' desc
         limit 60
      ) m;

    select coalesce(jsonb_agg(a.data order by a.data->>'date' desc), '[]'::jsonb) into v_notes
      from records a
     where a.collection = 'absences' and not a.deleted and a.data->>'pupilId' = v_pupil_id;

    v_child := jsonb_build_object(
      'id', v_p->>'id', 'first', v_p->>'first', 'last', v_p->>'last',
      'admissionNo', v_p->>'admissionNo', 'gender', v_p->>'gender', 'dob', v_p->>'dob',
      'classId', v_p->>'classId', 'status', v_p->>'status', 'enrolled', v_p->>'enrolled',
      'className', coalesce(v_cls->>'name', '—'), 'grade', coalesce(v_cls->>'grade', ''),
      'room', coalesce(v_cls->>'room', ''),
      'teacher', coalesce(portal_staff_name(v_cls->>'teacherId'), ''),
      'assistant', coalesce(portal_staff_name(v_cls->>'assistantId'), ''),
      -- a family sees their own child's medical record: it is theirs, and
      -- getting it wrong is what the allergy line is for
      'medical', coalesce(v_p->'medical', '{"allergies":"","conditions":"","doctor":""}'::jsonb),
      'guardian', coalesce(v_p->'guardian', '{}'::jsonb),
      'emergency', coalesce(v_p->'emergency', '{"name":"","phone":""}'::jsonb),
      'attendance', portal_family_attendance(v_pupil_id, v_term, v_today, coalesce(v_periods, '[]'::jsonb)),
      'subjects', portal_family_subjects(v_pupil_id, v_p->>'classId', coalesce(v_cls->>'grade',''),
                    coalesce(v_scale,'[]'::jsonb), coalesce(v_assessed,'{}'::jsonb), coalesce(v_kinds,'[]'::jsonb)),
      'fees', portal_family_fees(v_pupil_id, v_today),
      'week', portal_family_week(v_p->>'classId', coalesce(v_periods,'[]'::jsonb),
                coalesce(v_teams,'[]'::jsonb), coalesce(v_tt,'{}'::jsonb)),
      'messages', v_msgs, 'unread', coalesce(v_unread, 0), 'lastSeen', v_seen,
      'absenceNotes', v_notes);

    v_children := v_children || jsonb_build_array(v_child);
  end loop;

  -- school-wide, and the same for every family
  select coalesce(jsonb_agg(c.row order by c.at desc), '[]'::jsonb) into v_notices
    from (
      select r.data->>'sentAt' as at,
             jsonb_build_object('id', r.data->>'id', 'at', r.data->>'sentAt',
               'channel', r.data->>'channel', 'subject', coalesce(r.data->>'subject',''),
               'body', r.data->>'body',
               'from', coalesce(nullif(portal_staff_name(r.data->>'sentBy'), ''), 'The school office'),
               'direction', 'out') as row
        from records r
       where r.collection = 'comms' and not r.deleted
         and r.data->>'pupilId' is null
         and (r.data->>'classId' is null or r.data->>'classId' = any(coalesce(v_class_ids, '{}')))
       order by r.data->>'sentAt' desc
       limit 30
    ) c;

  select coalesce(jsonb_agg(data order by data->>'date'), '[]'::jsonb) into v_events
    from records where collection = 'events' and not deleted;

  select coalesce(jsonb_agg(data), '[]'::jsonb) into v_docs
    from records where collection = 'documents' and not deleted
      and (data->'audience' ? 'guardian' or data->'audience' ? 'families' or data->'audience' ? 'public');

  return jsonb_build_object(
    'kind', 'family', 'now', now(), 'today', v_today,
    'account', jsonb_build_object('id', v_g->>'id', 'name', v_g->>'name',
      'relationship', coalesce(v_g->>'relationship', 'Guardian'),
      'email', v_g->>'email', 'phone', coalesce(v_g->>'phone', ''),
      'pupilIds', coalesce(v_g->'pupilIds', '[]'::jsonb)),
    -- the school's own details are on its website anyway; the register lock
    -- and the integration keys are not
    'school', jsonb_build_object('name', v_school->>'name', 'tagline', v_school->>'tagline',
      'address', v_school->>'address', 'phone', v_school->>'phone', 'email', v_school->>'email',
      'web', v_school->>'web', 'term', v_term),
    'gradeScale', coalesce(v_scale, '[]'::jsonb),
    'periods', coalesce(v_periods, '[]'::jsonb),
    'dayLabels', coalesce(v_day_labels, '{}'::jsonb),
    'children', v_children,
    'events', v_events, 'documents', v_docs, 'notices', v_notices,
    'noticesSeen', coalesce(v_g->'seen'->>'notices', '1970-01-01'),
    'serverSeq', coalesce((select max(seq) from changes), 0));
end $$;

-- ---------------------------------------------------------------------------
-- What a family may write
-- ---------------------------------------------------------------------------
-- Three things, and each one begins by proving the child belongs to the
-- account. It is the only check that matters here, so it is written once.
-- ---------------------------------------------------------------------------

-- Telling the school a child will be away. It does not mark the register —
-- only a teacher does that — it puts the reason in front of whoever does.
create or replace function portal_family_absence(p_pupil_id text, p_date text, p_reason text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g jsonb; v_id text; v_row jsonb; v_p jsonb;
begin
  v_g := portal_require_guardian();
  if not portal_family_owns(v_g, p_pupil_id) then
    raise exception 'That is not one of your children.' using errcode = '42501';
  end if;
  if coalesce(p_date, '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Please give the date your child will be away.';
  end if;
  select data into v_p from records where collection = 'pupils' and id = p_pupil_id and not deleted;
  if v_p is null then raise exception 'Pupil not found.'; end if;

  v_id := 'ab_' || replace(gen_random_uuid()::text, '-', '');
  v_row := jsonb_build_object('id', v_id, 'pupilId', p_pupil_id, 'date', p_date,
    'reason', left(coalesce(nullif(trim(p_reason), ''), 'Absent'), 60),
    'note', left(coalesce(p_note, ''), 600),
    'reportedBy', v_g->>'id', 'reportedName', v_g->>'name',
    'at', now(), 'status', 'reported');
  insert into records (collection, id, data, updated_by) values ('absences', v_id, v_row, v_g->>'id');
  perform portal_note('absences', v_id, 'put', v_g->>'id');
  return jsonb_build_object('ok', true, 'absence', v_row);
end $$;

-- A message to the school, logged against the child exactly where the school's
-- own messages to the family are logged, so one thread holds both.
create or replace function portal_family_message(p_pupil_id text, p_subject text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g jsonb; v_id text; v_row jsonb; v_p jsonb; v_recent int;
begin
  v_g := portal_require_guardian();
  if not portal_family_owns(v_g, p_pupil_id) then
    raise exception 'That is not one of your children.' using errcode = '42501';
  end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'The message is empty.'; end if;

  select count(*) into v_recent from records
   where collection = 'comms' and not deleted
     and data->>'fromAccount' = (v_g->>'id')
     and (data->>'sentAt')::timestamptz > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'That is a lot of messages in a short time. Please telephone the school office instead.' using errcode = '42501';
  end if;

  select data into v_p from records where collection = 'pupils' and id = p_pupil_id and not deleted;
  v_id := 'cm_' || replace(gen_random_uuid()::text, '-', '');
  v_row := jsonb_build_object('id', v_id, 'pupilId', p_pupil_id, 'classId', v_p->>'classId',
    'channel', 'portal', 'subject', left(coalesce(p_subject, ''), 200), 'body', left(p_body, 4000),
    'fromGuardian', true, 'fromName', v_g->>'name', 'fromAccount', v_g->>'id',
    'sentBy', null, 'sentAt', now(), 'recipients', 1, 'status', 'received', 'to', 'The school office');
  insert into records (collection, id, data, updated_by) values ('comms', v_id, v_row, v_g->>'id');
  perform portal_note('comms', v_id, 'put', v_g->>'id');
  return jsonb_build_object('ok', true, 'message', v_row);
end $$;

-- A guardian's own contact details, which are theirs to correct. The name on
-- the account and the children it reaches are the school's to change.
create or replace function portal_family_details(p_phone text, p_relationship text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g jsonb; v_row jsonb;
begin
  v_g := portal_require_guardian();
  v_row := v_g || jsonb_build_object(
    'phone', left(coalesce(trim(p_phone), ''), 40),
    'relationship', left(coalesce(nullif(trim(p_relationship), ''), coalesce(v_g->>'relationship', 'Guardian')), 40));
  update records set data = v_row, updated_at = now(), updated_by = v_g->>'id'
   where collection = 'guardians' and id = v_g->>'id';
  perform portal_note('guardians', v_g->>'id', 'put', v_g->>'id');
  return jsonb_build_object('ok', true, 'account', v_row);
end $$;

-- Catching up: which thread this family has just had open.
create or replace function portal_family_seen(p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g jsonb;
begin
  v_g := portal_require_guardian();
  if coalesce(trim(p_key), '') = '' then raise exception 'Which thread?'; end if;
  if p_key <> 'notices' and not portal_family_owns(v_g, p_key) then
    raise exception 'That is not one of your children.' using errcode = '42501';
  end if;
  update records
     set data = data || jsonb_build_object('seen',
           coalesce(data->'seen', '{}'::jsonb) || jsonb_build_object(p_key, now())),
         updated_at = now()
   where collection = 'guardians' and id = v_g->>'id';
  return '{"ok":true}'::jsonb;
end $$;

-- ---------------------------------------------------------------------------
-- The office's side: giving a family a way in, and taking it back
-- ---------------------------------------------------------------------------
create or replace function portal_family_invite(p_pupil_id text, p_email text, p_name text,
                                                p_must_change boolean default false,
  p_relationship text, p_phone text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_p jsonb; v_email text; v_existing jsonb; v_id text; v_row jsonb; v_issued text; v_ids jsonb;
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'portal.manage');
  select data into v_p from records where collection = 'pupils' and id = p_pupil_id and not deleted;
  if v_p is null then raise exception 'Pupil not found.'; end if;
  if not ((v_p->>'classId') = any(portal_scope(v_me))) then
    raise exception 'That pupil is outside the classes you work with.' using errcode = '42501';
  end if;

  v_email := lower(trim(coalesce(nullif(trim(p_email), ''), v_p->'guardian'->>'email')));
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A working email address is needed — it is how the family signs in.';
  end if;
  if exists (select 1 from records where collection = 'staff' and not deleted
              and lower(data->>'email') = v_email) then
    raise exception 'That address belongs to a member of staff, who signs in to the staff portal instead.';
  end if;

  v_issued := portal_issued_password(p_password);

  -- A family with two children here gets one account, not two.
  select data into v_existing from records
   where collection = 'guardians' and not deleted and lower(data->>'email') = v_email;

  if v_existing is not null then
    v_id := v_existing->>'id';
    select jsonb_agg(distinct e) into v_ids
      from jsonb_array_elements_text(coalesce(v_existing->'pupilIds', '[]'::jsonb) || to_jsonb(array[p_pupil_id])) e;
    v_row := v_existing || jsonb_build_object('pupilIds', coalesce(v_ids, '[]'::jsonb), 'active', true);
    update records set data = v_row, updated_at = now(), updated_by = v_me->>'id'
     where collection = 'guardians' and id = v_id;
    delete from sessions where staff_id = v_id;
    perform portal_audit(v_me, 'Family portal: added ' || (v_p->>'first') || ' ' || (v_p->>'last')
      || ' to ' || (v_row->>'name') || '''s account and issued a new password');
  else
    v_id := 'g_' || replace(gen_random_uuid()::text, '-', '');
    v_row := jsonb_build_object('id', v_id,
      'name', left(coalesce(nullif(trim(p_name), ''), v_p->'guardian'->>'name', ''), 80),
      'relationship', left(coalesce(nullif(trim(p_relationship), ''), v_p->'guardian'->>'relationship', 'Guardian'), 40),
      'email', v_email, 'phone', left(coalesce(nullif(trim(p_phone), ''), v_p->'guardian'->>'phone', ''), 40),
      'pupilIds', jsonb_build_array(p_pupil_id), 'active', true,
      'createdBy', v_me->>'id', 'createdAt', now(), 'lastSeen', null);
    if coalesce(v_row->>'name', '') = '' then raise exception 'Please give the guardian''s name.'; end if;
    insert into records (collection, id, data, updated_by) values ('guardians', v_id, v_row, v_me->>'id');
    perform portal_audit(v_me, 'Family portal: gave ' || (v_row->>'name') || ' a sign-in for '
      || (v_p->>'first') || ' ' || (v_p->>'last'));
  end if;

  insert into credentials (staff_id, password_hash, must_change)
  values (v_id, crypt(v_issued, gen_salt('bf', 12)), coalesce(p_must_change, false))
    on conflict (staff_id) do update set password_hash = excluded.password_hash,
      must_change = excluded.must_change, failed = 0, locked_until = null;
  perform portal_note('guardians', v_id, 'put', v_me->>'id');
  return jsonb_build_object('ok', true, 'guardian', v_row, 'email', v_email, 'temporaryPassword', v_issued);
end $$;

create or replace function portal_family_reset(p_guardian_id text, p_password text,
                                               p_must_change boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_g jsonb; v_issued text;
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'portal.manage');
  select data into v_g from records where collection = 'guardians' and id = p_guardian_id and not deleted;
  if v_g is null then raise exception 'That family account does not exist.'; end if;
  v_issued := portal_issued_password(p_password);
  insert into credentials (staff_id, password_hash, must_change)
  values (p_guardian_id, crypt(v_issued, gen_salt('bf', 12)), coalesce(p_must_change, false))
    on conflict (staff_id) do update set password_hash = excluded.password_hash,
      must_change = excluded.must_change, failed = 0, locked_until = null;
  delete from sessions where staff_id = p_guardian_id;
  perform portal_audit(v_me, 'Family portal: reset the sign-in for ' || (v_g->>'name'));
  return jsonb_build_object('ok', true, 'temporaryPassword', v_issued,
    'email', v_g->>'email', 'name', v_g->>'name');
end $$;

create or replace function portal_family_close(p_guardian_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_g jsonb;
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'portal.manage');
  select data into v_g from records where collection = 'guardians' and id = p_guardian_id and not deleted;
  if v_g is null then raise exception 'That family account does not exist.'; end if;
  update records set data = data || '{"active":false}'::jsonb, updated_at = now(), updated_by = v_me->>'id'
   where collection = 'guardians' and id = p_guardian_id;
  delete from sessions where staff_id = p_guardian_id;
  perform portal_note('guardians', p_guardian_id, 'put', v_me->>'id');
  perform portal_audit(v_me, 'Family portal: closed the account for ' || (v_g->>'name'));
  return '{"ok":true}'::jsonb;
end $$;

-- Closing is reversible, so the portal offers Undo instead of a confirmation
-- nobody reads. Undo needs somewhere to go. The password was never deleted,
-- only refused, so reopening restores the sign-in the family already had.
create or replace function portal_family_reopen(p_guardian_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_g jsonb;
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'portal.manage');
  select data into v_g from records where collection = 'guardians' and id = p_guardian_id and not deleted;
  if v_g is null then raise exception 'That family account does not exist.'; end if;
  update records set data = data || '{"active":true}'::jsonb, updated_at = now(), updated_by = v_me->>'id'
   where collection = 'guardians' and id = p_guardian_id;
  perform portal_note('guardians', p_guardian_id, 'put', v_me->>'id');
  perform portal_audit(v_me, 'Family portal: reopened the account for ' || (v_g->>'name'));
  return '{"ok":true}'::jsonb;
end $$;

-- ---------------------------------------------------------------------------
-- The public forms
-- ---------------------------------------------------------------------------
-- Open by necessity — a new teacher has no account yet, and a family asking
-- about a place has nothing at all. Neither can do more than add a row to a
-- list somebody in the office then works through, and both are rate-limited
-- by address the way the door code is.
-- ---------------------------------------------------------------------------
create or replace function portal_public_rate(p_what text, p_limit int) returns void
language plpgsql security definer set search_path = public as $$
declare v_ip text; v_tries int;
begin
  v_ip := coalesce(split_part(nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), 'unknown');
  delete from gate_attempts where at < now() - interval '1 hour';
  select count(*) into v_tries from gate_attempts
   where ip = v_ip and audience = p_what and at > now() - interval '1 hour';
  if v_tries >= p_limit then
    raise exception 'Too many requests from here. Please telephone the school office instead.' using errcode = '42501';
  end if;
  insert into gate_attempts (ip, audience) values (v_ip, p_what);
end $$;

create or replace function portal_request_access(p_request jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; v_row jsonb; v_role text;
begin
  perform portal_public_rate('access-request', 5);
  if coalesce(trim(p_request->>'first'), '') = '' or coalesce(trim(p_request->>'last'), '') = '' then
    raise exception 'Please give your first name and surname.';
  end if;
  if coalesce(p_request->>'email', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please give a valid email address.';
  end if;
  select role into v_role from role_tiers where role = p_request->>'role' and not governance;
  v_row := jsonb_build_object('id', 'ar_' || replace(gen_random_uuid()::text, '-', ''),
    'first', left(trim(p_request->>'first'), 60), 'last', left(trim(p_request->>'last'), 60),
    'email', left(trim(p_request->>'email'), 120), 'phone', left(coalesce(p_request->>'phone', ''), 40),
    'role', coalesce(v_role, 'assistant'), 'note', left(coalesce(p_request->>'note', ''), 600),
    'at', now(), 'status', 'pending');
  v_id := v_row->>'id';
  insert into records (collection, id, data) values ('accessRequests', v_id, v_row);
  perform portal_note('accessRequests', v_id, 'put', null);
  return '{"ok":true}'::jsonb;
end $$;

create or replace function portal_enquire(p_enquiry jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; v_row jsonb; v_intake text; v_grade text;
begin
  perform portal_public_rate('enquiry', 8);
  if coalesce(trim(p_enquiry->>'childFirst'), '') = '' or coalesce(trim(p_enquiry->>'childLast'), '') = '' then
    raise exception 'Please give the child''s first name and surname.';
  end if;
  if coalesce(trim(p_enquiry->>'guardianName'), '') = '' then
    raise exception 'Please give a parent or guardian''s name.';
  end if;
  if coalesce(trim(p_enquiry->>'phone'), '') = '' and coalesce(trim(p_enquiry->>'email'), '') = '' then
    raise exception 'Please leave a telephone number or an email address so we can reply.';
  end if;

  select c->>'grade' into v_grade from jsonb_array_elements((select data from settings where key = 'classes')) c
   where c->>'grade' = p_enquiry->>'targetGrade' limit 1;
  if v_grade is null then
    select c->>'grade' into v_grade from jsonb_array_elements((select data from settings where key = 'classes')) c limit 1;
  end if;
  select i->>'id' into v_intake from jsonb_array_elements((select data from settings where key = 'intakes')) i
   where i->>'status' = 'open' limit 1;

  v_id := 'a_' || replace(gen_random_uuid()::text, '-', '');
  v_row := jsonb_build_object('id', v_id,
    'first', left(trim(p_enquiry->>'childFirst'), 60), 'last', left(trim(p_enquiry->>'childLast'), 60),
    'gender', case when p_enquiry->>'gender' = 'M' then 'M' else 'F' end,
    'dob', case when coalesce(p_enquiry->>'dob','') ~ '^\d{4}-\d{2}-\d{2}$' then p_enquiry->>'dob' else '' end,
    'targetGrade', v_grade, 'intakeId', v_intake,
    'stage', 'enquiry', 'appliedOn', current_date, 'source', 'Website',
    'sibling', coalesce((p_enquiry->>'sibling')::boolean, false),
    'guardian', jsonb_build_object('name', left(trim(p_enquiry->>'guardianName'), 80),
      'relationship', coalesce(p_enquiry->>'relationship', 'Guardian'),
      'phone', left(coalesce(p_enquiry->>'phone', ''), 40), 'email', left(coalesce(p_enquiry->>'email', ''), 120)),
    'docs', '{"birth":false,"clinic":false,"photo":false,"report":false,"consent":false}'::jsonb,
    'baseline', '', 'offerSentOn', '', 'offerExpires', '',
    'notes', left(coalesce(p_enquiry->>'message', ''), 600));
  insert into records (collection, id, data) values ('applicants', v_id, v_row);
  perform portal_note('applicants', v_id, 'put', null);
  return '{"ok":true}'::jsonb;
end $$;

-- Approving one creates the staff record and the sign-in in a single step.
create or replace function portal_decide_access(p_id text, p_decision text, p_role text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_req jsonb; v_role text; v_staff_id text; v_issued text; v_row jsonb;
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'accounts.manage');
  select data into v_req from records where collection = 'accessRequests' and id = p_id and not deleted;
  if v_req is null then raise exception 'Request not found.'; end if;
  if v_req->>'status' <> 'pending' then raise exception 'That request has already been dealt with.'; end if;

  if p_decision <> 'approve' then
    update records set data = data || jsonb_build_object('status', 'declined',
      'decidedBy', v_me->>'id', 'decidedAt', now()) where collection = 'accessRequests' and id = p_id;
    perform portal_note('accessRequests', p_id, 'put', v_me->>'id');
    perform portal_audit(v_me, 'Declined the access request from ' || (v_req->>'first') || ' ' || (v_req->>'last'));
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;

  v_role := coalesce(p_role, v_req->>'role');
  if not portal_can_issue_role(v_me, v_role) then
    raise exception 'You can set up an account at your own level or below, not above it.' using errcode = '42501';
  end if;
  v_staff_id := 's_' || replace(gen_random_uuid()::text, '-', '');
  v_issued := portal_issued_password(null);
  v_row := jsonb_build_object('id', v_staff_id, 'first', v_req->>'first', 'last', v_req->>'last',
    'title', 'Mr', 'role', v_role, 'email', v_req->>'email', 'phone', coalesce(v_req->>'phone', ''),
    'started', current_date, 'active', true,
    'grants', '[]'::jsonb, 'revokes', '[]'::jsonb, 'extraClasses', '[]'::jsonb);
  insert into records (collection, id, data, updated_by) values ('staff', v_staff_id, v_row, v_me->>'id');
  insert into credentials (staff_id, password_hash, must_change)
  values (v_staff_id, crypt(v_issued, gen_salt('bf', 12)), false);
  update records set data = data || jsonb_build_object('status', 'approved', 'staffId', v_staff_id,
    'decidedBy', v_me->>'id', 'decidedAt', now()) where collection = 'accessRequests' and id = p_id;
  perform portal_note('staff', v_staff_id, 'put', v_me->>'id');
  perform portal_audit(v_me, 'Approved ' || (v_req->>'first') || ' ' || (v_req->>'last') || ' as ' || v_role);
  return jsonb_build_object('ok', true, 'status', 'approved', 'staffId', v_staff_id,
    'email', v_row->>'email', 'password', v_issued);
end $$;

-- ===========================================================================
-- The door code
-- ---------------------------------------------------------------------------
-- One code for staff, a different one for families, given out the way a
-- building's door code is given out. It is not a password and nothing here
-- pretends it is: everybody on one side of the school has the same one, so it
-- proves nothing about who is at the keyboard. What it does is keep the two
-- sign-in forms off the open web. The password behind it is still the lock.
-- ===========================================================================

-- The school's own figures, for the public website, which has no session with
-- which to ask for them. It is the one open read in the schema and it is
-- narrow by construction: each field is named here, so a column added to a
-- setting later does not become public by accident. Note what is absent —
-- a class's teacher and assistant ids, and the 'gate' setting entirely.
create or replace function portal_public_facts() returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select data from settings where key = 'school'),
       c as (select data from settings where key = 'classes'),
       i as (select data from settings where key = 'intakes'),
       f as (select data from settings where key = 'feeItems'),
       r as (select data from settings where key = 'feeRules'),
       g as (select data from settings where key = 'gradeScale')
  select jsonb_build_object(
    'school', jsonb_build_object(
      'name',    coalesce((select data->>'name'    from s), ''),
      'tagline', coalesce((select data->>'tagline' from s), ''),
      'address', coalesce((select data->>'address' from s), ''),
      'phone',   coalesce((select data->>'phone'   from s), ''),
      'email',   coalesce((select data->>'email'   from s), ''),
      'web',     coalesce((select data->>'web'     from s), ''),
      'regNo',   coalesce((select data->>'regNo'   from s), ''),
      'term',    (select data->'term' from s),
      'lockMinutes', coalesce((select data->'lockMinutes' from s), to_jsonb(15))),
    'classes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e->>'id', 'name', e->>'name', 'grade', e->>'grade',
        'room', e->>'room', 'capacity', e->'capacity'))
      from jsonb_array_elements((select data from c)) e), '[]'::jsonb),
    'intakes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e->>'id', 'name', e->>'name', 'opens', e->>'opens', 'closes', e->>'closes',
        'starts', e->>'starts', 'status', e->>'status', 'places', coalesce(e->'places', '{}'::jsonb)))
      from jsonb_array_elements((select data from i)) e), '[]'::jsonb),
    'feeItems', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e->>'id', 'name', e->>'name', 'amount', e->'amount',
        'compulsory', coalesce(e->'compulsory', 'false'::jsonb), 'grades', coalesce(e->'grades', '[]'::jsonb)))
      from jsonb_array_elements((select data from f)) e), '[]'::jsonb),
    'feeRules', coalesce((select data from r), '{}'::jsonb),
    'gradeScale', coalesce((select data from g), '[]'::jsonb))
$$;

-- Whether each door has a code. Asked before anyone has signed in, so it says
-- the least that still lets the page know whether to ask: yes or no.
create or replace function portal_gate_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'staff',  jsonb_build_object('required', coalesce((select data->'staff'->>'hash'  from settings where key = 'gate') is not null, false)),
    'family', jsonb_build_object('required', coalesce((select data->'family'->>'hash' from settings where key = 'gate') is not null, false)))
$$;

-- The same, plus when and by whom — for the Settings page, which has a session.
create or replace function portal_gate_detail() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'staff', jsonb_build_object(
      'required', (select data->'staff'->>'hash' from settings where key = 'gate') is not null,
      'setAt',    (select data->'staff'->>'setAt' from settings where key = 'gate'),
      'setBy',    (select data->'staff'->>'setBy' from settings where key = 'gate')),
    'family', jsonb_build_object(
      'required', (select data->'family'->>'hash' from settings where key = 'gate') is not null,
      'setAt',    (select data->'family'->>'setAt' from settings where key = 'gate'),
      'setBy',    (select data->'family'->>'setBy' from settings where key = 'gate')))
$$;

create or replace function portal_gate_check(p_audience text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hash text; v_ip text; v_tries int;
begin
  if p_audience not in ('staff','family') then raise exception 'Which door?'; end if;

  -- Postgres has no request of its own; the address comes from the header
  -- Supabase forwards. An absent header throttles everyone together, which is
  -- the safe direction to be wrong in.
  v_ip := coalesce(split_part(nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1), 'unknown');
  delete from gate_attempts where at < now() - interval '1 hour';
  select count(*) into v_tries from gate_attempts
   where ip = v_ip and audience = p_audience and at > now() - interval '1 hour';
  if v_tries >= 15 then
    raise exception 'Too many attempts from this device. Try again in an hour, or telephone the school office.' using errcode = '42501';
  end if;
  insert into gate_attempts (ip, audience) values (v_ip, p_audience);

  select data->p_audience->>'hash' into v_hash from settings where key = 'gate';
  if v_hash is null then return jsonb_build_object('ok', true, 'unset', true); end if;

  if v_hash <> crypt(coalesce(p_pin, ''), v_hash) then
    raise exception 'That code is not right. Ask the school office for the current one.' using errcode = '28000';
  end if;
  delete from gate_attempts where ip = v_ip and audience = p_audience;
  return '{"ok":true}'::jsonb;
end $$;

create or replace function portal_gate_set(p_audience text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me jsonb; v_gate jsonb; v_pin text := coalesce(trim(p_pin), '');
begin
  v_me := portal_require_staff();
  perform portal_require(v_me, 'settings.manage');
  if p_audience not in ('staff','family') then raise exception 'Which door?'; end if;
  select coalesce(data, '{}'::jsonb) into v_gate from settings where key = 'gate';
  v_gate := coalesce(v_gate, '{}'::jsonb);

  if v_pin = '' then
    v_gate := v_gate - p_audience;
    perform portal_audit(v_me, 'Removed the ' || p_audience || ' portal door code — that page is open to anyone again');
  else
    if v_pin !~ '^[0-9]{4,10}$' then raise exception 'A door code is between four and ten digits.'; end if;
    if v_pin in ('0000','1234','1111','123456','000000') then raise exception 'That code is too easy to guess.'; end if;
    v_gate := v_gate || jsonb_build_object(p_audience, jsonb_build_object(
      'hash', crypt(v_pin, gen_salt('bf', 12)), 'setAt', now(), 'setBy', v_me->>'id'));
    perform portal_audit(v_me, 'Changed the ' || p_audience || ' portal door code');
  end if;

  insert into settings (key, data, updated_by) values ('gate', v_gate, v_me->>'id')
    on conflict (key) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by;
  return '{"ok":true}'::jsonb;
end $$;

-- --- only these are callable from a browser --------------------------------
-- Postgres grants EXECUTE to PUBLIC on every function it creates, and anon
-- inherits PUBLIC. Taking that away first is what makes the list below a
-- list of what is reachable rather than a list of what was thought about.
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon, authenticated;

-- Note that there is no function here that lists the staff, and none that
-- lists the pupils. Nothing about who is at this school is reachable without
-- signing in first, and portal_gate_status() answers only yes or no.
grant execute on function
  portal_login, portal_logout, portal_set_password,
  portal_state, portal_put, portal_delete, portal_setting,
  portal_request_access, portal_enquire, portal_decide_access, portal_public_facts,
  portal_gate_status, portal_gate_check, portal_gate_set,
  portal_family_state, portal_family_set_password,
  portal_family_absence, portal_family_message, portal_family_details, portal_family_seen,
  portal_family_invite, portal_family_reset, portal_family_close, portal_family_reopen
  to anon, authenticated;

-- Everything else stays internal. These are called only from the functions
-- above, which have already resolved and checked a session, so exposing them
-- would hand a browser the pieces without the checks around them.
revoke execute on function
  portal_staff, portal_guardian, portal_require_staff, portal_require_guardian,
  portal_can, portal_require, portal_note, portal_audit, portal_scope, portal_token,
  portal_can_issue_role, portal_can_issue_account, portal_issued_password,
  portal_staff_name, portal_family_owns, portal_family_attendance, portal_family_subjects,
  portal_family_fees, portal_family_week, portal_gate_detail, portal_public_rate
  from anon, authenticated;
