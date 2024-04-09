import { Router } from 'express';
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getColors, addCustomColor } from "../controllers/color.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getColors)
    .post(passport.authenticate('authorized', {session: false}), addCustomColor);
    
export default router;