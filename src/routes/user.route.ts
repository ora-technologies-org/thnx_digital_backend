import { authenticate, authorize } from "../middleware/auth.middleware";
import { createContactUs, getAllContactUs, notifyMerchant } from "../controllers/user.controller";
import Router from "express";
import { queryValidation, validate } from "../middleware/validation.middleware";
import { getContactUsQuerySchema } from "../validators/query.validators";
import { createContactUsSchema, notifyMerchantSchema } from "../validators/user.validator";

const router = Router();


router.post("/contact-us", validate(createContactUsSchema) ,createContactUs);
router.get("/contact-us", authenticate, authorize("ADMIN"), queryValidation(getContactUsQuerySchema), getAllContactUs);
router.post("/notify-merchant", validate(notifyMerchantSchema) , notifyMerchant);

export default router;