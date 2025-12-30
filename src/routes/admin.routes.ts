import Router from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { updateProfile } from "../controllers/admin.controller";
import { getAdminDashboardStats } from "../controllers/analytics.controller";

const router = Router();

router.put("/profile", authenticate, authorize("ADMIN"), updateProfile);
router.get("/dashboard", authenticate, authorize("ADMIN"), getAdminDashboardStats);
export default router;