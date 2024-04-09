import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getTemplates, getTouchpointAreaOfImpact } from "../controllers/templates.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getTemplates);

router.route('/touchpointareaofimpact')
    .get(passport.authenticate('jwt', {session: false}), getTouchpointAreaOfImpact);

export default router;