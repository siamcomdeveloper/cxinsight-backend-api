import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getTouchpoints } from "../controllers/touchpoint.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getTouchpoints);

export default router;