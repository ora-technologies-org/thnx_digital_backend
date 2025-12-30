import Router from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { updateProfile } from "../controllers/admin.controller";

const router = Router();

router.put("/profile", authenticate, authorize("ADMIN"), updateProfile)

export default router;