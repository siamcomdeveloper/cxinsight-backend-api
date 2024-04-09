import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getResponses, createResponse, updateResponse, getSurveyResponses, deleteSurveyResponses, getResponse } from "../controllers/response.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getResponses)
    .post(createResponse)//client can access
    .put(updateResponse);//client can access
    
router.route('/:surveyId')
    .delete(passport.authenticate('authorized', {session: false}), deleteSurveyResponses)
    .put(passport.authenticate('jwt', {session: false}), getSurveyResponses);

router.route('/:surveyId/:respondentId')
    .put(passport.authenticate('jwt', {session: false}), getResponse);

export default router;