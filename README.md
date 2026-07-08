# Larder — Meal Prep Inventory

A household kitchen app for prepped food stored in packs. Two faces, one app:

- **iPhone PWA** — inventory, meal planner, and shopping list in three tabs.
- **iPad kiosk dashboard** at `/dashboard` — an always-on, glanceable view of today's plan and what to eat next.

## Tech stack

Vite · React · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Realtime) · TanStack Query · Netlify

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

## Features

- **Larder** — meals live in the freezer, fridge, or shelf and are typed as full meal / component / ingredient. Freshness countdowns, per-serving macros, pack tracking with atomic eat/undo.
- **Planner** — two-week strip with breakfast/lunch/dinner/snack slots. Entries either link a larder meal (checking one off eats a pack) or are free-text "to make" items that can be pushed to the shopping list.
- **Shopping** — shared quick-add list with check-off and undoable clear.
- **Households** — all data is scoped to a household. New accounts create one or join with a 6-character invite code (found under the person icon in the Larder header).

## Data model

All tables carry a `household_id` and are guarded by membership-scoped RLS.

- **`households` / `household_members`** — tenancy and invite codes; joined via `create_household` / `join_household` RPCs.
- **`meals`** — one row per prepped batch: `storage_location`, `meal_type`, `prep_date`, `shelf_life_days`, computed `best_before`, packs, per-serving macros.
- **`meal_log`** — consumption events, written by the atomic `eat_pack` RPC (undone by `undo_eat`).
- **`plan_entries`** — dated slot entries, linked to a meal or title-only; completed via `complete_plan_entry`.
- **`shopping_items`** — the shared list.

## Freshness tiers

Thresholds depend on where the meal is stored (days to best-before):

| Tier | Freezer | Fridge | Shelf | Color |
| --- | --- | --- | --- | --- |
| Expired | < 0 | < 0 | < 0 | Red |
| Eat now | ≤ 7 | ≤ 1 | ≤ 2 | Orange |
| Eat soon | ≤ 21 | ≤ 3 | ≤ 5 | Amber |
| Fresh | beyond | beyond | beyond | Green |

## iPhone setup

Open the site in Safari → **Share** → **Add to Home Screen**. Launch it from the icon for the full-screen app experience.

## iPad kiosk setup

1. Log in once in Safari, then open `/dashboard`.
2. **Share** → **Add to Home Screen**, and launch from the icon.
3. Enable Guided Access for kiosk mode: **Settings → Accessibility → Guided Access**, then triple-click the side/home button while the app is open.
4. Keep the display awake: **Settings → Display & Brightness → Auto-Lock → Never.**

## Household accounts

New members sign up in the app, then join your household with the invite code from the Larder header (person icon → Invite code). Email signups must be enabled in **Supabase Dashboard → Authentication → Sign In / Up** for this to work; every account still only sees its own household's data.
