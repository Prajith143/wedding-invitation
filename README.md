# Royal Wedding Invitation Website

A responsive, image-first wedding invitation website with `/admin` management, MP3 background music, image ordering, upload timestamps and Supabase cloud storage.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`. Without Supabase credentials, the site runs in **local preview mode**. Uploads are saved in this browser's local storage only; this is for testing, not production.

## Connect cloud storage and secure admin login

1. Create a Supabase project.
2. In Supabase Storage, create a **public** bucket named `wedding-assets`.
3. Open SQL Editor and run all of `supabase/setup.sql`.
4. In Authentication settings, disable public sign-ups.
5. In Authentication > Users, create your admin user and set a strong password.
6. Copy the Project URL and Publishable key from the Supabase Connect/API Keys area.
7. Put them in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

8. Restart `npm run dev`.
9. Visit `http://localhost:5173/admin` and sign in with the admin user you created.

**Security note:** The included SQL grants write access to authenticated Supabase users. Keep public sign-ups disabled and create only trusted admin accounts. Never put a Supabase service-role key in frontend code.

## Deploy free subdomain with Cloudflare Pages

1. Push this folder to a GitHub repository.
2. In Cloudflare Dashboard, open Workers & Pages > Create > Pages > Connect to Git.
3. Select the repository.
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Add environment variables under project Settings > Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. Deploy. Cloudflare provides a `*.pages.dev` subdomain.
8. Add a `_redirects` file containing `/* /index.html 200` to support client-side routes. (This project uses `/admin` on the same SPA.)

## Features

- Cover page with OPEN INVITATION action.
- Original uploaded invitation images displayed without text or design modification.
- Previous/next page navigation and page dots.
- MP3 upload, play/pause, mute and volume control.
- Music element stays mounted while navigating pages.
- Admin dashboard at `/admin`.
- Image ordering and upload timestamps.
- Settings for heading, subtitle, button text and music.
- Responsive layouts for phones, tablets and desktop.

## Important notes

- Browser autoplay with sound is restricted. Music starts after the visitor presses OPEN INVITATION; visitors can also use the player controls.
- Local preview uploads are stored only in the current browser. Use Supabase for shared, persistent uploads.
- Upload storage limits and free-tier quotas depend on your Supabase plan.
- Before publishing real wedding information, test the public site and admin login on both mobile and desktop.
