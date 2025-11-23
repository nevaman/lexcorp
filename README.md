<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/14XvoCQCPneyoMDWXYMmwtHFQ0P7RfIuy

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_key
   ```
3. Apply the Supabase migrations (via `supabase db push` or run the SQL files in `supabase/migrations`).
4. Run the app:
   `npm run dev`

## Branch admin invite emails

Inviting a branch admin triggers the Edge Function `send-branch-invite`, which sends a branded email via SMTP. Configure it once per Supabase project:

1. Set the SMTP credentials (Supabase-provided or your own) as secrets:
   ```
   supabase secrets set \
     SMTP_HOST=... \
     SMTP_PORT=465 \
     SMTP_USER=... \
     SMTP_PASS=... \
     SMTP_SENDER="LexCorp Legal <legal@example.com>"
   ```
   
2. Deploy the function:
   ```
   supabase functions deploy send-branch-invite
   ```
   During local development you can run `supabase functions serve send-branch-invite` in another terminal to test deliveries.

If email delivery fails, the UI will still surface the generated invite link so you can share it manually.
