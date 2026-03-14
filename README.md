# FETCH — Media Downloader

A self-hosted web app to download YouTube videos and Instagram reels/posts locally.  
Built with **Hono** (backend) + **TypeScript** + **tsup** bundler.

---

## Stack

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Backend  | [Hono](https://hono.dev) on Node.js       |
| Bundler  | [tsup](https://tsup.egoist.dev)           |
| Language | TypeScript                                |
| Downloader | [yt-dlp-wrap](https://github.com/nicoekkart/yt-dlp-wrap) (wraps yt-dlp) |
| Frontend | Vanilla TypeScript, served as static HTML |

---

## Prerequisites

### 1 — Install `yt-dlp` (required)

`yt-dlp` must be available on the machine running the server.

**macOS:**
```bash
brew install yt-dlp
```

**Linux / Debian:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows:**
```powershell
winget install yt-dlp
# or download from https://github.com/yt-dlp/yt-dlp/releases
```

Verify:
```bash
yt-dlp --version
```

### 2 — Install ffmpeg (for merging video+audio streams)

**macOS:** `brew install ffmpeg`  
**Linux:** `sudo apt install ffmpeg`  
**Windows:** Download from https://ffmpeg.org/download.html and add to PATH.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript → dist/
npm run build

# 3. Start server
npm start
# → http://localhost:3000
```

For hot-reload during development:
```bash
npm run dev
# then in another terminal:
node dist/index.js
```

---

## Vercel Deployment

> **Important:** Vercel is a serverless platform. The streaming download endpoint
> (`/api/youtube/download`, `/api/instagram/download`) requires a long-lived process
> and **will not work on Vercel's free/hobby plan** due to the 10 s execution limit.
>
> **Recommended for full functionality:** Deploy on a **VPS** (Railway, Render, Fly.io,
> DigitalOcean, etc.) where you can install `yt-dlp` and `ffmpeg`.

### Deploy on Railway (recommended)
```bash
# 1. Push to GitHub
# 2. Connect repo on https://railway.app
# 3. Railway auto-detects Node, runs `npm run build` then `npm start`
# 4. Add yt-dlp via Nixpacks: add a nixpacks.toml
```

`nixpacks.toml` for Railway:
```toml
[phases.setup]
nixPkgs = ["yt-dlp", "ffmpeg"]
```

### Deploy on Render
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add yt-dlp via custom Dockerfile or shell script

---

## Environment Variables

| Variable      | Default | Purpose                              |
|---------------|---------|--------------------------------------|
| `PORT`        | `3000`  | HTTP port                            |
| `IG_USERNAME` | _(none)_| Instagram username (private content) |
| `IG_PASSWORD` | _(none)_| Instagram password (private content) |

---

## Pages

| URL              | Description              |
|------------------|--------------------------|
| `/`              | YouTube downloader       |
| `/instagram.html`| Instagram downloader     |

## API Endpoints

| Method | Endpoint                   | Query params              |
|--------|----------------------------|---------------------------|
| GET    | `/api/youtube/info`        | `url`                     |
| GET    | `/api/youtube/download`    | `url`, `format`, `title`  |
| GET    | `/api/instagram/info`      | `url`                     |
| GET    | `/api/instagram/download`  | `url`, `title`            |

---

## What Gets Downloaded

Each video download is streamed directly to the browser and saved with the video title as filename (`.mp4`).

The **metadata** (title + description) is shown in the UI before downloading. You can also save it manually from there.

---

## Limitations

- **Private Instagram accounts** require login credentials (set env vars)
- **Age-restricted YouTube** videos may require a cookies file (`--cookies` flag — extend the yt-dlp args in `src/index.ts`)
- Works with all **public** YouTube videos and Instagram reels/posts/IGTV