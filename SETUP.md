# Setting up Letterbox (about 15 minutes)

## 1. Firebase (a new project, separate from Tally)
1. Go to console.firebase.google.com → **Create a project** → name it `letterbox`. Analytics can be off.
2. Click the **</>** web icon to add a web app, call it `letterbox`, skip hosting.
3. Done: the firebaseConfig is already in index.html. Click **Continue to the console**.
4. **Build → Firestore Database → Create database** → London (europe-west2) → production mode.
5. **Firestore Database → Rules** → delete everything, paste all of `firestore.rules`, click **Publish**.
6. **Build → Authentication → Get started → Email/Password** → Enable → Save.

## 2. GitHub
1. New repository called `letterbox`, Public, tick "Add a README".
2. Upload everything in this folder (index.html, CNAME, firestore.rules, manifest.webmanifest, sw.js,
   LICENSE, README.md and the icons folder).
3. **Settings → Pages** → branch **main**, folder **/ (root)** → Save.
4. Still in **Settings → Pages**, under **Custom domain** type `letterbox.thepuzzleshed.com` → Save.
   (The CNAME file in this folder already says this.) Once the check goes green, tick **Enforce HTTPS**.

## 3. Namecheap
1. Domain List → thepuzzleshed.com → **Manage** → **Advanced DNS** → **Add new record**.
2. Type **CNAME Record**, Host `letterbox`, Value `delooze29-stack.github.io`, TTL Automatic → tick to save.
   It can take from a few minutes up to an hour to start working.

## 4. Firebase: allow the new address
**Authentication → Settings → Authorised domains → Add domain** → `letterbox.thepuzzleshed.com`.
Without this, sign-in won't work on the new address.

## 5. Test
Open **letterbox.thepuzzleshed.com**, tap 🏆, make a nickname and password, play today's game, then check the This week and Today tabs.

## Notes
- Players can change their own password: 🏆 → Change password.
- If someone forgets theirs: GitHub → letterbox repo → Actions → **Reset a password** → Run workflow,
  type their nickname and a new password, Run. Tell them the new one. (Needs the
  FIREBASE_SERVICE_ACCOUNT secret, see below.)

## Reset-a-password setup (once)
1. Firebase → ⚙ Project settings → **Service accounts** → **Generate new private key** → Generate.
   A .json file downloads. Keep it private.
2. GitHub → letterbox repo → **Settings → Secrets and variables → Actions → New repository secret**.
   Name `FIREBASE_SERVICE_ACCOUNT`, paste the whole contents of the .json file, **Add secret**.
3. Delete the downloaded .json file from your computer.
- Private leagues are included. Not included yet: notifications, challenges.
