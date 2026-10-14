-- Rooms and messages were readable by anyone holding the public anon key, signed in or not.
-- Limit reading to signed-in users. (Room passwords and the open room_members/polls/reactions
-- policies still need a proper rework; see the README.)
drop policy if exists "rooms public read" on public.chat_rooms;
create policy "rooms signed-in read" on public.chat_rooms
  for select to authenticated using (true);

drop policy if exists "messages public read" on public.chat_messages;
create policy "messages signed-in read" on public.chat_messages
  for select to authenticated using (true);
