import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
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
app.use("/uploads", express.static(uploadsDir, {
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

