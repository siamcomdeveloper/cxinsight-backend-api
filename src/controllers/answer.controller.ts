import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";
import { Answer } from "../interface/Answer";
import * as sql from 'mssql';
import GoogleAPIService from "../services/google.api.service";

export async function getAnswers(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswers', 'createRequest'); return res.json({ status: false, message: 'Error Get Answers' }); }

        const sqlStr = `SELECT a.* ;
                        FROM answers as a 
                        WHERE a.active = 1 
                        ORDER BY a.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswers', query.errorMessage); return res.json({ status: false, message: 'Error Get Answers', exception: query.errorMessage }); }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveys', error);
        return res.json(error);
    }
};

export async function createAnswer(req: Request, res: Response){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create The Answer' }); }

        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('question_type_id', sql.NVarChar, newAnswer.question_type_id);
        request.input('alert_status', sql.SmallInt, newAnswer.alert_status);
        request.input('skip_status', sql.SmallInt, newAnswer.skip_status);

        const sqlStr = `INSERT INTO answers (survey_id, project_id, collector_id, response_id, question_id, question_type_id, alert_status, skip_status) 
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @question_type_id, @alert_status, @skip_status)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswers', query.errorMessage); return res.json({ status: false, message: 'Error Get Answers', exception: query.errorMessage }); }

        let queryResultRecordset = query.result.recordset[0];
        let questionsInsertedId = queryResultRecordset.id;

        if(parseInt(newAnswer.skip_status) === 0){
            switch (parseInt(newAnswer.question_type_id)) {
                case 1: //rating
                    createRatingAnswer(req, res, questionsInsertedId);
                    break;
                case 2: //multiple choice
                    createChoiceAnswer(req, res, questionsInsertedId);
                    break;
                case 3: //checkbox
                    createCheckboxAnswer(req, res, questionsInsertedId);
                    break;
                case 4: //net promoter score
                    createScoreAnswer(req, res, questionsInsertedId);
                    break;
                case 5: //text
                    createTextAnswer(req, res, questionsInsertedId);
                    break;
                case 6: //dropdown
                    createDropdownAnswer(req, res, questionsInsertedId);
                    break;
                default:
                    return res.json({ status: true, result: query.result, message: 'Answer Other Type Skip Create' });
            }
        }
        else{
            return res.json({ status: true, result: query.result, message: 'Answer Skip Create' });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createAnswer', error);
        return res.json({ status: false, message: 'Error Create', exception: error });
    }
}

export async function getAnswer(req: Request, res: Response) {

    try{
        const id = req.params.surveyId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Get An Answer' }); }

        const sqlStr = `SELECT a.* 
                        FROM answers as a 
                        WHERE a.active = 1 and a.survey_id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Get An Answer', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveys', error);
        return res.json(error);
    }
};

export async function deleteAnswer(req: Request, res: Response) {

    try{
        const id = req.params.responseId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'deleteAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Delete The Answer' }); }

        const sqlStr = `UPDATE answers 
                        SET active = 0, deleted_at = GETDATE() 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'deleteAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Delete The Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer deleted' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteAnswer', error);
        return res.json({ status: false, message: 'Error delete', exception: error });
    }
}

export async function updateAnswer(req: Request, res: Response) {
    
    try {
        const id = req.params.responseId;
        const updateAnswer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getSurveys', 'createRequest'); return res.json({ status: false, message: 'Error Update The Answer' }); }

        let columnsValues = '';
        for (const key in updateAnswer) {
            request.input(key, sql.NVarChar, updateAnswer[key]);
            columnsValues += key + ' = @' + key + ', ';
        }
        
        const sqlStr = `UPDATE answers 
                        SET ${columnsValues}
                        modified_at = GETDATE()
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Update The Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Updated' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateAnswer', error);
        return res.json({ status: false, message: 'Error Update', exception: error });
    }
};

export async function getRespondentAnswer(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const respondentId = req.params.respondentId;

        const getRespondentAnswerBody = req.body;
        let sqlFilter = '';

        if(getRespondentAnswerBody.filterTimePeriod){
            if(getRespondentAnswerBody.filterTimePeriod.filterStartDate && getRespondentAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at BETWEEN '${getRespondentAnswerBody.filterTimePeriod.filterStartDate}' AND '${getRespondentAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(getRespondentAnswerBody.filterTimePeriod.filterStartDate && !getRespondentAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at >= '${getRespondentAnswerBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!getRespondentAnswerBody.filterTimePeriod.filterStartDate && getRespondentAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at <= '${getRespondentAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
        }

        if(getRespondentAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(getRespondentAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + getRespondentAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getRespondentAnswerBody.filterCollector.apply){
            let collectorIdStr = '';

            if(getRespondentAnswerBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + getRespondentAnswerBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(getRespondentAnswerBody.filterRespondentMetadata.apply){
            if(getRespondentAnswerBody.filterRespondentMetadata.filterCustomerId){
                sqlFilter += ` AND r.customer_id LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterLineId){
                sqlFilter += ` AND r.line_id LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlFilter += ` AND r.id_card_4_digit LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterRoomNumber){
                sqlFilter += ` AND r.room_number LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterInstitutionName){
                sqlFilter += ` AND r.institution_name LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterProjectName){
                sqlFilter += ` AND r.project_name LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterMobileNumber){
                sqlFilter += ` AND r.mobile_number LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterFirstName){
                sqlFilter += ` AND r.first_name LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterLastName){
                sqlFilter += ` AND r.last_name LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterEmail){
                sqlFilter += ` AND r.email_address LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterCustomGroup){
                sqlFilter += ` AND r.custom_group LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(getRespondentAnswerBody.filterRespondentMetadata.filterIPAddress){
                sqlFilter += ` AND r.ip_address LIKE '%${getRespondentAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
        }

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getRespondentAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Get The Respondent Answer' }); }

        const sqlStr = `SELECT a.survey_id, a.response_id, a.question_id, a.answer, a.additional, a.skip_status, a.alert_status, r.time_spent, r.complete_status, r.active 
                        FROM answers AS a 
                        LEFT JOIN responses AS r ON a.response_id = r.id 
                        WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.response_id = ${respondentId} ${sqlFilter}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getRespondentAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Get The Respondent Answer', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getRespondentAnswer', error);
        return res.json(error);
    }
};

export async function getAnswerByQuestion(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const respondentId = req.params.respondentId;
        const resspondentSearch = req.params.respondentId ? " and a.response_id = " + respondentId : "";
        
        const getAnswerBody = req.body;
        let sqlFilter = '';

        if(getAnswerBody.filterTimePeriod){
            if(getAnswerBody.filterTimePeriod.filterStartDate && getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at BETWEEN '${getAnswerBody.filterTimePeriod.filterStartDate}' AND '${getAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(getAnswerBody.filterTimePeriod.filterStartDate && !getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at >= '${getAnswerBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!getAnswerBody.filterTimePeriod.filterStartDate && getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at <= '${getAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
        }

        if(getAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(getAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + getAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getAnswerBody.filterCollector.apply){
            let collectorIdStr = '';

            if(getAnswerBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + getAnswerBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(getAnswerBody.filterRespondentMetadata.apply){
            if(getAnswerBody.filterRespondentMetadata.filterCustomerId){
                sqlFilter += ` AND r.customer_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterLineId){
                sqlFilter += ` AND r.line_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlFilter += ` AND r.id_card_4_digit LIKE '%${getAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterRoomNumber){
                sqlFilter += ` AND r.room_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterInstitutionName){
                sqlFilter += ` AND r.institution_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterProjectName){
                sqlFilter += ` AND r.project_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterMobileNumber){
                sqlFilter += ` AND r.mobile_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterFirstName){
                sqlFilter += ` AND r.first_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterLastName){
                sqlFilter += ` AND r.last_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterEmail){
                sqlFilter += ` AND r.email_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterCustomGroup){
                sqlFilter += ` AND r.custom_group LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterIPAddress){
                sqlFilter += ` AND r.ip_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
        }
        
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswerByQuestion', 'createRequest'); return res.json({ status: false, message: 'Error Get Answers By Question' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        const sqlStr = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date
                        FROM answers AS a 
                        LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                        LEFT JOIN responses AS r ON a.response_id = r.id 
                        WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                        ${sqlFilter}
                        ${resspondentSearch}
                        ORDER BY a.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswerByQuestion', query.errorMessage); return res.json({ status: false, message: 'Error Get Answers By Question', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getAnswerByQuestion', error);
        return res.json(error);
    }
};

export async function getAnswerByQuestionAndRangePicker(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        const getAnswerBody = req.body;
        let sqlDailyFilter = '', sqlMonthlyFilter = '';

        if(getAnswerBody.dailyRangePicker){
            if(getAnswerBody.dailyRangePicker.dailyStartDate && getAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at BETWEEN '${getAnswerBody.dailyRangePicker.dailyStartDate}' AND '${getAnswerBody.dailyRangePicker.dailyEndDate}' `;
            }
            else if(getAnswerBody.dailyRangePicker.dailyStartDate && !getAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at >= '${getAnswerBody.dailyRangePicker.dailyStartDate}' `;
            }
            else if(!getAnswerBody.dailyRangePicker.dailyStartDate && getAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at <= '${getAnswerBody.dailyRangePicker.dailyEndDate}' `;
            }
        }
        
        if(getAnswerBody.monthlyRangePicker){
            if(getAnswerBody.monthlyRangePicker.monthlyStartDate && getAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at BETWEEN '${getAnswerBody.monthlyRangePicker.monthlyStartDate}' AND '${getAnswerBody.monthlyRangePicker.monthlyEndDate}' `;
            }
            else if(getAnswerBody.monthlyRangePicker.monthlyStartDate && !getAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at >= '${getAnswerBody.monthlyRangePicker.monthlyStartDate}' `;
            }
            else if(!getAnswerBody.monthlyRangePicker.monthlyStartDate && getAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at <= '${getAnswerBody.monthlyRangePicker.monthlyEndDate}' `;
            }
        }

        if(getAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(getAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + getAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlDailyFilter += ` AND r.project_id IN ${projectIdStr} `;
            sqlMonthlyFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getAnswerBody.filterCollector.apply){
            let collectorIdStr = '';

            if(getAnswerBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + getAnswerBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlDailyFilter += ` AND r.collector_id IN ${collectorIdStr} `;
            sqlMonthlyFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(getAnswerBody.filterRespondentMetadata.apply){
            if(getAnswerBody.filterRespondentMetadata.filterFirstName){
                sqlDailyFilter += ` AND r.first_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
                sqlMonthlyFilter += ` AND r.first_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterLastName){
                sqlDailyFilter += ` AND r.last_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterLastName}%' `;
                sqlMonthlyFilter += ` AND r.last_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterEmail){
                sqlDailyFilter += ` AND r.email_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterEmail}%' `;
                sqlMonthlyFilter += ` AND r.email_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterCustomGroup){
                sqlDailyFilter += ` AND r.custom_group LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
                sqlMonthlyFilter += ` AND r.custom_group LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterIPAddress){
                sqlDailyFilter += ` AND r.ip_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
                sqlMonthlyFilter += ` AND r.ip_address LIKE '%${getAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterCustomerId){
                sqlDailyFilter += ` AND r.customer_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
                sqlMonthlyFilter += ` AND r.customer_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterLineId){
                sqlDailyFilter += ` AND r.line_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterLineId}%' `;
                sqlMonthlyFilter += ` AND r.line_id LIKE '%${getAnswerBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlDailyFilter += ` AND r.id_card_4_digit LIKE '%${getAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
                sqlMonthlyFilter += ` AND r.id_card_4_digit LIKE '%${getAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterRoomNumber){
                sqlDailyFilter += ` AND r.room_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
                sqlMonthlyFilter += ` AND r.room_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterInstitutionName){
                sqlDailyFilter += ` AND r.institution_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
                sqlMonthlyFilter += ` AND r.institution_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterProjectName){
                sqlDailyFilter += ` AND r.project_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
                sqlMonthlyFilter += ` AND r.project_name LIKE '%${getAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(getAnswerBody.filterRespondentMetadata.filterMobileNumber){
                sqlDailyFilter += ` AND r.mobile_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
                sqlMonthlyFilter += ` AND r.mobile_number LIKE '%${getAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
        }

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswerByQuestionAndRangePicker', 'createRequest'); return res.json({ status: false, message: 'Error Get Answer By Question And Range Picker' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        const sqlStr1 = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date
                         FROM answers AS a 
                         LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                         LEFT JOIN responses AS r ON a.response_id = r.id 
                         WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                         ${sqlDailyFilter}
                         ORDER BY a.created_at DESC 
                         `;

        const sqlStr2 = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date
                         FROM answers AS a 
                         LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                         LEFT JOIN responses AS r ON a.response_id = r.id 
                         WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                         ${sqlMonthlyFilter}
                         ORDER BY a.created_at DESC 
                         `;

        const sqlStr = sqlStr1 + sqlStr2;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswerByQuestionAndRangePicker', query.errorMessage); return res.json({ status: false, message: 'Error Get Answer By Question And Range Picker', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getAnswerByQuestionAndRangePicker', error);
        return res.json(error);
    }
};

export async function getAnswerByQuestionForReport(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        const getAnswerBody = req.body;
        let sqlFilter = '';

        if(getAnswerBody.filterTimePeriod){
            if(getAnswerBody.filterTimePeriod.filterStartDate && getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at BETWEEN '${getAnswerBody.filterTimePeriod.filterStartDate}' AND '${getAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(getAnswerBody.filterTimePeriod.filterStartDate && !getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at >= '${getAnswerBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!getAnswerBody.filterTimePeriod.filterStartDate && getAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at <= '${getAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
        }

        if(getAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(getAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + getAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(getAnswerBody.filterSurveyCollector.apply){
            let collectorIdStr = '';

            if(getAnswerBody.filterSurveyCollector.collectorId.length){
                collectorIdStr = '(' + getAnswerBody.filterSurveyCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswerByQuestionForReport', 'createRequest'); return res.json({ status: false, message: 'Error Get Answer By Question For Report' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        const sqlStr = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date
                        FROM answers AS a
                        LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id
                        LEFT JOIN responses AS r ON a.response_id = r.id
                        WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                        ${sqlFilter}
                        ORDER BY a.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswerByQuestionForReport', query.errorMessage); return res.json({ status: false, message: 'Error Get Answer By Question For Report', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getAnswerByQuestionForReport', error);
        return res.json(error);
    }
};

export async function getAnswerByQuestionForInstitutionReport(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        let sqlFilter = '';

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getAnswerByQuestionForInstitutionReport', 'createRequest'); return res.json({ status: false, message: 'Error Get Answer By Question For Report' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        const sqlStr = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date
                        FROM answers AS a
                        LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id
                        LEFT JOIN responses AS r ON a.response_id = r.id
                        WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                        ${sqlFilter}
                        ORDER BY a.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getAnswerByQuestionForInstitutionReport', query.errorMessage); return res.json({ status: false, message: 'Error Get Answer By Question For Report', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getAnswerByQuestionForInstitutionReport', error);
        return res.json(error);
    }
};

export async function exportAnswerByQuestion(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        const exportAnswerBody = req.body;
        let sqlFilter = '';

        if(exportAnswerBody.filterTimePeriod){
            if(exportAnswerBody.filterTimePeriod.filterStartDate && exportAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at BETWEEN '${exportAnswerBody.filterTimePeriod.filterStartDate}' AND '${exportAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
            else if(exportAnswerBody.filterTimePeriod.filterStartDate && !exportAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at >= '${exportAnswerBody.filterTimePeriod.filterStartDate}' `;
            }
            else if(!exportAnswerBody.filterTimePeriod.filterStartDate && exportAnswerBody.filterTimePeriod.filterEndDate){
                sqlFilter += ` AND a.created_at <= '${exportAnswerBody.filterTimePeriod.filterEndDate}' `;
            }
        }
        
        if(exportAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(exportAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + exportAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(exportAnswerBody.filterCollector.apply){
            let collectorIdStr = '';

            if(exportAnswerBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + exportAnswerBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(exportAnswerBody.filterRespondentMetadata.apply){
            if(exportAnswerBody.filterRespondentMetadata.filterCustomerId){
                sqlFilter += ` AND r.customer_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterLineId){
                sqlFilter += ` AND r.line_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlFilter += ` AND r.id_card_4_digit LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterRoomNumber){
                sqlFilter += ` AND r.room_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterInstitutionName){
                sqlFilter += ` AND r.institution_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterProjectName){
                sqlFilter += ` AND r.project_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterMobileNumber){
                sqlFilter += ` AND r.mobile_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterFirstName){
                sqlFilter += ` AND r.first_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterLastName){
                sqlFilter += ` AND r.last_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterEmail){
                sqlFilter += ` AND r.email_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterCustomGroup){
                sqlFilter += ` AND r.custom_group LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterIPAddress){
                sqlFilter += ` AND r.ip_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
        }

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'exportAnswerByQuestion', 'createRequest'); return res.json({ status: false, message: 'Error Export Answer By Question' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        // const sqlSelect = "SELECT a.*, ans.*, FORMAT( DATEADD(hh, 7, ans.created_at), 'dd/MM/yyyy HH:mm') AS created_date , r.complete_status, FORMAT( DATEADD(hh, 7, r.created_at), 'dddd, MMMM d, yyyy hh.mm tt') AS started, FORMAT( DATEADD(hh, 7, r.modified_at), 'dddd, MMMM d, yyyy hh.mm tt') AS last_modified, r.time_spent, r.ip_address, r.email_address, r.mobile_number, r.first_name, r.last_name, r.custom_group, c.name AS collector_name, c.type AS collector_type ";
        const sqlStr = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date , r.complete_status, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') AS started, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') AS last_modified, r.time_spent, r.ip_address, r.email_address, r.mobile_number, r.name_title, r.first_name, r.last_name, r.birthdate, r.line_id, r.id_card_4_digit, r.room_number, r.institution_name, r.project_name, r.customer_id, r.custom_group, c.name AS collector_name, c.type AS collector_type 
                        FROM answers AS a 
                        LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                        LEFT JOIN responses AS r ON r.id = a.response_id 
                        LEFT JOIN collectors AS c ON c.id = r.collector_id 
                        WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                        ${sqlFilter}
                        ORDER BY a.created_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'exportAnswerByQuestion', query.errorMessage); return res.json({ status: false, message: 'Error Export Answer By Question', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'exportAnswerByQuestion', error);
        return res.json(error);
    }
};

export async function exportAnswerByQuestionAndRangePicker(req: Request, res: Response) {

    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const exportAnswerBody = req.body;

        let sqlDailyFilter = '', sqlMonthlyFilter = '';

        if(exportAnswerBody.dailyRangePicker){
            if(exportAnswerBody.dailyRangePicker.dailyStartDate && exportAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at BETWEEN '${exportAnswerBody.dailyRangePicker.dailyStartDate}' AND '${exportAnswerBody.dailyRangePicker.dailyEndDate}' `;
            }
            else if(exportAnswerBody.dailyRangePicker.dailyStartDate && !exportAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at >= '${exportAnswerBody.dailyRangePicker.dailyStartDate}' `;
            }
            else if(!exportAnswerBody.dailyRangePicker.dailyStartDate && exportAnswerBody.dailyRangePicker.dailyEndDate){
                sqlDailyFilter += ` AND a.created_at <= '${exportAnswerBody.dailyRangePicker.dailyEndDate}' `;
            }
        }
        
        if(exportAnswerBody.monthlyRangePicker){
            if(exportAnswerBody.monthlyRangePicker.monthlyStartDate && exportAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at BETWEEN '${exportAnswerBody.monthlyRangePicker.monthlyStartDate}' AND '${exportAnswerBody.monthlyRangePicker.monthlyEndDate}' `;
            }
            else if(exportAnswerBody.monthlyRangePicker.monthlyStartDate && !exportAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at >= '${exportAnswerBody.monthlyRangePicker.monthlyStartDate}' `;
            }
            else if(!exportAnswerBody.monthlyRangePicker.monthlyStartDate && exportAnswerBody.monthlyRangePicker.monthlyEndDate){
                sqlMonthlyFilter += ` AND a.created_at <= '${exportAnswerBody.monthlyRangePicker.monthlyEndDate}' `;
            }
        }

        if(exportAnswerBody.filterProject.apply){
            let projectIdStr = '';

            if(exportAnswerBody.filterProject.projectId.length){
                projectIdStr = '(' + exportAnswerBody.filterProject.projectId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                projectIdStr = '(-1)';
            }

            sqlDailyFilter += ` AND r.project_id IN ${projectIdStr} `;
            sqlMonthlyFilter += ` AND r.project_id IN ${projectIdStr} `;
        }
        else if(exportAnswerBody.filterCollector.apply){
            let collectorIdStr = '';

            if(exportAnswerBody.filterCollector.collectorId.length){
                collectorIdStr = '(' + exportAnswerBody.filterCollector.collectorId.map((entity: any, i: any) => { return entity; }).join(',') + ')';
            }
            else{
                collectorIdStr = '(-1)';
            }

            sqlDailyFilter += ` AND r.collector_id IN ${collectorIdStr} `;
            sqlMonthlyFilter += ` AND r.collector_id IN ${collectorIdStr} `;
        }

        if(exportAnswerBody.filterRespondentMetadata.apply){
            if(exportAnswerBody.filterRespondentMetadata.filterFirstName){
                sqlDailyFilter += ` AND r.first_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
                sqlMonthlyFilter += ` AND r.first_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterFirstName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterLastName){
                sqlDailyFilter += ` AND r.last_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLastName}%' `;
                sqlMonthlyFilter += ` AND r.last_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLastName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterEmail){
                sqlDailyFilter += ` AND r.email_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterEmail}%' `;
                sqlMonthlyFilter += ` AND r.email_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterEmail}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterCustomGroup){
                sqlDailyFilter += ` AND r.custom_group LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
                sqlMonthlyFilter += ` AND r.custom_group LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomGroup}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterIPAddress){
                sqlDailyFilter += ` AND r.ip_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
                sqlMonthlyFilter += ` AND r.ip_address LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIPAddress}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterCustomerId){
                sqlDailyFilter += ` AND r.customer_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
                sqlMonthlyFilter += ` AND r.customer_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterCustomerId}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterLineId){
                sqlDailyFilter += ` AND r.line_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLineId}%' `;
                sqlMonthlyFilter += ` AND r.line_id LIKE '%${exportAnswerBody.filterRespondentMetadata.filterLineId}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterIdCard4Digit){
                sqlDailyFilter += ` AND r.id_card_4_digit LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
                sqlMonthlyFilter += ` AND r.id_card_4_digit LIKE '%${exportAnswerBody.filterRespondentMetadata.filterIdCard4Digit}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterRoomNumber){
                sqlDailyFilter += ` AND r.room_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
                sqlMonthlyFilter += ` AND r.room_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterRoomNumber}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterInstitutionName){
                sqlDailyFilter += ` AND r.institution_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
                sqlMonthlyFilter += ` AND r.institution_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterInstitutionName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterProjectName){
                sqlDailyFilter += ` AND r.project_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
                sqlMonthlyFilter += ` AND r.project_name LIKE '%${exportAnswerBody.filterRespondentMetadata.filterProjectName}%' `;
            }
            if(exportAnswerBody.filterRespondentMetadata.filterMobileNumber){
                sqlDailyFilter += ` AND r.mobile_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
                sqlMonthlyFilter += ` AND r.mobile_number LIKE '%${exportAnswerBody.filterRespondentMetadata.filterMobileNumber}%' `;
            }
        }

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'exportAnswerByQuestionAndRangePicker', 'createRequest'); return res.json({ status: false, message: 'Error Export Answer By Question And Range Picker' }); }

        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'answer_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'answer_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'answer_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'answer_score';
                break;
            case 5: //text
                questionTypeName = 'answer_text';
                break;
            case 6: //dropdown
                questionTypeName = 'answer_dropdown';
                break;
            default:
                break;
        }

        const sqlStr1 = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date , r.complete_status, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') AS started, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') AS last_modified, r.time_spent, r.ip_address, r.email_address, r.mobile_number, r.name_title, r.first_name, r.last_name, r.birthdate, r.line_id, r.id_card_4_digit, r.room_number, r.institution_name, r.project_name, r.customer_id, r.custom_group, c.name AS collector_name, c.type AS collector_type 
                         FROM answers AS a 
                         LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                         LEFT JOIN responses AS r ON r.id = a.response_id 
                         LEFT JOIN collectors AS c ON c.id = r.collector_id 
                         WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                         ${sqlDailyFilter}
                         ORDER BY a.created_at DESC
                         `;

        const sqlStr2 = `SELECT a.*, ans.*, FORMAT( ans.created_at, 'dd/MM/yyyy HH:mm') AS created_date , r.complete_status, FORMAT( r.created_at, 'dddd, MMMM d, yyyy hh.mm tt') AS started, FORMAT( r.modified_at, 'dddd, MMMM d, yyyy hh.mm tt') AS last_modified, r.time_spent, r.ip_address, r.email_address, r.mobile_number, r.name_title, r.first_name, r.last_name, r.birthdate, r.line_id, r.id_card_4_digit, r.room_number, r.institution_name, r.project_name, r.customer_id, r.custom_group, c.name AS collector_name, c.type AS collector_type 
                         FROM answers AS a 
                         LEFT JOIN ${questionTypeName} AS ans ON a.id = ans.answer_id 
                         LEFT JOIN responses AS r ON r.id = a.response_id 
                         LEFT JOIN collectors AS c ON c.id = r.collector_id 
                         WHERE a.active = 1 AND a.survey_id = ${surveyId} AND a.question_id = ${questionId} AND r.complete_status in (2,3)
                         ${sqlMonthlyFilter}
                         ORDER BY a.created_at DESC
                         `;

        const sqlStr = sqlStr1 + sqlStr2;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'exportAnswerByQuestionAndRangePicker', query.errorMessage); return res.json({ status: false, message: 'Error Export Answer By Question And Range Picker', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'exportAnswerByQuestionAndRangePicker', error);
        return res.json(error);
    }
};

async function createRatingAnswer(req: Request, res: Response, id: number){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createRatingAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Rating Answer' }); }

        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.SmallInt, newAnswer.answer);
        request.input('comment', sql.NVarChar, newAnswer.comment);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);
        
        const sqlStr = `INSERT INTO answer_rating (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, comment, analyze_entity, analyze_sentiment) 
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @comment, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createRatingAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Rating Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Rating Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createRatingAnswer', error);
        return res.json({ status: false, message: 'Error Answer Rating Create', exception: error });
    }
    
}

async function createChoiceAnswer(req: Request, res: Response, id: number){

    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createChoiceAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Choice Answer' }); }
        
        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.SmallInt, newAnswer.answer);
        request.input('comment', sql.NVarChar, newAnswer.comment);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);

        const sqlStr = `INSERT INTO answer_choice (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, comment, analyze_entity, analyze_sentiment) 
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @comment, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createChoiceAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Choice Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Chocie Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createChoiceAnswer', error);
        return res.json({ status: false, message: 'Error Answer Choice Create', exception: error });
    }
    
}

async function createCheckboxAnswer(req: Request, res: Response, id: number){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createCheckboxAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Checkbox Answer' }); }
        
        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.VarChar, newAnswer.answer);
        request.input('comment', sql.NVarChar, newAnswer.comment);
        request.input('signature_image', sql.NVarChar, newAnswer.signature_image);
        request.input('consent_image_path', sql.NVarChar, newAnswer.consent_image_path);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);

        const sqlStr = `INSERT INTO answer_checkbox (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, comment, signature_image, consent_image_path, analyze_entity, analyze_sentiment)  
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @comment, @signature_image, @consent_image_path, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createCheckboxAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Checkbox Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Checkbox Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createCheckboxAnswer', error);
        return res.json({ status: false, message: 'Error Answer Checkbox Create', exception: error });
    }
    
}

async function createScoreAnswer(req: Request, res: Response, id: number){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createScoreAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Score Answer' }); }
        
        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.SmallInt, newAnswer.answer);
        request.input('comment', sql.NVarChar, newAnswer.comment);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);

        const sqlStr = `INSERT INTO answer_score (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, comment, analyze_entity, analyze_sentiment) 
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @comment, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createScoreAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Score Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Score Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createScoreAnswer', error);
        return res.json({ status: false, message: 'Error Answer Score Create', exception: error });
    }
    
}

async function createTextAnswer(req: Request, res: Response, id: number){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createTextAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Text Answer' }); }
       
        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.NVarChar, newAnswer.answer);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);

        const sqlStr = `INSERT INTO answer_text (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, analyze_entity, analyze_sentiment) 
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createTextAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Text Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Text Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createTextAnswer', error);
        return res.json({ status: false, message: 'Error Answer Text Create', exception: error });
    }
    
}

async function createDropdownAnswer(req: Request, res: Response, id: number){
    
    try {
        const newAnswer: Answer = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'createDropdownAnswer', 'createRequest'); return res.json({ status: false, message: 'Error Create A Dropdown Answer' }); }

        request.input('survey_id', sql.SmallInt, newAnswer.survey_id);
        request.input('project_id', sql.SmallInt, newAnswer.project_id);
        request.input('collector_id', sql.SmallInt, newAnswer.collector_id);
        request.input('response_id', sql.SmallInt, newAnswer.response_id);
        request.input('question_id', sql.SmallInt, newAnswer.question_id);
        request.input('answer_id', sql.Int, id);
        request.input('answer', sql.SmallInt, newAnswer.answer);
        request.input('comment', sql.NVarChar, newAnswer.comment);
        request.input('analyze_entity', sql.NVarChar, newAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, newAnswer.analyze_sentiment);

        const sqlStr = `INSERT INTO answer_dropdown (survey_id, project_id, collector_id, response_id, question_id, answer_id, answer, comment, analyze_entity, analyze_sentiment)  
                        OUTPUT INSERTED.id
                        VALUES (@survey_id, @project_id, @collector_id, @response_id, @question_id, @answer_id, @answer, @comment, @analyze_entity, @analyze_sentiment)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createDropdownAnswer', query.errorMessage); return res.json({ status: false, message: 'Error Create A Dropdown Answer', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer Dropdown Created' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createDropdownAnswer', error);
        return res.json({ status: false, message: 'Error Answer Dropdown Create', exception: error });
    }
    
}

export async function updateAnswerWithGoogleApi(req: Request, res: Response) {
    
    try {
        const questionTypeId = parseInt(req.params.questionTypeId);
        const answerInsertedId = req.params.answerInsertedId;

        const updateAnswer = req.body;
        const siteAlias = req.headers['x-site'];
        
        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});
        
        let text = '';
        if(updateAnswer.question_type_id === 5){
            updateAnswer.answer = updateAnswer.answer.replace( /[\r\n]+/gm, ". " );
            text = updateAnswer.answer;
        }
        else{
            updateAnswer.comment = updateAnswer.comment.replace( /[\r\n]+/gm, ". " );
            text = updateAnswer.comment;
        }
        
        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi', 'createPortalRequest'); return res.json({ status: false, message: 'Error updateAnswerWithGoogleApi createPortalRequest', exception: siteAlias }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error updateAnswerWithGoogleApi createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        let googleApiKey = '';
        if(queryResultRecordsetPortal && queryResultRecordsetPortal.google_api_key){
            googleApiKey = queryResultRecordsetPortal.google_api_key;
        }
        else{
            createSiteLog(siteAlias, 'updateAnswerWithGoogleApi', 'No Google API key setup'); 
            return res.json({ status: false, message: 'Error Update Answer with google api', exception: 'No Google API key setup' });
        }

        //google api analyze entity process 
        // if( updateAnswer.question_analyze_entity === 1 && updateAnswer.question_analyze_sentiment === 0 ){
                
        //     let googleTranslationAPIObject = `{ 
        //         "q": "${text}",
        //         "source": "th",
        //         "target": "en"
        //     }`;

        //     let googleNaturalLanguageAPIObject = `{
        //         "document":{
        //             "type":"PLAIN_TEXT",
        //             "content":"${text}"
        //         },
        //         "encodingType": "UTF8"
        //     }`;

        //     //1. detect language
        //     const lang = await GoogleAPIService.getGoogleTranslationAPI("detect", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //         (rp: any) => {
        //             try{
        //                 if (rp.Status) {
        //                     return rp.Data.data.detections[0][0].language;
        //                 } else {
        //                     return false;
        //                 }
        //             }
        //             catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity 1. detect language', error); }
        //         }
        //     );

        //     if(lang === 'th'){
        //         //2. translate th to en
        //         const translatedText = await GoogleAPIService.getGoogleTranslationAPI("", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //             (rp: any) => {
        //                 try{
        //                     if (rp.Status) {
        //                         return rp.Data.data.translations[0].translatedText;
        //                     } else {
        //                         return '';
        //                     }
        //                 }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity 2. translate th to en', error); }
        //             }
        //         );

        //         googleNaturalLanguageAPIObject = `{
        //             "document":{
        //                 "type":"PLAIN_TEXT",
        //                 "content":"${translatedText}"
        //             },
        //             "encodingType": "UTF8"
        //         }`;

        //         //3. get analyze entity
        //         const strEnEntities = await GoogleAPIService.getGoogleNaturalLanguageAPI("analyzeEntities", googleApiKey, JSON.parse(googleNaturalLanguageAPIObject)).then(
        //             (rp: any) => {
        //                 try{
        //                     if (rp.Status) {
        //                         return rp.Data.entities.map((data: any) => {
        //                             const nameLowerCaseTrim = data.name.toLowerCase().trim();
        //                             const nameCapitalize = nameLowerCaseTrim.charAt(0).toUpperCase() + nameLowerCaseTrim.slice(1);
        //                             return nameCapitalize;
        //                         }).join(',');
        //                     }
        //                     else{
        //                         return '';
        //                     }
        //                 }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity 3. get analyze entity', error); }
        //             }
        //         );

        //         const tempEnEntities = strEnEntities.includes(',') ? strEnEntities.split(',').map((entity: any) => { return `"${entity}"`; }).join(',') : `"${strEnEntities}"`;

        //         googleTranslationAPIObject = `{ 
        //             "q": [${tempEnEntities}],
        //             "source": "en",
        //             "target": "th"
        //         }`;

        //         //4. translate en to th
        //         const strThEntities = await GoogleAPIService.getGoogleTranslationAPI("", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //             (rp: any) => {
        //                 try{
        //                     if (rp.Status) {
        //                         return rp.Data.data.translations.map((data: any) => {
        //                             return data.translatedText;
        //                         }).join(',');
        //                     }
        //                     else{
        //                         return '';
        //                     }
        //                 }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity 4. translate en to th', error); }
        //             }
        //         );

        //         updateAnswer.analyze_entity = strThEntities;
        //     }
        //     else if(lang === 'en'){
        //         //do the normal process
        //         const strEnEntities = await GoogleAPIService.getGoogleNaturalLanguageAPI("analyzeEntities", googleApiKey, JSON.parse(googleNaturalLanguageAPIObject)).then(
        //             (rp: any) => {
        //                 try{
        //                     if (rp.Status) {
        //                         return rp.Data.entities.map((data: any) => {
        //                             const nameLowerCaseTrim = data.name.toLowerCase().trim();
        //                             const nameCapitalize = nameLowerCaseTrim.charAt(0).toUpperCase() + nameLowerCaseTrim.slice(1);
        //                             return nameCapitalize;
        //                         }).join(',');
        //                     }
        //                     else{
        //                         return '';
        //                     }
        //                 }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity do the normal process', error); }
        //             }
        //         );

        //         updateAnswer.analyze_entity = strEnEntities;
        //     }
        // }
        // else if( updateAnswer.question_analyze_entity === 1 && updateAnswer.question_analyze_sentiment === 1 ){

        // let googleTranslationAPIObject = `{ 
        //     "q": "${text}",
        //     "source": "th",
        //     "target": "en"
        // }`;

        let googleNaturalLanguageAPIObject = `{
            "document":{
                "type":"PLAIN_TEXT",
                "content":"${text}"
            },
            "encodingType": "UTF8"
        }`

        //1. detect language
        // const lang = await GoogleAPIService.getGoogleTranslationAPI("detect", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //     (rp: any) => {
        //         try{
        //             if (rp.Status) {
        //                 return rp.Data.data.detections[0][0].language;
                        
        //             } else {
        //                 return false;
        //             }
        //         }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity & analyze_sentiment 1. detect language', error); }
        //     }
        // );

        // if(lang === 'th'){
        //     //2. translate th to en
        //     const translatedText = await GoogleAPIService.getGoogleTranslationAPI("", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //         (rp: any) => {
        //             try{
        //                 if (rp.Status) {
        //                     return rp.Data.data.translations[0].translatedText;
        //                 } else {
        //                     return '';
        //                 }
        //             }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity & analyze_sentiment 2. translate th to en', error); }
        //         }
        //     );

        //     googleNaturalLanguageAPIObject = `{
        //         "document":{
        //             "type":"PLAIN_TEXT",
        //             "content":"${translatedText}"
        //         },
        //         "encodingType": "UTF8"
        //     }`

        //     //3. get google Analyze Entity Sentiment
        //     let strEnEntities = '';
        //     let strSentiments = '';
            
        //     const status = await GoogleAPIService.getGoogleNaturalLanguageAPI("analyzeEntitySentiment", googleApiKey, JSON.parse(googleNaturalLanguageAPIObject)).then(
        //         (rp: any) => {
        //             try{
        //                 if (rp.Status) {
        //                     strEnEntities = rp.Data.entities.map((data: any) => {
        //                         const nameLowerCaseTrim = data.name.toLowerCase().trim();
        //                         const nameCapitalize = nameLowerCaseTrim.charAt(0).toUpperCase() + nameLowerCaseTrim.slice(1);
        //                         return nameCapitalize;
        //                     }).join(',');
        
        //                     strSentiments = rp.Data.entities.map((data: any) => {
        //                         return data.mentions[0].sentiment.score.toString();
        //                     }).join(',');

        //                     return true;
        
        //                 } else {
        //                     return false;
        //                 }
        //             }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity & analyze_sentiment 3. get google Analyze Entity Sentiment', error); }
        //         }
        //     );

        //     const tempEnEntities = strEnEntities.includes(',') ? strEnEntities.split(',').map((entity: any) => { return `"${entity}"`; }).join(',') : `"${strEnEntities}"`;

        //     googleTranslationAPIObject = `{ 
        //         "q": [${tempEnEntities}],
        //         "source": "en",
        //         "target": "th"
        //     }`;

        //     //4. translate en to th
        //     const strThEntities = await GoogleAPIService.getGoogleTranslationAPI("", googleApiKey, JSON.parse(googleTranslationAPIObject)).then(
        //         (rp: any) => {
        //             try{
        //                 if (rp.Status) {
        //                     return rp.Data.data.translations.map((data: any) => {
        //                         return data.translatedText;
        //                     }).join(',');
        //                 }
        //                 else{
        //                     return '';
        //                 }
        //             }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity & analyze_sentiment 4. translate en to th', error); }
        //         }
        //     );

        //     updateAnswer.analyze_entity = strThEntities;
        //     updateAnswer.analyze_sentiment = strSentiments;
        // }
        // else if(lang === 'en'){
        //do the normal process
        const strThEntitiesSentiments = await GoogleAPIService.getGoogleNaturalLanguageAPI("analyzeEntitySentiment", googleApiKey, JSON.parse(googleNaturalLanguageAPIObject)).then(
            (rp: any) => {
                try{
                    if (rp.Status) {
                        console.log('rp.Data', rp.Data);
                        console.log('rp.Data.entities', rp.Data.entities);
                        let strEnEntities = rp.Data.entities.map((data: any) => {
                            const nameLowerCaseTrim = data.name.toLowerCase().trim();
                            const nameCapitalize = nameLowerCaseTrim.charAt(0).toUpperCase() + nameLowerCaseTrim.slice(1);
                            return nameCapitalize;
                        }).join(',');
    
                        console.log('strEnEntities', strEnEntities);

                        let strSentiments = rp.Data.entities.map((data: any) => {
                            return data.mentions[0].sentiment.score.toString();
                        }).join(',');
    
                        console.log('strSentiments', strSentiments);

                        updateAnswer.analyze_entity = strEnEntities;
                        updateAnswer.analyze_sentiment = strSentiments;

                        return;
                    }
                }catch(error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi analyze_entity & analyze_sentiment do the normal process', error); }
            }
        );
        // }
        //}

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi', 'createRequest'); return res.json({ status: false, message: 'Error Update Answer with google api' }); }
        let questionTypeName : string = '';
        switch (questionTypeId) {
            case 1: questionTypeName = 'answer_rating'; break;
            case 2: questionTypeName = 'answer_choice'; break;
            case 3: questionTypeName = 'answer_checkbox'; break;
            case 4: questionTypeName = 'answer_score'; break;
            case 5: questionTypeName = 'answer_text'; break;
            case 6: questionTypeName = 'answer_dropdown'; break;
            default: break;
        }

        let columnsValues = 'analyze_entity = @analyze_entity, analyze_sentiment = @analyze_sentiment, ';
        request.input('analyze_entity', sql.NVarChar, updateAnswer.analyze_entity);
        request.input('analyze_sentiment', sql.NVarChar, updateAnswer.analyze_sentiment);

        sqlStr = `UPDATE ${questionTypeName} 
                        SET ${columnsValues} 
                        modified_at = GETDATE() 
                        WHERE id = ${answerInsertedId}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateAnswerWithGoogleApi', query.errorMessage); return res.json({ status: false, message: 'Error Update Answer with google api', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Answer with google api Updated' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateAnswerWithGoogleApi', error);
        return res.json({ status: false, message: 'Error Update Answer with google api', exception: error });
    }
};