# Our Little World

A phone-friendly shared couple's bucket list and photo album. Alexia gets pink accents and Dyan gets blue, on a black background.

## Login
Choose Alexia or Dyan and enter that profile's password. There is no account-creation screen on the website. Login uses Appwrite email/password authentication with two internal alias emails:
- Alexia: `alexia@ourlittleworld.invalid`
- Dyan: `dyan@ourlittleworld.invalid`

These are intentionally non-deliverable alias addresses; they do not expose personal email addresses. Password reset emails will not reach these aliases, so reset a forgotten password directly in Appwrite Console.

The public website source never contains either password or an Appwrite API key.

## One-time setup (Appwrite; no SQL)

### 1. Create a free Appwrite Cloud project
1. Open https://cloud.appwrite.io/console and create a project named `our-little-world`.
2. In **Overview / Project Settings**, copy the Project ID and the API endpoint/region.
3. Under **Settings → Platforms**, add a **Web** platform with hostname `raleaalexia-cmyk.github.io`.

Appwrite's current Free plan includes 2 GB of storage and 5 GB of bandwidth, with usage limits. Free projects may pause after a week without activity. See [Appwrite pricing](https://appwrite.io/pricing) for current limits.

### 2. Privately create the two login users
In **Auth → Users**, create these two users manually (do not use the public website):
- Name: `Alexia`; Email: `alexia@ourlittleworld.invalid`; Password: choose a new strong password privately.
- Name: `Dyan`; Email: `dyan@ourlittleworld.invalid`; Password: choose a different new strong password privately.

The passwords previously typed into chat should be treated as exposed; use new passwords. These alias emails intentionally cannot receive email. Email verification is not required for signing in with these accounts; reset forgotten passwords in Appwrite Console.

Copy the **User ID** shown for each account. You will use these IDs in the data permissions.

### 3. Create one database and one table
1. Open **Databases → Create database**. Set its ID to `our-little-world-db`.
2. Create a table with ID `shared-content`.
3. Add the columns below. Only `type` is required. Set all others to not required. Use Varchar/Text for text columns and Boolean for `completed`.

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

4. In the table's **Settings → Permissions**, grant **Read, Create, Update, and Delete** to the specific **User IDs** for Alexia and Dyan. Add each user's ID individually. Do not grant access to **Any**, **Guests**, or all **Users**.

### 4. Create the private photo bucket
1. Open **Storage → Create bucket**. Set its ID to `couple-photos`.
2. In **Bucket Settings → Permissions**, grant **Read, Create, Update, and Delete** only to the same two specific User IDs.
3. Do not grant access to **Any**, **Guests**, or all **Users**. If file-level security is enabled, configure the same two user permissions for uploaded files.

### 5. Connect the website
Open [`config.js` on GitHub](https://github.com/raleaalexia-cmyk/our-little-world/edit/main/config.js) and replace just these two placeholders:
- `YOUR_REGION`: use the region/API endpoint displayed in Appwrite. For example, if the endpoint shown is `https://fra.cloud.appwrite.io/v1`, set the entire `endpoint` value to that exact URL.
- `YOUR_APPWRITE_PROJECT_ID`: your project's Project ID.

The database ID, table ID, bucket ID, and the two alias emails are already filled in. Do not add any password or API key. Click **Commit changes**.

GitHub Pages will redeploy after the commit. Open https://raleaalexia-cmyk.github.io/our-little-world/, select Alexia or Dyan, and enter the password assigned to that account in Appwrite.

## Features
- One list shared between both accounts, including categories, priorities, search, and progress.
- Completed dreams remain at the bottom.
- Shared photo folders, uploads, downloads, and deletion.
- Realtime list and photo updates between devices.
- Responsive phone, tablet, and desktop design.
- Pink Alexia theme and blue Dyan theme.
- Notes section removed.

## Security
Access is enforced by Appwrite's table and bucket permissions, not only by the frontend login screen. The two user IDs must be the only users granted access to the shared table and photo bucket. Never make either resource public. Never put passwords or an Appwrite API key in frontend files or GitHub.
