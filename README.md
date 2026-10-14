# StudyOS

A study workspace: assignments, a to-do list, notes, flashcards, subjects, an AI tutor, and study rooms. Next.js 16 with Supabase for sign-in and data, deployed on Vercel.

## Running it

```bash
npm install
npm run dev
```

`.env.local` needs:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (sign-in and data) |
| `ANTHROPIC_API_KEY` | Optional. Without it the AI features (tutor, summaries, flashcard generation) say they're off and everything else works. |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-haiku-5-5`. |

## Google

Signing in with Google only shares name and email. Google Classroom, Docs, and Slides are optional: Profile has a **Connect Google** button that asks for those scopes, and the token is kept in an httpOnly cookie for an hour. Classroom import, Classroom courses on the Subjects page, PDF summaries, and "Draft in Google Docs" only appear while connected. Many school accounts block third-party apps, so nothing else depends on it.

## Database

Tables live in the Supabase project; changes made from this repo are in `supabase/migrations/` (the original tables predate it). Every personal table (`assignments`, `notes`, `subjects`, `todos`, `flashcard_decks`, `ai_chats`, ...) is limited to its owner by row-level security.

A GitHub Action (`.github/workflows/keep-alive.yml`) reads one row every three days so the free Supabase project doesn't pause.

### Known issue: study room permissions

The community tables still trust the browser:

- Room passwords are stored in plain text and every signed-in user can read them; the check happens client-side.
- `room_members`, `room_polls`, and `message_reactions` allow any signed-in user to change any row, so a member could make themselves owner or undo a kick.

Fixing this means hashing passwords and joining through a database function, and limiting membership changes to owners and moderators.
