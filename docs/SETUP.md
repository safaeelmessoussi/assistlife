# Service setup

The app runs without any of this: accounts and Google Calendar simply show "not switched on yet". Each part below switches one of them on. All values you copy are public identifiers; none is a secret.

Dashboards change their labels from time to time, so a button may be named slightly differently.

## 1. Accounts and encrypted backup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com). Choose a region in Europe.
2. Open **SQL Editor**, paste the contents of [`supabase/migrations/0001_vaults.sql`](../supabase/migrations/0001_vaults.sql) and run it.
3. Open **Authentication → URL Configuration** and set **Site URL** to `https://assistlife.pages.dev`.
4. Open **Project Settings → API** (or **API Keys**) and copy:
   - the **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - the **anon** (also called **publishable**) key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Never copy the `service_role` / secret key anywhere in this project.

E-mail confirmation can stay on (new users confirm by a link, then sign in) or be switched off under **Authentication → Sign In / Providers → Email** for quicker testing.

## 2. Google Calendar

1. In [Google Cloud Console](https://console.cloud.google.com), create a project.
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** (or **Google Auth Platform**): user type **External**, keep it in **Testing**, and add as **test users** the Google addresses that will try the app.
4. Add the scope `https://www.googleapis.com/auth/calendar.readonly`.
5. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Under **Authorized JavaScript origins** add `https://assistlife.pages.dev` (and `http://localhost:8081` for local runs).
6. Copy the **Client ID** → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. The client secret is not used.

While the consent screen is in Testing, only the listed test users can connect, and Google shows an "unverified app" notice. Verification by Google is needed before a public launch.

## 3. Give the values to the hosted site (Cloudflare Pages)

1. In the Cloudflare dashboard open the `assistlife` project → **Settings → Variables and Secrets** (or **Environment variables**).
2. Add the three variables above for the **Production** environment, as plain text.
3. **Deployments → Retry deployment** on the latest one, so the site is rebuilt with them.

For local runs, copy `.env.example` to `.env.local` and fill it in.
