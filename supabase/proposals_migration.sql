create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

alter table if exists users
  add column if not exists reputation numeric(10,2) not null default 0;

create table if not exists user_privileges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  privilege_level smallint not null check (privilege_level in (1, 2)),
  granted_by uuid references users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_admin'
  ) then
    insert into user_privileges (user_id, privilege_level, notes)
    select id, 1, 'migrated from users.is_admin'
    from users
    where coalesce(is_admin, false) = true
    on conflict (user_id) do nothing;
  end if;
end;
$$;

alter table if exists users
  drop column if exists is_admin;

alter table if exists songs
  add column if not exists duration_ms integer,
  add column if not exists spotify_import boolean not null default false,
  add column if not exists merged_into_song_id uuid references songs(id) on delete set null;

create table if not exists song_credits (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  unique (song_id, artist_id, role)
);

create index if not exists idx_songs_spotify_import on songs(spotify_import);
create index if not exists idx_songs_merged_into_song_id on songs(merged_into_song_id);
create index if not exists idx_song_credits_song_id on song_credits(song_id, role);
create index if not exists idx_song_credits_artist_id on song_credits(artist_id);
create index if not exists idx_songs_title_trgm on songs using gin (lower(title) gin_trgm_ops);
create index if not exists idx_artists_name_trgm on artists using gin (lower(name) gin_trgm_ops);
create index if not exists idx_albums_name_trgm on albums using gin (lower(name) gin_trgm_ops);
create index if not exists idx_user_privileges_level on user_privileges(privilege_level, user_id);

alter table if exists song_credits enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'song_credits'
      and policyname = 'Public read access'
  ) then
    create policy "Public read access" on song_credits for select using (true);
  end if;
end;
$$;

create or replace function proposal_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function proposal_merge_jsonb(existing_value jsonb, patch_value jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(existing_value, '{}'::jsonb) || coalesce(patch_value, '{}'::jsonb);
$$;

create or replace function proposal_parse_artist_names(raw_value text)
returns text[]
language sql
immutable
as $$
  select coalesce(
    array(
      select trim(part)
      from unnest(string_to_array(coalesce(raw_value, ''), ',')) as part
      where trim(part) <> ''
    ),
    array[]::text[]
  );
$$;

create or replace function proposal_resolve_artist_reference(artist_id_value uuid, artist_name_value text)
returns uuid
language plpgsql
as $$
declare
  resolved_artist_id uuid;
begin
  if artist_id_value is not null then
    select id into resolved_artist_id
    from artists
    where id = artist_id_value
    limit 1;

    if resolved_artist_id is not null then
      return resolved_artist_id;
    end if;
  end if;

  return proposal_find_or_create_artist(artist_name_value);
end;
$$;

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('song_add', 'song_edit', 'song_merge', 'artist_link_spotify', 'album_link_spotify', 'playlist_song_add')),
  target_song_id uuid references songs(id) on delete set null,
  proposer_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'merged', 'reverted')),
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  spotify_import boolean not null default false,
  canonical_song_id uuid references songs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  reputation_delta numeric(10,2) not null default 0,
  approved_at timestamptz,
  approved_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'proposals_type_check'
  ) then
    alter table proposals drop constraint proposals_type_check;
  end if;

  alter table proposals
    add constraint proposals_type_check
    check (type in ('song_add', 'song_edit', 'song_merge', 'artist_link_spotify', 'album_link_spotify', 'playlist_song_add'));
end;
$$;

create table if not exists proposal_votes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  weight numeric(10,2) not null,
  reason text,
  reason_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, user_id)
);

alter table if exists proposal_votes
  add column if not exists reason text,
  add column if not exists reason_code text;

create table if not exists proposal_reports (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  reporter_id uuid not null references users(id) on delete cascade,
  category text not null,
  details text not null,
  status text not null default 'open' check (status in ('open', 'triaged', 'dismissed', 'actioned', 'escalated')),
  abuse_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, reporter_id)
);

create table if not exists proposal_audit_logs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists song_merge_aliases (
  alias_song_id uuid primary key references songs(id) on delete cascade,
  canonical_song_id uuid not null references songs(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'proposals'
      and column_name = 'original_snapshot'
  ) then
    insert into proposal_audit_logs (
      proposal_id,
      actor_id,
      action,
      reason,
      before_snapshot,
      after_snapshot,
      metadata
    )
    select
      p.id,
      p.approved_by,
      'approve',
      'Backfilled legacy approval snapshot',
      p.original_snapshot,
      null,
      jsonb_build_object(
        'backfilled_from', 'proposals.original_snapshot',
        'legacy_status', p.status
      )
    from proposals p
    where p.type = 'song_edit'
      and p.original_snapshot is not null
      and p.status in ('approved', 'reverted')
      and not exists (
        select 1
        from proposal_audit_logs audit_log
        where audit_log.proposal_id = p.id
          and audit_log.action = 'approve'
      );
  end if;
end;
$$;

alter table if exists proposals
  drop column if exists original_snapshot,
  drop column if exists diff;

create index if not exists idx_proposals_proposer_status on proposals(proposer_id, status, created_at desc);
create index if not exists idx_proposals_status_type on proposals(status, type, created_at desc);
create index if not exists idx_proposals_target_song on proposals(target_song_id);
create index if not exists idx_proposal_votes_proposal on proposal_votes(proposal_id);
create index if not exists idx_proposal_reports_status on proposal_reports(status, created_at desc);
create index if not exists idx_proposal_audit_logs_proposal_action on proposal_audit_logs(proposal_id, action, created_at desc);
create index if not exists idx_proposals_payload_gin on proposals using gin (payload);

drop trigger if exists trg_proposals_updated_at on proposals;
create trigger trg_proposals_updated_at
before update on proposals
for each row
execute function proposal_set_updated_at();

drop trigger if exists trg_proposal_votes_updated_at on proposal_votes;
create trigger trg_proposal_votes_updated_at
before update on proposal_votes
for each row
execute function proposal_set_updated_at();

drop trigger if exists trg_proposal_reports_updated_at on proposal_reports;
create trigger trg_proposal_reports_updated_at
before update on proposal_reports
for each row
execute function proposal_set_updated_at();

drop trigger if exists trg_song_merge_aliases_updated_at on song_merge_aliases;
create trigger trg_song_merge_aliases_updated_at
before update on song_merge_aliases
for each row
execute function proposal_set_updated_at();

drop trigger if exists trg_user_privileges_updated_at on user_privileges;
create trigger trg_user_privileges_updated_at
before update on user_privileges
for each row
execute function proposal_set_updated_at();

create or replace function proposal_find_or_create_artist(artist_name text)
returns uuid
language plpgsql
as $$
declare
  artist_id uuid;
begin
  if trim(coalesce(artist_name, '')) = '' then
    return null;
  end if;

  select id into artist_id
  from artists
  where lower(name) = lower(trim(artist_name))
  order by created_at asc
  limit 1;

  if artist_id is null then
    insert into artists (name)
    values (trim(artist_name))
    returning id into artist_id;
  end if;

  return artist_id;
end;
$$;

do $$
declare
  legacy_song record;
  songwriter_name text;
  songwriter_artist_id uuid;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'songs'
      and column_name = 'songwriter'
  ) then
    for legacy_song in
      select id, songwriter
      from songs
      where nullif(trim(coalesce(songwriter, '')), '') is not null
    loop
      foreach songwriter_name in array proposal_parse_artist_names(legacy_song.songwriter) loop
        songwriter_artist_id := proposal_find_or_create_artist(songwriter_name);

        if songwriter_artist_id is null then
          continue;
        end if;

        insert into song_credits (song_id, artist_id, role)
        values (legacy_song.id, songwriter_artist_id, 'Songwriter')
        on conflict (song_id, artist_id, role) do nothing;
      end loop;
    end loop;

    alter table songs drop column if exists songwriter;
  end if;
end;
$$;

create or replace function proposal_find_or_create_album(album_name text)
returns uuid
language plpgsql
as $$
declare
  album_id uuid;
begin
  if trim(coalesce(album_name, '')) = '' then
    return null;
  end if;

  select id into album_id
  from albums
  where lower(name) = lower(trim(album_name))
  order by created_at asc
  limit 1;

  if album_id is null then
    insert into albums (name)
    values (trim(album_name))
    returning id into album_id;
  end if;

  return album_id;
end;
$$;

create or replace function proposal_set_song_credits(song_id_value uuid, album_name_value text, artist_names_value text[])
returns void
language plpgsql
as $$
declare
  album_id_value uuid;
  artist_name_value text;
  artist_id_value uuid;
begin
  if trim(coalesce(album_name_value, '')) <> '' then
    album_id_value := proposal_find_or_create_album(album_name_value);
    update songs
    set album_id = album_id_value
    where id = song_id_value;
  end if;

  if coalesce(array_length(artist_names_value, 1), 0) = 0 then
    return;
  end if;

  delete from song_artists where song_id = song_id_value;

  foreach artist_name_value in array artist_names_value loop
    artist_id_value := proposal_find_or_create_artist(artist_name_value);
    if artist_id_value is null then
      continue;
    end if;

    insert into song_artists (song_id, artist_id)
    values (song_id_value, artist_id_value)
    on conflict do nothing;

    if album_id_value is not null then
      insert into album_artists (album_id, artist_id)
      values (album_id_value, artist_id_value)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

create or replace function proposal_apply_song_contributors(song_id_value uuid, album_name_value text, payload_value jsonb)
returns void
language plpgsql
as $$
declare
  album_id_value uuid;
  artist_row jsonb;
  credit_row jsonb;
  resolved_artist_id uuid;
begin
  select album_id into album_id_value
  from songs
  where id = song_id_value;

  if trim(coalesce(album_name_value, '')) <> '' then
    album_id_value := proposal_find_or_create_album(album_name_value);
    update songs
    set album_id = album_id_value
    where id = song_id_value;
  end if;

  if payload_value ? 'artists'
     and jsonb_typeof(coalesce(payload_value -> 'artists', '[]'::jsonb)) = 'array'
     and jsonb_array_length(coalesce(payload_value -> 'artists', '[]'::jsonb)) > 0 then
    delete from song_artists where song_id = song_id_value;

    for artist_row in
      select value
      from jsonb_array_elements(coalesce(payload_value -> 'artists', '[]'::jsonb)) as value
    loop
      resolved_artist_id := proposal_resolve_artist_reference(
        nullif(artist_row ->> 'id', '')::uuid,
        artist_row ->> 'name'
      );

      if resolved_artist_id is null then
        continue;
      end if;

      insert into song_artists (song_id, artist_id)
      values (song_id_value, resolved_artist_id)
      on conflict do nothing;

      if album_id_value is not null then
        insert into album_artists (album_id, artist_id)
        values (album_id_value, resolved_artist_id)
        on conflict do nothing;
      end if;
    end loop;
  elsif trim(coalesce(payload_value ->> 'artist_name', '')) <> '' then
    perform proposal_set_song_credits(song_id_value, album_name_value, proposal_parse_artist_names(payload_value ->> 'artist_name'));
  end if;

  if payload_value ? 'credits' then
    delete from song_credits where song_id = song_id_value;

    for credit_row in
      select value
      from jsonb_array_elements(coalesce(payload_value -> 'credits', '[]'::jsonb)) as value
    loop
      resolved_artist_id := proposal_resolve_artist_reference(
        nullif(credit_row ->> 'artist_id', '')::uuid,
        credit_row ->> 'artist_name'
      );

      if resolved_artist_id is null or trim(coalesce(credit_row ->> 'role', '')) = '' then
        continue;
      end if;

      insert into song_credits (song_id, artist_id, role)
      values (
        song_id_value,
        resolved_artist_id,
        trim(credit_row ->> 'role')
      )
      on conflict (song_id, artist_id, role) do nothing;

      if album_id_value is not null then
        insert into album_artists (album_id, artist_id)
        values (album_id_value, resolved_artist_id)
        on conflict do nothing;
      end if;
    end loop;
  end if;
end;
$$;

create or replace function proposal_build_song_snapshot(song_id_value uuid)
returns jsonb
language sql
stable
as $$
  select case
    when s.id is null then null
    else jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'bpm', s.bpm,
      'genre', s.genre,
      'year_released', s.year_released,
      'duration_ms', s.duration_ms,
      'spotify_id', s.spotify_id,
      'spotify_import', s.spotify_import,
      'album_id', s.album_id,
      'album_name', a.name,
      'user_id', s.user_id,
      'merged_into_song_id', s.merged_into_song_id,
      'credits', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'artist_id', sc.artist_id,
              'artist_name', ar.name,
              'role', sc.role
            )
            order by ar.name asc, sc.role asc
          )
          from song_credits sc
          join artists ar on ar.id = sc.artist_id
          where sc.song_id = s.id
        ),
        '[]'::jsonb
      ),
      'artist_names', coalesce(
        (
          select jsonb_agg(ar.name order by ar.name asc)
          from song_artists sa
          join artists ar on ar.id = sa.artist_id
          where sa.song_id = s.id
        ),
        '[]'::jsonb
      )
    )
  end
  from songs s
  left join albums a on a.id = s.album_id
  where s.id = song_id_value;
$$;

create or replace function proposal_restore_song_snapshot(snapshot_value jsonb)
returns void
language plpgsql
as $$
declare
  restored_song_id uuid;
  restored_artist_names text[];
  restored_credit jsonb;
  restored_credit_artist_id uuid;
begin
  if snapshot_value is null then
    return;
  end if;

  restored_song_id := (snapshot_value ->> 'id')::uuid;
  restored_artist_names := coalesce(
    array(
      select jsonb_array_elements_text(coalesce(snapshot_value -> 'artist_names', '[]'::jsonb))
    ),
    array[]::text[]
  );

  insert into songs (
    id,
    title,
    bpm,
    genre,
    year_released,
    duration_ms,
    spotify_id,
    spotify_import,
    album_id,
    user_id,
    merged_into_song_id
  )
  values (
    restored_song_id,
    snapshot_value ->> 'title',
    nullif(snapshot_value ->> 'bpm', '')::integer,
    nullif(snapshot_value ->> 'genre', ''),
    nullif(snapshot_value ->> 'year_released', '')::integer,
    nullif(snapshot_value ->> 'duration_ms', '')::integer,
    nullif(snapshot_value ->> 'spotify_id', ''),
    coalesce((snapshot_value ->> 'spotify_import')::boolean, false),
    null,
    nullif(snapshot_value ->> 'user_id', '')::uuid,
    nullif(snapshot_value ->> 'merged_into_song_id', '')::uuid
  )
  on conflict (id) do update
  set title = excluded.title,
      bpm = excluded.bpm,
      genre = excluded.genre,
      year_released = excluded.year_released,
      duration_ms = excluded.duration_ms,
      spotify_id = excluded.spotify_id,
      spotify_import = excluded.spotify_import,
      user_id = excluded.user_id,
      merged_into_song_id = excluded.merged_into_song_id;

  perform proposal_set_song_credits(
    restored_song_id,
    snapshot_value ->> 'album_name',
    restored_artist_names
  );

  delete from song_credits where song_id = restored_song_id;

  for restored_credit in
    select value
    from jsonb_array_elements(coalesce(snapshot_value -> 'credits', '[]'::jsonb)) as value
  loop
    restored_credit_artist_id := coalesce(
      nullif(restored_credit ->> 'artist_id', '')::uuid,
      proposal_find_or_create_artist(restored_credit ->> 'artist_name')
    );

    if restored_credit_artist_id is null then
      continue;
    end if;

    insert into song_credits (song_id, artist_id, role)
    values (
      restored_song_id,
      restored_credit_artist_id,
      coalesce(nullif(restored_credit ->> 'role', ''), 'Songwriter')
    )
    on conflict (song_id, artist_id, role) do nothing;
  end loop;
end;
$$;

create or replace function proposal_capture_merge_snapshot(song_ids uuid[])
returns jsonb
language plpgsql
stable
as $$
declare
  songs_snapshot jsonb;
begin
  select coalesce(jsonb_agg(snapshot_value), '[]'::jsonb)
  into songs_snapshot
  from (
    select proposal_build_song_snapshot(song_id_value) as snapshot_value
    from unnest(song_ids) as song_id_value
  ) snapshots
  where snapshot_value is not null;

  return jsonb_build_object(
    'songs', songs_snapshot,
    'likes', coalesce((select jsonb_agg(to_jsonb(l)) from likes l where l.song_id = any(song_ids)), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(to_jsonb(r)) from ratings r where r.song_id = any(song_ids)), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(rv)) from reviews rv where rv.song_id = any(song_ids)), '[]'::jsonb),
    'listened', coalesce((select jsonb_agg(to_jsonb(li)) from listened li where li.song_id = any(song_ids)), '[]'::jsonb),
    'listento', coalesce((select jsonb_agg(to_jsonb(lt)) from listento lt where lt.song_id = any(song_ids)), '[]'::jsonb),
    'playlist_songs', coalesce((select jsonb_agg(to_jsonb(ps)) from playlist_songs ps where ps.song_id = any(song_ids)), '[]'::jsonb),
    'favorite_songs', coalesce((select jsonb_agg(to_jsonb(fs)) from favorite_songs fs where fs.song_id = any(song_ids)), '[]'::jsonb),
    'song_credits', coalesce((select jsonb_agg(to_jsonb(sc)) from song_credits sc where sc.song_id = any(song_ids)), '[]'::jsonb),
    'recommendations', coalesce((
      select jsonb_agg(to_jsonb(rec))
      from recommendations rec
      where rec.source_song_id = any(song_ids) or rec.recommended_song_id = any(song_ids)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function approve_song_proposal(p_proposal_id uuid, p_actor_id uuid, p_reason text default null)
returns void
language plpgsql
as $$
declare
  proposal_row proposals%rowtype;
  payload_value jsonb;
  song_id_value uuid;
  before_snapshot_value jsonb;
  after_snapshot_value jsonb;
begin
  select * into proposal_row
  from proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if proposal_row.status <> 'pending' then
    raise exception 'Proposal % is not pending', p_proposal_id;
  end if;

  if proposal_row.type not in ('song_add', 'song_edit') then
    raise exception 'approve_song_proposal only handles add/edit proposals';
  end if;

  payload_value := coalesce(proposal_row.payload, '{}'::jsonb);

  if proposal_row.type = 'song_add' then
    insert into songs (
      title,
      bpm,
      genre,
      year_released,
      spotify_id,
      spotify_import,
      user_id
    )
    values (
      coalesce(nullif(payload_value ->> 'title', ''), 'Untitled'),
      nullif(payload_value ->> 'bpm', '')::integer,
      nullif(payload_value ->> 'genre', ''),
      nullif(payload_value ->> 'year_released', '')::integer,
      nullif(payload_value ->> 'spotify_id', ''),
      coalesce(proposal_row.spotify_import, false),
      proposal_row.proposer_id
    )
    returning id into song_id_value;

    perform proposal_apply_song_contributors(song_id_value, payload_value ->> 'album_name', payload_value);
    before_snapshot_value := null;
  else
    song_id_value := proposal_row.target_song_id;
    before_snapshot_value := proposal_build_song_snapshot(song_id_value);

    update songs
    set title = coalesce(nullif(payload_value ->> 'title', ''), title),
        bpm = coalesce(nullif(payload_value ->> 'bpm', '')::integer, bpm),
        genre = coalesce(nullif(payload_value ->> 'genre', ''), genre),
        year_released = coalesce(nullif(payload_value ->> 'year_released', '')::integer, year_released),
        spotify_id = coalesce(nullif(payload_value ->> 'spotify_id', ''), spotify_id),
        spotify_import = case
          when nullif(payload_value ->> 'spotify_id', '') is not null then true
          else spotify_import
        end,
        merged_into_song_id = null
    where id = song_id_value;

    perform proposal_apply_song_contributors(song_id_value, payload_value ->> 'album_name', payload_value);
  end if;

  after_snapshot_value := proposal_build_song_snapshot(song_id_value);

  update proposals
  set status = 'approved',
      target_song_id = song_id_value,
      approved_by = p_actor_id,
      approved_at = now(),
      spotify_import = coalesce(proposal_row.spotify_import, false) or nullif(payload_value ->> 'spotify_id', '') is not null,
      metadata = proposal_merge_jsonb(metadata, jsonb_build_object(
        'last_action_reason', coalesce(p_reason, 'Approved'),
        'last_action_by', p_actor_id,
        'approval_applied_at', now()
      ))
  where id = p_proposal_id;

  insert into proposal_audit_logs (
    proposal_id,
    actor_id,
    action,
    reason,
    before_snapshot,
    after_snapshot,
    metadata
  )
  values (
    p_proposal_id,
    p_actor_id,
    'approve',
    coalesce(p_reason, 'Approved'),
    before_snapshot_value,
    after_snapshot_value,
    jsonb_build_object('target_song_id', song_id_value)
  );
end;
$$;

create or replace function execute_song_merge(p_proposal_id uuid, p_actor_id uuid, p_reason text default null)
returns void
language plpgsql
as $$
declare
  proposal_row proposals%rowtype;
  payload_value jsonb;
  canonical_song_id_value uuid;
  candidate_song_ids_value uuid[];
  merged_song_id_value uuid;
  all_song_ids uuid[];
  before_snapshot_value jsonb;
  after_snapshot_value jsonb;
begin
  select * into proposal_row
  from proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if proposal_row.type <> 'song_merge' then
    raise exception 'Proposal % is not a merge proposal', p_proposal_id;
  end if;

  if proposal_row.status not in ('pending', 'approved') then
    raise exception 'Merge proposal % is not open for execution', p_proposal_id;
  end if;

  payload_value := coalesce(proposal_row.payload, '{}'::jsonb);
  canonical_song_id_value := coalesce(proposal_row.canonical_song_id, nullif(payload_value ->> 'canonical_song_id', '')::uuid);

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into candidate_song_ids_value
  from jsonb_array_elements_text(coalesce(payload_value -> 'candidate_song_ids', '[]'::jsonb)) as value;

  candidate_song_ids_value := array(
    select distinct song_id_value
    from unnest(candidate_song_ids_value) as song_id_value
    where song_id_value <> canonical_song_id_value
  );

  if canonical_song_id_value is null or coalesce(array_length(candidate_song_ids_value, 1), 0) = 0 then
    raise exception 'Merge proposal % is missing canonical or candidate ids', p_proposal_id;
  end if;

  all_song_ids := array_prepend(canonical_song_id_value, candidate_song_ids_value);
  before_snapshot_value := proposal_capture_merge_snapshot(all_song_ids);

  foreach merged_song_id_value in array candidate_song_ids_value loop
    delete from likes current_row
    using likes canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update likes set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from ratings current_row
    using ratings canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update ratings set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from reviews current_row
    using reviews canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update reviews set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from listened current_row
    using listened canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update listened set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from listento current_row
    using listento canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update listento set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from playlist_songs current_row
    using playlist_songs canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.playlist_id = current_row.playlist_id;
    update playlist_songs set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from favorite_songs current_row
    using favorite_songs canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.user_id = current_row.user_id;
    update favorite_songs set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    delete from song_credits current_row
    using song_credits canonical_row
    where current_row.song_id = merged_song_id_value
      and canonical_row.song_id = canonical_song_id_value
      and canonical_row.artist_id = current_row.artist_id
      and canonical_row.role = current_row.role;
    update song_credits set song_id = canonical_song_id_value where song_id = merged_song_id_value;

    update recommendations set source_song_id = canonical_song_id_value where source_song_id = merged_song_id_value;
    update recommendations set recommended_song_id = canonical_song_id_value where recommended_song_id = merged_song_id_value;

    update songs
    set merged_into_song_id = canonical_song_id_value
    where id = merged_song_id_value;

    insert into song_merge_aliases (alias_song_id, canonical_song_id, proposal_id)
    values (merged_song_id_value, canonical_song_id_value, p_proposal_id)
    on conflict (alias_song_id) do update
    set canonical_song_id = excluded.canonical_song_id,
        proposal_id = excluded.proposal_id,
        updated_at = now();
  end loop;

  after_snapshot_value := proposal_merge_jsonb(
    proposal_capture_merge_snapshot(array[canonical_song_id_value]),
    jsonb_build_object(
      'aliases', coalesce(
        (
          select jsonb_agg(to_jsonb(alias_row))
          from song_merge_aliases alias_row
          where alias_row.proposal_id = p_proposal_id
        ),
        '[]'::jsonb
      )
    )
  );

  update proposals
  set status = 'merged',
      target_song_id = canonical_song_id_value,
      approved_by = p_actor_id,
      approved_at = now(),
      metadata = proposal_merge_jsonb(metadata, jsonb_build_object(
        'last_action_reason', coalesce(p_reason, 'Merge executed'),
        'last_action_by', p_actor_id,
        'merged_song_ids', to_jsonb(candidate_song_ids_value),
        'merge_executed_at', now()
      ))
  where id = p_proposal_id;

  insert into proposal_audit_logs (
    proposal_id,
    actor_id,
    action,
    reason,
    before_snapshot,
    after_snapshot,
    metadata
  )
  values (
    p_proposal_id,
    p_actor_id,
    'merge-execute',
    coalesce(p_reason, 'Merge executed'),
    before_snapshot_value,
    after_snapshot_value,
    jsonb_build_object(
      'canonical_song_id', canonical_song_id_value,
      'merged_song_ids', to_jsonb(candidate_song_ids_value)
    )
  );
end;
$$;

create or replace function revert_song_proposal(p_proposal_id uuid, p_actor_id uuid, p_reason text default null)
returns void
language plpgsql
as $$
declare
  proposal_row proposals%rowtype;
  merge_snapshot_value jsonb;
  restored_song_snapshot jsonb;
  restored_song_ids uuid[];
  edit_snapshot_value jsonb;
  current_song_snapshot_value jsonb;
  current_merge_snapshot_value jsonb;
begin
  select * into proposal_row
  from proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal % not found', p_proposal_id;
  end if;

  if proposal_row.status not in ('approved', 'merged') then
    raise exception 'Proposal % is not in a revertible state', p_proposal_id;
  end if;

  if proposal_row.type = 'song_add' then
    current_song_snapshot_value := case
      when proposal_row.target_song_id is not null then proposal_build_song_snapshot(proposal_row.target_song_id)
      else null
    end;

    if proposal_row.target_song_id is not null then
      delete from songs where id = proposal_row.target_song_id;
    end if;

    update proposals
    set status = 'reverted',
        metadata = proposal_merge_jsonb(metadata, jsonb_build_object(
          'reverted_by', p_actor_id,
          'reverted_reason', coalesce(p_reason, 'Reverted')
        ))
    where id = p_proposal_id;

    insert into proposal_audit_logs (proposal_id, actor_id, action, reason, before_snapshot, after_snapshot, metadata)
    values (
      p_proposal_id,
      p_actor_id,
      'revert',
      coalesce(p_reason, 'Reverted'),
      current_song_snapshot_value,
      null,
      jsonb_build_object('target_song_id', proposal_row.target_song_id)
    );
    return;
  end if;

  if proposal_row.type = 'song_edit' then
    current_song_snapshot_value := proposal_build_song_snapshot(proposal_row.target_song_id);

    select before_snapshot into edit_snapshot_value
    from proposal_audit_logs
    where proposal_id = p_proposal_id
      and action = 'approve'
    order by created_at desc
    limit 1;

    if edit_snapshot_value is null then
      raise exception 'Edit snapshot missing for proposal %', p_proposal_id;
    end if;

    perform proposal_restore_song_snapshot(edit_snapshot_value);

    update proposals
    set status = 'reverted',
        metadata = proposal_merge_jsonb(metadata, jsonb_build_object(
          'reverted_by', p_actor_id,
          'reverted_reason', coalesce(p_reason, 'Reverted')
        ))
    where id = p_proposal_id;

    insert into proposal_audit_logs (proposal_id, actor_id, action, reason, before_snapshot, after_snapshot, metadata)
    values (
      p_proposal_id,
      p_actor_id,
      'revert',
      coalesce(p_reason, 'Reverted'),
      current_song_snapshot_value,
      edit_snapshot_value,
      jsonb_build_object('target_song_id', proposal_row.target_song_id)
    );
    return;
  end if;

  select before_snapshot into merge_snapshot_value
  from proposal_audit_logs
  where proposal_id = p_proposal_id
    and action = 'merge-execute'
  order by created_at desc
  limit 1;

  if merge_snapshot_value is null then
    raise exception 'Merge snapshot missing for proposal %', p_proposal_id;
  end if;

  select coalesce(array_agg((snapshot_item ->> 'id')::uuid), array[]::uuid[])
  into restored_song_ids
  from jsonb_array_elements(coalesce(merge_snapshot_value -> 'songs', '[]'::jsonb)) as snapshot_item;

  current_merge_snapshot_value := proposal_capture_merge_snapshot(restored_song_ids);

  delete from song_merge_aliases where proposal_id = p_proposal_id;
  delete from likes where song_id = any(restored_song_ids);
  delete from ratings where song_id = any(restored_song_ids);
  delete from reviews where song_id = any(restored_song_ids);
  delete from listened where song_id = any(restored_song_ids);
  delete from listento where song_id = any(restored_song_ids);
  delete from playlist_songs where song_id = any(restored_song_ids);
  delete from favorite_songs where song_id = any(restored_song_ids);
  delete from song_credits where song_id = any(restored_song_ids);
  delete from recommendations where source_song_id = any(restored_song_ids) or recommended_song_id = any(restored_song_ids);

  for restored_song_snapshot in
    select value
    from jsonb_array_elements(coalesce(merge_snapshot_value -> 'songs', '[]'::jsonb)) as value
  loop
    perform proposal_restore_song_snapshot(restored_song_snapshot);
  end loop;

  insert into likes (id, user_id, song_id, created_at)
  select id, user_id, song_id, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'likes', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, created_at timestamptz)
  on conflict do nothing;

  insert into ratings (id, user_id, song_id, rating, created_at)
  select id, user_id, song_id, rating, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'ratings', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, rating integer, created_at timestamptz)
  on conflict do nothing;

  insert into reviews (id, user_id, song_id, content, created_at)
  select id, user_id, song_id, content, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'reviews', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, content text, created_at timestamptz)
  on conflict do nothing;

  insert into listened (id, user_id, song_id, has_listened, created_at)
  select id, user_id, song_id, has_listened, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'listened', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, has_listened boolean, created_at timestamptz)
  on conflict do nothing;

  insert into listento (id, user_id, song_id, add_listento, created_at)
  select id, user_id, song_id, add_listento, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'listento', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, add_listento boolean, created_at timestamptz)
  on conflict do nothing;

  insert into playlist_songs (id, playlist_id, song_id, position, added_at)
  select id, playlist_id, song_id, position, added_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'playlist_songs', '[]'::jsonb))
    as restored(id uuid, playlist_id uuid, song_id uuid, position integer, added_at timestamptz)
  on conflict do nothing;

  insert into favorite_songs (id, user_id, song_id, position, created_at)
  select id, user_id, song_id, position, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'favorite_songs', '[]'::jsonb))
    as restored(id uuid, user_id uuid, song_id uuid, position integer, created_at timestamptz)
  on conflict do nothing;

  insert into song_credits (id, song_id, artist_id, role, created_at)
  select id, song_id, artist_id, role, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'song_credits', '[]'::jsonb))
    as restored(id uuid, song_id uuid, artist_id uuid, role text, created_at timestamptz)
  on conflict (song_id, artist_id, role) do nothing;

  insert into recommendations (id, source_song_id, recommended_song_id, user_id, is_helpful, created_at)
  select id, source_song_id, recommended_song_id, user_id, is_helpful, created_at
  from jsonb_to_recordset(coalesce(merge_snapshot_value -> 'recommendations', '[]'::jsonb))
    as restored(id uuid, source_song_id uuid, recommended_song_id uuid, user_id uuid, is_helpful boolean, created_at timestamptz)
  on conflict do nothing;

  update proposals
  set status = 'reverted',
      metadata = proposal_merge_jsonb(metadata, jsonb_build_object(
        'reverted_by', p_actor_id,
        'reverted_reason', coalesce(p_reason, 'Reverted')
      ))
  where id = p_proposal_id;

  insert into proposal_audit_logs (proposal_id, actor_id, action, reason, before_snapshot, after_snapshot, metadata)
  values (
    p_proposal_id,
    p_actor_id,
    'revert',
    coalesce(p_reason, 'Reverted'),
    current_merge_snapshot_value,
    merge_snapshot_value,
    jsonb_build_object('restored_song_ids', to_jsonb(restored_song_ids))
  );
end;
$$;

comment on table proposals is 'Pending song contribution proposals stored as sparse payload patches. Live song records are only mutated through approval or merge execution.';
comment on table user_privileges is 'Stores elevated moderation privileges. Level 1 = admin, level 2 = owner.';
comment on function approve_song_proposal(uuid, uuid, text) is 'RPC used by the backend to apply add/edit proposals transactionally and record an audit snapshot.';
comment on function execute_song_merge(uuid, uuid, text) is 'RPC used by the backend to execute a merge proposal, relink associations, and write a merge audit log.';
comment on function revert_song_proposal(uuid, uuid, text) is 'RPC used by the backend to revert approved contributions from audit snapshots and record an accurate before/after revert audit entry.';