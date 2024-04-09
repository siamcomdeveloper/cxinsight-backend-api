import { Router } from 'express';
import passport from 'passport';
import "../middlewares/passport";
import { indexWelcome, frontendLog } from "../controllers/index.controller";

const router = Router();

// When someone calls this api url with "GET" Method it will process the "indexWelcome" function with req: Request, res: Response parameter
router.route('/')
    .get(indexWelcome);

// Needs the 'jwt' authentication to call this api 
router.route('/frontendlog/')
    .post(passport.authenticate('jwt', {session: false}), frontendLog);

router.route('/frontendlogclient/')
    .post(frontendLog);

export default router;