# BENLOAD — Instagram Downloader

> Download Instagram reels & posts with their captions. Free & open source.

**Live:** Frontend on Vercel · Backend on Railway  
**Repo:** [github.com/BennysonSamuel/yt_insta_downloader](https://github.com/BennysonSamuel/yt_insta_downloader)  
**Made with love for Bless Big Bro** ❤️

---

## Stack

| Layer | Tech |
|---|---|
| Backend | [Hono](https://hono.dev) on Node.js |
| Bundler | [tsup](https://tsup.egoist.dev) |
| Language | TypeScript |
| Downloader | yt-dlp + ffmpeg (system binaries) |
| Frontend | Vanilla HTML/CSS/JS — zero dependencies |
| Backend host | [Railway](https://railway.app) |
| Frontend host | [Vercel](https://vercel.com) |

---

## Why the split deployment?

The backend runs `yt-dlp` as a child process, streams large video files, and can take 30–120 seconds per download. **Vercel serverless functions cannot do this** — they have a 10s timeout and no support for system binaries.

```
┌─────────────────────┐        ┌──────────────────────────────┐
│   Vercel (frontend) │ ──────▶│   Railway (backend)          │
│   index.html        │  HTTPS │   Hono + yt-dlp + ffmpeg     │
│   Static file only  │ ◀───── │   /api/instagram/info        │
└─────────────────────┘        │   /api/instagram/download    │
                                └──────────────────────────────┘
```

---

## Local Development

### Prerequisites

Install `yt-dlp` and `ffmpeg` on your machine:

**Windows (PowerShell):**
```powershell
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

**macOS:**
```bash
brew install yt-dlp ffmpeg
```

**Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
sudo apt install ffmpeg
```

### Run locally

```bash
npm install
npm run build
npm start
# → http://localhost:3000
```

In local dev, the frontend and backend run together on port 3000 — no split needed.

---

## Deploying the Backend to Railway

Railway auto-installs `yt-dlp` and `ffmpeg` via the included `nixpacks.toml`.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/BennysonSamuel/yt_insta_downloader.git
git push -u origin main
```

### Step 2 — Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → select your repo
3. Railway detects `nixpacks.toml` and automatically:
   - Installs `yt-dlp` and `ffmpeg`
   - Runs `npm install && npm run build`
   - Starts with `npm start`

### Step 3 — Set environment variables (Railway dashboard)

| Variable | Value |
|---|---|
| `PORT` | `3000` |

### Step 4 — Get your backend URL

In Railway dashboard → your service → **Settings** → **Networking** → **Generate Domain**

You'll get something like:
```
https://benload-backend-production.up.railway.app
```

---

## Deploying the Frontend to Vercel

### Step 1 — Update the API URL in the frontend

Open `public/index.html` and find this line near the bottom:

```js
return 'REPLACE_WITH_RAILWAY_URL';
```

Replace it with your actual Railway URL:

```js
return 'https://benload-backend-production.up.railway.app';
```

Save the file and commit:

```bash
git add public/index.html
git commit -m "set production API URL"
git push
```

### Step 2 — Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset:** `Other`
   - **Root Directory:** `.` (project root)
   - **Build Command:** leave empty (no build needed for the frontend)
   - **Output Directory:** `public`
4. Click **Deploy**

Vercel will serve the `public/` folder as a static site.

> **Note:** If Vercel tries to run `npm run build`, it will also try to start the backend — which won't work. Set Output Directory to `public` and leave Build Command blank to avoid this.

### Step 3 — Test

Open your Vercel URL, paste an Instagram reel link, and download away.

---

## Project Structure

```
benload/
├── src/
│   └── index.ts          # Hono backend — all API routes
├── public/
│   └── index.html        # Frontend — single file, no framework
├── dist/                 # Built output (gitignored)
│   └── index.js
├── nixpacks.toml         # Railway: installs yt-dlp + ffmpeg
├── Dockerfile            # Alternative: Docker-based deploy
├── tsup.config.ts        # Bundler config
├── tsconfig.json         # TypeScript config
└── package.json
```

---

## API Reference

| Method | Endpoint | Query params | Description |
|---|---|---|---|
| `GET` | `/api/instagram/info` | `url` | Fetch title, caption, author, date |
| `GET` | `/api/instagram/download` | `url`, `title`, `description`, `uploader`, `uploadDate`, `what` | Download video (`what=video`) or text file (`what=text`) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port the server listens on |

---

## Contributing

PRs welcome. Open an issue first for major changes.

**Created by BENLOAD · Made with love for Bless Big Bro**