import { Router, type IRouter } from "express";
import healthRouter from "./health";
import redraftRouter from "./redraft";

const router: IRouter = Router();

router.use(healthRouter);
router.use(redraftRouter);

export default router;
