# Setting up accounts and sync (milestone 2)

This is the one-time setup that only you can do: a free Supabase project (the database and the
sign-in), and a Google sign-in key. Nothing here costs money. Allow about 30 minutes.

**What you hand back to me:** nothing secret. When you are done, tell me, and tell me the Supabase
**Project URL**. The two values the app needs go into Netlify (part C), not into chat.

**Keep secret** (never paste them in chat, in GitHub, or in the app): the Supabase **database
password**, the Supabase **service_role / secret key**, and the Google **client secret**. The
Supabase **Project URL** and **anon / publishable key** are meant to be public: the app ships with
them.

---

## A. Supabase (the database)

1. Go to <https://supabase.com> and sign in with GitHub.
2. **New project.** Name `climb-pass-tracker`. Choose a database password and save it in a password
   manager (you will rarely need it). **Region: Southeast Asia (Singapore).** Free plan.
3. Wait for the project to finish setting up (a minute or two).
4. Create the tables: open **SQL Editor** → **New query**.
   1. Open `supabase/migrations/20261002000000_init.sql` on GitHub, copy all of it, paste it in the
      editor and press **Run**. It should say "Success. No rows returned."
   2. New query again. Copy all of `supabase/seed_gyms.sql`, paste, **Run**.
   3. Check: **Table Editor** shows the tables `gyms`, `user_gyms`, `passes`, `freezes`, `uses`,
      `user_settings`, and `gyms` has the built-in gym names.
5. Copy two values from **Project Settings → API** (or the **Connect** button):
   - **Project URL**, like `https://abcdxyz.supabase.co`
   - **anon / publishable key** (a long string; *not* the service_role / secret key)

   You will paste both into Netlify in part C.

## B. Google sign-in

1. Go to <https://console.cloud.google.com>, sign in, and create a **New project** named
   `Climb Pass Tracker`.
2. Open **APIs & Services → OAuth consent screen** (it may be called **Google Auth Platform**).
   - User type: **External**. App name: `Climb Pass Tracker`. Add your email as the support
     email and the developer contact.
   - Scopes: leave only the defaults (email, profile, openid).
   - Add your own Google address under **Test users** for now.
   - Later, before you tell the public about the app, press **Publish app** so anyone can sign in.
     It does not need Google's review because the app asks only for the basic sign-in details.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
   - Application type: **Web application**. Name: `Climb Pass Tracker web`.
   - **Authorized redirect URIs:** `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (use your own Project URL from part A, with `/auth/v1/callback` on the end).
   - Leave "Authorized JavaScript origins" empty. Press **Create**.
4. Copy the **Client ID** and **Client secret**.

## C. Connect them

1. In Supabase: **Authentication → Sign In / Providers → Google.** Turn it on, paste the Client ID
   and Client secret, Save.
2. In Supabase: **Authentication → URL Configuration.**
   - **Site URL:** `https://climbpasstracker.netlify.app`
   - **Redirect URLs** (add each):
     - `https://climbpasstracker.netlify.app/**`
     - `https://deploy-preview-*--climbpasstracker.netlify.app/**`
     - `http://localhost:5173/**`
     - `http://localhost:4173/**`
3. In Netlify: **Site configuration → Environment variables → Add a variable**, for **all
   deploy contexts** (production and deploy previews):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key

   Netlify only applies new variables to *new* builds, so a preview built before this will not
   have them.

## D. Check it worked

- In Supabase **Table Editor**, `gyms` lists the built-in gym names.
- In Supabase **Authentication → Providers**, Google shows as enabled.
- Tell me it is done. The sign-in button itself arrives in the next step (2.2), and then you can try
  it on a preview.

## Later

- The built-in gym list is loaded by running `supabase/seed_gyms.sql`. After you change
  `src/data/gyms.ts`, run `npm run gyms:sql` and run the new file in the SQL Editor again.
- Changes to the database come as new files in `supabase/migrations/`. I will say which to run.
