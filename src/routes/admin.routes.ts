import Router from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { updateProfile } from "../controllers/admin.controller";
import { getAdminDashboardStats } from "../controllers/analytics.controller";
import { validate } from "../middleware/validation.middleware";
import { updateAdminProfileSchema } from "../validators/admin.validators";

const router = Router();

router.put("/profile", authenticate, authorize("ADMIN"), validate(updateAdminProfileSchema), updateProfile);
router.get("/dashboard", authenticate, authorize("ADMIN"), getAdminDashboardStats);
export default router;