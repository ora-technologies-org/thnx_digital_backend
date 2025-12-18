import Router from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { updateAdminProfile } from "../controllers/admin.controller";

const router = Router();

router.put("/profile", authenticate, authorize("ADMIN"), updateAdminProfile)

export default router;