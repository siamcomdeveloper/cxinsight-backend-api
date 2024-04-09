import { Router } from "express";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { getUsers, getUser, updateUser, deleteUser } from "../controllers/user.controller";

router.route('/list')
    .get(passport.authenticate('admin-authorized', {session: false}), getUsers)

router.route('/:userId')
    .get(passport.authenticate('admin-authorized', {session: false}), getUser)
    .delete(passport.authenticate('admin-authorized', {session: false}), deleteUser)
    .put(passport.authenticate('admin-authorized', {session: false}), updateUser);
    
export default router;