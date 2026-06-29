import { Router, type IRouter } from "express";
import healthRouter from "./health";
import emulatorsRouter from "./emulators";
import deviceProfilesRouter from "./device-profiles";
import systemRouter from "./system";
import romsRouter from "./roms";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emulatorsRouter);
router.use(deviceProfilesRouter);
router.use(systemRouter);
router.use(romsRouter);

export default router;
