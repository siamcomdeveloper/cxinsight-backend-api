import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getAnswers, createAnswer, getAnswer, deleteAnswer, updateAnswer, updateAnswerWithGoogleApi, getRespondentAnswer, getAnswerByQuestion, exportAnswerByQuestion, getAnswerByQuestionForReport, getAnswerByQuestionAndRangePicker, exportAnswerByQuestionAndRangePicker, getAnswerByQuestionForInstitutionReport} from "../controllers/answer.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getAnswers)
    .post(createAnswer);//client can access
    
router.route('/:surveyId')
    .get(passport.authenticate('jwt', {session: false}), getAnswer)
    .delete(passport.authenticate('authorized', {session: false}), deleteAnswer)
    .put(passport.authenticate('authorized', {session: false}), updateAnswer);

router.route('/:surveyId/:respondentId')
    .put(passport.authenticate('jwt', {session: false}), getRespondentAnswer); 

router.route('/rangepicker/:surveyId/:questionId/:questionTypeId')
    .put(passport.authenticate('jwt', {session: false}), getAnswerByQuestionAndRangePicker);

router.route('/rangepicker/export/:surveyId/:questionId/:questionTypeId')
    .put(passport.authenticate('jwt', {session: false}), exportAnswerByQuestionAndRangePicker);

router.route('/export/:surveyId/:questionId/:questionTypeId')
    .put(passport.authenticate('jwt', {session: false}), exportAnswerByQuestion);

router.route('/googleapi/:questionTypeId/:answerInsertedId')
    .put(updateAnswerWithGoogleApi);//client can access

router.route('/report/:surveyId/:questionId/:questionTypeId')
    .put(passport.authenticate('jwt', {session: false}), getAnswerByQuestionForReport);

router.route('/institution-report/:surveyId/:questionId/:questionTypeId')
    .put(getAnswerByQuestionForInstitutionReport);//client can access
    
router.route('/:surveyId/:questionId/:questionTypeId/:respondentId?')
    .put(passport.authenticate('jwt', {session: false}), getAnswerByQuestion);

export default router;