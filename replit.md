# Recall.ai — Understand more. Read less.

## Overview

A full-stack AI content intelligence app. Users paste any URL (articles, YouTube videos, PDFs, EPUBs) and get an AI-generated verdict on whether it's worth reading, dynamic bullet summaries, and can ask questions about content. Includes Learning Tools (flashcards, quiz mode, infographic), Slide Deck Generator, Deep Research mode, full data export (JSON/CSV/Markdown/ZIP), import, RSS feed subscriptions, reading status tracking + streaks, personal notes/annotations, Recall Wrapped annual review, Teams workspaces, Living Documents (change tracking), Notion integration, and EPUB book summarization with per-chapter summaries.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + Framer Motion (artifacts/recall-web)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM (lib/db)
- **AI**: Anthropic Claude (via Replit AI Integrations — no API key needed)
- **Content scraping**: Jina Reader API (primary) + direct fetch fallback
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: JWT (stored in localStorage as `recall_token`)
- **Build**: esbuild (CJS bundle)

## Architecture

### Frontend (artifacts/recall-web)
- Pages: Home (/), Saved Library (/saved), Notes (/notes), Strategy Canvas (/canvas), Highlights (/highlights), Insights (/insights), Knowledge Graph (/graph), Creator Tools (/create), Public Share (/share/:token), Settings (/settings), Auth (/login, /register), RSS Feeds (/feeds), Recall Wrapped (/wrapped/:year), Teams (/teams)
- Home page has dual mode: "Analyze URL" (standard) and "Deep Research" (autonomous research mode that generates a full report using library as context)
- AuthContext in src/lib/auth.tsx — manages JWT token in localStorage, calls setAuthTokenGetter for API requests
- Dark mode via ThemeProvider with localStorage persistence
- Recharts for Reading DNA donut chart and Knowledge Graph visualization

### Backend (artifacts/api-server)
Routes:
- `auth.*` — register, login, logout, me, profile update
- `summarize.*` — URL summarization via Jina Reader + Claude, suggest questions, ask about content, ask library, rabbit hole
- `library.*` — CRUD for saved articles, share tokens, spaced repetition reviews, library stats
- `collections.*` — CRUD for article collections
- `highlights.*` — Save and manage bullet highlights
- `insights.*` — Reading DNA analysis, reading streak, AI mentor recommendations
- `digest.*` — Daily digest preview, send email (requires RESEND_API_KEY), weekly report
- `payments.*` — Razorpay payment order creation and verification
- `feeds.*` — RSS feed subscriptions, auto-fetch and summarise, per-feed refresh
- `notes.*` — Personal notes per article (upsert/delete, all-notes fetch)
- `streak.*` — Daily streak check/update, weekly reading goal, status updates (unread/reading/completed)
- `wrapped.*` — Annual reading review data (topics, streak, highlights, source breakdown)
- `teams.*` — Create/join teams with invite codes, shared library, AI Q&A across team articles
- `living-documents.*` — Track content changes (MD5 hash), re-summarize on significant change, changeSummary field
- `notion.*` — OAuth connect/callback, sync individual articles or all, disconnect
- `export.*` — JSON, CSV, Markdown single file, ZIP archive (one .md per article), import JSON
- `summarize.*` — EPUB parsing via epub2: temp file → chapters → per-chapter AI summaries → book-level summary

### Database Schema (lib/db/src/schema/)
- `users` — email, password_hash, plan (free/pro), monthly_saves_count, saves_limit, preferred_language, daily_streak, best_streak, last_active_date, weekly_reading_goal
- `saved_articles` — title, verdict, bullets (jsonb), recall_score, credibility_score, share_token, spaced repetition fields, status (unread/reading/completed), reading_progress, is_rss, rss_feed_id
- `collections` — name, color per user
- `highlights` — bullet_text, note, linked to article
- `rss_feeds` — user_id, feed_url, feed_name, last_fetched_at, is_active, article_count
- `article_notes` — user_id, article_id, note_text (upserted per article)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database

The app uses **Supabase PostgreSQL** as its primary database (migrated May 2026).
- Connection is established via `SUPABASE_DATABASE_URL` (Transaction pooler, port 6543)
- Falls back to `DATABASE_URL` if `SUPABASE_DATABASE_URL` is not set
- `search_path=public` is set explicitly on every connection (required for Supabase pooler)
- Schema managed via Drizzle ORM (`lib/db/src/`)

## Optional Environment Variables (for extra features)

- `RESEND_API_KEY` — For sending daily digest emails
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — For payment processing (Pro plan)
- `YOUTUBE_API_KEY` — For enhanced YouTube video data

## AI Integration

Uses Replit's built-in Anthropic integration (no API key needed from user). Uses:
- `claude-haiku-4-5` for fast summarization, question suggestion, reading DNA
- `claude-sonnet-4-6` for Ask My Library (needs richer context synthesis)

## Action Engine (added May 2026)

Turns saved articles into a real weekly action plan instead of a passive read-later list.

- **Schema**: `action_items` (one row per extracted action, with `status`, `intent_type`, `snoozed_until`, `completed_at`), `action_plans` (one per `(user_id, week_start)` storing `plan_json`), plus `users.goals` and `saved_articles.intent_type` / `action_items_extracted`.
- **AI extraction**: when an article is saved (`POST /api/saved`), the server kicks off a fire-and-forget call to `extractActionItems()` (Claude Haiku) which fills in the article's `intent_type` and inserts up to 5 action items.
- **Weekly plan**: `GET /api/action-plan/current` returns this week's plan (auto-generates if missing and the user has any saves). `POST /api/action-plan/generate` force-regenerates. Plans are stored as `{ topActions: [{action, articleTitle?, rationale?}], insight }` and serialized into a flat shape for the UI.
- **User goals**: `GET/PATCH /api/user/goals` — used as personalization context when generating plans. Edited from the Settings page (`textarea-goals`).
- **Pending list**: `GET /api/action-items/pending` returns items grouped by `intent_type` (snoozed items reappear after 7 days) plus `{ saved, completed, pending }` stats over the last 30 days. `PATCH /api/action-items/:id` accepts `status: "completed" | "snoozed" | "pending"`.
- **Frontend**: new `/actions` page (`pages/actions.tsx`), Actions item in the sidebar with the lightning-bolt icon, "Today's actions" widget below the URL form on home (`components/home-actions-widget.tsx`), goals textarea in Settings, weekly digest email and `/report/weekly` updated to include the latest action plan.

## Free vs Pro Plan

- **Free**: 50 saves/month, basic features
- **Pro** (₹499/mo via Razorpay): Unlimited saves, all features
