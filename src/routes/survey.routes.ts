import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getSurveys, createSurvey, copySurvey, getSurvey, getClientSurvey, getClientEscapeDeeplink, deleteSurvey, updateSurvey, getSearch, getSurveyExecutiveReport, getSurveyInstitutionReport } from "../controllers/survey.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getSurveys)
    .post(passport.authenticate('authorized', {session: false}), createSurvey)

router.route('/executive-report/:touchpointId')
    .get(passport.authenticate('jwt', {session: false}), getSurveyExecutiveReport) 

router.route('/copy')
    .post(passport.authenticate('authorized', {session: false}), copySurvey);

router.route('/search')
    .get(passport.authenticate('jwt', {session: false}), getSearch);
    
router.route('/:surveyId')
    .get(passport.authenticate('jwt', {session: false}), getSurvey)
    .delete(passport.authenticate('authorized', {session: false}), deleteSurvey)
    .put(passport.authenticate('authorized', {session: false}), updateSurvey);

router.route('/client/:surveyId/:collectorId')
    .get(getClientSurvey);//client can access

router.route('/client-escape-deeplink')
    .post(getClientEscapeDeeplink);//client can access

router.route('/client-institution-report/:surveyId')
    .get(getSurveyInstitutionReport);//client can access

export default router;