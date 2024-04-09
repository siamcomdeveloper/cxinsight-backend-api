import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getCollectors, createCollector, getCollector, getTypeName, getStatusName, deleteCollector, updateCollector } from "../controllers/collector.controller";

router.route('/list/:surveyId?')
    .get(passport.authenticate('jwt', {session: false}), getCollectors);
    
router.route('/:collectorId?')
    .get(passport.authenticate('jwt', {session: false}), getCollector)
    .post(passport.authenticate('authorized', {session: false}), createCollector)
    .put(passport.authenticate('authorized', {session: false}), updateCollector);

router.route('/delete/:collectorId')
    .put(passport.authenticate('authorized', {session: false}), deleteCollector);

router.route('/typeName/:typeId')
    .get(passport.authenticate('jwt', {session: false}), getTypeName);

router.route('/statusName/:statusId')
    .get(passport.authenticate('jwt', {session: false}), getStatusName);

export default router;