import { Router } from 'express';
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getFonts } from "../controllers/font.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getFonts);
    
export default router;