import { createContactUs } from "../controllers/user.controller";
import Router from "express";

const router = Router();


router.post("/contact-us", createContactUs);


export default router;