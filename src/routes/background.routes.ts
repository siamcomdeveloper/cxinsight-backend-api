import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getBackgrounds } from "../controllers/background.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getBackgrounds);

export default router;