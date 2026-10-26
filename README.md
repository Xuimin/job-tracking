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

## Tests

```bash
composer test
```

## License

MIT (Laravel framework components remain under their respective licenses; see [Laravel](https://laravel.com/docs) for framework licensing.)
