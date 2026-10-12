# Our Little World

A responsive couple's bucket list and shared photo album with a pink **her** theme and blue **him** theme on a black background.

## Features
- Secure Supabase email/password authentication — no browser-stored passwords or preview login.
- Exactly two app membership slots: one **her** profile and one **him** profile.
- Private first-time setup code, checked by a database function; each profile can be claimed only once.
- After both slots are claimed, the app hides account creation. Other Supabase auth accounts cannot access app content unless they have one of the two membership slots.
- One bucket list shared by both registered accounts, with categories, priorities, search, progress and completed items moved to the bottom.
- Shared private cloud photo album with folders, upload, download and delete.
- Mobile-responsive design.
- Password reset email flow.

## Required setup before login can work

### 1. Create a Supabase project
Create a project at https://supabase.com/ and wait for it to finish provisioning.

### 2. Configure the one-time setup code in the SQL
1. Open `supabase-schema.sql` in this repository.
2. Replace the exact text `REPLACE_WITH_A_PRIVATE_CODE_YOU_CHOOSE` with a strong, unique private code (at least 24 random characters is recommended). Do not use an example or a code you share publicly.
3. Open the Supabase SQL Editor, paste the updated entire script, and run it.
4. Keep the code private. Enter it in the website only when registering the her and him accounts. The database stores a bcrypt hash, not the plain code.

The SQL script sets up the two membership slots, security policies, shared bucket-list database, private photo metadata, and a private Storage bucket. If you already ran an older version of the starter SQL, run this updated script after replacing the setup-code placeholder.

### 3. Connect the front end
1. In Supabase, open Project Settings → API.
2. Copy the Project URL and the publishable/anon public key.
3. Put them in `config.js` as `supabaseUrl` and `supabaseAnonKey`.
4. Never put a `service_role` key in `config.js` or any browser file.

### 4. Configure email confirmation and redirects
In Supabase Authentication settings:
- Add `https://raleaalexia-cmyk.github.io/our-little-world/` to the allowed redirect URLs.
- Set the Site URL to the same deployed website address.
- Email confirmation may stay enabled. If enabled, the account holder must confirm the email, then log in again and enter the private couple setup code once to claim the chosen profile.

### 5. Create your two accounts
1. Open the website and select **For her**. Choose **Create an account**, enter her name, email, a strong password, and the private setup code, then submit.
2. Confirm the email if asked. If confirmation is enabled, log in after confirmation and enter the setup code to finish claiming the her profile.
3. Log out, select **For him**, and repeat using his own email and password.
4. Once both profiles are claimed, account creation is closed in the website. Sign in thereafter using those two registered accounts.

Choose different strong passwords for each person. Do not share either person's password.

## Privacy and limitations
- The GitHub repository is public; never commit passwords, the setup code, or a service-role key.
- The browser anon/publishable key is intended to be public, but database and Storage safety depends on the supplied row-level security policies.
- The setup code is only for claiming the two initial profile slots; it is not either person's login password.
- Because GitHub Pages is a static host, Supabase performs authentication and enforces access to shared cloud data.
- Only members of the two registered profile slots can read or write the shared bucket list and private photo album.

## Publish
Repository: https://github.com/raleaalexia-cmyk/our-little-world

In GitHub, open Settings → Pages → Deploy from a branch, choose `main` and `/(root)`, then Save. Once configured, GitHub Pages republishes after each commit.
