# Our Little World

A phone-friendly shared couple's bucket list and photo album. Alexia gets pink accents and Dyan gets blue, on a black background.

## Login
Choose Alexia or Dyan and enter that profile's password. There is no public account-creation screen. The app uses Appwrite email/password authentication. The exact two configured email accounts must also be members of the private Appwrite team that has access to the database table and photo bucket.

The website source never contains either password or an Appwrite API key.

## One-time setup (Appwrite; no SQL)

### 1. Create a free Appwrite Cloud project
1. Open https://cloud.appwrite.io/console and create a project named `our-little-world`.
2. In **Overview / Project Settings**, copy the Project ID and the API endpoint/region.
3. Under **Settings → Platforms**, add a **Web** platform with hostname `raleaalexia-cmyk.github.io`.

Appwrite Free currently includes a small project's database, storage, and bandwidth allowance. Free projects may pause after a week without activity; check Appwrite's current limits if you need uninterrupted availability.

### 2. Create the two users privately
1. In **Auth → Users**, create Alexia's user with her email and a new strong password.
2. Create Dyan's user with his email and a different new strong password.
3. The passwords previously typed into chat should be treated as exposed; choose new ones privately.
4. Never put passwords in GitHub or in `config.js`.

The public website has no sign-up UI. Access to shared data is restricted to Appwrite team members; accounts outside that team must not be given database or bucket permissions.

### 3. Create a private team
1. Open **Teams** and create a team named `our-little-world`.
2. Add the Alexia and Dyan Auth users as team members.
3. Keep other users out of this team. Copy the Team ID for reference.

### 4. Create one database and one table
1. Open **Databases → Create database**. Name it `our-little-world`; copy its ID.
2. Create a table named `shared_content`; copy its ID.
3. Add these columns. Except for `type`, set each column to **not required**. Use varchar/text for the text columns and boolean for `completed`.

| Column | Type | Size |
| --- | --- | ---: |
| `type` | Varchar, required | 16 |
| `title` | Varchar | 120 |
| `description` | Text | — |
| `category` | Varchar | 24 |
| `priority` | Varchar | 24 |
| `dream_date` | Varchar | 20 |
| `completed` | Boolean | — |
| `completed_at` | Varchar | 40 |
| `created_at` | Varchar | 40 |
| `folder` | Varchar | 100 |
| `name` | Varchar | 255 |
| `storage_path` | Varchar | 36 |
| `uploaded_by` | Varchar | 36 |

4. In the table's **Settings → Permissions**, grant the `our-little-world` **team** Read, Create, Update, and Delete access. Do not grant those permissions to `Any` or `Users`.

### 5. Create the private photo bucket
1. Open **Storage → Create bucket**, name it `couple-photos`, and copy the Bucket ID.
2. In the bucket's **Settings → Permissions**, grant the same team Read, Create, Update, and Delete access.
3. Do not grant access to `Any` or all authenticated users. If file security is enabled, the team permission must also apply to the uploaded files.

### 6. Connect the website
Open [`config.js` on GitHub](https://github.com/raleaalexia-cmyk/our-little-world/edit/main/config.js) and replace these placeholders:

- `YOUR_REGION`: your Appwrite region from the project's API endpoint. Keep the `.cloud.appwrite.io/v1` ending (for example, if your endpoint is `https://fra.cloud.appwrite.io/v1`, replace the whole endpoint value with that exact URL).
- `YOUR_APPWRITE_PROJECT_ID`: Project ID
- `YOUR_DATABASE_ID`: database ID
- `YOUR_TABLE_ID`: `shared_content` table ID
- `YOUR_BUCKET_ID`: `couple-photos` bucket ID
- `ALEXIA_ACCOUNT_EMAIL`: exact email used for Alexia's Auth user
- `DYAN_ACCOUNT_EMAIL`: exact email used for Dyan's Auth user

Click **Commit changes**. These IDs and email mappings are frontend configuration; do not add passwords or an Appwrite API key.

GitHub Pages will redeploy the site after the commit. Use the app at https://raleaalexia-cmyk.github.io/our-little-world/.

## Features
- One list shared between both accounts, including categories, priorities, search, and progress.
- Completed dreams remain at the bottom.
- Shared photo folders, upload, download, and delete.
- Realtime list and photo updates between devices.
- Responsive design for phone, tablet, and desktop.
- Pink Alexia theme and blue Dyan theme.
- Notes section removed.

## Security
The frontend checks which of the two configured profiles signed in, but the real data protection is enforced by Appwrite permissions. Only the team members should have access to the table and bucket. Never make the table or bucket public. Never put passwords or an Appwrite API key in frontend files or GitHub.
