import { Router } from "express";
import jwt from 'jsonwebtoken';
import passport from 'passport';
import "../middlewares/passport";
import * as sql from 'mssql';
import { createTransaction, createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";
import bcrypt from "bcrypt-nodejs";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
const router = Router();

dotenv.config();

router.post('/login', (req, res, next) => {
  
    const siteAlias = req.headers['x-site'];

    passport.authenticate('local-login', {session: false, passReqToCallback: true }, (err: any, user: any, info: any) => {

        try {
            if (err) return next(err);

            if (!user) {
                info.status = false;
                return res.status(200).json(info);
            }

            const privateKey = process.env.JWT_SECRET as string;
            const opts = req.body.remember ? {} : { expiresIn: "1h" };
            const userToken = jwt.sign(user, privateKey, opts);

            info.status = true;
            info.userToken = userToken;

            return res.status(200).json(info);
        } 
        catch (error) {
            createSiteLog(siteAlias, 'auth login catch', error);
            return res.status(500).json(error);
        }

    })(req, res, next);
});

router.get('/account/', passport.authenticate('jwt', {session: false}), (req, res, next) => {
    
    const siteAlias = req.headers['x-site'];

    try {
        const info = { status: false, userToken: '' };
        
        if (!req.user) {
            info.status = false;
            return res.status(200).json(info);
        }
    
        const privateKey = process.env.JWT_SECRET as string;
        const userToken = jwt.sign(req.user, privateKey);

        info.status = true;
        info.userToken = userToken;

        return res.status(200).json(info);
    } 
    catch (error) {
        createSiteLog(siteAlias, 'auth get account catch', error);
        return res.status(500).json(error);
    }
});

router.get('/getUserToken', passport.authenticate('jwt', {session: false}), (req, res, next) => {
  
    const siteAlias = req.headers['x-site'];

    try {
        const info = { status: false, userToken: '' };
    
        if (!req.user) {
            info.status = false;
            return res.status(200).json(info);
        }

        const user = req.user as any;
        const userData = {
            id: user.id,
            email: user.email.toLowerCase(),
            ro: user.role_id,
            rm: user.responsible_menu_id,
            rs: user.responsible_survey_id,
            rp: user.responsible_project_id,
            rt: user.responsible_touchpoint_id,
            ri: user.responsible_impact_id,
        }
        
        const privateKey = process.env.JWT_SECRET as string;
        const opts = user.remember ? {} : { expiresIn: "1h" };
        const userToken = jwt.sign(userData, privateKey, opts);
        
        info.status = true;
        info.userToken = userToken;

        return res.status(200).json(info);
    } 
    catch (error) {
        createSiteLog(siteAlias, 'auth getUserToken catch', error);
        return res.status(500).json(error);
    }
});

router.post('/register', async (req, res, next) => {
  
    const siteAlias = req.headers['x-site'];
    
    try {
        const register = req.body

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'auth register', 'createRequest'); return res.json({ status: false, message: 'Error Register' }); }

        const sqlStr = `SELECT id FROM users WHERE email = '${register.email.toLowerCase()}'`;
        await request.query(sqlStr,
            async (err: any, result: any) => {
                if(err){
                    createSiteLog(siteAlias, 'auth register', err.message);
                    return res.json({ status: false, message: 'Register Error', exception: err.message });
                }
                else{
                    const resultData = result?.recordset[0] as any;
                    
                    //That email address has already been used
                    if(resultData){ return res.json({ status: false, message: 'That email address has already been used.', exception: err }); }
                    else{
                        const requestPortal = await createPortalRequest();
                        if(!requestPortal){ createSiteLog(siteAlias, 'sendInviteEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

                        const sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                                        FROM sites AS s 
                                        WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

                        const query = await requestQuery(requestPortal, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

                        const queryResultRecordsetPortal = query.result.recordset[0];
                        if(queryResultRecordsetPortal){

                            const transaction = await createTransaction(req) as any;
                            if(!transaction){ createSiteLog(siteAlias, 'auth register', 'createTransaction'); return res.json({ status: false, message: 'Error Register' }); }
                            transaction.begin().then(async function () {
                                try {
                                    const passwordHash = bcrypt.hashSync(register.password);
                                    
                                    const request = await createRequest(req, transaction) as any;
                                    if(!request){ createSiteLog(siteAlias, 'auth register', 'createTransaction createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Register' }); }); return; }
                                    await request
                                    .input('email', sql.VarChar, register.email.toLowerCase())
                                    .input('title', sql.NVarChar, register.title)
                                    .input('first_name', sql.NVarChar, register.first_name)
                                    .input('last_name', sql.NVarChar, register.last_name)
                                    .input('company_name', sql.NVarChar, register.company_name)
                                    .input('mobile_number', sql.VarChar, '0'+register.mobile_number)
                                    .input('password', sql.NVarChar, passwordHash)
                                    .query(`
                                        INSERT INTO users (email, title, first_name, last_name, company_name, mobile_number, password) 
                                        OUTPUT INSERTED.id
                                        VALUES (@email, @title, @first_name, @last_name, @company_name, @mobile_number, @password)`,
                                        (err: any, result: any) => {
                                            if(err){
                                                createSiteLog(siteAlias, 'auth register', err.message);
                                                transaction.rollback(function() { return res.json({ status: false, message: 'Register Error', exception: err.message }); }); return;
                                            } else{
                                                const resultData = result?.recordset[0] as any;
                                                if(resultData){

                                                    const userData = {
                                                        id: resultData.id,
                                                        email: register.email.toLowerCase()
                                                    }
                                                    const privateKey = process.env.JWT_SECRET as string;
                                                    const token = jwt.sign(userData, privateKey);

                                                    const mail = {
                                                        from: queryResultRecordsetPortal.email_sender, //from email (option)
                                                        to: register.email.toLowerCase(), //to email (require)
                                                        subject: "CX InSight CXM Platform Register Confirmation Email", //subject
                                                        html: `
                                                        <p>You request to confirm your account.</p>
                                                        <p>Click this <a href="https://cxinsight-frontend.onrender.com/cxm/platform/${req.headers['x-site']}/confirm/${token}">link</a> to confirm your email.</p>`  //email body
                                                    }
                                                    
                                                    const smtp = {
                                                        host: queryResultRecordsetPortal.smtp_host as any, //set to your host name or ip
                                                        port: parseInt(queryResultRecordsetPortal.smtp_port) as any,//465, //25, 465, 587 depend on your 
                                                        secure: false, // use SSL : true
                                                        auth: {
                                                            user: queryResultRecordsetPortal.email_sender as any, //user account
                                                            pass: queryResultRecordsetPortal.email_secret as any //user password
                                                        }
                                                    };

                                                    console.log(smtp);

                                                    const smtpTransport = nodemailer.createTransport(smtp);

                                                    smtpTransport.sendMail(mail, function(error, response){
                                                        smtpTransport.close();
                                                        if(error){
                                                            createSiteLog(siteAlias, 'auth register', error);
                                                            //error handler
                                                            transaction.rollback(function(err: any) { return res.json({ status: false, message: 'Register Error', exception: error }); });
                                                        } else{
                                                            //success handler 
                                                            transaction.commit(function(err: any) {
                                                                // ... error checks
                                                                if(!err){ return res.json({ status: true, result: result, message: 'Please check your inbox,<br/>we just emailed you a link to confirm your email.' }); }
                                                                else{
                                                                    createSiteLog(siteAlias, 'auth register', err);
                                                                    transaction.rollback(function() { return res.json({ status: false, message: 'Register Error', exception: err }); });
                                                                }
                                                            });
                                                        }
                                                    });
                                                } else{
                                                    createSiteLog(siteAlias, 'auth register', err);
                                                    transaction.rollback(function() { return res.json({ status: false, message: 'Register Error', exception: err }); });
                                                }
                                            }
                                        }
                                    );
                                }
                                catch(error){
                                    createSiteLog(siteAlias, 'auth register', error);
                                    return res.json({ status: false, message: error, exception: error });
                                }
                            });

                        } else{ return res.json({ status: false, message: 'Register Error', exception: err }); }
                    }
                }
            }
        );
    } 
    catch (error) {
        createSiteLog(siteAlias, 'auth register catch', error);
        return res.status(500).json(error);
    }
});

router.post('/confirm', async (req, res, next) => {

    const siteAlias = req.headers['x-site'];

    try {
        const token = req.body.token;
        const privateKey = process.env.JWT_SECRET as any;
        
        var userData = jwt.verify(token, privateKey) as any;
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'auth confirm', 'createRequest'); return res.json({ status: false, message: 'Error Confirm' }); }

        let columnsValues = 'confirmed = @confirmed, ';
        request.input('confirmed', sql.SmallInt, 1);

        request.query(`
            UPDATE users 
            SET ` + columnsValues +
            `modified_at = GETDATE() ` +
            `WHERE id = ${userData.id} AND email = '${userData.email.toLowerCase()}'`,
            (err: any, result: any) => {
                if(!err){
                    return res.json({ status: true, result: result, message: 'You have been successfully registered!<br/>Please wait for the admin approval.' });
                }
                else{
                    createSiteLog(siteAlias, 'auth confirm', err.message);
                    return res.json({ status: false, message: 'Error Confirm', exception: err.message });
                }
            }
        );
    }
    catch(error){
        createSiteLog(siteAlias, 'auth confirm catch', error);
        return res.json({ status: false, message: 'Error Confirm', exception: error });
    }
});

router.post('/reset', async (req, res, next) => {

    const siteAlias = req.headers['x-site'];

    try {
        const email = req.body.email;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request) return res.json({ status: false, message: 'Error Reset' });

        const sql = `SELECT id FROM users WHERE email = '${email.toLowerCase()}'`;
        await request.query(sql,
            async (err: any, result: any) => {
                if(err){ return res.json({ status: false, message: 'Invalid an email address, Please try again.', exception: err.message }); }
                else{
                    const resultData = result?.recordset[0] as any;

                    if(resultData){

                        const userData = {
                            id: resultData.id,
                            email: email.toLowerCase()
                        }

                        const privateKey = process.env.JWT_SECRET as string;
                        const token = jwt.sign(userData, privateKey);

                        const requestPortal = await createPortalRequest();
                        if(!requestPortal){ createSiteLog(siteAlias, 'sendInviteEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

                        const sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                                        FROM sites AS s 
                                        WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

                        const query = await requestQuery(requestPortal, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

                        const queryResultRecordsetPortal = query.result.recordset[0];
                        if(queryResultRecordsetPortal){

                            const mail = {
                                from: queryResultRecordsetPortal.email_sender,
                                to: email.toLowerCase(),
                                subject: "You requested a new CX InSight CXM Platform password",
                                html: `
                                <p>You request to reset your CX InSight CXM Platform for the username ${email.toLowerCase()}.</p>
                                <p><a href="https://cxinsight-frontend.onrender.com/cxm/platform/${req.headers['x-site']}/resetpassword/${token}">Click Here</a> to create your new password.</p>`  //email body
                            }

                            const smtp = {
                                host: queryResultRecordsetPortal.smtp_host as any, //set to your host name or ip
                                port: parseInt(queryResultRecordsetPortal.smtp_port) as any,//465, //25, 465, 587 depend on your 
                                secure: false, // use SSL : true
                                auth: {
                                    user: queryResultRecordsetPortal.email_sender as any, //user account
                                    pass: queryResultRecordsetPortal.email_secret as any //user password
                                }
                            };

                            const smtpTransport = nodemailer.createTransport(smtp);
                            
                            smtpTransport.sendMail(mail, function(error, response){
                                smtpTransport.close();
                                // error handler
                                if(error){ createSiteLog(siteAlias, 'reset smtpTransport.sendMail', query.errorMessage); return res.json({ status: false, message: 'Reset Error', exception: error }); } 
                                else{ return res.json({ status: true, result: result, message: 'Please check your inbox,<br/>we just emailed you a link to reset your password.' }); }
                                // success handler 
                            });

                        } else{ return res.json({ status: false, message: 'Invalid an email address, Please try again.', exception: err.message }); }

                    } else{ return res.json({ status: false, message: 'Invalid an email address, Please try again.', exception: err.message }); }
                }
                
            });
    }
    catch(error){
        createSiteLog(siteAlias, 'auth reset catch', error);
        return res.json({ status: false, message: 'Error Confirm', exception: error });
    }
});

router.post('/update', async (req, res, next) => {

    const siteAlias = req.headers['x-site'];
    
    try {
        const id = req.body.id;
        const email = req.body.email;
        const password = req.body.password;
        const passwordHash = bcrypt.hashSync(password);
        
        const request = await createRequest(req) as any;
        if(!request) return res.json({ status: false, message: 'Error Update' });

        let columnsValues = 'password = @password, ';
        request.input('password', sql.VarChar, passwordHash);

        request.query(`
            UPDATE users 
            SET ` + columnsValues +
            `modified_at = GETDATE() ` +
            `WHERE id = ${id} AND email = '${email.toLowerCase()}'`,
            (err: any, result: any) => {
                if(err){ createSiteLog(siteAlias, 'auth update users', err.message); return res.json({ status: false, message: 'Error update', exception: err.message }); }
                else{ return res.json({ status: true, result: result, message: 'Password Updated' }); }
            }
        );
    }
    catch(error){
        createSiteLog(siteAlias, 'auth update catch', error);
        return res.json({ status: false, message: 'Error update', exception: error });
    }
});

router.get('/iconlite/:base64', async (req, res, next) => {

    const siteAlias = req.headers['x-site'];

    try {
        const base64 = req.params.base64;
        const bufferBase64 = Buffer.from(base64, 'base64');
        const uid = bufferBase64.toString();

        // Decode the String
        if(uid){

            const requestPortal = await createPortalRequest();
            if(!requestPortal){ createSiteLog(siteAlias, '/iconlite/:base64', 'createPortalRequest'); return res.json({ status: false, message: 'Error /iconlite/:base64 createPortalRequest', exception: '' }); }

            let sqlStr = `SELECT s.*
                          FROM sites AS s 
                          WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

            let query = await requestQuery(requestPortal, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, '/iconlite/:base64 createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error /iconlite/:base64 createPortalRequest SELECT', exception: query.errorMessage }); }

            const queryResultRecordsetPortal = query.result.recordset[0];

            if(queryResultRecordsetPortal){

                const iconLiteApiUrl = queryResultRecordsetPortal.icon_lite_api_url;

                const request = await createRequest(req) as any;
                if(!request){ createSiteLog(siteAlias, 'auth get iconlite', 'createRequest'); return res.json({ status: false, message: 'Error Icon Lite Login' }); }

                const sql = `SELECT email FROM users WHERE iconlite_id = '${uid}' AND active = 1`;
                await request.query(sql,
                    (err: any, result: any) => {
                        if(err){ createSiteLog(siteAlias, 'auth get iconlite SELECT', err.message); return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: err }); }
                        else {
                            const resultData = result?.recordset[0] as any;

                            if(resultData){ return res.json({ status: true, found: true, user: { email: `${resultData.email.toLowerCase()}`, password: "123456" } }); }
                            else{ return res.json({ status: true, found: false, iconLiteApiUrl: iconLiteApiUrl }); }
                        }
                    }
                );
            }
            else{
                createSiteLog(siteAlias, `else /iconlite/:base64`, 'The site is not found');
                return res.json({ status: false, message: `else /iconlite/:base64`, exception: "The site is not found" });
            }
        }   
        else{ return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', }); }
    }
    catch(error){
        createSiteLog(siteAlias, 'auth get iconlite catch', error);
        return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: error });
    }
});

router.post('/iconlite/register', async (req, res, next) => {
  
    const siteAlias = req.headers['x-site'];

    try {
        const register = req.body

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'auth register iconlite', 'createRequest'); return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support' }); }

        const sqlStr = `SELECT id FROM users WHERE email = '${register.email.toLowerCase()}' AND active = 1`;
        await request.query(sqlStr,
            async (err: any, result: any) => {
                if(err){ createSiteLog(siteAlias, 'auth register iconlite', err.message); return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: err.message }); }
                else{
                    const resultData = result?.recordset[0] as any;
                    
                    //That email address has already been used
                    if(resultData){ return res.json({ status: false, message: 'That email address has already been used.', exception: err }); }
                    else{
                        const transaction = await createTransaction(req) as any;
                        if(!transaction){ createSiteLog(siteAlias, 'auth register iconlite', 'createTransaction'); return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support' }); }
                        transaction.begin().then(async function () {
                            try {
                                const passwordHash = bcrypt.hashSync(register.password);
                                
                                const request = await createRequest(req, transaction) as any;
                                if(!request){ createSiteLog(siteAlias, 'auth register iconlite', 'transaction createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support' }); }); return; }

                                request.input('email', sql.VarChar, register.email.toLowerCase())
                                request.input('title', sql.NVarChar, register.title)
                                request.input('first_name', sql.NVarChar, register.first_name)
                                request.input('last_name', sql.NVarChar, register.last_name)
                                request.input('company_name', sql.NVarChar, register.company_name)
                                request.input('mobile_number', sql.VarChar, register.mobile_number)
                                request.input('password', sql.NVarChar, passwordHash)
                                request.input('iconlite_id', sql.VarChar, register.iconlite_id)
                                request.input('role_id', sql.SmallInt, register.role_id)
                                request.input('confirmed', sql.SmallInt, 1)
                                request.input('approved', sql.SmallInt, 1)

                                const sqlStr = `INSERT INTO users (email, title, first_name, last_name, company_name, mobile_number, password, role_id, confirmed, approved, iconlite_id) 
                                                OUTPUT INSERTED.id
                                                VALUES (@email, @title, @first_name, @last_name, @company_name, @mobile_number, @password, @role_id, @confirmed, @approved, @iconlite_id)`;

                                request.query(sqlStr, (err: any, result: any) => {
                                    if(err){ createSiteLog(siteAlias, 'auth register iconlite', err.message); transaction.rollback(function() { return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: err.message }); }); return; }
                                    else{
                                        const resultData = result?.recordset[0] as any;
                                        if(resultData){
                                            //success handler 
                                            transaction.commit(function(err: any) {
                                                // ... error checks
                                                if(!err){ return res.json({ status: true }); }
                                                else{ createSiteLog(siteAlias, 'auth register iconlite transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: err }); }); return; }
                                            });
                                        }
                                        else{ transaction.rollback(function() { return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: err }); }); return; }
                                    }
                                });
                            }
                            catch(error){ 
                                createSiteLog(siteAlias, 'auth register iconlite catch', error);
                                return res.json({ status: false, message: 'Error ICON Lite User Login, please try again or contact a technical support', exception: error }); 
                            }
                        });
                    }
                }
            });
    } catch (error) {
        createSiteLog(siteAlias, 'auth register iconlite catch', error);
        return res.status(500).json(error);
    }
});

export default router;
