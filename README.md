# TwinMinds Studio — Next.js + Tailwind + Framer Motion

Minimal, production‑ready marketing site starter for TwinMinds Studio.

## Quickstart
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Tech
- Next.js (App Router)
- Tailwind CSS (dark mode, lime gradient accents)
- Framer Motion (scroll reveals, hover motion)
- Simple API route for contact form (replace with your email/Supabase logic)

## Customize
- Edit copy in components
- Update project links in `lib/projects.ts`
- Replace email in `components/Contact.tsx`
- Copy `.env.example` to `.env` and fill in:
  - `NEXT_PUBLIC_SITE_URL` – production URL (e.g. `https://www.twinminds.studio/`)
  - `RESEND_API_KEY` – API key from [Resend](https://resend.com)
  - `RESEND_FROM_EMAIL` – verified sender (e.g. `"TwinMinds Studio <hello@twinminds.studio>"`)
  - `CONTACT_TO_EMAIL` – inbox that should receive enquiries
