import { authenticate, authorize } from "../middleware/auth.middleware";
import { createContactUs, getAllContactUs } from "../controllers/user.controller";
import Router from "express";

const router = Router();


router.post("/contact-us", createContactUs);
router.get("/contact-us", authenticate, authorize("ADMIN") , getAllContactUs);

export default router;