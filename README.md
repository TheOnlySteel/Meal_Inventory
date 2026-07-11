# Larder — Household Kitchen & Home Management

A household management PWA that grew out of a meal-prep tracker. Two faces, one app:

- **iPhone PWA** — five tabs: Home (day planner), Larder (inventory), Recipes, Chores, Shopping.
- **iPad kiosk dashboard** at `/dashboard` — an always-on, glanceable view of today's plan, today's chores, and what to eat next.

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

- **Home** — the day's source of truth: a three-week strip (a week of history, two weeks ahead) with breakfast/lunch/dinner/snack slots that appear only when populated. Entries either link a larder meal (checking one off eats a pack) or are free-text "to make" items that can be pushed to the shopping list. Today's and overdue chores show here too.
- **Larder** — meals live in the freezer, fridge, or shelf and are typed as full meal / component / ingredient. Freshness countdowns, per-serving macros, pack tracking with atomic eat/undo.
- **Recipes** — the household recipe book with per-serving macros, one-per-line ingredients, and instructions. "Send to larder" opens the meal form prefilled from the recipe; ingredients push to the shopping list in one tap; any meal can be saved back as a recipe.
- **Chores** — one-off or recurring (completing a recurring chore advances its due date), assignable to named household members, grouped by Overdue/Today/Upcoming/Someday/Done.
- **Shopping** — shared quick-add list with check-off and undoable clear.
- **Households** — all data is scoped to a household. New accounts create one or join with a 6-character invite code (person icon in the Larder header, where members can also edit their display names).

## Data model

All tables carry a `household_id` and are guarded by membership-scoped RLS.

- **`households` / `household_members`** — tenancy, invite codes, and member display names; joined via `create_household` / `join_household` RPCs.
- **`meals`** — one row per prepped batch: `storage_location`, `meal_type`, `prep_date`, `shelf_life_days`, computed `best_before`, packs, per-serving macros, optional `recipe_id`.
- **`meal_log`** — consumption events, written by the atomic `eat_pack` RPC (undone by `undo_eat`).
- **`recipes`** — the recipe book: ingredients (one per line), instructions, per-serving macros, default storage and shelf life.
- **`plan_entries`** — dated slot entries, linked to a meal or title-only; completed via `complete_plan_entry`.
- **`chores`** — one-off or recurring tasks with optional assignee; `complete_chore` advances recurring due dates and stores the prior schedule for exact undo.
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

1. Log in once in Safari, then **Share** → **Add to Home Screen** and launch from the icon. (The installed app always opens on the home screen, regardless of the page it was installed from.)
2. In the app, open the **Larder** tab and tap **Kiosk** in the header to reach the dashboard.
3. Enable Guided Access for kiosk mode: **Settings → Accessibility → Guided Access**, then triple-click the side/home button while the app is open — it stays on the dashboard while pinned.
4. Keep the display awake: **Settings → Display & Brightness → Auto-Lock → Never.**

## Household accounts

New members sign up in the app, then join your household with the invite code from the Larder header (person icon → Invite code). Email signups must be enabled in **Supabase Dashboard → Authentication → Sign In / Up** for this to work; every account still only sees its own household's data.
