# Job Tracker

A personal **job application tracker**: sign in, add roles you are pursuing, and move them through a hiring pipeline on a kanban-style board. Data is stored per user on the server, with optional **offline editing** and **install-as-app** (PWA) support so you can keep working when the network drops.

## What it is for

Use Job Tracker when you want a single place to:

- Record **company**, **role**, **location**, **salary**, **job posting URL**, **date applied**, and **notes**
- See applications grouped by stage: **Wishlist → Applied → Interview → Offer → Rejected**
- **Drag cards** between columns to update status
- **Search** by company or position
- **Stay productive offline**: changes queue locally and sync when you are back online

Each account only sees its own applications. Authentication uses Laravel **session cookies** and **CSRF** protection (no API tokens stored in the browser).

## Features

| Area | Details |
|------|---------|
| Auth | Register, log in, log out (`/api/register`, `/api/login`, `/api/logout`, `/api/me`) |
| Applications | CRUD via `/api/applications` (list, create, update, delete) |
| UI | React SPA served from `/`, Tailwind CSS |
| Offline | IndexedDB cache + sync queue; banners when offline or pending sync |
| PWA | Install prompt, service worker, standalone app manifest |

## Tech stack

- **Backend:** PHP 8.3+, Laravel 13
- **Frontend:** React 19, Vite 8, Tailwind CSS 4
- **Database:** SQLite by default (configurable via `.env`)
- **PWA:** `vite-plugin-pwa` / Workbox

## Requirements

- PHP 8.3+ and [Composer](https://getcomposer.org/)
- Node.js 18+ and npm
- SQLite extension enabled in PHP (default), or MySQL/MariaDB if you change `.env`

Check tools from a terminal in the project folder:

```bash
php -v
composer -V
node -v
npm -v
```

## Local setup

### 1. First-time install

In the project root (`job-tracker`):

```bash
composer setup
```

That command:

1. Runs `composer install`
2. Copies `.env.example` → `.env` if `.env` is missing
3. Runs `php artisan key:generate`
4. Runs migrations (SQLite file at `database/database.sqlite` by default)
5. Runs `npm install` and `npm run build` (compiled CSS/JS in `public/build`)

**Windows (cmd):** if you prefer manual steps instead of `composer setup`:

```cmd
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
npm install
npm run build
```

### 2. Run the app locally

Pick **one** of these workflows.

#### Option A — Laravel dev server (simplest)

Starts PHP (`artisan serve`), the Vite dev server, and related processes together:

```bash
composer dev
```

Open **http://localhost:8000**, register, and use the app.

Use this when you are editing React/CSS and want **hot reload** without extra terminals.

#### Option B — Laragon (or another local Apache/Nginx host)

Your project already lives under Laragon (`www/Projects/job-tracker`). Laragon can serve PHP; you still need frontend assets built or Vite running.

1. Start **Laragon** (Apache/Nginx + PHP).
2. Open the site URL Laragon gives you (often something like `http://job-tracker.test` — check Laragon’s menu).
3. In `.env`, set `APP_URL` to that exact URL (no trailing slash), for example:

   ```env
   APP_URL=http://job-tracker.test
   ```

4. **After `composer setup`:** visiting the Laragon URL is enough — `npm run build` already ran.

5. **While developing the UI:** keep Vite running in a second terminal:

   ```bash
   npm run dev
   ```

   Reload the Laragon URL in the browser. Leave Laragon handling PHP; Vite serves hot-reloaded JS/CSS.

If the page loads but styles/scripts are missing, run `npm run build` once, or start `npm run dev` as above.

#### Option C — Manual two-terminal dev

```bash
# Terminal 1
php artisan serve

# Terminal 2
npm run dev
```

Then open **http://localhost:8000**.

### 3. Database

Default `.env` uses SQLite:

```env
DB_CONNECTION=sqlite
```

The database file is `database/database.sqlite`. Migrations create `users`, sessions, cache, and `job_applications` tables.

To reset the local database:

```bash
php artisan migrate:fresh
```

### 4. Common issues

| Problem | What to try |
|---------|-------------|
| `APP_KEY` / encryption errors | `php artisan key:generate` |
| 500 after clone | `composer install`, copy `.env`, migrate, `npm run build` |
| Blank page or Vite error | Run `npm run dev` or `npm run build` |
| Session/CSRF oddities on Laragon | Match `APP_URL` to the URL in the browser; clear cookies for that host |
| `touch` not found on Windows | Create `database/database.sqlite` as an empty file, or run `php artisan migrate` (Laravel creates it when needed) |

### Manual setup (reference)

Same as `composer setup`, step by step:

```bash
composer install
cp .env.example .env   # Windows cmd: copy .env.example .env
php artisan key:generate
php artisan migrate
npm install
npm run build
php artisan serve       # or use Laragon + optional npm run dev
```

## API overview

JSON routes live under `/api` in the **web** middleware group so they use the same session and CSRF cookies as the SPA.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | — | Current user or `null` |
| POST | `/api/register` | — | Create account and log in |
| POST | `/api/login` | — | Log in |
| POST | `/api/logout` | yes | End session |
| GET | `/api/applications` | yes | List applications (`?q=` optional search) |
| POST | `/api/applications` | yes | Create |
| PUT | `/api/applications/{id}` | yes | Update (partial updates supported, e.g. status only) |
| DELETE | `/api/applications/{id}` | yes | Delete |

Login and register are rate-limited (10 requests per minute).

## Project layout (high level)

```
app/
  Http/Controllers/   AuthController, JobApplicationController
  Models/             User, JobApplication
resources/
  js/app.jsx          React UI (board, auth, offline UX)
  js/offlineStore.js  IndexedDB + sync queue
  views/app.blade.php SPA shell
routes/web.php        `/` view + `/api/*` routes
```

## Deploy on Render (recommended if Fly.io is painful)

Uses the same [`Dockerfile`](Dockerfile) as Fly. **No CLI required** — GitHub + dashboard only. Free web tier spins down when idle (first request may take ~30s).

### Option A — Blueprint (Postgres + web app in one flow)

1. Push this repo to GitHub.
2. [render.com](https://render.com) → sign up → **New** → **Blueprint**.
3. Connect the repo. Render reads [`render.yaml`](render.yaml) and creates **job-tracker** (web) + **job-tracker-db** (Postgres).
4. When prompted, set **sync: false** variables:
   - `APP_KEY` — run locally: `php artisan key:generate --show`
   - `APP_URL` — after deploy: `https://<your-service-name>.onrender.com` (shown on the service page)
5. Wait for deploy. Open the URL → register → test the board.

### Option B — Manual

1. **New** → **PostgreSQL** (free). Copy the **Internal Database URL** (or External if required).
2. **New** → **Web Service** → connect repo → **Language: Docker**.
3. **Environment** (same as Fly/Railway):

| Variable | Value |
|----------|--------|
| `APP_KEY` | `php artisan key:generate --show` |
| `APP_URL` | `https://YOUR-SERVICE.onrender.com` |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_NAME` | `Job Tracker` |
| `DB_CONNECTION` | `pgsql` |
| `DATABASE_URL` | Paste from Postgres dashboard |
| `SESSION_DRIVER` | `database` |
| `CACHE_STORE` | `database` |
| `LOG_CHANNEL` | `stderr` |
| `SESSION_SECURE_COOKIE` | `true` |

4. **Health Check Path:** `/up` → **Create Web Service**.

**Note:** Do not use SQLite on Render. Migrations run on container start (see `Dockerfile` `CMD`).

---

## Deploy on Railway

This repo includes [`railway.toml`](railway.toml) (Docker build, health check on `/up`).

### 1. Push to GitHub

Railway deploys from Git. Your remote should look like `https://github.com/YOUR_USER/job-tracking.git`.

### 2. Create the Railway project

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select this repository.
2. Add **PostgreSQL** to the project (**+ New** → **Database** → **PostgreSQL**).
3. Open your **web service** (the repo) → **Variables**. Add:

| Variable | Value |
|----------|--------|
| `APP_NAME` | `Job Tracker` |
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | Output of `php artisan key:generate --show` (run locally once) |
| `APP_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` |
| `DB_CONNECTION` | `pgsql` |
| `DB_URL` | `${{Postgres.DATABASE_URL}}` — use your Postgres service name if it is not `Postgres` (Railway variable picker) |
| `SESSION_DRIVER` | `database` |
| `CACHE_STORE` | `database` |
| `QUEUE_CONNECTION` | `sync` |
| `SESSION_SECURE_COOKIE` | `true` |
| `SESSION_SAME_SITE` | `lax` |
| `LOG_CHANNEL` | `stderr` |

4. **Settings** → **Networking** → **Generate Domain**.
5. Wait for deploy. Open the domain, register, and test the board.

Build uses the **Dockerfile** (Composer, Vite, production image). The container runs migrations then `php artisan serve` on Railway’s `PORT`.

### 3. After code changes

Push to GitHub; Railway redeploys automatically. For env-only changes, redeploy from the Railway dashboard.

**Note:** Use PostgreSQL on Railway, not SQLite (the filesystem is not durable). PWA install works over HTTPS once `npm run build` has run in deploy.

## Deploy on Fly.io

This repo includes a [`Dockerfile`](Dockerfile) and [`fly.toml`](fly.toml).

### 1. Install Fly CLI and sign in

```bash
# Windows (PowerShell)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

fly auth login
```

### 2. Create the app and Postgres

From the project root:

```bash
fly apps create YOUR-APP-NAME
```

Edit `fly.toml` and set `app = 'YOUR-APP-NAME'` (and `primary_region` if you want, e.g. `sin` for Singapore).

```bash
fly postgres create --name YOUR-APP-NAME-db --region sin
fly postgres attach YOUR-APP-NAME-db --app YOUR-APP-NAME
```

Attaching sets `DATABASE_URL` on the app (Laravel reads it for `pgsql`).

### 3. Secrets and URL

```bash
php artisan key:generate --show
fly secrets set APP_KEY="base64:..." APP_NAME="Job Tracker"
fly deploy
fly certs add YOUR-APP-NAME.fly.dev
fly secrets set APP_URL="https://YOUR-APP-NAME.fly.dev"
```

Redeploy once after setting `APP_URL` so generated links and cookies match:

```bash
fly deploy
```

### 4. Open the site

```bash
fly open
```

Register and test the board. Migrations run on container start (see `Dockerfile`).

### 5. Updates

```bash
git push   # if using GitHub + Fly remote build
fly deploy
```

**Note:** Do not use SQLite on Fly; the disk is ephemeral. PWA works over HTTPS after the Docker build runs `npm run build`.

If the build log shows `ondrej/php` or `apt install php8.3` errors, Fly is using **Nixpacks** instead of Docker. In the dashboard, choose **Dockerfile** as the build method (or ensure `fly.toml` has `[build] dockerfile = "Dockerfile"`), push to GitHub, and redeploy.

## Tests

```bash
composer test
```

## License

MIT (Laravel framework components remain under their respective licenses; see [Laravel](https://laravel.com/docs) for framework licensing.)
