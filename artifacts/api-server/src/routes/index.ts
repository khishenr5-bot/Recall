import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import summarizeRouter from "./summarize";
import libraryRouter from "./library";
import collectionsRouter from "./collections";
import highlightsRouter from "./highlights";
import insightsRouter from "./insights";
import digestRouter from "./digest";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(summarizeRouter);
router.use(libraryRouter);
router.use(collectionsRouter);
router.use(highlightsRouter);
router.use(insightsRouter);
router.use(digestRouter);
router.use(paymentsRouter);

export default router;
