# Our Little World

A mobile-friendly couple's bucket list and shared cloud photo album. Alexia gets pink accents, Dyan gets blue, on a black background.

## The login is intentionally simple
- Choose **Alexia** or **Dyan**.
- Enter that profile's password.
- There is no **Create account** button, no name field, and no email field on the public login screen.
- The website maps each profile to an existing Supabase Auth email configured in `config.js`. It checks the account's database membership before opening the private app.
- The database allows only two membership roles: `her` and `him`. Any other Supabase Auth user is denied access to shared data.

The public source does not contain passwords. Do not add passwords to `config.js`, GitHub, or any frontend code.

## Required private setup

### 1. Create a Supabase project
Create a project at https://supabase.com/ and wait for provisioning to finish.

### 2. Privately create the two login accounts
In Supabase, open **Authentication → Users → Add user**:
1. Create Alexia's user using her real email address and a strong private password. Mark/confirm the email as confirmed if you want password login to work immediately.
2. Create Dyan's user using his real email address and a different strong private password. Confirm the email too.
3. Do not use the public website to create accounts; it intentionally has no sign-up function.

The passwords previously typed in a chat should be treated as exposed. Set fresh passwords privately in Supabase, and never enter them into GitHub or this file.

### 3. Assign the only two app profiles
1. Open `supabase-schema.sql` in this repository and copy its full contents.
2. In the **Supabase SQL Editor only**, replace `ALEXIA_EMAIL_REPLACE_THIS` and `DYAN_EMAIL_REPLACE_THIS` in the two membership insert statements with the exact email addresses used for the two Supabase Auth users.
3. Run the SQL script. It creates row-level security policies, the two approved membership roles, the shared bucket list, private photo storage and live-sync publication. Do not commit actual emails or credentials into the SQL file in this public repository.
4. If you previously tested the old sign-up version and the SQL reports that a profile is already assigned to another user, inspect `public.couple_members` in the SQL Editor and remove only the obsolete test membership before running the two insert statements again. Do not delete either Auth user.

### 4. Connect the website to Supabase
In Supabase **Project Settings → API**, copy the Project URL and the publishable/anon public key. Edit `config.js` in GitHub and replace:
- `YOUR_SUPABASE_PROJECT_URL` with the Project URL
- `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY` with the publishable/anon key
- `ALEXIA_AUTH_EMAIL` with Alexia's Auth email
- `DYAN_AUTH_EMAIL` with Dyan's Auth email

Save/commit `config.js`; GitHub Pages automatically rebuilds after a commit. The email mappings are visible in the public frontend, so use email addresses you are comfortable being public. Never add either password or a `service_role` key to this file.

### 5. Open and log in
Visit https://raleaalexia-cmyk.github.io/our-little-world/ . Pick Alexia or Dyan and enter the password privately set for that account. Each account must have the matching membership entry from step 3.

## Features
- Shared bucket list with categories, priorities, search, progress, and completed items moved to the bottom.
- Private cloud photo album with custom folders, uploads, downloads, and deletion.
- Realtime updates across devices.
- Responsive phone, tablet, and desktop layout.
- Pink Alexia theme and blue Dyan theme.
- Password reset is intentionally not shown on the public screen; manage/reset passwords in Supabase Authentication.

## Security
- The GitHub repository is public. Do not commit passwords, actual credentials, real email addresses, or service-role keys.
- Use only the Supabase publishable/anon key in browser configuration, with the supplied row-level-security policies enabled.
- Only users listed in `public.couple_members` can access the shared bucket list and cloud photo album.

## Publish
Repository: https://github.com/raleaalexia-cmyk/our-little-world

In GitHub, open **Settings → Pages → Deploy from a branch**, choose `main` and `/(root)`, then Save.
