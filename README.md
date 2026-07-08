# Larder — Meal Prep Inventory

A household meal-prep tracker for food stored in packs in the freezer. Two faces, one app:

- **iPhone PWA** — add meals, log servings, watch freshness countdowns and macros.
- **iPad kiosk dashboard** at `/dashboard` — an always-on, glanceable view of what's in the freezer and what to eat next.

## Tech stack

Vite · React · TypeScript · Tailwind v4 · Supabase (Postgres + Auth) · TanStack Query · Netlify

## Local development

```bash
npm install
```

Create a `.env` at the repo root:

```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:

```bash
npm run dev
```

## Data model

**`meals`** — one row per prepped batch:

- `prep_date`, `shelf_life_weeks`, and a computed `best_before`
- `servings_per_pack`, `pack_quantity`
- per-serving macros, including extended nutrients

**`meal_log`** — consumption events (who ate what, when), which decrement inventory.

## Freshness tiers

| Tier | Days to best-before | Color |
| --- | --- | --- |
| Expired | < 0 | Red |
| Eat now | ≤ 2 | Orange |
| Eat soon | ≤ 7 | Amber |
| Fresh | > 7 | Green |

## iPhone setup

Open the site in Safari → **Share** → **Add to Home Screen**. Launch it from the icon for the full-screen app experience.

## iPad kiosk setup

1. Log in once in Safari, then open `/dashboard`.
2. **Share** → **Add to Home Screen**, and launch from the icon.
3. Enable Guided Access for kiosk mode: **Settings → Accessibility → Guided Access**, then triple-click the side/home button while the app is open.
4. Keep the display awake: **Settings → Display & Brightness → Auto-Lock → Never**.

## Household accounts

Public signups are disabled. Add household members in the **Supabase Dashboard → Authentication → Users → Add user**.
