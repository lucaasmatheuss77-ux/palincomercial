-- Migration for adding meeting transcription support

-- 1. Add columns to commercial_activities for audio, transcript, and action items
alter table public.commercial_activities
  add column if not exists audio_bucket text,
  add column if not exists audio_path text,
  add column if not exists transcript text,
  add column if not exists action_items jsonb default '{}'::jsonb;

-- 2. Create Supabase Storage bucket for meeting audios
insert into storage.buckets (id, name, public)
values ('meeting-audios', 'meeting-audios', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

-- 3. Setup RLS policies for the meeting-audios bucket

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'meeting_audios_authenticated_select'
  ) then
    execute $policy$
      create policy meeting_audios_authenticated_select on storage.objects
      for select to authenticated
      using (bucket_id = 'meeting-audios')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'meeting_audios_authenticated_insert'
  ) then
    execute $policy$
      create policy meeting_audios_authenticated_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'meeting-audios')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'meeting_audios_authenticated_update'
  ) then
    execute $policy$
      create policy meeting_audios_authenticated_update on storage.objects
      for update to authenticated
      using (bucket_id = 'meeting-audios')
      with check (bucket_id = 'meeting-audios')
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'meeting_audios_authenticated_delete'
  ) then
    execute $policy$
      create policy meeting_audios_authenticated_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'meeting-audios')
    $policy$;
  end if;
end
$$;
