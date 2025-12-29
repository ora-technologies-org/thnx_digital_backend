import { authenticate, authorize } from "../middleware/auth.middleware";
import { createContactUs, getAllContactUs, notifyMerchant } from "../controllers/user.controller";
import Router from "express";
import { validate } from "../middleware/validation.middleware";
import { createContactUsSchema, notifyMerchantSchema } from "../validators/user.validator";

const router = Router();


router.post("/contact-us", validate(createContactUsSchema) ,createContactUs);
router.get("/contact-us", authenticate, authorize("ADMIN") , getAllContactUs);
router.post("/notify-merchant", validate(notifyMerchantSchema) , notifyMerchant);

export default router;