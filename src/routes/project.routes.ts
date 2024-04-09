import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getProjects } from "../controllers/project.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getProjects);

export default router;