-- Chat files are private. Only members of the room (and app admins) can read them, through
-- signed links that expire. chat_messages.file_url now holds the storage path
-- ("<room id>/<file>") instead of a public URL; the app turns it into a signed link.
update storage.buckets set public = false where id = 'chat-files';

create policy "members read chat files" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-files'
    and (public.is_room_member_text((storage.foldername(name))[1]) or public.is_app_admin())
  );

-- Files sent before this stored the full public URL; keep just the path.
update public.chat_messages
  set file_url = substring(file_url from '/storage/v1/object/public/chat-files/(.+)$')
  where file_url like '%/storage/v1/object/public/chat-files/%';
