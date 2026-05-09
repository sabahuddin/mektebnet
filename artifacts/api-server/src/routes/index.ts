import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lessonsRouter from "./lessons";
import progressRouter from "./progress";
import authRouter from "./auth";
import muallimRouter from "./muallim";
import roditeljRouter from "./roditelj";
import adminRouter from "./admin";
import contentRouter from "./content";
import porukeRouter from "./poruke";
import ucenikRouter from "./ucenik";
import setupRouter from "./setup";
import importContentRouter from "./import-content";
import gamesRouter from "./games";
import h5pRouter from "./h5p";
import popraviSaceRouter from "./popravi-sace";
import misijeRouter from "./misije";
import pushRouter from "./push";
import mapaRouter from "./mapa";
import aktivnostRouter from "./aktivnost";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use(lessonsRouter);
router.use(progressRouter);
router.use("/muallim", muallimRouter);
router.use("/roditelj", roditeljRouter);
router.use("/admin", adminRouter);
router.use("/content", contentRouter);
router.use("/poruke", porukeRouter);
router.use("/ucenik", ucenikRouter);
router.use("/setup", setupRouter);
router.use("/import-content", importContentRouter);
router.use("/games", gamesRouter);
router.use("/h5p", h5pRouter);
router.use("/popravi-sace", popraviSaceRouter);
router.use("/misije", misijeRouter);
router.use("/push", pushRouter);
router.use("/mapa", mapaRouter);
router.use("/aktivnost", aktivnostRouter);

export default router;

