import { Router } from 'express';
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getEmployees } from "../controllers/employee.controller";

router.route('/')
    .get(passport.authenticate('jwt', {session: false}), getEmployees);
    
export default router;