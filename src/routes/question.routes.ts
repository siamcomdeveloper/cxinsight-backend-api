import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import {getQuestion, updateDesginQuestion, deleteDesignQuestion, deleteDesignQuestionSpecial, updateQuestionByType, getQuestionByType, designMoveQuestionUp, designMoveQuestionDown, designMoveUpToQuestion, designMoveDownToQuestion, designCopyToQuestion, designNewToQuestion, designNewToPage, designNewTemplateToQuestion, designNewTemplateToPage, getClientQuestionByType } from "../controllers/question.controller";

router.route('/:surveyId')
    .get(passport.authenticate('jwt', {session: false}), getQuestion)

router.route('/:surveyId/:orderNo')
    .get(passport.authenticate('jwt', {session: false}), getQuestionByType)

router.route('/client/:surveyId/:orderNo')
    .get(getClientQuestionByType)//client can access

router.route('/design/newtemplate/:surveyId/:questionTypeId/:questionTemplateId/:toPageNo/:numQuestion/:questionBankLang')
    .put(passport.authenticate('authorized', {session: false}), designNewTemplateToPage)

router.route('/design/newtemplate/:surveyId/:questionTypeId/:questionTemplateId/:toPageNo/:toOrderNo/:toPosition/:questionBankLang')
    .put(passport.authenticate('authorized', {session: false}), designNewTemplateToQuestion)

router.route('/design/new/:surveyId/:questionTypeId/:toPageNo/:numQuestion')
    .put(passport.authenticate('authorized', {session: false}), designNewToPage)

router.route('/design/new/:surveyId/:questionTypeId/:toPageNo/:toOrderNo/:toPosition')
    .put(passport.authenticate('authorized', {session: false}), designNewToQuestion)

router.route('/design/copy/:surveyId/:questionId/:questionTypeId/:toPageNo/:toOrderNo/:toPosition')
    .put(passport.authenticate('authorized', {session: false}), designCopyToQuestion)

router.route('/design/move/upto/:surveyId/:questionId/:pageNo/:orderNo/:toPageNo/:toOrderNo/:toPosition/:oneOnPage')
    .put(passport.authenticate('authorized', {session: false}), designMoveUpToQuestion)

router.route('/design/move/downto/:surveyId/:questionId/:pageNo/:orderNo/:toPageNo/:toOrderNo/:toPosition/:oneOnPage')
    .put(passport.authenticate('authorized', {session: false}), designMoveDownToQuestion)

router.route('/design/move/up/:surveyId/:questionId/:pageNo/:orderNo')
    .put(passport.authenticate('authorized', {session: false}), designMoveQuestionUp)

router.route('/design/move/down/:surveyId/:questionId/:pageNo/:orderNo')
    .put(passport.authenticate('authorized', {session: false}), designMoveQuestionDown)

router.route('/design/ndelete/:surveyId/:questionId/:questionTypeId')
    .delete(passport.authenticate('authorized', {session: false}), deleteDesignQuestion)

router.route('/design/sdelete/:surveyId/:questionId/:questionTypeId')
    .delete(passport.authenticate('authorized', {session: false}), deleteDesignQuestionSpecial)

router.route('/design/update/:surveyId/:questionId')
    .put(passport.authenticate('authorized', {session: false}), updateDesginQuestion);

router.route('/design/update/:surveyId/:questionId/:questionTypeId')
    .put(passport.authenticate('authorized', {session: false}), updateQuestionByType);

export default router;