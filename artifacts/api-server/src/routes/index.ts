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

export default router;
