import { Request, Response } from "express";
import { createTransaction, createRequest, requestQuery, createSiteLog } from "../database";
import { Collector } from "../interface/Collector";
import * as sql from 'mssql';
import jwt from 'jsonwebtoken';
import * as dotenv from "dotenv";
import { SurveyResponse } from "../interface/Response";
dotenv.config();

export async function getCollectors(req: Request, res: Response) {
   
    try {
        const id = req.params.surveyId ? req.params.surveyId : '';
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getCollectors', 'createRequest'); return res.json({ status: false, message: 'Error Get Collectors' }); }

        const sqlWhere = req.params.surveyId ? `WHERE c.active = 1 and c.survey_id = ${id}` : `WHERE c.active = 1`;

        const sqlStr = `SELECT c.*, FORMAT( c.created_at, 'dd/MM/yyyy') as created_date, FORMAT( c.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') as modified_date 
                        FROM collectors as c 
                        ${sqlWhere}
                        ORDER BY c.modified_at DESC`;
        
        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getCollectors', query.errorMessage); return res.json({ status: false, message: 'Error Get Collectors', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getCollectors', error);
        return res.json(error);
    }
};

export async function createCollector(req: Request, res: Response){
    
    try {
        const newCollector: Collector = req.body;
        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'createCollector', 'createTransaction'); return res.json({ status: false, message: 'Error Create Collector' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'createCollector', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Collector' }); }); return; }

                await request
                .input('name', sql.NVarChar, newCollector.name)
                .input('nickname', sql.NVarChar, newCollector.nickname)
                .input('survey_id', sql.SmallInt, newCollector.survey_id)
                .input('project_id', sql.SmallInt, newCollector.project_id)
                .input('type', sql.SmallInt, newCollector.type)
                .query(`
                    INSERT INTO collectors (name, nickname, survey_id, project_id, type) 
                    OUTPUT INSERTED.id
                    VALUES (@name, @nickname, @survey_id, @project_id, @type)`,
                    async (err: any, result: any) => {
                        if(!err){
                            const resultData = result?.recordset[0] as any;
                            const collectorInsertedId = resultData.id;

                            const userData = {
                                survey_id: newCollector.survey_id,
                                collector_id: collectorInsertedId,
                            }

                            const privateKey = process.env.JWT_SECRET as string;
                            const jwtToken = jwt.sign(userData, privateKey);

                            let buff = Buffer.from(jwtToken)
                            let base64data = buff.toString('base64');

                            const urlToken = `${process.env.DOMAIN_NAME_FRONTEND}/client/${req.headers['x-site']}/sv?tk=${base64data}`;
                            
                            let columnsValues = '';
                            request.input(`link`, sql.VarChar , urlToken);
                            columnsValues += `link = @link, `;

                            const sqlStr = `UPDATE collectors
                                            SET ` + columnsValues +
                                            `modified_at = GETDATE() ` +
                                            `WHERE id = ` + collectorInsertedId;

                            await request.query(sqlStr,
                                async (err: any, result: any) => {
                                    if(!err){
                                        transaction.commit(function(err: any) {
                                            // ... error checks
                                            if(!err){ return res.json({ status: true, result: result, message: 'Collector Created' }); }
                                            else{ transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Collector Commit', exception: err }); }); }
                                        });
                                    }
                                    else{
                                        createSiteLog(siteAlias, 'createCollector', err);
                                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Collector', exception: err }); });
                                    }
                            });
                        }
                        else{
                            createSiteLog(siteAlias, 'createCollector', err);
                            transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Collector', exception: err.message }); }); 
                        }
                    }
                );
            }
            catch(error){
                createSiteLog(siteAlias, 'createCollector', error);
                return res.json({ status: false, message: 'Error Create Collector', exception: error });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createCollector', error);
        return res.json({ status: false, message: 'Error Create Collector', exception: error });
    }
}

export async function getCollector(req: Request, res: Response) {
    
    try{
        const id = req.params.collectorId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getCollector', 'createRequest'); return res.json({ status: false, message: 'Error Get A Collector' }); }

        const sqlStr = `SELECT c.*, FORMAT( c.created_at, 'dd/MM/yyyy') as created_date, FORMAT( c.modified_at, 'dd/MM/yyyy') as modified_date, DATEADD(hh, 7, c.send_date) as send_datetime, DATEADD(hh, 7, c.cutoff_date) as cutoff_datetime, cs.name AS status_name 
                        FROM collectors as c 
                        LEFT JOIN collector_status as cs ON c.status = cs.id 
                        WHERE c.active = 1 and c.id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getCollector', query.errorMessage); return res.json({ status: false, message: 'Error Get A Collector', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getCollector', error);
        return res.json(error);
    }
};

export async function getTypeName(req: Request, res: Response) {
    
    try{
        const id = req.params.typeId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getTypeName', 'createRequest'); return res.json({ status: false, message: 'Error Get Type Name' }); }

        const sqlStr = `SELECT name 
                        FROM collector_type 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getTypeName', query.errorMessage); return res.json({ status: false, message: 'Error Get Type Name', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getTypeName', error);
        return res.json(error);
    }
};

export async function getStatusName(req: Request, res: Response) {
    
    try{
        const id = req.params.statusId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getStatusName', 'createRequest'); return res.json({ status: false, message: 'Error Get A Status Name' }); }

        const sqlStr = `SELECT name 
                        FROM collector_status 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getStatusName', query.errorMessage); return res.json({ status: false, message: 'Error Get A Status Name', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getStatusName', error);
        return res.json(error);
    }
};

export async function deleteCollector(req: Request, res: Response) {
    
    try {
        const id = req.params.collectorId;
        const updateCollector = req.body;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'deleteCollector', 'createTransaction'); return res.json({ status: false, message: 'Error delete collector' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'deleteCollector', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector' }); }); return; }
                
                //collectors
                let sqlStr = `UPDATE collectors SET active = 0, status = 0, deleted_at = GETDATE() WHERE id = ${id}`;
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE collectors', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                //responses
                sqlStr = `UPDATE responses SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE responses', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                //answers
                sqlStr = `UPDATE answers SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answers', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                //answer_rating
                sqlStr = `UPDATE answer_rating SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_rating', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                //answer_choice
                sqlStr = `UPDATE answer_choice SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_choice', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }
                
                //answer_checkbox
                sqlStr = `UPDATE answer_checkbox SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_checkbox', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }
                
                //answer_score
                sqlStr = `UPDATE answer_score SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_score', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }
                
                //answer_text
                sqlStr = `UPDATE answer_text SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_text', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }
                
                //answer_dropdown
                sqlStr = `UPDATE answer_dropdown SET active = 0, deleted_at = GETDATE() WHERE collector_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector UPDATE answer_dropdown', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                //total responses and time spent from every collectors
                sqlStr = `SELECT COUNT(*) AS total_responses, 
                          ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${updateCollector.survey_id} ) AS total_completed_response, 
                          ( SELECT AVG(time_spent) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id =  ${updateCollector.survey_id} AND r.time_spent < (SELECT num_question * 2 * 60 FROM surveys AS s WHERE s.active = 1 AND s.id =  ${updateCollector.survey_id}) ) AS avg_time_spent, 
                          ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 1 AND c.survey_id = ${updateCollector.survey_id} ) AS not_configured_collector_num, 
                          ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 2 AND c.survey_id = ${updateCollector.survey_id} ) AS opening_collector_num, 
                          ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 3 AND c.survey_id = ${updateCollector.survey_id} ) AS closed_collector_num 
                          FROM responses AS r 
                          WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${updateCollector.survey_id}`;
                
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteCollector SELECT for calulation', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                const queryResultRecordset = query.result.recordset[0];
                if(queryResultRecordset){
                        
                    let surveyStatus = 1;//Draft

                    const not_configured_collector_num = queryResultRecordset.not_configured_collector_num;
                    const opening_collector_num = queryResultRecordset.opening_collector_num;
                    const closed_collector_num = queryResultRecordset.closed_collector_num;

                    if(opening_collector_num > 0) surveyStatus = 2; //Open
                    else if(not_configured_collector_num > 0) surveyStatus = 1; //Draft
                    else if(closed_collector_num  > 0) surveyStatus = 3; //Closed

                    const totalResponses = queryResultRecordset.total_responses;
                    const totalCompletedResponse = queryResultRecordset.total_completed_response;
                    const avgTimeSpent = queryResultRecordset.avg_time_spent;

                    const completePercent = (totalCompletedResponse / totalResponses) * 100;
                    
                    const updateSurvey: SurveyResponse = {
                        total_responses: totalCompletedResponse,
                        completion_rate: completePercent,
                        time_spent: avgTimeSpent,
                        status: surveyStatus
                    }

                    let columnsValues = '';
                    for (const key in updateSurvey) {
                        if(['completion_rate', 'status'].includes(key)){
                            request.input(`${key}_s4`, sql.SmallInt, updateSurvey[key]);
                            columnsValues += `${key} = @${key}_s4, `;
                        }
                        else if(['total_responses', 'time_spent'].includes(key)){
                            request.input(`${key}_s4`, sql.Int, updateSurvey[key]);
                            columnsValues += `${key} = @${key}_s4, `;
                        }
                    }

                    sqlStr = `UPDATE surveys 
                              SET ${columnsValues} modified_at = GETDATE() 
                              WHERE id = ${updateCollector.survey_id}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, `deleteCollector with survey statistic updates`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: query.errorMessage }); }); return; }

                    //All updates Done!
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `deleteCollector transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Collector Deleted' });
                    });
                }
                else{
                    //All updates Done! (without survey statistic updates)
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `deleteCollector transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Collector Deleted' });
                    });
                }
            } catch(error){ 
                createSiteLog(siteAlias, 'deleteCollector', error); 
                transaction.rollback(function() { return res.json({ status: false, message: 'Error delete collector', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteCollector', error);
        return res.json({ status: false, message: 'Error delete collector', exception: error });
    }
}

export async function updateCollector(req: Request, res: Response) {
    
    try {
        const id = req.params.collectorId;
        const updateCollector = req.body;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'updateCollector', 'createTransaction'); return res.json({ status: false, message: 'Error Update Collector' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'updateCollector', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector' }); }); return; }
                
                let columnsValues = '';
                for (const key in updateCollector) {
                    if(['status', 'send', 'cutoff', 'collect_option', 'no_send_option', 'no_send_in_day', 'project_id'].includes(key)){
                        request.input(`${key}`, sql.SmallInt, updateCollector[key]);
                        columnsValues += `${key} = @${key}, `;
                    }
                    else if(['name','nickname', 'subject', 'message', 'send_date', 'cutoff_date', 'color_theme', 'option_send_hour', 'option_send_time', 'employee_id'].includes(key)){
                        request.input(key, sql.NVarChar, updateCollector[key]);
                        columnsValues += `${key} = @${key}, `;
                    }
                }
                //collectors
                let sqlStr = `UPDATE collectors SET ${columnsValues} modified_at = GETDATE(), deleted_at = '' WHERE id = ${id}`;
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE collectors', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                if(parseInt(updateCollector.status) === 1 || parseInt(updateCollector.status) === 2){
                    //1 = not configured = not active
                    //2 = open = active
                    //3 = close
                    const activeStatus = [2,3].includes(parseInt(updateCollector.status)) ? 1 : 0;

                    //responses
                    sqlStr = `UPDATE responses SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE responses', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    //answers
                    sqlStr = `UPDATE answers SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answers', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    //answer_rating
                    sqlStr = `UPDATE answer_rating SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_rating', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    //answer_choice
                    sqlStr = `UPDATE answer_choice SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_choice', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }
                    
                    //answer_checkbox
                    sqlStr = `UPDATE answer_checkbox SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_checkbox', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }
                    
                    //answer_score
                    sqlStr = `UPDATE answer_score SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_score', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }
                    
                    //answer_text
                    sqlStr = `UPDATE answer_text SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_text', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }
                    
                    //answer_dropdown
                    sqlStr = `UPDATE answer_dropdown SET active = ${activeStatus}, deleted_at = NULL WHERE collector_id = ${id}`;
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector UPDATE answer_dropdown', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    //total responses and time spent from every collectors
                    sqlStr = `SELECT COUNT(*) AS total_responses, 
                              ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${updateCollector.survey_id} ) AS total_completed_response, 
                              ( SELECT AVG(time_spent) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id =  ${updateCollector.survey_id} AND r.time_spent < (SELECT num_question * 2 * 60 FROM surveys AS s WHERE s.active = 1 AND s.id =  ${updateCollector.survey_id}) ) AS avg_time_spent, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 1 AND c.survey_id = ${updateCollector.survey_id} ) AS not_configured_collector_num, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 2 AND c.survey_id = ${updateCollector.survey_id} ) AS opening_collector_num, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 3 AND c.survey_id = ${updateCollector.survey_id} ) AS closed_collector_num 
                              FROM responses AS r 
                              WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${updateCollector.survey_id}`;
                    
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector SELECT for calulation', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    const queryResultRecordset = query.result.recordset[0];
                    if(queryResultRecordset){
                            
                        let surveyStatus = 1;//Draft

                        const not_configured_collector_num = queryResultRecordset.not_configured_collector_num;
                        const opening_collector_num = queryResultRecordset.opening_collector_num;
                        const closed_collector_num = queryResultRecordset.closed_collector_num;

                        
                        if(opening_collector_num > 0) surveyStatus = 2; //Open
                        else if(not_configured_collector_num > 0) surveyStatus = 1; //Draft
                        else if(closed_collector_num  > 0) surveyStatus = 3; //Closed


                        const totalResponses = queryResultRecordset.total_responses;
                        const totalCompletedResponse = queryResultRecordset.total_completed_response;
                        const avgTimeSpent = queryResultRecordset.avg_time_spent;

                        const completePercent = (totalCompletedResponse / totalResponses) * 100;
                        
                        const updateSurvey: SurveyResponse = {
                            total_responses: totalCompletedResponse,
                            completion_rate: completePercent,
                            time_spent: avgTimeSpent,
                            status: surveyStatus
                        }

                        let columnsValues = '';
                        for (const key in updateSurvey) {
                            if(['completion_rate', 'status'].includes(key)){
                                request.input(`${key}_s4`, sql.SmallInt, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                            else if(['total_responses', 'time_spent'].includes(key)){
                                request.input(`${key}_s4`, sql.Int, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                        }

                        sqlStr = `UPDATE surveys 
                                  SET ${columnsValues} modified_at = GETDATE() 
                                  WHERE id = ${updateCollector.survey_id}`;

                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, `updateCollector with survey statistic updates`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                        //All updates Done!
                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, `updateCollector transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector commit', exception: err }); }); return; }
                            return res.json({ status: true, result: query.result, message: 'Collector Deleted' });
                        });
                    }
                    else{
                        //All updates Done! (without survey statistic updates)
                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, `updateCollector transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector commit', exception: err }); }); return; }
                            return res.json({ status: true, result: query.result, message: 'Collector Deleted' });
                        });
                    }
                }
                else if(parseInt(updateCollector.status) === 3){//update close status
                    //total responses and time spent from every collectors
                    sqlStr = `SELECT COUNT(*) AS total_responses, 
                              ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${updateCollector.survey_id} ) AS total_completed_response, 
                              ( SELECT AVG(time_spent) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id =  ${updateCollector.survey_id} AND r.time_spent < (SELECT num_question * 2 * 60 FROM surveys AS s WHERE s.active = 1 AND s.id =  ${updateCollector.survey_id}) ) AS avg_time_spent, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 1 AND c.survey_id = ${updateCollector.survey_id} ) AS not_configured_collector_num, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 2 AND c.survey_id = ${updateCollector.survey_id} ) AS opening_collector_num, 
                              ( SELECT COUNT(*) FROM collectors AS c WHERE c.active = 1 AND c.status = 3 AND c.survey_id = ${updateCollector.survey_id} ) AS closed_collector_num 
                              FROM responses AS r 
                              WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${updateCollector.survey_id}`;
                    
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateCollector (updateCollector.status) === 3 SELECT for calulation', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                    const queryResultRecordset = query.result.recordset[0];
                    if(queryResultRecordset){
                            
                        let surveyStatus = 1;//Draft

                        const not_configured_collector_num = queryResultRecordset.not_configured_collector_num;
                        const opening_collector_num = queryResultRecordset.opening_collector_num;
                        const closed_collector_num = queryResultRecordset.closed_collector_num;

                        
                        if(opening_collector_num > 0) surveyStatus = 2; //Open
                        else if(not_configured_collector_num > 0) surveyStatus = 1; //Draft
                        else if(closed_collector_num  > 0) surveyStatus = 3; //Closed


                        const totalResponses = queryResultRecordset.total_responses;
                        const totalCompletedResponse = queryResultRecordset.total_completed_response;
                        const avgTimeSpent = queryResultRecordset.avg_time_spent;

                        const completePercent = (totalCompletedResponse / totalResponses) * 100;
                        
                        const updateSurvey: SurveyResponse = {
                            total_responses: totalCompletedResponse,
                            completion_rate: completePercent,
                            time_spent: avgTimeSpent,
                            status: surveyStatus
                        }

                        let columnsValues = '';
                        for (const key in updateSurvey) {
                            if(['completion_rate', 'status'].includes(key)){
                                request.input(`${key}_s4`, sql.SmallInt, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                            else if(['total_responses', 'time_spent'].includes(key)){
                                request.input(`${key}_s4`, sql.Int, updateSurvey[key]);
                                columnsValues += `${key} = @${key}_s4, `;
                            }
                        }

                        sqlStr = `UPDATE surveys 
                                  SET ${columnsValues} modified_at = GETDATE() 
                                  WHERE id = ${updateCollector.survey_id}`;

                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, `updateCollector (updateCollector.status) === 3 with survey statistic updates`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: query.errorMessage }); }); return; }

                        //All updates Done!
                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, `updateCollector (updateCollector.status) === 3 transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector commit', exception: err }); }); return; }
                            return res.json({ status: true, result: query.result, message: 'Collector Updated' });
                        });
                    }
                    else{
                        //All updates Done! (without survey statistic updates)
                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, `updateCollector without survey statistic updates transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector commit', exception: err }); }); return; }
                            return res.json({ status: true, result: query.result, message: 'Collector Updated' });
                        });
                    }
                }
                else{
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `updateCollector else transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error update collector commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Collector Updated' });
                    });
                }
            } catch(error){ 
                createSiteLog(siteAlias, 'updateCollector', error); 
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Collector', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateCollector', error);
        return res.json({ status: false, message: 'Error Update Collector', exception: error });
    }
};