import { Request, Response, Router } from "express";
import { createTransaction, createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";
import { Email } from "../interface/Email";
import * as sql from 'mssql';
import schedule from 'node-schedule';
import jwt from 'jsonwebtoken';
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

export async function getEmails(req: Request, res: Response) {
   
    try {
        const id = req.params.collectorId ? req.params.collectorId : '';
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getEmails', 'createRequest'); return res.json({ status: false, message: 'Error Get Emails' }); }

        const sqlWhere = req.params.collectorId ? "WHERE e.active = 1 and e.collector_id = " + id : "WHERE e.active = 1";
        
        const sqlStr = `SELECT e.* , es.name AS responded_name, FORMAT(e.event_datetime_stamp, 'dd/MM/yyyy HH:mm') AS event_datetime
                        FROM emails as e 
                        LEFT JOIN response_status as es ON e.response_status = es.id 
                        ${sqlWhere}
                        ORDER BY e.modified_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getEmails', query.errorMessage); return res.json({ status: false, message: 'Error Get Emails', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getEmails', error);
        return res.json(error);
    }
};

export async function sendInviteEmail(req: Request, res: Response){
    
    try {
        // const tableName = parseInt(req.body.type_id) === 3 ? 'emails' : 'smses';
        const tableName = 'emails';
        const surveyId = parseInt(req.body.survey_id);
        const collectorId = parseInt(req.body.collector_id);
        const id = req.body.id;

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'sendInviteEmail', 'createRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

        let sqlStr = `SELECT u.*, 
                      ( SELECT s.name FROM surveys AS s WHERE s.active = 1 AND s.id = ${surveyId}) AS survey_name,
                      ( SELECT s.image_src FROM surveys AS s WHERE s.active = 1 AND s.id = ${surveyId}) AS image_src,
                      ( SELECT s.image_src_type FROM surveys AS s WHERE s.active = 1 AND s.id = ${surveyId}) AS image_src_type,
                      ( SELECT c.subject FROM collectors AS c WHERE c.active = 1 AND c.id = ${collectorId}) AS email_subject,
                      ( SELECT c.message FROM collectors AS c WHERE c.active = 1 AND c.id = ${collectorId}) AS email_message,
                      ( SELECT c.color_theme FROM collectors AS c WHERE c.active = 1 AND c.id = ${collectorId}) AS email_color_theme,
                      ( SELECT c.name FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_name,
                      ( SELECT p.name FROM collectors as c LEFT JOIN projects as p ON c.project_id = p.id WHERE c.id = ${collectorId} ) AS collector_project
                      FROM ${tableName} AS u 
                      WHERE u.active = 1 AND u.id = ${id}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

        let queryResultRecordset = query.result.recordset[0];
        if(queryResultRecordset){

            let userData = {};
            if(parseInt(req.body.type_id) === 2){ //emails
                userData = {
                    survey_id: surveyId,
                    collector_id: collectorId,
                    email_id: id,
                    email_address: queryResultRecordset.email_address,
                    first_name: queryResultRecordset.first_name,
                    last_name: queryResultRecordset.last_name,
                    custom_group : queryResultRecordset.custom_group,
                    customer_id : queryResultRecordset.customer_id,
                }

                const privateKey = process.env.JWT_SECRET as string;
                const jwtToken = jwt.sign(userData, privateKey);

                let buff = Buffer.from(jwtToken)
                let base64data = buff.toString('base64');

                const requestPortal = await createPortalRequest();
                if(!requestPortal){ createSiteLog(siteAlias, 'sendInviteEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

                sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                          FROM sites AS s 
                          WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

                query = await requestQuery(requestPortal, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

                const queryResultRecordsetPortal = query.result.recordset[0];
                if(queryResultRecordsetPortal){
                    
                    let emailSubjectReplace = queryResultRecordset.email_subject ? queryResultRecordset.email_subject.replace(/\${ProjectName}/g, queryResultRecordset.collector_project) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${CollectorName}/g, queryResultRecordset.collector_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${FirstName}/g, queryResultRecordset.first_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${LastName}/g, queryResultRecordset.last_name) : '';

                    const mail = {
                        from: queryResultRecordsetPortal.email_sender,
                        to: queryResultRecordset.email_address,
                        subject: emailSubjectReplace,
                        html: sendInviteHtml(req, queryResultRecordset, base64data)
                    }

                    const messageLog = `Sent an invitation email to ${queryResultRecordset.email_address}`;

                    const transaction = await createTransaction(req) as any;
                    if(!transaction){ createSiteLog(siteAlias, 'sendInviteEmail', 'createTransaction'); return res.json({ status: false, message: 'Error Send Invite' }); }
                    transaction.begin().then(async function () {
                        try{
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

                            smtpTransport.sendMail(mail, async function(error, response){
                                smtpTransport.close();
                                if(error){
                                    createSiteLog(siteAlias, 'sendInviteEmail smtpTransport.sendMail', error); 
                                    transaction.rollback(function() { return res.json({ status: false, message: 'Send invite email error, please do it again later.', exception: error }); });
                                }else{
                                    const request = await createRequest(req, transaction) as any;
                                    if(!request){ createSiteLog(siteAlias, 'sendInviteEmail', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Send Invite' }); }); return; }

                                    request.input('survey_id', sql.SmallInt, surveyId);
                                    request.input('collector_id', sql.SmallInt, collectorId);
                                    request.input('message_log', sql.NVarChar, messageLog);

                                    sqlStr = `INSERT INTO message_history (survey_id, collector_id, message_log) 
                                              OUTPUT INSERTED.id
                                              VALUES (@survey_id, @collector_id, @message_log)`

                                    query = await requestQuery(request, sqlStr) as any;
                                    if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail sendinvite', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Send Invite' }); }); return; }
                                        
                                    //UPDATE ${tableName}
                                    sqlStr = `UPDATE ${tableName} 
                                              SET sent = 1, modified_at = GETDATE() 
                                              WHERE id = ${id}`;

                                    query = await requestQuery(request, sqlStr) as any;
                                    if(query.error){ createSiteLog(siteAlias, `sendInviteEmail UPDATE ${tableName}`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Send Invite' }); }); return; }
                                    
                                    transaction.commit(function(err: any) {
                                        if(err){ createSiteLog(siteAlias, 'sendInviteEmail smtpTransport.sendMail transaction.commit ', err); transaction.rollback(function() { return res.json({ status: false, message: 'Send invite email error, please do it again later.', exception: err }); }); }
                                        return res.json({ status: true, message: 'Sent invite email.', exception: error });
                                    });
                                }
                            });
                        }
                        catch(error){ 
                            createSiteLog(siteAlias, 'sendInviteEmail', error); 
                            transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: error }); });
                        }
                    });

                } else{ return res.json({ status: false, message: 'Send invite email error', exception: query.errorMessage }); }
            }
            else{
                userData = {
                    survey_id: surveyId,
                    collector_id: collectorId,
                    sms_id: id,
                    mobile_number: queryResultRecordset.mobile_number,
                    first_name: queryResultRecordset.first_name,
                    last_name: queryResultRecordset.last_name,
                    custom_group : queryResultRecordset.custom_group,
                    customer_id : queryResultRecordset.customer_id,
                }

                return res.json({ status: true, result: query.result, message: 'For SMS Collector' });
            }

        } else{ return res.json({ status: false, message: 'Send invite email error', exception: query.errorMessage }); }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'sendInviteEmail', error);
        return res.json({ status: false, message: 'Send invite email error', exception: error });
    }
}

export async function followUpSendEmails(req: Request, res: Response){
    
    try {
        const collectorId = req.params.collectorId;
        const functionId =  parseInt(req.params.functionId);
        const messageLabel = functionId === 4 ? `invitation` : `reminder`;

        let conditions = '';
        let functionName = '';
        //1 = no response, 2 = partial response, 3 = both, 4 = not sent yet
        if(functionId === 1) { conditions = `AND e.sent = 1 AND e.response_status = 1`; functionName = `no response`}
        else if(functionId === 2) { conditions = `AND e.sent = 1 AND e.response_status = 2`; functionName = `partial response`}
        else if(functionId === 3) { conditions = `AND e.sent = 1 AND (e.response_status = 1 OR e.response_status = 2)`; functionName = `both (no response and partial response)`}
        else if(functionId === 4) { conditions = `AND e.sent = 0`; functionName = `not sent invitation yet`}

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'followUpSendEmails', 'createRequest'); return res.json({ status: false, message: 'Error Send Follow Up Emails' }); }

        let sqlStr = `SELECT e.*, c.survey_id, c.send_date, c.subject AS email_subject, c.message AS email_message, c.color_theme AS email_color_theme,  
                      ( SELECT s.name FROM surveys AS s WHERE s.id = (SELECT survey_id FROM collectors AS c WHERE c.id = ${collectorId}) ) AS survey_name,
                      ( SELECT s.image_src FROM surveys AS s WHERE s.id = (SELECT survey_id FROM collectors AS c WHERE c.id = ${collectorId}) ) AS image_src ,
                      ( SELECT c.name FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_name,
                      ( SELECT p.name FROM collectors as c LEFT JOIN projects as p ON c.project_id = p.id WHERE c.id = ${collectorId} ) AS collector_project
                      FROM emails AS e 
                      LEFT JOIN collectors AS c ON e.collector_id = c.id 
                      WHERE e.active = 1 ${conditions} AND e.collector_id = ${collectorId}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'followUpSendEmails SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Follow Up Emails', exception: query.errorMessage }); }

        let queryResultRecordsets = query.result.recordset;
        if(queryResultRecordsets.length){

            const messageLog = `Sent ${messageLabel} emails to ${queryResultRecordsets.length} people with ${functionName}`;

            request.input(`survey_id_reminder`, sql.SmallInt, queryResultRecordsets[0].survey_id);
            request.input(`collector_id_reminder`, sql.SmallInt, collectorId);
            request.input(`message_log_reminder`, sql.NVarChar, messageLog);

            sqlStr = `INSERT INTO message_followup (survey_id, collector_id, message_log) 
                      OUTPUT INSERTED.id
                      VALUES (@survey_id_reminder, @collector_id_reminder, @message_log_reminder)`;

            query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'followUpSendEmails INSERT INTO message_followup', query.errorMessage); return; }
            
            queryResultRecordsets.map(async (resultData: any, i: any) => {
                const userData = {
                    survey_id: resultData.survey_id,
                    collector_id: resultData.collector_id,
                    email_id: resultData.id,
                    email_address: resultData.email_address,
                    first_name: resultData.first_name,
                    last_name: resultData.last_name,
                    custom_group : resultData.custom_group,
                }

                const privateKey = process.env.JWT_SECRET as string;
                const jwtToken = jwt.sign(userData, privateKey);

                let buff = Buffer.from(jwtToken)
                let base64data = buff.toString('base64');

                const requestPortal = await createPortalRequest();
                if(!requestPortal){ createSiteLog(siteAlias, 'sendInviteEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

                sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                          FROM sites AS s 
                          WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

                query = await requestQuery(requestPortal, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

                const queryResultRecordsetPortal = query.result.recordset[0];
                if(queryResultRecordsetPortal){

                    let emailSubjectReplace = resultData.email_subject ? resultData.email_subject.replace(/\${ProjectName}/g, resultData.collector_project) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${CollectorName}/g, resultData.collector_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${FirstName}/g, resultData.first_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${LastName}/g, resultData.last_name) : '';

                    const mail = {
                        from: queryResultRecordsetPortal.email_sender,
                        to: resultData.email_address,
                        subject: emailSubjectReplace,
                        html: sendInviteHtml(req, resultData, base64data)
                    }

                    const currentDatetime = new Date();
                    const sendDatetime = currentDatetime.setSeconds( currentDatetime.getSeconds() + (5 * (i+1)) );

                    schedule.scheduleJob(sendDatetime, async function(){

                        const transaction = await createTransaction(req) as any;
                        if(!transaction){ createSiteLog(siteAlias, 'followUpSendEmails schedule.scheduleJob', 'createTransaction'); return res.json({ status: false, message: 'Error Send Follow Up Emails' }); }
                        transaction.begin().then(async function () {
                            try{
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

                                smtpTransport.sendMail(mail, async function(error, response){
                                    smtpTransport.close();
                                    if(error){
                                        createSiteLog(siteAlias, 'followUpSendEmails smtpTransport.sendMail', error); 
                                        transaction.rollback();
                                    }else{
                                        const messageLog = `Sent an ${messageLabel} email to ${resultData.email_address}`;

                                        const request = await createRequest(req, transaction) as any;
                                        if(!request){ createSiteLog(siteAlias, 'followUpSendEmails', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Send Follow Up Emails' }); }); return; }

                                        request.input(`survey_id_${i}`, sql.SmallInt, resultData.survey_id);
                                        request.input(`collector_id_${i}`, sql.SmallInt, resultData.collector_id);
                                        request.input(`message_log_${i}`, sql.NVarChar, messageLog);

                                        sqlStr = `INSERT INTO message_history (survey_id, collector_id, message_log) 
                                                  OUTPUT INSERTED.id
                                                  VALUES (@survey_id_${i}, @collector_id_${i}, @message_log_${i})`;

                                        query = await requestQuery(request, sqlStr) as any;
                                        if(query.error){ createSiteLog(siteAlias, 'followUpSendEmails INSERT INTO message_history', query.errorMessage); transaction.rollback(); return; }
                                        
                                        //UPDATE emails
                                        sqlStr = `UPDATE emails 
                                                  SET sent = 1, modified_at = GETDATE() 
                                                  WHERE id = ${resultData.id}`;

                                        query = await requestQuery(request, sqlStr) as any;
                                        if(query.error){ createSiteLog(siteAlias, 'followUpSendEmails UPDATE emails', query.errorMessage); transaction.rollback(); return; }                                      
                                        
                                        transaction.commit(function(err: any) {
                                            if(err){ createSiteLog(siteAlias, 'followUpSendEmails smtpTransport.sendMail transaction.commit ', err); transaction.rollback(); }
                                        });
                                    }
                                });
                                
                            }catch(error){
                                createSiteLog(siteAlias, 'followUpSendEmails smtpTransport.sendMail', error); 
                                transaction.rollback();
                            }
                        });
                    });

                } else{ return res.json({ status: true, message: `No emails ${messageLabel} to send`, }); }

            });

            const timeToSend = Math.ceil(queryResultRecordsets.length * 5 / 60);
            return res.json({
                status: true,
                message: `Scheduled send ${messageLabel} emails to ${queryResultRecordsets.length} people, would be done in ${ timeToSend > 1 ? `${timeToSend} mins` : `${queryResultRecordsets.length * 5} second`}`,
            });
        }
        else{
            return res.json({
                status: true,
                message: `No emails ${messageLabel} to send`,
            });
        }

    } 
    catch(error){
        createSiteLog(req.headers['x-site'], 'followUpSendEmails', error);
        return res.json({ status: false, message: 'Error Send Follow Up Emails', exception: error });
    }
}

export async function scheduleSendEmails(req: Request, res: Response){
    
    try {
        const collectorId = req.params.collectorId ? req.params.collectorId : '';
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'scheduleSendEmails', 'createRequest'); return res.json({ status: false, message: 'Error Schedule Send Emails' }); }

        let sqlStr = `SELECT e.*, c.survey_id, c.send_date, c.subject AS email_subject, c.message AS email_message, c.color_theme AS email_color_theme,   
                      ( SELECT s.name FROM surveys AS s WHERE s.id = (SELECT survey_id FROM collectors AS c WHERE c.id = ${collectorId}) ) AS survey_name, 
                      ( SELECT s.image_src FROM surveys AS s WHERE s.id = (SELECT survey_id FROM collectors AS c WHERE c.id = ${collectorId}) ) AS image_src,
                      ( SELECT c.name FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_name,
                      ( SELECT p.name FROM collectors as c LEFT JOIN projects as p ON c.project_id = p.id WHERE c.id = ${collectorId} ) AS collector_project
                      FROM emails AS e 
                      LEFT JOIN collectors AS c ON e.collector_id = c.id 
                      WHERE e.active = 1 AND e.sent = 0 AND e.collector_id = ${collectorId}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'scheduleSendEmails SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Schedule Send Emails', exception: query.errorMessage }); }

        let queryResultRecordsets = query.result.recordset;
        if(queryResultRecordsets.length){

            queryResultRecordsets.map(async (resultData: any, i: any) => {
                const userData = {
                    survey_id: resultData.survey_id,
                    collector_id: resultData.collector_id,
                    email_id: resultData.id,
                    email_address: resultData.email_address,
                    first_name: resultData.first_name,
                    last_name: resultData.last_name,
                    custom_group : resultData.custom_group,
                }

                const privateKey = process.env.JWT_SECRET as string;
                const jwtToken = jwt.sign(userData, privateKey);

                let buff = Buffer.from(jwtToken)
                let base64data = buff.toString('base64');

                const requestPortal = await createPortalRequest();
                if(!requestPortal){ createSiteLog(siteAlias, 'sendInviteEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Error Send Invite' }); }

                sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                          FROM sites AS s 
                          WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

                query = await requestQuery(requestPortal, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'sendInviteEmail createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Send Invite', exception: query.errorMessage }); }

                const queryResultRecordsetPortal = query.result.recordset[0];
                if(queryResultRecordsetPortal){
                    
                    let emailSubjectReplace = resultData.email_subject ? resultData.email_subject.replace(/\${ProjectName}/g, resultData.collector_project) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${CollectorName}/g, resultData.collector_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${FirstName}/g, resultData.first_name) : '';
                    emailSubjectReplace = emailSubjectReplace ? emailSubjectReplace.replace(/\${LastName}/g, resultData.last_name) : '';

                    const mail = {
                        from: queryResultRecordsetPortal.email_sender,
                        to: resultData.email_address,
                        subject: emailSubjectReplace,
                        html: sendInviteHtml(req, resultData, base64data)
                    }

                    resultData.send_date.setSeconds( resultData.send_date.getSeconds() + (5 * (i+1)) );

                    schedule.scheduleJob(resultData.send_date, async function(){

                        sqlStr = `SELECT c.* 
                                  FROM collectors AS c 
                                  WHERE c.active = 1 AND c.id = ${collectorId}`;

                        let query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'scheduleSendEmails SELECT', query.errorMessage); }

                        let queryResultRecordsets = query.result.recordset;
                        
                        if(queryResultRecordsets.length){
                            const collectorData = queryResultRecordsets[0] as any;

                            collectorData.send_date.setSeconds( collectorData.send_date.getSeconds() + (5 * (i+1)) );

                            if( collectorData.send && (collectorData.send_date.getTime() === resultData.send_date.getTime()) ){

                                const messageLog = `Sent an invitation email to ${resultData.email_address}`;

                                const transaction = await createTransaction(req) as any;
                                if(!transaction){ createSiteLog(siteAlias, 'scheduleSendEmails schedule.scheduleJob', 'createTransaction'); return res.json({ status: false, message: 'Error Schedule Send Emails' }); }
                                transaction.begin().then(async function () {
                                    try{
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
                                        
                                        smtpTransport.sendMail(mail, async function(error, response){
                                            smtpTransport.close();
                                            if(error){
                                                createSiteLog(siteAlias, 'scheduleSendEmails smtpTransport.sendMail', error); 
                                                transaction.rollback();
                                            }else{
                                                const request = await createRequest(req, transaction) as any;
                                                if(!request){ createSiteLog(siteAlias, 'scheduleSendEmails', 'createRequest'); return res.json({ status: false, message: 'Error Schedule Send Emails' }); }
                                                
                                                request.input('survey_id', sql.SmallInt, resultData.survey_id);
                                                request.input('collector_id', sql.SmallInt, resultData.collector_id);
                                                request.input('message_log', sql.NVarChar, messageLog);

                                                sqlStr = `INSERT INTO message_history (survey_id, collector_id, message_log) 
                                                          OUTPUT INSERTED.id
                                                          VALUES (@survey_id, @collector_id, @message_log)`;

                                                query = await requestQuery(request, sqlStr) as any;
                                                if(query.error){ createSiteLog(siteAlias, 'scheduleSendEmails INSERT INTO message_history', query.errorMessage); transaction.rollback(); return;}

                                                //UPDATE emails
                                                sqlStr = `UPDATE emails 
                                                          SET sent = 1, modified_at = GETDATE() 
                                                          WHERE id = ${resultData.id}`;

                                                query = await requestQuery(request, sqlStr) as any;
                                                if(query.error){ createSiteLog(siteAlias, 'scheduleSendEmails UPDATE emails', query.errorMessage); transaction.rollback(); return;}
                                                
                                                transaction.commit(function(err: any) {
                                                    if(err){ createSiteLog(siteAlias, 'scheduleSendEmails smtpTransport.sendMail transaction.commit ', err); transaction.rollback(); }
                                                });
                                            }
                                        });
                                    }
                                    catch(error){
                                        createSiteLog(siteAlias, 'scheduleSendEmails', error); 
                                        transaction.rollback(function() { return res.json({ status: false, message: 'Error schedule send emails', exception: error }); });
                                    }
                                });
                                
                            } else{ createSiteLog(siteAlias, `scheduleSendEmails`, `Not send (not the same setup as the first time setup so do nothing here)`); }

                        } else{ createSiteLog(siteAlias, `scheduleSendEmails`, `collectors no match result ${queryResultRecordsets}`); }

                    });

                } else{ return res.json({ status: true, message: 'No emails to send', }); }

            });

            return res.json({ status: true, message: 'Scheduled send emails', });

        } else{ return res.json({ status: true, message: 'No emails to send', }); }

    }
    catch(error){
        createSiteLog(req.headers['x-site'], `scheduleSendEmails`, error);
        return res.json({ status: false, message: 'Error schedule send emails', exception: error });
    }
}

export async function createEmail(req: Request, res: Response){
    
    try {
        const newEmail: Email = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createEmail', 'createRequest'); return res.json({ status: false, message: 'Error Create An Emails' }); }

        request.input('collector_id', sql.VarChar, newEmail.collector_id)
        request.input('email_address', sql.NVarChar, newEmail.email_address)
        request.input('first_name', sql.NVarChar, newEmail.first_name)
        request.input('last_name', sql.NVarChar, newEmail.last_name)
        request.input('customer_id', sql.NVarChar, newEmail.customer_id)
        request.input('custom_group', sql.NVarChar, newEmail.custom_group)

        const sqlStr = `INSERT INTO emails (collector_id, email_address, first_name, last_name, customer_id, custom_group) 
                        OUTPUT INSERTED.id
                        VALUES (@collector_id, @email_address, @first_name, @last_name, @customer_id, @custom_group)`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createEmail', query.errorMessage); return res.json({ status: false, message: 'Error Create An Emails', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Email Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createEmail', error);
        return res.json({ status: false, message: 'Error Create', exception: error });
    }
}

export async function getEmail(req: Request, res: Response) {
    
    try{
        const id = req.params.emailId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getEmail', 'createRequest'); return res.json({ status: false, message: 'Error Get An Email' }); }

        const sqlStr = `SELECT e.*, es.name AS responded_name, FORMAT(e.event_datetime_stamp, 'dd/MM/yyyy HH:mm') AS event_datetime
                        FROM emails as e 
                        LEFT JOIN response_status as es ON e.response_status = es.id 
                        WHERE e.active = 1 and e.id = ${id}`

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getEmail', query.errorMessage); return res.json({ status: false, message: 'Error Get An Email', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getEmail', error);
        return res.json(error);
    }
};

export async function deleteEmail(req: Request, res: Response) {
    
    try{
        const id = req.params.emailId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'deleteEmail', 'createRequest'); return res.json({ status: false, message: 'Error Delete An Email' }); }

        const sqlStr = `UPDATE emails
                        SET active = 0, deleted_at = GETDATE() 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'deleteEmail', query.errorMessage); return res.json({ status: false, message: 'Error Delete An Email', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Email deleted' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteEmail', error);
        return res.json({ status: false, message: 'Error delete', exception: error });
    }
}

export async function updateEmail(req: Request, res: Response) {
    
    try {
        const id = req.params.emailId;
        const updateEmail = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateEmail', 'createRequest'); return res.json({ status: false, message: 'Error Update An Email' }); }

        let columnsValues = '';
        for (const key in updateEmail) {
            request.input(key, sql.SmallInt, updateEmail[key]);
            columnsValues += key + ' = @' + key + ', ';
        }

        const sqlStr = `UPDATE emails 
                        SET ${columnsValues} 
                        modified_at = GETDATE()
                        WHERE id = ${id}`

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateEmail', query.errorMessage); return res.json({ status: false, message: 'Error Update An Email', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Email Updated' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateEmail', error);
        return res.json({ status: false, message: 'Error Update', exception: error });
    }
};

export async function messageHistory(req: Request, res: Response) {
   
    try {
        const id = req.params.collectorId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'messageHistory', 'createRequest'); return res.json({ status: false, message: 'Error Get History Messages' }); }

        const sqlStr = `SELECT m.message_log, FORMAT( m.created_at, 'dd/MM/yyyy HH:mm:ss') AS created_date 
                        FROM message_history AS m 
                        WHERE m.active = 1 AND m.collector_id = ${id}
                        ORDER BY m.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'messageHistory', query.errorMessage); return res.json({ status: false, message: 'Error Get History Messages', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'messageHistory', error);
        return res.json(error);
    }
};

export async function messageFollowUp(req: Request, res: Response) {
   
    try {
        const id = req.params.collectorId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'messageFollowUp', 'createRequest'); return res.json({ status: false, message: 'Error Get Follow Up Messages' }); }

        const sqlStr = `SELECT m.message_log, FORMAT( m.created_at, 'dd/MM/yyyy HH:mm:ss') AS created_date 
                        FROM message_followup AS m 
                        WHERE m.active = 1 AND m.collector_id = ${id}
                        ORDER BY m.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'messageFollowUp', query.errorMessage); return res.json({ status: false, message: 'Error Get Follow Up Messages', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'messageFollowUp', error);
        return res.json(error);
    }
};

export async function sendErrorHandlingEmail(req: Request, res: Response){
    
    try {
        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});
        
        const errorData = {
            errorType : "The Requested Destination cannot reach",
            surveyId : req.body.survey_id,
            surveyName : req.body.survey_name,
            firstName : req.body.first_name,
            lastName : req.body.last_name,
            mobile : req.body.mobile,
            email : req.body.email,
            reason : "Destination URL server problem",
            solution : "1. Ensure the destination URL server is working properly and IT has to manual key-in consent from CX survey to OneTrust"
        }

        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'sendErrorHandlingEmail', 'createPortalRequest'); return res.json({ status: false, message: 'Send error handling email error' }); }

        let sqlStr = `SELECT s.email_sender, s.email_secret, s.smtp_host, s.smtp_port 
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'sendErrorHandlingEmail createPortalRequest SELECT Error', query.errorMessage); return res.json({ status: false, message: 'Send error handling email error', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];
        if(errorData.surveyId && queryResultRecordsetPortal){

            let now = new Date();
            now.setSeconds(now.getSeconds() + 3); // timestamp
            now = new Date(now); // Date object
    
            schedule.scheduleJob(now, async function(){
    
                const mail = {
                    from: queryResultRecordsetPortal.email_sender,
                    to: "nunticha.v@singhaestate.co.th",
                    subject: "CX error handling email for OneTrust",
                    html: errorHandlingHtml(req, errorData)
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

                smtpTransport.sendMail(mail, async function(error, response){
                    smtpTransport.close();
                    if(error){
                        createSiteLog(siteAlias, 'sendErrorHandlingEmail smtpTransport.sendMail Error', `error : ${error}, from: ${queryResultRecordsetPortal.email_sender}, to: "nunticha.v@singhaestate.co.th", subject: "CX Error Handling Email", errorType : ${errorData.errorType}, surveyId : ${req.body.survey_id}, surveyName : ${req.body.survey_name}, firstName : ${req.body.first_name}, lastName : ${req.body.last_name}, mobile : ${req.body.mobile}, email : ${req.body.email}, reason : ${errorData.reason}, solution : ${errorData.solution}`); 
                    }else{
                        createSiteLog(siteAlias, 'sendErrorHandlingEmail Sent', `from: ${queryResultRecordsetPortal.email_sender}, to: "nunticha.v@singhaestate.co.th", subject: "CX Error Handling Email", errorType : ${errorData.errorType}, surveyId : ${req.body.survey_id}, surveyName : ${req.body.survey_name}, firstName : ${req.body.first_name}, lastName : ${req.body.last_name}, mobile : ${req.body.mobile}, email : ${req.body.email}, reason : ${errorData.reason}, solution : ${errorData.solution}`); 
                    }
                });
                
            });

            return res.json({ status: true, message: ``, exception: 'pass' }); //pass

        } else{ 
            createSiteLog(siteAlias, 'sendErrorHandlingEmail Not pass', `surveyId : ${req.body.survey_id}, surveyName : ${req.body.survey_name}, firstName : ${req.body.first_name}, lastName : ${req.body.last_name}, mobile : ${req.body.mobile}, email : ${req.body.email}`); 
            return res.json({ status: false, message: '', exception: 'not pass' }); 
        }
            
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'sendErrorHandlingEmail', error);
        return res.json({ status: false, message: '', exception: error });
    }
}

function errorHandlingHtml(req: Request, errorData: any){ 
    try{
        return (
            `<div id="email-preview" style="width: 100%;">
                <div style="text-align: center;">
                    <table cellpadding="0" cellspacing="0" style="border: 0px; width: 100%; text-align: center;">
                        <tbody>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>ERROR Type :  ${errorData.errorType}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>Survey Name :  ${errorData.surveyName}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>FirstName :  ${errorData.firstName}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>LastName :  ${errorData.lastName}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>Mobile :  ${errorData.mobile}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>Email :  ${errorData.email}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>Reason :  ${errorData.reason}</p></td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>Solution :  ${errorData.solution}</p></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`
        );
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'sendInviteHtml', error);
        return `<div id="email-preview" style="width: 100%;"></div>`
    }
}

function sendInviteHtml(req: Request, resultData: any, base64data: any){ 
    try{

        let emailMessageReplace = resultData.email_message ? resultData.email_message.replace(/\${ProjectName}/g, resultData.collector_project) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/\${CollectorName}/g, resultData.collector_name) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/\${FirstName}/g, resultData.first_name) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/\${LastName}/g, resultData.last_name) : '';

        //update font sizes
        const fontSizeSmallStyleReplace = `ql-size-small" style="font-size: 0.75em;`;
        const fontSizeLargeStyleReplace = `ql-size-large" style="font-size: 1.5em;`;
        const fontSizeHugeStyleReplace = `ql-size-huge" style="font-size: 2.5em;`;

        const fontSizeSmallReplace = `ql-size-small" style="font-size: 0.75em;">`;
        const fontSizeLargeReplace = `ql-size-large" style="font-size: 1.5em;">`;
        const fontSizeHugeReplace = `ql-size-huge" style="font-size: 2.5em;">`;

        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-small" style="/g, fontSizeSmallStyleReplace) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-large" style="/g, fontSizeLargeStyleReplace) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-huge" style="/g, fontSizeHugeStyleReplace) : '';

        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-small">/g, fontSizeSmallReplace) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-large">/g, fontSizeLargeReplace) : '';
        emailMessageReplace = emailMessageReplace ? emailMessageReplace.replace(/ql-size-huge">/g, fontSizeHugeReplace) : '';


        let surveyName = resultData.survey_name ? resultData.survey_name.replace(/\${ProjectName}/g, resultData.collector_project) : '';
        surveyName = surveyName ? surveyName.replace(/\${CollectorName}/g, resultData.collector_name) : '';
        surveyName = surveyName ? surveyName.replace(/\${FirstName}/g, resultData.first_name) : '';
        surveyName = surveyName ? surveyName.replace(/\${LastName}/g, resultData.last_name) : '';

        return (
            `<div id="email-preview" style="width: 100%;">
                <div style="text-align: center;">
                    <table cellpadding="0" cellspacing="0" style="border: 0px; width: 100%; text-align: center;">
                        <tbody>
                            <tr style="background-color: ${resultData.email_color_theme ? resultData.email_color_theme : 'dodgerblue'}"><td colspan="5">&nbsp;</td></tr>
                            <tr style="background-color: ${resultData.email_color_theme ? resultData.email_color_theme : 'dodgerblue'}">
                                <td style="/*width: 20%;*/">&nbsp;</td>
                                <td style="/*width: 20%;*/">&nbsp;</td>
                                <td style="text-align: center; font-size: 29px; color: rgb(255, 255, 255); font-weight: normal; letter-spacing: 1px; line-height: 1;">${surveyName}</td>
                                <td style="/*width: 20%;*/">&nbsp;</td>
                                <td style="/*width: 20%;*/">&nbsp;</td>
                            </tr>
                            <tr style="background-color: ${resultData.email_color_theme ? resultData.email_color_theme : 'dodgerblue'}"><td colspan="5">&nbsp;</td></tr>
                            <tr><td colspan="5">&nbsp;</td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="padding: 0;text-align: center;">${resultData.image_src ? `<img src="${resultData.image_src}" style="max-width: 200px;max-height: 180px;" alt="logo">` : '' }</td></tr>
                            <tr><td colspan="5">&nbsp;</td></tr>
                            <tr><td colspan="5" align="left" valign="top" style="color: rgb(102, 102, 102); font-size: 13px; padding: 10px 20px;"><p>${emailMessageReplace}</p></td></tr>
                            <tr><td colspan="5">&nbsp;</td></tr>
                            <tr><td colspan="2">&nbsp;</td><td colspan="1">
                                    <a style="text-decoration: none;" href="${process.env.DOMAIN_NAME_FRONTEND}/${req.headers['x-site']}/sv?tk=${base64data}" target="_blank">
                                        <table cellpadding="0" cellspacing="0" style="text-align:center;margin: 0 auto;width: 30%;">
                                            <tbody>
                                                <tr><td style="text-align: center; background: ${resultData.email_color_theme ? resultData.email_color_theme : 'dodgerblue'}; border-radius: 4px; padding: 10px 18px;"><a style="font-size: 14px; color: rgb(255, 255, 255); text-decoration: none; letter-spacing: 1px; text-shadow: rgba(0, 0, 0, 0.8) -1px -1px 1px;" href="${process.env.DOMAIN_NAME_FRONTEND}/${req.headers['x-site']}/sv?tk=${base64data}" target="_blank">Begin Survey</a></td></tr>
                                            </tbody>
                                        </table>
                                    </a>
                                </td>
                                <td colspan="2">&nbsp;</td>
                            </tr>
                            <tr><td colspan="5">&nbsp;</td></tr>
                            <tr style="vertical-align: top; color: rgb(102, 102, 102); font-size: 10px;">
                                <td>&nbsp;</td>
                                <td colspan="3" style="text-align: center; vertical-align: top;"><p>Please do not forward this email as its survey link is unique to you. <br>
                                    <a href="# " target="_blank" style="color: rgb(51, 51, 51); text-decoration: underline;">Privacy</a></p>
                                </td>
                                <td>&nbsp;</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`
        );
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'sendInviteHtml', error);
        return `<div id="email-preview" style="width: 100%;"></div>`
    }
}