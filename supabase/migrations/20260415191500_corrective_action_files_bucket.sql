insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'corrective-action-files',
  'corrective-action-files',
  true,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do nothing;

drop policy if exists "Users can upload corrective action files" on storage.objects;
create policy "Users can upload corrective action files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'corrective-action-files');

drop policy if exists "Users can view corrective action files" on storage.objects;
create policy "Users can view corrective action files"
on storage.objects
for select
to authenticated
using (bucket_id = 'corrective-action-files');

drop policy if exists "Users can delete corrective action files" on storage.objects;
create policy "Users can delete corrective action files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'corrective-action-files');
