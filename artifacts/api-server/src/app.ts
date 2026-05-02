import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";
import { trackVisit } from "./middlewares/visitTracker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS — eksplicitna lista origin-a:
//  - https://mekteb.net + https://www.mekteb.net  → produkcijski web
//  - http://localhost:* + Replit dev domeni        → dev environment
//  - capacitor://localhost                          → iOS Capacitor app
//  - https://localhost                              → Android Capacitor app
//  - http://localhost                               → Capacitor live-reload na iOS sim
// `credentials: true` jer login koristi i Bearer token i HttpOnly cookie za H5P.
const STATIC_ALLOWED_ORIGINS = new Set([
  "https://mekteb.net",
  "https://www.mekteb.net",
  "capacitor://localhost",
  "https://localhost",
  "http://localhost",
]);
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin (curl, server-to-server) — origin je undefined, propusti.
      if (!origin) return callback(null, true);
      if (STATIC_ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      // Replit dev/preview domeni — *.replit.dev, *.repl.co, *.picard.replit.dev
      if (/^https:\/\/[a-z0-9-]+\.(replit\.dev|repl\.co|picard\.replit\.dev)$/i.test(origin))
        return callback(null, true);
      // Localhost na bilo kom portu (Vite dev server, Capacitor live-reload)
      if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return callback(null, true);
      callback(new Error(`Origin nije dozvoljen: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

app.use("/api", router);

const uploadsDir = process.env["UPLOADS_DIR"]
  ? path.resolve(process.env["UPLOADS_DIR"])
  : path.resolve(process.cwd(), "uploads");
console.log(`[Static] Serving /uploads from: ${uploadsDir}`);

// H5P interaktivni sadržaj nije za javnost — vezan je za lekciju i hasanate.
// Štitimo /uploads/h5p/* zahtjevom za auth (cookie ili Bearer header). Ostali
// /uploads/* (PDF, slike, itd. korišteni iz contentHtml-a lekcije) ostaju javni
// jer su dio renderirane lekcije i moraju biti dostupni i out-of-context.
const JWT_SECRET = process.env["JWT_SECRET"] || "mekteb-secret-change-in-production";
function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
function requireH5pAuth(req: Request, res: Response, next: NextFunction) {
  // Samo /h5p/... pod /uploads ide kroz auth — ostalo (npr. /pdfs/, /images/) prolazi.
  if (!req.path.startsWith("/h5p/")) return next();
  const cookieToken = parseCookie(req.headers.cookie, "mekteb_h5p_session");
  const headerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = cookieToken || headerToken;
  if (!token) {
    res.status(401).json({ error: "Pristup H5P sadržaju zahtijeva prijavu" });
    return;
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Nevažeća sesija — prijavite se ponovo" });
  }
}

// Mount na oba prefiksa: `/uploads` (direktan pristup unutar API kontejnera,
// reverse proxy u prod-u) i `/api/uploads` (kroz Replit path routing — frontend
// može direktno fetch-ovati H5P static fajlove preko `/api` koji je već mapiran
// na ovaj servis). Tako H5P URL-ovi rade i u dev-u i u prod-u.
const uploadsStatic = express.static(uploadsDir, {
  maxAge: "30d",
  immutable: true,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  },
});
app.use("/uploads", requireH5pAuth, uploadsStatic);
app.use("/api/uploads", requireH5pAuth, uploadsStatic);

app.use(trackVisit);

if (process.env["SERVE_STATIC"] === "true") {
  const frontendDist = path.resolve(__dirname, "../../mekteb-arapsko-pismo/dist/public");

  // Serve edu assets (images for ilmihal/kvizovi) from mounted volume
  const eduDir = path.resolve(__dirname, "../../../edu");
  app.use("/edu", express.static(eduDir));

  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;

