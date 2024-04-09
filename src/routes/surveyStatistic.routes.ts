import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getSurveysStatistic } from "../controllers/surveyStatistic.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getSurveysStatistic);

export default router;