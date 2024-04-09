import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getEmails, createEmail, getEmail, deleteEmail, updateEmail, scheduleSendEmails, sendInviteEmail, messageHistory, messageFollowUp, followUpSendEmails, sendErrorHandlingEmail } from "../controllers/email.controller";

router.route('/list/:collectorId?')
    .get(passport.authenticate('jwt', {session: false}), getEmails)

router.route('/schedulesendemails/list/:collectorId')
    .get(passport.authenticate('authorized', {session: false}), scheduleSendEmails)
    
router.route('/messagehistory/list/:collectorId')
    .get(passport.authenticate('authorized', {session: false}), messageHistory)

router.route('/messagefollowup/list/:collectorId')
    .get(passport.authenticate('authorized', {session: false}), messageFollowUp)
    
router.route('/followup/list/:collectorId/:functionId')
    .get(passport.authenticate('authorized', {session: false}), followUpSendEmails)

router.route('/send/invite')
    .post(passport.authenticate('authorized', {session: false}), sendInviteEmail)

router.route('/send/error-handling-email')
    .post(sendErrorHandlingEmail)

router.route('/:emailId?')
    .get(getEmail)
    .post(passport.authenticate('authorized', {session: false}), createEmail)
    .delete(passport.authenticate('authorized', {session: false}), deleteEmail)
    .put(updateEmail);

export default router;