# Supabase Setup Guide

This guide shows you how to set up Supabase for winner history storage.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: `pixelarena` (or your project name)
   - **Database Password**: Generate a secure password
   - **Region**: Choose closest to your users
5. Click "Create new project"

## 2. Create Database Table

1. In your Supabase dashboard, click "SQL Editor" in the sidebar
2. Click "New Query"
3. Copy and paste the SQL from `supabase-setup.sql`
4. Click "Run" or press `Ctrl+Enter`
5. You should see "Success. No rows returned"

## 3. Get Your Credentials

1. Go to "Settings" → "API" in the sidebar
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 4. Configure Environment Variables

### For Vercel:

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add these variables:
   - **Key**: `NEXT_PUBLIC_SUPABASE_URL`
     - **Value**: Your Project URL
   - **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **Value**: Your anon public key
4. Click "Save"
5. Redeploy: `vercel --prod`

### For Docker/Local:

1. Copy `.env.example` to `.env.local`
2. Add these lines:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Restart your dev server

### For Docker Engine:

Add the same environment variables to your Docker deployment service:
- Render.com: Settings → Environment → Add environment variables
- Railway: Variables tab → Add variables
- docker-compose.yml: Add to `environment` section

## 5. Test the Setup

1. Start your application
2. Wait for a round to complete
3. Check Supabase dashboard → "Table Editor" → "winners"
4. You should see the winner entry appear!

## Troubleshooting

**No winners appearing in database:**
- Check browser console for errors
- Verify environment variables are set correctly
- Check that RLS policies are enabled (SQL script does this)
- Look at Docker logs: `docker-compose logs -f`

**"Failed to save winner" in logs:**
- Verify Supabase URL and key are correct
- Check that the table exists in Supabase
- Ensure RLS policies allow inserts

## Optional: View Winners

The frontend automatically fetches winners from Supabase via `/api/winners` endpoint.
Recent winners will appear in the "Recent Winners" section.

## Database Schema

```sql
winner{
  id: bigserial (primary key)
  round: integer
  address: text
  fees: decimal(20,9)
  tx_signature: text
  color: text
  pixels: integer
  created_at: timestamptz
}
```

