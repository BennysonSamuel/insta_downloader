import { Hono } from "hono";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import { spawn } from "child_process";
import {
  createReadStream,
  unlinkSync,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import youtubeDl from "yt-dlp-wrap";

// ─── Helpers ──────────────────────────────────────────────────────────────

function sanitize(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .substring(0, 80)
      .trim() || "video"
  );
}

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    "media-dl",
    `dl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string) {
  try {
    if (!existsSync(dir)) return;
    const { readdirSync } = require("fs");
    for (const f of readdirSync(dir)) {
      try {
        unlinkSync(join(dir, f));
      } catch {}
    }
    require("fs").rmdirSync(dir);
  } catch {}
}

function streamFile(
  res: ServerResponse,
  filePath: string,
  filename: string,
  mimeType: string,
) {
  const size = statSync(filePath).size;
  res.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
    "Cache-Control": "no-store",
    Connection: "close",
  });
  const rs = createReadStream(filePath);
  rs.pipe(res);
  rs.on("error", (e) => {
    console.error("[read]", e.message);
    res.end();
  });
}

// ─── Hono — info + static ─────────────────────────────────────────────────

const app = new Hono();
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);
// Serve frontend static files only in local dev (not on Railway/production)
// In production the frontend is deployed separately on Vercel
const IS_PROD =
  process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;
if (!IS_PROD) {
  app.use("/*", serveStatic({ root: "./public" }));
}

app.get("/", (c) =>
  c.json({ service: "BENLOAD API", status: "ok", version: "1.0.0" }),
);
app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/api/instagram/info", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "URL required" }, 400);
  try {
    const m = await new youtubeDl().getVideoInfo(url);
    return c.json({
      title:
        m.title || (m.description || "").substring(0, 60) || "Instagram Video",
      description: m.description || m.caption || "",
      uploader: m.uploader || m.channel || "",
      uploadDate: m.upload_date || "",
      likeCount: m.like_count || 0,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ─── Raw HTTP server ───────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000", 10);

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const fullUrl = `http://localhost:${PORT}${req.url}`;
  const parsed = new URL(fullUrl);
  const path = parsed.pathname;
  const qs = parsed.searchParams;

  // ── Instagram: download video + text file ──────────────────────────────
  if (path === "/api/instagram/download") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = qs.get("url") || "";
    const title = qs.get("title") || "instagram_video";
    const desc = qs.get("description") || "";
    const uploader = qs.get("uploader") || "";
    const uploadDate = qs.get("uploadDate") || "";
    const what = qs.get("what") || "video"; // "video" | "text"

    if (!url) {
      res.writeHead(400);
      res.end("URL required");
      return;
    }

    const safeTitle = sanitize(title);

    // ── Just send the text file ──────────────────────────────────────────
    if (what === "text") {
      const lines = [
        `TITLE:       ${title}`,
        `AUTHOR:      ${uploader ? "@" + uploader : "—"}`,
        `DATE:        ${uploadDate || "—"}`,
        `URL:         ${url}`,
        ``,
        `DESCRIPTION / CAPTION:`,
        `─────────────────────────────────────────`,
        desc || "(no description)",
      ].join("\r\n");

      const tmpFile = join(tmpdir(), `${safeTitle}_info.txt`);
      writeFileSync(tmpFile, lines, "utf-8");
      streamFile(
        res,
        tmpFile,
        `${safeTitle}_info.txt`,
        "text/plain; charset=utf-8",
      );
      res.on("finish", () => {
        try {
          unlinkSync(tmpFile);
        } catch {}
      });
      return;
    }

    // ── Download video ───────────────────────────────────────────────────
    const tmpDir = makeTempDir();
    const outFile = join(tmpDir, `${safeTitle}.mp4`);

    const bin = "yt-dlp";
    const args = [
      url,
      "-f",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format",
      "mp4",
      "-o",
      outFile,
      "--no-playlist",
      "--no-warnings",
      "--retries",
      "3",
    ];

    console.log(`\n[yt-dlp] → ${outFile}`);
    console.log(`[cmd] ${bin} ${args.join(" ")}\n`);

    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
    proc.stderr?.on("data", (d: Buffer) => process.stderr.write(d));

    proc.on("close", (code) => {
      if (code !== 0 || !existsSync(outFile)) {
        cleanup(tmpDir);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end(`yt-dlp failed (exit ${code}). Check terminal.`);
        }
        return;
      }
      console.log(
        `\n[stream] ${safeTitle}.mp4 — ${(statSync(outFile).size / 1024 / 1024).toFixed(1)} MB`,
      );
      streamFile(res, outFile, `${safeTitle}.mp4`, "video/mp4");
      res.on("finish", () => {
        cleanup(tmpDir);
      });
    });

    proc.on("error", (err) => {
      cleanup(tmpDir);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(err.message);
      }
    });

    return;
  }

  // ── Everything else → Hono ─────────────────────────────────────────────
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (typeof v === "string") headers[k] = v;
  }
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => {
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    Promise.resolve(
      app.fetch(
        new Request(fullUrl, {
          method: req.method || "GET",
          headers,
          body: body?.length ? body : undefined,
        }),
        { incoming: req, outgoing: res },
      ),
    )
      .then(async (hr: Response) => {
        if (res.headersSent) return;
        const h: Record<string, string> = {};
        hr.headers.forEach((v, k) => {
          h[k] = v;
        });
        res.writeHead(hr.status, h);
        if (hr.body) {
          const reader = hr.body.getReader();
          const pump = async () => {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              return;
            }
            res.write(value);
            pump();
          };
          pump();
        } else {
          res.end();
        }
      })
      .catch((e: Error) => {
        if (!res.headersSent) res.writeHead(500);
        res.end(e.message);
      });
  });
});

server.listen(PORT, () => {
  console.log(`\n🎬  Instagram Downloader  →  http://localhost:${PORT}\n`);
});
