import { authenticate, authorize } from "../middleware/auth.middleware";
import { createContactUs, getAllContactUs } from "../controllers/user.controller";
import Router from "express";
import { validate } from "../middleware/validation.middleware";
import { createContactUsSchema } from "../validators/user.validator";

const router = Router();


router.post("/contact-us", validate(createContactUsSchema) ,createContactUs);
router.get("/contact-us", authenticate, authorize("ADMIN") , getAllContactUs);

export default router;