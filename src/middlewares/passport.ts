import * as dotenv from "dotenv";
import passport from 'passport'; //miiddlewares
import passportLocal from "passport-local"; //miiddlewares for emails
import passportJWT from 'passport-jwt'; //miiddlewares for jwt
import { createRequest, createSiteLog } from '../database'; //database helper
import bcrypt from "bcrypt-nodejs"; //encrypt user passwords

const LocalStrategy = passportLocal.Strategy;
const JWTStrategy = passportJWT.Strategy;
const ExtractJWT = passportJWT.ExtractJwt;

dotenv.config();

//Register a new user by using an email so have to use 'local-login' method
passport.use('local-login', new LocalStrategy({ usernameField: "email", passwordField: 'password', passReqToCallback: true }, async (req, email, password, done) => {

    try {
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'LocalStrategy', 'createRequest'); return done(undefined, false, { message: "Error Login, please contact a technical support" }); }

        const sqlSelect = "SELECT u.* ";
        const sqlFrom = "FROM users as u ";
        const sqlWhere = `WHERE u.active = 1 AND u.email = '${email.toLowerCase()}'`;
        const sql = sqlSelect + sqlFrom + sqlWhere;

        await request.query(sql,
            (err: any, result: any) => {
                try{
                    if(result?.recordset.length && !err){
                        const user = result?.recordset[0] as any;

                        if(!user.confirmed) return done(undefined, false, { message: "Please check your inbox,<br/>we have emailed you a link to confirm your email." });
                        if(!user.approved) return done(undefined, false, { message: "Please wait for the admin approval." });

                        const isMatch = bcrypt.compareSync(password, user.password);
                        
                        if(!isMatch) return done(undefined, false, { message: "Invalid username or password." });

                        const messageUser = { message: `Welcome!<br/>${user.title} ${user.first_name} ${user.last_name}` };

                        const userData = {
                            id: user.id,
                            email: user.email,
                            ro: user.role_id,
                            rm: user.responsible_menu_id,
                            rs: user.responsible_survey_id,
                            rp: user.responsible_project_id,
                            rt: user.responsible_touchpoint_id,
                            ri: user.responsible_impact_id,
                        }

                        return done(undefined, userData, messageUser);
                    }
                    else if(err){
                        createSiteLog(siteAlias, 'LocalStrategy else if', err);
                        return done(undefined, false, { message: "Error, Please try again." });
                    }
                    else{
                        return done(undefined, false, { message: "Invalid username or password." });
                    }
                }catch(error){
                    createSiteLog(siteAlias, 'LocalStrategy else', error);
                }
            });
      }
      catch(error){
        createSiteLog(req.headers['x-site'], 'LocalStrategy', error);
        return done(error);
      }
}));


//Intitial JWT options for the user login process
const opts = {
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(), //
    secretOrKey: process.env.JWT_SECRET,
    passReqToCallback: true
};

// User login with JWT options
passport.use(new JWTStrategy(opts, async function(req: any, jwt_payload: any, done: any) {

    try {
        const userToken = jwt_payload;
        const siteAlias = req.headers['x-site'];
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'JWTStrategy', 'createRequest'); return done(null, false); }

        const sqlSelect = "SELECT u.* ";
        const sqlFrom = "FROM users as u ";
        const sqlWhere = `WHERE u.active = 1 AND u.approved = 1 AND u.confirmed = 1 AND ( (u.role_id IN (1,4) AND u.email = '${userToken.email}') OR (u.id = '${userToken.id}' AND u.email = '${userToken.email}') ) `;
        const sqlStr = sqlSelect + sqlFrom + sqlWhere;

        await request.query(sqlStr,
            (err: any, result: any) => {
                try{
                    if(result?.recordset.length && !err){

                        const user = result?.recordset[0] as any;

                        delete user.password;
                        user.remember = userToken.exp ? false : true;

                        return done(null, user);
                    }
                    else if(err){
                        createSiteLog(siteAlias, 'JWTStrategy else if', err);
                        return done(undefined, false, { message: "Error, Please try again." });
                    }
                    else{
                        return done(null, false);
                    }
                }catch(error){
                    createSiteLog(siteAlias, 'JWTStrategy else', error);
                }
            }
        );
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'JWTStrategy', error);
        return done(null, false);
    }
    
}));


// Checking if the user is authorized
passport.use('authorized', new JWTStrategy(opts, async function(req: any, jwt_payload: any, done: any) {

    try {
        const userToken = jwt_payload;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'authorized', 'createRequest'); return done(null, false); }

        const sqlSelect = "SELECT u.* ";
        const sqlFrom = "FROM users as u ";
        const sqlWhere = `WHERE u.active = 1 AND u.approved = 1 AND u.confirmed = 1 AND u.role_id IN (1,2) AND u.id = '${userToken.id}' AND u.email = '${userToken.email}'`;
        const sqlStr = sqlSelect + sqlFrom + sqlWhere;

        await request.query(sqlStr,
            (err: any, result: any) => {
                try{
                    if(result?.recordset.length && !err){

                        const user = result?.recordset[0] as any;

                        delete user.password;
                        user.remember = userToken.exp ? false : true;

                        return done(null, user);
                    }
                    else if(err){
                        createSiteLog(siteAlias, 'authorized else if', err);
                        return done(undefined, false, { message: "Error, Please try again." });
                    }
                    else{
                        return done(null, false);
                    }
                }catch(error){
                    createSiteLog(siteAlias, 'authorized else', error);
                }
                
            }
        );
    }
    catch(error){
        return done(null, false);
    }
  
}));


// Checking if the user is admin authorized
passport.use('admin-authorized', new JWTStrategy(opts, async function(req: any, jwt_payload: any, done: any) {

    try {
        const userToken = jwt_payload;
        const siteAlias = req.headers['x-site'];
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'admin-authorized', 'createRequest'); return done(null, false); }

        const sqlSelect = "SELECT u.* ";
        const sqlFrom = "FROM users as u ";
        const sqlWhere = `WHERE u.active = 1 AND u.approved = 1 AND u.confirmed = 1 AND u.role_id IN (1) AND u.id = '${userToken.id}' AND u.email = '${userToken.email}'`;
        const sql = sqlSelect + sqlFrom + sqlWhere;

        await request.query(sql,
            (err: any, result: any) => {
                try{
                    if(result?.recordset.length && !err){

                        const user = result?.recordset[0] as any;

                        delete user.password;
                        user.remember = userToken.exp ? false : true;

                        return done(null, user);
                    }
                    else if(err){
                        createSiteLog(siteAlias, 'admin-authorized else if', err);
                        return done(undefined, false, { message: "Error, Please try again." });
                    }
                    else{
                        return done(null, false);
                    }
                }catch(error){
                    createSiteLog(siteAlias, 'admin-authorized else', error);
                }
            }
        );
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'admin-authorized', error);
        return done(null, false);
    }
  
}));