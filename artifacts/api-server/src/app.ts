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
app.use(cors());
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

app.use("/uploads", requireH5pAuth, express.static(uploadsDir, {
  maxAge: "30d",
  immutable: true,
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  },
}));

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

