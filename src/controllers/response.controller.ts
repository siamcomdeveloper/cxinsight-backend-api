import { Request, Response } from "express";
import { createTransaction, createRequest, requestQuery, createSiteLog } from "../database";
import { SurveyResponse } from "../interface/Response";
import * as sql from 'mssql';
import schedule from 'node-schedule';

const requestIp = require('request-ip');

export async function getResponses(req: Request, res: Response){
   
    try {
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getResponses', 'createRequest'); return res.json({ status: false, message: 'Error Responses' }); }

        const sqlStr = `SELECT r.*, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') as created_date, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') as modified_date 
                        FROM responses as r 
                        WHERE r.active = 1
                        ORDER BY r.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getResponses', query.errorMessage); return res.json({ status: false, message: 'Error Responses', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getResponses', error);
        return res.json(error);
    }
};

export async function createResponse(req: Request, res: Response){
    
    try{
        const newResponse: SurveyResponse = req.body;
        const siteAlias = req.headers['x-site'];

        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createResponse', 'createRequest'); return res.json({ status: false, message: 'Error Create A Response' }); }
        
        const clientIp = requestIp.getClientIp(req);

        //step 1 : INSERT INTO responses
        request.input('survey_id', sql.SmallInt, newResponse.survey_id);
        request.input('project_id', sql.SmallInt, newResponse.project_id);
        request.input('collector_id', sql.SmallInt, newResponse.collector_id);
        request.input('time_spent', sql.Int, newResponse.time_spent);
        request.input('complete_status', sql.SmallInt, newResponse.complete_status);
        request.input('ip_address', sql.VarChar, clientIp);
        request.input('email_address', sql.VarChar, newResponse.email_address);
        request.input('first_name', sql.NVarChar, newResponse.first_name);
        request.input('last_name', sql.NVarChar, newResponse.last_name);
        request.input('customer_id', sql.NVarChar, newResponse.customer_id);
        request.input('custom_group', sql.NVarChar, newResponse.custom_group);

        let sqlStr = `INSERT INTO responses (survey_id, collector_id, project_id, time_spent, complete_status, ip_address, email_address, first_name, last_name, customer_id, custom_group) 
                      OUTPUT INSERTED.id
                      VALUES (@survey_id, @collector_id, @project_id, @time_spent, @complete_status, @ip_address, @email_address, @first_name, @last_name, @customer_id, @custom_group)`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createResponse step 1', query.errorMessage); return res.json({ status: false, message: 'Error Create A Response', exception: query.errorMessage }); }

        //step 2 : UPDATE
        const responsesResultData = query.result;
        const resultData = query.result.recordset[0];
        const responseInsertedId = resultData.id;

        if(newResponse.email_id || newResponse.sms_id){
            const tableName = newResponse.email_id ? 'emails' : 'smses';
            const clientId = newResponse.email_id ? newResponse.email_id : newResponse.sms_id;

            sqlStr = `UPDATE ${tableName} 
                      SET response_status = 2, response_id = ${responseInsertedId}, modified_at = GETDATE() 
                      WHERE id = ${clientId} AND response_status = 1`;
    
            query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'createResponse step 2', query.errorMessage); return res.json({ status: false, message: 'Error Response Create', exception: query.errorMessage }); }
            
            const queryResultRecordsets = query.result.recordsets;
            //response at the first time, update response_id to that record
            if(queryResultRecordsets.length === 0){//response_status = 1
                return res.json({ status: true, result: responsesResultData, message: 'Response Create' });
            }
            else{ //response more then 1 time, get response_id from that record (response_status > 1)
                const request = await createRequest(req) as any;
                if(!request){ createSiteLog(siteAlias, 'createResponse', 'createRequest'); return res.json({ status: false, message: 'Error Create A Response' }); }

                const sqlStr = `SELECT response_id AS id 
                                FROM ${tableName}
                                WHERE id = ${clientId} AND active = 1`;
                
                const query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'createResponse', query.errorMessage); return res.json({ status: false, message: 'Error Response Create', exception: query.errorMessage }); }

                return res.json({ status: true, result: query.result, message: 'Response Create' });
            }
        }
        else{
            return res.json({ status: true, result: query.result, message: 'Response Create' });
        }
    } 
    catch(error){
        createSiteLog(req.headers['x-site'], 'createResponse', error);
        return res.json(error);
    }
}

export async function updateResponse(req: Request, res: Response){
    
    try {
        const updateResponse: SurveyResponse = req.body;
        const siteAlias = req.headers['x-site'];
            
        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});

        if(updateResponse.email_id || updateResponse.sms_id){
            const tableName = updateResponse.email_id ? 'emails' : 'smses';
            const clientId = updateResponse.email_id ? updateResponse.email_id : updateResponse.sms_id;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'updateResponse', 'createRequest'); return res.json({ status: false, message: 'Error Update A Response' }); }
            
            const sqlStr = `SELECT response_status
                            FROM ${tableName}
                            WHERE id = ${clientId}`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'updateResponse SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Update A Response', exception: query.errorMessage }); }

            let queryResultRecordset = query.result.recordset[0];

            //check if this person (email) already responded
            if(queryResultRecordset.response_status === 3) return res.json({ status: false, message: 'You have already responded.' });
            else updateResponseProcess(updateResponse, req, res);

        }
        else{
            updateResponseProcess(updateResponse, req, res);
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateResponse', error);
        return res.json({ status: false, message: 'Error Update', exception: error });
    }
}

async function updateResponseScheduleJob(updateResponse: any, req: Request){
    try{
        const siteAlias = req.headers['x-site'];

        const currentDatetime = new Date();
        const sendDatetime = currentDatetime.setSeconds( currentDatetime.getSeconds() + 1 );
        
        schedule.scheduleJob(sendDatetime, async function(){

            const transaction = await createTransaction(req) as any;
            if(!transaction){ createSiteLog(siteAlias, 'updateResponseScheduleJob', 'createTransaction'); }
            transaction.begin().then(async function () {
                try{
                    const request = await createRequest(req, transaction) as any;
                    if(!request){ createSiteLog(siteAlias, 'updateResponseScheduleJob', 'createRequest'); transaction.rollback(); return; }

                    //step 1 SELECT total responses and time spent from every collectors
                    let sqlStr = `SELECT COUNT(*) AS total_responses, 
                                  ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${updateResponse.survey_id} ) AS total_completed_response, 
                                  ( SELECT AVG(time_spent) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id =  ${updateResponse.survey_id} AND r.time_spent < (SELECT num_question * 2 * 60 FROM surveys AS s WHERE s.active = 1 AND s.id =  ${updateResponse.survey_id}) ) AS avg_time_spent 
                                  FROM responses AS r 
                                  WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${updateResponse.survey_id}`;
                
                    let query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateResponseScheduleJob step 1', query.errorMessage); transaction.rollback(); return; }

                    // step 2 UPDATE surveys
                    let queryResultRecordset = query.result.recordset[0];
                    if(queryResultRecordset){
                        
                        const totalResponses = queryResultRecordset.total_responses;
                        const totalCompletedResponse = queryResultRecordset.total_completed_response;
                        const avgTimeSpent = queryResultRecordset.avg_time_spent;

                        const completePercent = (totalCompletedResponse / totalResponses) * 100;
                        
                        const updateSurvey: SurveyResponse = {
                            total_responses: totalCompletedResponse,
                            completion_rate: completePercent,
                            time_spent: avgTimeSpent
                        }

                        let columnsValues = '';
                        for (const key in updateSurvey) {
                            if(['completion_rate'].includes(key)){
                                request.input(`${key}_s4`, sql.SmallInt, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                            else if(['total_responses', 'time_spent'].includes(key)){
                                request.input(`${key}_s4`, sql.Int, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                        }

                        sqlStr = `UPDATE surveys 
                                  SET ${columnsValues}
                                  modified_at = GETDATE()
                                  WHERE id = ${updateResponse.survey_id}`;

                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'updateResponseScheduleJob step 2', query.errorMessage); transaction.rollback(); return; }

                        // step 3 UPDATE collectors
                        sqlStr = `UPDATE collectors 
                                  SET responses = ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${updateResponse.survey_id} AND r.collector_id = ${updateResponse.collector_id} ), modified_at = GETDATE() 
                                  WHERE id = ${updateResponse.collector_id}`;
                
                        query = await requestQuery(request, sqlStr) as any;
                        
                        if(query.error){ createSiteLog(siteAlias, 'updateResponseScheduleJob step 3', query.errorMessage); transaction.rollback(); return; }

                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, 'updateResponseProcess transaction.commit', err); transaction.rollback(); return; }
                        });
                    }
                    else{
                        transaction.rollback();
                        createSiteLog(siteAlias, 'updateResponseScheduleJob', 'else transaction.rollback()');
                    }
                }
                catch(error){
                    createSiteLog(siteAlias, 'updateResponseScheduleJob', error);
                    transaction.rollback();
                }
            });
        });
    } 
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateResponseScheduleJob', error);
    }
}

async function updateResponseProcess(updateResponse: any, req: Request, res: Response){

    try{
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateResponseProcess', 'createRequest'); return res.json({ status: false, message: 'Error Update The Response' }); }

        //step 1 UPDATE responses
        let columnsValues = '';
        for (const key in updateResponse) {
            if(['survey_id', 'collector_id', 'complete_status'].includes(key)){
                request.input(`${key}_s1`, sql.SmallInt, updateResponse[key]);
                columnsValues += `${key} = @${key}_s1, `;
            }
            else if(['time_spent'].includes(key)){
                request.input(`${key}_s1`, sql.Int, updateResponse[key]);
                columnsValues += `${key} = @${key}_s1, `;
            }
            else if(['email_address', 'mobile_number', 'birthdate', 'line_id', 'id_card_4_digit', 'room_number', 'customer_id'].includes(key)){
                request.input(`${key}_s1`, sql.VarChar, updateResponse[key]);
                columnsValues += `${key} = @${key}_s1, `;
            }
            else if(['name_title', 'first_name', 'last_name', 'custom_group', 'institution_name', 'project_name'].includes(key)){
                request.input(`${key}_s1`, sql.NVarChar, updateResponse[key]);
                columnsValues += `${key} = @${key}_s1, `;
            }
        }

        let sqlStr = `UPDATE responses
                      SET ${columnsValues}
                      modified_at = GETDATE()
                      WHERE id = ${updateResponse.response_id}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateResponseProcess step 1', query.errorMessage); return res.json({ status: false, message: 'Error Update The Response', exception: query.errorMessage }); }
        
        if(updateResponse.email_id || updateResponse.sms_id){
            const tableName = updateResponse.email_id ? 'emails' : 'smses';
            const clientId = updateResponse.email_id ? updateResponse.email_id : updateResponse.sms_id;

            // step 2 UPDATE ${tableName} 
            sqlStr = `UPDATE ${tableName} 
                      SET response_status = 3, modified_at = GETDATE() 
                      WHERE id = ${clientId} AND response_id = ${updateResponse.response_id}`;

            query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'updateResponseProcess step 2', query.errorMessage); return res.json({ status: false, message: 'Error Update The Response', exception: query.errorMessage }); }

            updateResponseScheduleJob(updateResponse, req);
            return res.json({ status: true, result: query.result, message: 'Response Sent' });
        }
        else{
            updateResponseScheduleJob(updateResponse, req);
            return res.json({ status: true, result: query.result, message: 'Response Sent' });
        }
    } 
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateResponseProcess', error);
        return res.json({ status: false, message: 'Error Update The Response', exception: error });
    }
                                
}

export async function getSurveyResponses(req: Request, res: Response) {

    try{
        const id = req.params.surveyId;
        const siteAlias = req.headers['x-site'];

        const getSurveyResponseBody = req.body;

        let sqlFilter = '';
        if(getSurveyResponseBody.filterTimePeriod.apply){
            if(getSurveyResponseBody.filterTimePeriod.filterStartDate && getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at BETWEEN '${getSurveyResponseBody.filterTimePeriod.filterStartDate}' AND '${getSurveyResponseBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(getSurveyResponseBody.filterTimePeriod.filterStartDate && !getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at >= '${getSurveyResponseBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!getSurveyResponseBody.filterTimePeriod.filterStartDate && getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at <= '${getSurveyResponseBody.filterTimePeriod.filterEndDate}' `;
            }
        }

        if(getSurveyResponseBody.filterProject.apply){
            let projectIdStr = '';
            if(getSurveyResponseBody.filterProject.projectId.length){
                projectIdStr = '(' + getSurveyResponseBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }
            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getSurveyResponseBody.filterCollector.apply){
            let collectorIdStr = '';
            if(getSurveyResponseBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + getSurveyResponseBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }
            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(getSurveyResponseBody.filterRespondentMetadata.apply){
            if(getSurveyResponseBody.filterRespondentMetadata.filterCustomerId){
                sqlFilter += ` AND r.customer_id LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterLineId){
                sqlFilter += ` AND r.line_id LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlFilter += ` AND r.id_card_4_digit LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterRoomNumber){
                sqlFilter += ` AND r.room_number LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterInstitutionName){
                sqlFilter += ` AND r.institution_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterProjectName){
                sqlFilter += ` AND r.project_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterMobileNumber){
                sqlFilter += ` AND r.mobile_number LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterFirstName){
                sqlFilter += ` AND r.first_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterLastName){
                sqlFilter += ` AND r.last_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterEmail){
                sqlFilter += ` AND r.email_address LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterCustomGroup){
                sqlFilter += ` AND r.custom_group LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterIPAddress){
                sqlFilter += ` AND r.ip_address LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
        }

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getSurveyResponses', 'createRequest'); return res.json({ status: false, message: 'Error Get Survey Responses' }); }

        const sqlStr = `SELECT r.*, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') AS created_date, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') AS modified_date,
                        ( SELECT COUNT(*) FROM responses as r WHERE r.active = 1 AND r.complete_status = 3 ${sqlFilter} AND r.survey_id = ${id} ) AS total_respondents 
                        FROM responses AS r 
                        WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${id} 
                        ${sqlFilter}
                        ORDER BY r.id ASC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurveyResponses', query.errorMessage); return res.json({ status: false, message: 'Error Get Survey Responses', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveyResponses', error);
        return res.json(error);
    }
};

export async function deleteSurveyResponses(req: Request, res: Response) {
    
    try{
        const id = req.params.responseId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'deleteSurveyResponses', 'createRequest'); return res.json({ status: false, message: 'Error Delete Survey Responses' }); }

        const sqlStr = `UPDATE responses 
                        SET active = 0, deleted_at = GETDATE() 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'deleteSurveyResponses', query.errorMessage); return res.json({ status: false, message: 'Error Delete Survey Responses', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Response deleted' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteSurveyResponses', error);
        return res.json({ status: false, message: 'Error delete', exception: error });
    }
}

export async function updateSurveyResponses(req: Request, res: Response) {
    
    try {
        const id = req.params.responseId;
        const updateResponse = req.body;
    
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateSurveyResponses', 'createRequest'); return res.json({ status: false, message: 'Error Update Survey Responses' }); }
        let columnsValues = '';
        for (const key in updateResponse) {
            request.input(key, sql.VarChar, updateResponse[key]);
            columnsValues += key + ' = @' + key + ', ';
        }

        const sqlStr = `UPDATE responses 
                        SET ${columnsValues} 
                        modified_at = GETDATE()
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateSurveyResponses', query.errorMessage); return res.json({ status: false, message: 'Error Update Survey Responses', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Response Updated' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateSurveyResponses', error);
        return res.json({ status: false, message: 'Error Update', exception: error });
    }
};

export async function getResponse(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const respondentId = req.params.respondentId;

        const siteAlias = req.headers['x-site'];
        const getSurveyResponseBody = req.body;

        let sqlFilter = '';
        if(getSurveyResponseBody.filterTimePeriod.apply){
            if(getSurveyResponseBody.filterTimePeriod.filterStartDate && getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at BETWEEN '${getSurveyResponseBody.filterTimePeriod.filterStartDate}' AND '${getSurveyResponseBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(getSurveyResponseBody.filterTimePeriod.filterStartDate && !getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at >= '${getSurveyResponseBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!getSurveyResponseBody.filterTimePeriod.filterStartDate && getSurveyResponseBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND r.created_at <= '${getSurveyResponseBody.filterTimePeriod.filterEndDate}' `;
            }
        }
    
        if(getSurveyResponseBody.filterProject.apply){
            let projectIdStr = '';
            if(getSurveyResponseBody.filterProject.projectId.length){
                projectIdStr = '(' + getSurveyResponseBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }
            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getSurveyResponseBody.filterCollector.apply){
            let collectorIdStr = '';
            if(getSurveyResponseBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + getSurveyResponseBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }
            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(getSurveyResponseBody.filterRespondentMetadata.apply){
            if(getSurveyResponseBody.filterRespondentMetadata.filterFirstName){
                sqlFilter += ` AND r.first_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterLastName){
                sqlFilter += ` AND r.last_name LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterEmail){
                sqlFilter += ` AND r.email_address LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterCustomGroup){
                sqlFilter += ` AND r.custom_group LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(getSurveyResponseBody.filterRespondentMetadata.filterIPAddress){
                sqlFilter += ` AND r.ip_address LIKE '%${getSurveyResponseBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
        }

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getResponse', 'createRequest'); return res.json({ status: false, message: 'Error Get A Response' }); }

        const sqlStr = `SELECT r.*, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') AS created_date, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') AS modified_date
                        FROM responses AS r
                        WHERE r.active = 1 AND r.survey_id = ${surveyId} AND r.id = ${respondentId} 
                        ${sqlFilter}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getResponse', query.errorMessage); return res.json({ status: false, message: 'Error Get A Response', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSearch', error);
        return res.json(error);
    }
};