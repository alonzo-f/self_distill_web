# Supabase Local And Production Flow

This project supports two execution modes:

- Local development fallback: no Supabase variables configured. API routes use in-memory state so the app still runs.
- Supabase mode: `NEXT_PUBLIC_SUPABASE_URL` and keys are configured. API routes persist participants and photos to Supabase.

## Local Development Flow

Prerequisites:

- Docker Desktop running
- Supabase CLI available through `npx supabase`

Start local Supabase:

```powershell
npm run supabase:start
```

Copy the local API URL, anon key, and service role key printed by Supabase into `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Then replace these values:

```text
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
SUPABASE_SERVICE_ROLE_KEY=<local service role key>
```

Apply schema from scratch:

```powershell
npm run supabase:reset
```

Run the app:

```powershell
npm run dev:local
```

Local checks:

```powershell
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Manual local test:

1. Open `http://localhost:3000`.
2. Complete registration and photo capture.
3. Open `http://localhost:3000/wall` in another window.
4. Confirm the participant appears and updates after benchmark.
5. Open Supabase Studio at `http://127.0.0.1:54323` and inspect `participants` plus the `participant-photos` bucket.

## Production Flow

Production prerequisites:

- Supabase Cloud project
- Migration applied to the cloud database
- Vercel project connected to this repo
- HTTPS domain, required for reliable mobile camera permissions

Apply schema to production:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Set Vercel environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=<cloud project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key>
SUPABASE_SERVICE_ROLE_KEY=<cloud service role key>
AI_PROVIDER=<provider>
AI_MODEL=<model>
AI_API_KEY=<server-only key>
AI_BASE_URL=<optional compatible endpoint>
RESEND_API_KEY=<future messaging>
TWILIO_ACCOUNT_SID=<future sms>
TWILIO_AUTH_TOKEN=<future sms>
CRON_SECRET=<future cron guard>
```

Production checks:

1. Deploy to Vercel preview.
2. Test registration/photo on a real phone over HTTPS.
3. Run two or more phones plus `/wall` and confirm shared participant state.
4. Confirm photos are uploaded to `participant-photos`.
5. Run `npm run build` locally before promoting to production.

## Current Scope

Implemented now:

- Participant persistence through Supabase when configured.
- Photo upload to Supabase Storage when configured.
- Projection wall updates through Supabase Realtime Broadcast when configured.
- In-memory fallback when Supabase is not configured.
- Local and production migration files.

Still pending:

- Anonymous auth session binding per participant.
- Operator actions persistence and broadcast.
- Post-experience messaging cron.
