import { Request, Response } from "express";
import async from "async";
import { createTransaction, createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";
import { Survey } from "../interface/Survey";
import * as sql from 'mssql';
import { SurveyResponse } from "../interface/Response";
import jwt from 'jsonwebtoken';

import GoogleAPIService from "../services/google.api.service";

export async function getSurveys(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getSurveys', 'createPortalRequest'); return res.json({ status: false, message: 'Error getSurveys createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurveys createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getSurveys createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){
            
            const user = req.user as any;

            let responsibleSurveyIdStr = '';
            let sqlWhereSurveyIdInStr = '';
            if([0,2,3].includes(user.role_id)){//For Creators and Subcribers
                if(user.responsible_survey_id){
                    if(user.responsible_survey_id.includes('/')) responsibleSurveyIdStr = '(' + user.responsible_survey_id.split('/').map((entity: any, i: any) => { return entity; }).join(',') + ')';
                    else responsibleSurveyIdStr = `(${user.responsible_survey_id})`;
                }
                sqlWhereSurveyIdInStr = responsibleSurveyIdStr ? `AND s.id IN ${responsibleSurveyIdStr}` : `AND s.id IN (0) `;
            }
            
            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getSurveys', 'createRequest'); return res.json({ status: false, message: 'Error Get Surveys' }); }
            const sqlStr = `SELECT s.*, FORMAT( s.created_at, 'dd/MM/yyyy') as created_date, FORMAT( s.modified_at, 'dd/MM/yyyy') as modified_date, st.name AS template_name
                            FROM surveys as s 
                            LEFT JOIN survey_template as st ON s.template_id = st.id 
                            WHERE s.active = 1  ${sqlWhereSurveyIdInStr}
                            ORDER BY s.modified_at DESC`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getSurveys', query.errorMessage); return res.json({ status: false, message: 'Error Get Surveys', exception: query.errorMessage }); }

            return res.json(query.result);
        }
        else{
            createSiteLog(siteAlias, `getSurveys`, 'The site is not found');
            return res.json({ status: false, message: `else getSurveys`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveys', error);
        return res.json(error);
    }
};


export async function createSurvey(req: Request, res: Response){
    
    try {
        const newSurvey: Survey = req.body;
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'createSurvey', 'createPortalRequest'); return res.json({ status: false, message: 'Error createSurvey createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'createSurvey createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error createSurvey createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const transaction = await createTransaction(req) as any;
            if(!transaction){ createSiteLog(siteAlias, 'createSurvey', 'createTransaction'); return res.json({ status: false, message: 'Error Create A Survey' }); }
            transaction.begin().then(async function () {
                try {
                    const user = req.user as any;
                    const userId = user.id;
                    const userResponsibleSurveyId = user.responsible_survey_id ? user.responsible_survey_id : '';
                    
                    const request = await createRequest(req, transaction) as any;
                    if(!request){ createSiteLog(siteAlias, 'createSurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey' }); }); return; }

                    //step 1 : INSERT INTO surveys
                    request.input('name', sql.NVarChar, newSurvey.name);
                    request.input('nickname', sql.NVarChar, newSurvey.nickname);
                    request.input('project_id', sql.SmallInt, newSurvey.project_id);
                    request.input('touchpoint_id', sql.SmallInt, newSurvey.touchpoint_id);
                    request.input('owner_user_id', sql.SmallInt, newSurvey.owner_user_id);
                    // request.input('multi_lang', sql.SmallInt, newSurvey.multi_lang);

                    let sqlStr = `INSERT INTO surveys (name, nickname, project_id, touchpoint_id, template_id, owner_user_id, modified_at) 
                                  OUTPUT INSERTED.id
                                  VALUES (@name, @nickname, @project_id, @touchpoint_id, @touchpoint_id, @owner_user_id, GETDATE())`;
            
                    let query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'createSurvey step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }
            
                    //step 2 : UPDATE users
                    let queryResultRecordset = query.result.recordset[0];
                    let surveyInsertedId = queryResultRecordset.id;

                    //create a survey first time or not
                    const requestInputUserResponsibleSurveyId = userResponsibleSurveyId ? `${userResponsibleSurveyId}/${surveyInsertedId}` : surveyInsertedId;

                    request.input(`responsible_survey_id`, sql.VarChar , requestInputUserResponsibleSurveyId);
                    const columnsValues = `responsible_survey_id = @responsible_survey_id, `;

                    sqlStr = `UPDATE users 
                              SET ${columnsValues}
                              modified_at = GETDATE()
                              WHERE id = ${userId}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'createSurvey step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

                    //step 3 : copy question from ${typeAlias}_question_templates upon touchpoint
                    sqlStr = `SET IDENTITY_INSERT questions OFF
                              INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id]) 
                              OUTPUT INSERTED.id, INSERTED.type_id, INSERTED.template_question_id 
                              SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [id] FROM ${typeAlias}_question_templates AS r WHERE r.touchpoint_id = ${newSurvey.touchpoint_id} AND r.template_question_status = 1 AND r.active = 1 ORDER BY r.order_no ASC`;
                    
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'createSurvey step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

                    //step 4 : UPDATE survey_id to the inserted questions
                    const questionsInsertedId = query.result.recordset;
                    
                    if(questionsInsertedId.length){

                        let columnsValues = '';

                        request.input(`survey_id_step3`, sql.SmallInt , surveyInsertedId);
                        columnsValues += `survey_id = @survey_id_step3, `;

                        const sqlStr = `UPDATE questions 
                                        SET ${columnsValues}
                                        modified_at = GETDATE() 
                                        WHERE survey_id = 0`;

                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'createSurvey step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }
                        
                        let index = 0;
                        let numRating = 0;
                        let numChoice = 0;
                        let numCheck = 0;
                        let numNPS = 0;
                        let numText = 0;
                        let numDropdown = 0;

                        async.eachSeries(questionsInsertedId, function iteratee(data: any, callback) {

                            switch (data.type_id) {
                                case 1: numRating++; break;//Rating
                                case 2: numChoice++; break;//Multiple Choice
                                case 3: numCheck++; break;//Checkbox
                                case 4: numNPS++; break;//NPS
                                case 5: numText++; break;//Text
                                case 6: numDropdown++; break;//dropdown
                                default:
                            }

                            questionsProcess(request, transaction, req, res, data, index++, surveyInsertedId, typeAlias, callback);
                        },
                        async function(err) 
                        {
                            if(err){ createSiteLog(siteAlias, 'createSurvey async.eachSeries', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: err }); }); return; }

                            //Star Rating = 15 sec
                            //Multiple Choice = 20 sec
                            //Checkboxes = 20 sec
                            //Net Promoter Score = 15 sec
                            //Text = 150 sec
                            //Dropdown = 20 sec
                            const estimatedTime = ( numRating * 15 ) + ( numChoice * 20 ) + ( numCheck * 20 ) + ( numNPS * 15 ) + ( numText * 150 ) + ( numDropdown * 20 );

                            const sqlStr = `UPDATE surveys 
                                            SET num_page = 1, num_question = ${questionsInsertedId.length}, time_spent = ${estimatedTime}, modified_at = GETDATE() 
                                            WHERE id = ${surveyInsertedId}`;

                            query = await requestQuery(request, sqlStr) as any;
                            if(query.error){ createSiteLog(siteAlias, 'createSurvey async.eachSeries UPDATE surveys', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

                            transaction.commit(function(err: any) {
                                if(err){ createSiteLog(siteAlias, 'createSurvey transaction.commit ', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: err }); }); return; }
                                return res.json({ status: true, result: { surveyInsertedId: surveyInsertedId }, message: 'Survey Created' });
                            });

                        });
                    }
                    //no question template for this touchpoint (Other or Start From Scatch)
                    else{
                        transaction.commit(function(err: any) {
                            if(err){ createSiteLog(siteAlias, 'createSurvey transaction.commit ', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: err }); }); return; }
                            return res.json({ status: true, result: { surveyInsertedId: surveyInsertedId }, message: 'Survey Created' });
                        });
                    }
                } catch(error){ 
                    createSiteLog(siteAlias, 'createSurvey', error); 
                    transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: error }); });
                }
            });
        }
        else{
            createSiteLog(siteAlias, `createSurvey`, 'The site is not found');
            return res.json({ status: false, message: `else createSurvey`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createSurvey', error);
        return res.json({ status: false, message: 'Error Create', exception: error });
    }
}

async function questionsProcess(request: any, transaction: any, req: Request, res: Response, data: any, i: any, surveyInsertedId: any, typeAlias: any, callback: any) {
    
    try{
        const siteAlias = req.headers['x-site'];

        let questionTypeTabelName : string = '';
        let questionAdditionColumnName : string = '';
        let newQuestionTypeTabelName : string = '';
        switch (data.type_id) {
            case 1: //rating
                questionTypeTabelName = 'question_rating';
                questionAdditionColumnName = ', [shape], [color], [show_label], [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_rating_template`;
                break;
            case 2: //multiple choice
                questionTypeTabelName = 'question_choice';
                questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_choice_template`;
                break;
            case 3: //checkbox
                questionTypeTabelName = 'question_checkbox';
                questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_checkbox_template`;
                break;
            case 4: //net promoter score
                questionTypeTabelName = 'question_score';
                questionAdditionColumnName = ', [show_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_score_template`;
                break;
            case 5: //text
                questionTypeTabelName = 'question_text';
                questionAdditionColumnName = ', [hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_text_template`;
                break;
            case 6: //dropdown
                questionTypeTabelName = 'question_dropdown';
                questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                newQuestionTypeTabelName = `${typeAlias}_question_dropdown_template`;
                break;
            default:
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', }); }); return;
        }
        
        //step 5 : copy question template from each type table
        let sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                      INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName}) 
                      OUTPUT INSERTED.id 
                      SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName} FROM ${newQuestionTypeTabelName} WHERE question_id = ${data.template_question_id}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, `createSurvey step 5 questionsProcess INSERT INTO ${questionTypeTabelName} question_id = ${data.template_question_id}`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

        //step 6 : update question_id to the inserted question in question type table
        let queryResultRecordset = query.result.recordset[0];
        let questionRatingInsertedId = queryResultRecordset.id;

        let columnsValues = '';

        request.input(`question_id_${i}`, sql.SmallInt , data.id);
        columnsValues += `question_id = @question_id_${i}, `;
        
        request.input(`survey_id_${i}`, sql.SmallInt , surveyInsertedId);
        columnsValues += `survey_id = @survey_id_${i}, `;

        sqlStr = `UPDATE ${questionTypeTabelName} 
                  SET ${columnsValues}
                  modified_at = GETDATE()
                  WHERE id = ${questionRatingInsertedId}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, `createSurvey step 6 questionsProcess UPDATE ${questionTypeTabelName} id = ${questionRatingInsertedId}`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

        async.setImmediate(function() { callback(null); });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createSurvey questionsProcess', error);
        transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: error }); }); 
        return;
    }
};

async function questionsCopyProcess(request: any, transaction: any, req: Request, res: Response, data: any, i: any, surveyInsertedId: any, questionsId: any, callback: any) {
    
    try{
        const siteAlias = req.headers['x-site'];
        
        //step 4 : UPDATE survey_id to the inserted questions
        let columnsValues = '';

        request.input(`survey_id_step3_${i}`, sql.SmallInt , surveyInsertedId);
        columnsValues += `survey_id = @survey_id_step3_${i}, `;

        let sqlStr = `UPDATE questions 
                      SET ${columnsValues}
                      modified_at = GETDATE() 
                      WHERE id = ${data.id}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'copySurvey questionsCopyProcess step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create Survey', exception: query.errorMessage }); }); return; }

        //step 5 : copy question template from each type table
        let questionTypeTabelName : string = '';
        let questionAdditionColumnName : string = '';
        switch (data.type_id) {
            case 1: //rating
                questionTypeTabelName = 'question_rating';
                questionAdditionColumnName = ', [shape], [color], [show_label], [choice], [choice_html], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [comment_field_label_html], [comment_field_hint_html]';
                break;
            case 2: //multiple choice
                questionTypeTabelName = 'question_choice';
                questionAdditionColumnName = ', [choice], [choice_html], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [comment_field_label_html], [comment_field_hint_html]';
                break;
            case 3: //checkbox
                questionTypeTabelName = 'question_checkbox';
                questionAdditionColumnName = ', [choice], [choice_html], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [comment_field_label_html], [comment_field_hint_html], [limit_selection], [limit_min], [limit_max]';
                break;
            case 4: //net promoter score
                questionTypeTabelName = 'question_score';
                questionAdditionColumnName = ', [show_label], [low_score_label], [high_score_label], [low_score_label_html], [high_score_label_html], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [comment_field_label_html], [comment_field_hint_html]';
                break;
            case 5: //text
                questionTypeTabelName = 'question_text';
                questionAdditionColumnName = ', [hint], [hint_html]';
                break;
            case 6: //dropdown
                questionTypeTabelName = 'question_dropdown';
                questionAdditionColumnName = ', [choice], [choice_html], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [comment_field_label_html], [comment_field_hint_html]';
                break;
            default:
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', }); }); return;
        }
        
        sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                  INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_name_html], [image_src], [image_description] ${questionAdditionColumnName}) 
                  OUTPUT INSERTED.id 
                  SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_name_html], [image_src], [image_description] ${questionAdditionColumnName} FROM ${questionTypeTabelName} WHERE question_id = ${questionsId[i].id}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, `copySurvey questionsCopyProcess step 5 INSERT INTO ${questionTypeTabelName} question_id = ${questionsId[i].id}`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: query.errorMessage }); }); return; }

        //step 6 : update question_id to the inserted question in question type table
        let queryResultRecordset = query.result.recordset[0];
        let questionRatingInsertedId = queryResultRecordset.id;
                
        columnsValues = '';

        request.input(`question_id_${i}`, sql.SmallInt , data.id);
        columnsValues += `question_id = @question_id_${i}, `;
        
        request.input(`survey_id_${i}`, sql.SmallInt , surveyInsertedId);
        columnsValues += `survey_id = @survey_id_${i}, `;

        sqlStr = `UPDATE ${questionTypeTabelName} 
                  SET ${columnsValues}
                  modified_at = GETDATE() 
                  WHERE id = ${questionRatingInsertedId}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, `copySurvey questionsCopyProcess step 6 UPDATE ${questionTypeTabelName} id = ${questionRatingInsertedId}`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: query.errorMessage }); }); return; }

        async.setImmediate(function() { callback(null); });
        
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'copySurvey questionsCopyProcess', error);
        transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: error }); }); 
        return;
    }
};

export async function copySurvey(req: Request, res: Response){
    
    try {
        const copySurvey = req.body;
        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'copySurvey', 'createTransaction'); return res.json({ status: false, message: 'Error Copy A Survey' }); }
        transaction.begin().then(async function () {
            try {

                const user = req.user as any;
                const userId = user.id;
                const userResponsibleSurveyId = user.responsible_survey_id ? user.responsible_survey_id : '';
                
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'copySurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey' }); }); return; }

                console.log(copySurvey);
                //step 1
                request.input('nickname', sql.NVarChar, `${copySurvey.nickname} copy`);
                request.input('name', sql.NVarChar, `${copySurvey.name} copy`);
                request.input('name_html', sql.NVarChar, `${copySurvey.name_html} copy`);

                // request.input('multi_lang', sql.SmallInt, copySurvey.multi_lang);
                request.input('project_id', sql.SmallInt, copySurvey.project_id);
                request.input('touchpoint_id', sql.SmallInt, copySurvey.touchpoint_id);
                request.input('template_id', sql.SmallInt, copySurvey.template_id);
                request.input('num_page', sql.SmallInt, copySurvey.num_page);
                request.input('num_question', sql.SmallInt, copySurvey.num_question);

                request.input('owner_user_id', sql.SmallInt, userId);

                request.input('header_description', sql.NVarChar, copySurvey.header_description);
                request.input('footer_description', sql.NVarChar, copySurvey.footer_description);
                request.input('end_of_survey_message', sql.NVarChar, copySurvey.end_of_survey_message);

                request.input('enable_src_type', sql.SmallInt, copySurvey.enable_src_type);
                request.input('image_src', sql.VarChar, copySurvey.image_src);
                request.input('banner_src', sql.VarChar, copySurvey.banner_src);
                request.input('logo_alignment', sql.SmallInt, copySurvey.logo_alignment);
                request.input('image_width', sql.SmallInt, copySurvey.image_width);
                request.input('image_src_type', sql.SmallInt, copySurvey.image_src_type);

                request.input('end_of_survey_enable_src_type', sql.SmallInt, copySurvey.end_of_survey_enable_src_type);
                request.input('end_of_survey_image_src', sql.VarChar, copySurvey.end_of_survey_image_src);
                request.input('end_of_survey_banner_src', sql.VarChar, copySurvey.end_of_survey_banner_src);
                request.input('end_of_survey_logo_alignment', sql.SmallInt, copySurvey.end_of_survey_logo_alignment);
                request.input('end_of_survey_image_width', sql.SmallInt, copySurvey.end_of_survey_image_width);

                request.input('previous_text', sql.NVarChar, copySurvey.previous_text);
                request.input('next_text', sql.NVarChar, copySurvey.next_text);
                request.input('done_text', sql.NVarChar, copySurvey.done_text);

                request.input('button_color_theme', sql.NVarChar, copySurvey.button_color_theme);
                request.input('completion_redirect', sql.NVarChar, copySurvey.completion_redirect);

                request.input('global_font_name', sql.NVarChar, copySurvey.global_font_name);
                request.input('global_font_family', sql.NVarChar, copySurvey.global_font_family);
                request.input('global_font_size', sql.NVarChar, copySurvey.global_font_size);

                let sqlStr = `INSERT INTO surveys (nickname, name, name_html, project_id, touchpoint_id, template_id, num_page, num_question, owner_user_id, header_description, footer_description, end_of_survey_message, enable_src_type, image_src, banner_src, logo_alignment, image_width, image_src_type, end_of_survey_enable_src_type, end_of_survey_image_src, end_of_survey_banner_src, end_of_survey_logo_alignment, end_of_survey_image_width, previous_text, next_text, done_text, button_color_theme, completion_redirect, global_font_name, global_font_family, global_font_size, modified_at) 
                              OUTPUT INSERTED.id
                              VALUES (@nickname, @name, @name_html, @project_id, @touchpoint_id, @touchpoint_id, @num_page, @num_question, @owner_user_id, @header_description, @footer_description, @end_of_survey_message, @enable_src_type, @image_src, @banner_src, @logo_alignment, @image_width, @image_src_type, @end_of_survey_enable_src_type, @end_of_survey_image_src, @end_of_survey_banner_src, @end_of_survey_logo_alignment, @end_of_survey_image_width, @previous_text, @next_text, @done_text, @button_color_theme, @completion_redirect, @global_font_name, @global_font_family, @global_font_size, GETDATE())`;
        
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'copySurvey step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey', exception: query.errorMessage }); }); return; }
        
                //step 2 : UPDATE users
                let queryResultRecordset = query.result.recordset[0];
                let surveyInsertedId = queryResultRecordset.id;

                //create a survey first time or not
                const requestInputUserResponsibleSurveyId = userResponsibleSurveyId ? `${userResponsibleSurveyId}/${surveyInsertedId}` : surveyInsertedId;

                request.input(`responsible_survey_id`, sql.VarChar , requestInputUserResponsibleSurveyId);
                const columnsValues = `responsible_survey_id = @responsible_survey_id, `;

                sqlStr = `UPDATE users 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${userId}`;

                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'copySurvey step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey', exception: query.errorMessage }); }); return; }
                
                //step 3 : get question ids from the survey
                sqlStr = `SELECT id 
                          FROM questions AS q 
                          WHERE q.active = 1 AND q.survey_id = ${copySurvey.id} 
                          ORDER BY q.order_no ASC`;

                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'copySurvey step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey', exception: query.errorMessage }); }); return; }

                //step 4 : copy question from ${typeAlias}_question_templates upon touchpoint
                queryResultRecordset = query.result.recordset[0];
                const questionsId = query.result.recordset;

                sqlStr = `SET IDENTITY_INSERT questions OFF
                          INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [question_label_html], [order_no], [required], [required_label], [required_label_html], [template_question_id]) 
                          OUTPUT INSERTED.id, INSERTED.type_id, INSERTED.template_question_id 
                          SELECT [survey_id], [page_no], [type_id], [question_label], [question_label_html], [order_no], [required], [required_label], [required_label_html], [template_question_id] FROM questions AS q WHERE q.active = 1 AND q.survey_id = ${copySurvey.id} ORDER BY q.order_no ASC`;
                
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'copySurvey step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy', exception: query.errorMessage }); }); return; }
                
                const questionsInsertedId = query.result.recordset;
                if(!questionsInsertedId.length){ transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy', exception: query.errorMessage }); }); return; }
                
                //update copy all new questions type
                let index = 0;
                let numRating = 0;
                let numChoice = 0;
                let numCheck = 0;
                let numNPS = 0;
                let numText = 0;
                let numDropdown = 0;

                async.eachSeries(questionsInsertedId, function iteratee(data: any, callback) {

                    switch (data.type_id) {
                        case 1: numRating++; break;//Rating
                        case 2: numChoice++; break;//Multiple Choice
                        case 3: numCheck++; break;//Checkbox
                        case 4: numNPS++; break;//NPS
                        case 5: numText++; break;//Text
                        case 6: numDropdown++; break;//dropdown
                        default:
                    }

                    questionsCopyProcess(request, transaction, req, res, data, index++, surveyInsertedId, questionsId, callback);
                },
                async function(err) 
                {
                    if(err){ createSiteLog(siteAlias, 'copySurvey async.eachSeries', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy', exception: err }); }); return; }

                    //Star Rating = 15 sec
                    //Multiple Choice = 20 sec
                    //Checkboxes = 20 sec
                    //Net Promoter Score = 15 sec
                    //Text = 150 sec
                    //Dropdown = 20 sec
                    const estimatedTime = ( numRating * 15 ) + ( numChoice * 20 ) + ( numCheck * 20 ) + ( numNPS * 15 ) + ( numText * 150 ) + ( numDropdown * 20 );

                    const sqlStr = `UPDATE surveys 
                                    SET num_question = ${questionsInsertedId.length}, time_spent = ${estimatedTime}, modified_at = GETDATE() 
                                    WHERE id = ${surveyInsertedId}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'copySurvey async.eachSeries UPDATE surveys', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey', exception: query.errorMessage }); }); return; }
                    
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'copySurvey async.eachSeries transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy Survey', exception: err }); }); return; }
                        return res.json({ status: true, result: { surveyInsertedId: surveyInsertedId }, message: 'Survey Copied' });
                    });

                });
            } catch(error){ 
                createSiteLog(siteAlias, 'copySurvey', error); 
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Create', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'copySurvey', error);
        return res.json({ status: false, message: 'Error Create', exception: error });
    }
}

export async function getSurvey(req: Request, res: Response) {
    
    try{
        const id = req.params.surveyId;
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getSurvey', 'createPortalRequest'); return res.json({ status: false, message: 'Error getSurvey createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurvey createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getSurvey createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;
            const remApiLink = queryResultRecordsetPortal.rem_api_link;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getSurvey', 'createRequest'); return res.json({ status: false, message: 'Error Get A Survey' }); }

            const sqlStr = `SELECT s.*, FORMAT( s.created_at, 'dd/MM/yyyy') as created_date, FORMAT( s.modified_at, 'dd/MM/yyyy') as modified_date, st.name AS template_name, ss.name AS status_name,
                            STUFF(( select ',' + name + '~'+ CAST(id as varchar(10)) from ${typeAlias}_area_of_impacts WHERE active = 1 ORDER BY order_no ASC FOR XML PATH('')),1,1,'') AS name_area_of_impacts,
                            STUFF(( select ',' + name from ${typeAlias}_departments WHERE active = 1 ORDER BY order_no ASC FOR XML PATH('')),1,1,'') AS name_departments,
                            STUFF(( select ',' + CONVERT(varchar(10),id) from ${typeAlias}_departments as d WHERE d.active = 1 FOR XML PATH('')),1,1,'') AS id_departments,
                            STUFF(( select ',' + nickname from collectors as c WHERE c.survey_id = ${id} AND c.active = 1 AND c.status IN (2,3) FOR XML PATH('')),1,1,'') AS survey_collector_nickname,
                            STUFF(( select ',' + name from projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_name,
                            STUFF(( select ',' + CONVERT(varchar(10),id) from projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_id,
                            STUFF(( select ',' + CONVERT(varchar(10),id) from collectors as c WHERE c.survey_id = ${id} AND c.active = 1 AND c.status IN (2,3) FOR XML PATH('')),1,1,'') AS survey_collector_id,
                            STUFF(( select ',' + CONVERT(varchar(10),project_id) from collectors as c WHERE c.survey_id = ${id} AND c.active = 1 AND c.status IN (2,3) FOR XML PATH('')),1,1,'') AS collector_project_id
                            FROM surveys as s 
                            LEFT JOIN survey_template as st ON s.template_id = st.id 
                            LEFT JOIN survey_status as ss ON s.status = ss.id 
                            WHERE s.active = 1 and s.id = ${id}`;

            console.log(sqlStr);
            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getSurvey', query.errorMessage); return res.json({ status: false, message: 'Error Get A Survey', exception: query.errorMessage }); }

            query.result.recordset[0].rem_api_link = remApiLink;
            return res.json(query.result);
        }
        else{
            createSiteLog(siteAlias, `getSurvey`, 'The site is not found');
            return res.json({ status: false, message: `else getSurvey`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurvey', error);
        return res.json(error);
    }
};

export async function getClientSurvey(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const collectorId = req.params.collectorId;
        const siteAlias = req.headers['x-site'];

        console.log('surveyId', surveyId);
        console.log('collectorId', collectorId);
        console.log('siteAlias', siteAlias);

        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});

        // const pass = await GoogleAPIService.verifyGoogleReCaptcha(reCaptchaKey).then(
        //     (rp: any) => {
        //         try{
        //             if (rp.Status) {
        //                 if(!rp.Data.success) createSiteLog(siteAlias, 'GoogleAPIService.verifyGoogleReCaptcha', `Error ${rp.Data['error-codes'][0]}`);
        //                 return rp.Data.success;
        //             } else {
        //                 return false;
        //             }
        //         }
        //         catch(error){ 
        //             createSiteLog(siteAlias, 'GoogleAPIService.verifyGoogleReCaptcha', error); 
        //             return false;
        //         }
        //     }
        // );

        // if(!pass) return res.json({ status: false, message: 'Please verify with reCaptcha again!'});

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'createPortalRequest', 'createPortalRequest'); return res.json({ status: false, message: 'Error getClientSurvey createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getClientSurvey createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getClientSurvey createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        console.log('queryResultRecordsetPortal', queryResultRecordsetPortal);

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getClientSurvey', 'createRequest'); return res.json({ status: false, message: 'Error Get A Client Survey' }); }
            
            const sqlStr = `SELECT s.num_question, s.num_page,
                            s.enable_src_type, s.image_src, s.banner_src, s.logo_alignment, s.image_width, s.completion_redirect,
                            s.end_of_survey_enable_src_type, s.end_of_survey_image_src, s.end_of_survey_banner_src, s.end_of_survey_logo_alignment, s.end_of_survey_image_width, s.background_image, s.background_color,
                            s.name, s.name_html, s.header_description, s.footer_description, s.end_of_survey_message, s.previous_text, s.next_text, s.done_text,
                            s.button_color_theme, s.global_font_family, s.global_font_size,
                            ( SELECT c.status FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_status,
                            ( SELECT c.cutoff FROM collectors as c WHERE c.id = ${collectorId} ) AS cutoff,
                            ( SELECT c.cutoff_date FROM collectors as c WHERE c.id = ${collectorId} ) AS cutoff_datetime,
                            ( SELECT c.project_id FROM collectors as c WHERE c.id = ${collectorId} ) AS project_id,
                            ( SELECT c.collect_option FROM collectors as c WHERE c.id = ${collectorId} ) AS collect_option,
                            ( SELECT c.name FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_name,
                            ( SELECT c.nickname FROM collectors as c WHERE c.id = ${collectorId} ) AS collector_nickname
                            FROM surveys as s 
                            LEFT JOIN survey_template as st ON s.template_id = st.id 
                            LEFT JOIN survey_status as ss ON s.status = ss.id 
                            WHERE s.active = 1 and s.id = ${surveyId}`;

            console.log(sqlStr);

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getClientSurvey', query.errorMessage); return res.json({ status: false, message: 'Error Get Client Survey', exception: query.errorMessage }); }

            return res.json(query.result);
        }
        else{
            createSiteLog(siteAlias, `getClientSurvey`, 'The site is not found');
            return res.json({ status: false, message: `else getClientSurvey`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getClientSurvey', error);
        return res.json(error);
    }
};

export async function getClientEscapeDeeplink(req: Request, res: Response) {
    
    try{
        const clientData = req.body;
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getClientEscapeDeeplink', 'createPortalRequest'); return res.json({ status: false, message: 'Error getClientEscapeDeeplink createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getClientEscapeDeeplink createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getClientEscapeDeeplink createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            clientData.deeplink = '1';

            const privateKey = process.env.JWT_SECRET as string;
            const tokenEscapeDeeplink = jwt.sign(clientData, privateKey);

            return res.json({ status: true, token: tokenEscapeDeeplink, message: 'Got a token to escape deeplink'});
        }
        else{
            createSiteLog(siteAlias, `getClientEscapeDeeplink`, 'The site is not found');
            return res.json({ status: false, message: `else getClientEscapeDeeplink`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getClientEscapeDeeplink', error);
        return res.json(error);
    }
};

export async function getSurveyExecutiveReport(req: Request, res: Response) {

    try{
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getSurveyExecutiveReport', 'createPortalRequest'); return res.json({ status: false, message: 'Error getSurveyExecutiveReport createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurveyExecutiveReport createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getSurveyExecutiveReport createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;
            const touchpointId = parseInt(req.params.touchpointId);
            const sqlWhereTouchpoint = touchpointId ? ` AND s.touchpoint_id = ${touchpointId} ` : '';
            
            const user = req.user as any;

            let responsibleSurveyIdStr = '';
            let sqlWhereSurveyIdInStr = '';
            if([0,2,3].includes(user.role_id)){//For Creators and Subcribers
                if(user.responsible_survey_id){
                    if(user.responsible_survey_id.includes('/')) responsibleSurveyIdStr = '(' + user.responsible_survey_id.split('/').map((entity: any, i: any) => { return entity; }).join(',') + ')';
                    else responsibleSurveyIdStr = `(${user.responsible_survey_id})`;
                }
                sqlWhereSurveyIdInStr = responsibleSurveyIdStr ? `AND s.id IN ${responsibleSurveyIdStr}` : `AND s.id IN (0) `;
            }

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getSurveyExecutiveReport', 'createRequest'); return res.json({ status: false, message: 'Error Get Survey' }); }

            const sqlStr = `SELECT 
                            s.id AS survey_id, COUNT(q.id) AS num_question,
                            ( SELECT sn.nickname FROM surveys as sn WHERE sn.id = s.id ) AS survey_name,
                            ( SELECT COUNT(p.id) FROM projects as p WHERE p.active = 1) AS num_projects,
                            STUFF(( select ',' + CAST(id AS varchar(20))  FROM collectors as c WHERE c.active = 1 AND c.status IN (2,3) AND c.survey_id = s.id FOR XML PATH('')),1,1,'') AS collector_id,
                            STUFF(( select ',' + nickname FROM collectors as c WHERE c.active = 1 AND c.status IN (2,3) AND c.survey_id = s.id FOR XML PATH('')),1,1,'') AS collector_nickname,
                            STUFF(( select ',' + name FROM projects FOR XML PATH('')),1,1,'') AS name_projects,
                            STUFF(( select ',' + name FROM projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_name,
                            STUFF(( select ',' + CONVERT(varchar(10),id) FROM projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_id,
                            STUFF(( select ',' + CONVERT(varchar(10),project_id) FROM collectors as c WHERE c.survey_id = s.id AND c.active = 1 AND c.status IN (2,3) FOR XML PATH('')),1,1,'') AS collector_project_id 
                            FROM surveys AS s 
                            LEFT JOIN questions AS q ON q.survey_id = s.id 
                            WHERE s.active = 1 AND (s.status = 2 OR s.status = 3)
                            ${sqlWhereSurveyIdInStr} 
                            ${sqlWhereTouchpoint} 
                            GROUP BY s.id 
                            ORDER BY s.id DESC`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getSurveyExecutiveReport', query.errorMessage); return res.json({ status: false, message: 'Error to get Survey Details', exception: query.errorMessage }); }

            return res.json({ status: true, result: query.result, message: 'Got Survey Details' });
        }
        else{
            createSiteLog(siteAlias, `getSurveyExecutiveReport`, 'The site is not found');
            return res.json({ status: false, message: `else getSurveyExecutiveReport`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveyExecutiveReport', error);
        return res.json({ status: false, message: 'Error to get Survey Details', exception: error });
    }
};

export async function getSurveyInstitutionReport(req: Request, res: Response) {

    try{
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getSurveyInstitutionReport', 'createPortalRequest'); return res.json({ status: false, message: 'Error getSurveyInstitutionReport createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurveyInstitutionReport createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getSurveyInstitutionReport createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;
            const surveyId = parseInt(req.params.surveyId);
            let sqlWhereSurveyIdInStr = `AND s.id IN (${surveyId})`;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getSurveyInstitutionReport', 'createRequest'); return res.json({ status: false, message: 'Error Get Survey' }); }

            const sqlStr = `SELECT 
                            s.id AS survey_id, COUNT(q.id) AS num_question,
                            ( SELECT sn.nickname FROM surveys as sn WHERE sn.id = s.id ) AS survey_name,
                            ( SELECT COUNT(p.id) FROM projects as p WHERE p.active = 1) AS num_projects,
                            ( SELECT COUNT(ar.id) FROM ${typeAlias}_area_of_impacts as ar ) AS num_area_of_impacts,
                            STUFF(( select ',' + CAST(id AS varchar(20))  FROM collectors as c WHERE c.active = 1 AND c.status IN (2,3) AND c.survey_id = s.id FOR XML PATH('')),1,1,'') AS collector_id,
                            STUFF(( select ',' + nickname FROM collectors as c WHERE c.active = 1 AND c.status IN (2,3) AND c.survey_id = s.id FOR XML PATH('')),1,1,'') AS collector_nickname,
                            STUFF(( select ',' + name FROM projects FOR XML PATH('')),1,1,'') AS name_projects,
                            STUFF(( select ',' + name FROM ${typeAlias}_area_of_impacts WHERE active = 1 ORDER BY order_no ASC FOR XML PATH('')),1,1,'') AS name_area_of_impacts,
                            STUFF(( select ',' + name FROM projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_name,
                            STUFF(( select ',' + CONVERT(varchar(10),id) FROM projects as p WHERE p.active = 1 FOR XML PATH('')),1,1,'') AS survey_project_id,
                            STUFF(( select ',' + CONVERT(varchar(10),project_id) FROM collectors as c WHERE c.survey_id = s.id AND c.active = 1 AND c.status IN (2,3) FOR XML PATH('')),1,1,'') AS collector_project_id 
                            FROM surveys AS s 
                            LEFT JOIN questions AS q ON q.survey_id = s.id 
                            WHERE s.active = 1 AND (s.status = 2 OR s.status = 3) AND q.active = 1
                            ${sqlWhereSurveyIdInStr} 
                            GROUP BY s.id 
                            ORDER BY s.id DESC`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getSurveyInstitutionReport', query.errorMessage); return res.json({ status: false, message: 'Error to get Survey Details', exception: query.errorMessage }); }

            return res.json({ status: true, result: query.result, message: 'Got Survey Details' });
        }
        else{
            createSiteLog(siteAlias, `getSurveyInstitutionReport`, 'The site is not found');
            return res.json({ status: false, message: `else getSurveyInstitutionReport`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveyInstitutionReport', error);
        return res.json({ status: false, message: 'Error to get Survey Details', exception: error });
    }
};

export async function getTemplateName(req: Request, res: Response) {
    
    try{
        const id = req.params.templateId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getTemplateName', 'createRequest'); return res.json({ status: false, message: 'Error Get A Template Name' }); }

        const sqlStr = `SELECT name 
                        FROM survey_template 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getTemplateName', query.errorMessage); return res.json({ status: false, message: 'Error Get A Template Name', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getTemplateName', error);
        return res.json(error);
    }
};

export async function deleteSurvey(req: Request, res: Response) {
    
    try{
        const id = req.params.surveyId;
        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'deleteSurvey', 'createTransaction'); return res.json({ status: false, message: 'Error Delete The Survey' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'deleteSurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Survey' }); }); return; }
                
                //surveys
                let sqlStr = `UPDATE surveys SET active = 0, status = 0, deleted_at = GETDATE() WHERE id = ${id}`;
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE surveys', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //collectors
                sqlStr = `UPDATE collectors SET active = 0, status = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE collectors', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //questions
                sqlStr = `UPDATE questions SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE questions', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //question_rating
                sqlStr = `UPDATE question_rating SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_rating', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //question_choice
                sqlStr = `UPDATE question_choice SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_choice', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //question_checkbox
                sqlStr = `UPDATE question_checkbox SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_checkbox', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //question_score
                sqlStr = `UPDATE question_score SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_score', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //question_text
                sqlStr = `UPDATE question_text SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_text', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //question_dropdown
                sqlStr = `UPDATE question_dropdown SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE question_dropdown', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //responses
                sqlStr = `UPDATE responses SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE responses', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //answers
                sqlStr = `UPDATE answers SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answers', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //answer_rating
                sqlStr = `UPDATE answer_rating SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_rating', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //answer_choice
                sqlStr = `UPDATE answer_choice SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_choice', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //answer_checkbox
                sqlStr = `UPDATE answer_checkbox SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_checkbox', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //answer_score
                sqlStr = `UPDATE answer_score SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_score', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //answer_text
                sqlStr = `UPDATE answer_text SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_text', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }
                
                //answer_dropdown
                sqlStr = `UPDATE answer_dropdown SET active = 0, deleted_at = GETDATE() WHERE survey_id = ${id}`;
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey UPDATE answer_dropdown', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                //total responses and time spent from every collectors
                sqlStr = `SELECT COUNT(*) AS total_responses, 
                          ( SELECT COUNT(*) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id = ${id} ) AS total_completed_response, 
                          ( SELECT AVG(time_spent) FROM responses AS r WHERE r.active = 1 AND r.complete_status = 3 AND r.survey_id =  ${id} AND r.time_spent < (SELECT num_question * 2 * 60 FROM surveys AS s WHERE s.active = 1 AND s.id =  ${id}) ) AS avg_time_spent 
                          FROM responses AS r 
                          WHERE r.active = 1 AND r.complete_status in (2,3) AND r.survey_id = ${id}`;
                
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteSurvey SELECT for calulation', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                const queryResultRecordset = query.result.recordset[0];
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

                    const sqlStr = `UPDATE surveys SET ${columnsValues} modified_at = GETDATE() WHERE id = ${id}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, `deleteSurvey with survey statistic updates`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: query.errorMessage }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `deleteSurvey transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Survey Deleted' });
                    });
                }
                else{
                    //All updates Done! (without survey statistic updates)
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `deleteSurvey without survey statistic updates`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Survey Deleted' });
                    });
                }
            } catch(error){ 
                createSiteLog(siteAlias, 'deleteSurvey', error); 
                transaction.rollback(function() { return res.json({ status: false, message: 'Error delete survey', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteSurvey', error);
        return res.json({ status: false, message: 'Error delete survey', exception: error });
    }
}

export async function updateSurvey(req: Request, res: Response) {
    
    try { 
        const surveyId = req.params.surveyId;
        const updateSurvey = req.body;

        const siteAlias = req.headers['x-site'];
                
        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'updateSurvey', 'createTransaction'); return res.json({ status: false, message: 'Error Update The Survey' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'updateSurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update The Survey' }); }); return; }

                let toProcessUserResponsibleSurveyId = false;

                let columnsValues = '';
                for (const key in updateSurvey) {
                    request.input(key, sql.NVarChar, updateSurvey[key]);
                    columnsValues += key + ' = @' + key + ', ';

                    //for update user survey access authorization
                    if(['subscriber'].includes(key)) toProcessUserResponsibleSurveyId = true;
                }

                //surveys
                let sqlStr = `UPDATE surveys 
                              SET ${columnsValues}
                              modified_at = GETDATE() 
                              WHERE id = ${surveyId}`;

                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'updateSurvey UPDATE surveys', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update The Survey', exception: query.errorMessage }); }); return; }

                if(!toProcessUserResponsibleSurveyId){
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `updateSurvey transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Survey commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Survey Updated' });
                    });
                }
                else{
                    //toProcessUserResponsibleSurveyId
                    const user = req.user as any;

                    //check user permission to edit survey subscribers
                    sqlStr = `SELECT s.* 
                              FROM surveys AS s 
                              WHERE s.id = ${surveyId}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateSurvey SELECT surveys', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }

                    const userData = query.result.recordset[0];
                    
                    const permission = userData.owner_user_id === user.id ? true : false;
                    const admin = user.role_id === 1 ? true : false;
                    
                    if(!admin && !permission){ transaction.rollback(function() { return res.json({ status: false, message: 'No permission to update subscribers', exception: '!admin && !permission' }); }); return; }

                    sqlStr = `SELECT u.role_id, u.responsible_survey_id, u.email 
                              FROM users AS u 
                              WHERE u.role_id IN (2,3,4) AND u.id != ${userData.owner_user_id}`;

                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'updateSurvey SELECT users', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }

                    //userData map
                    const usersData = query.result.recordset;  
                    const previousUsersEmail = [] as any;

                    usersData.map(async (userData: any, index: any) => {
                        if(userData.responsible_survey_id){
                            if(userData.responsible_survey_id.includes('/')){
                                userData.responsible_survey_id.split('/').some((entity: any) => {
                                    if(entity === surveyId) previousUsersEmail.push(usersData[index].email);
                                });
                            }
                            else{
                                if(userData.responsible_survey_id === surveyId) previousUsersEmail.push(usersData[index].email)
                            }
                        }
                    });

                    const surveySubscribersArr = updateSurvey.subscriber.split(',');
                    //check and add the user emails if not have a access for this survey to a list for the next step
                    const addSubscribersArrStr = surveySubscribersArr.map((entity: any) => {
                        if(!previousUsersEmail.includes(entity)) return `'${entity}'`;
                    }).filter((entity: any) => {return entity;}).join(',');

                    //check and remove the user emails if already have a access for this survey to a list fot the next step
                    const removeSubscribersArrStr = previousUsersEmail.map((entity: any) => {
                        if(!surveySubscribersArr.includes(entity)) return `'${entity}'`;
                    }).filter((entity: any) => {return entity;}).join(',');
                    
                    //add user authorization
                    if(addSubscribersArrStr.length){

                        sqlStr = `SELECT u.id, u.role_id, u.responsible_survey_id 
                                  FROM users AS u 
                                  WHERE u.email IN (${addSubscribersArrStr}) AND u.role_id IN (2,3,4)`;

                        const request = await createRequest(req) as any
                        if(!request){ createSiteLog(siteAlias, 'updateSurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers' }); }); return; }
                        
                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'updateSurvey add user authorization SELECT', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }

                        const usersData = query.result.recordset;  

                        usersData.map(async (userData: any, i: any) => {

                            if(userData.responsible_survey_id) request.input(`responsible_survey_id_a${i}`, sql.VarChar, `${userData.responsible_survey_id}/${surveyId}`);
                            else request.input(`responsible_survey_id_a${i}`, sql.VarChar, surveyId);

                            sqlStr = `UPDATE users 
                                      SET responsible_survey_id = @responsible_survey_id_a${i}, modified_at = GETDATE() 
                                      WHERE id = ${userData.id}`;

                            query = await requestQuery(request, sqlStr) as any;
                            if(query.error){ createSiteLog(siteAlias, 'updateSurvey add user authorization UPDATE', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }
                        });
                    }

                    //remove user authorization
                    if(removeSubscribersArrStr.length){
                    
                        sqlStr = `SELECT u.id, u.role_id, u.responsible_survey_id 
                                  FROM users AS u 
                                  WHERE u.email IN (${removeSubscribersArrStr}) AND u.role_id IN (2,3,4)`;

                        const request = await createRequest(req) as any
                        if(!request){ createSiteLog(siteAlias, 'updateSurvey', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers' }); }); return; }

                        query = await requestQuery(request, sqlStr) as any;
                        if(query.error){ createSiteLog(siteAlias, 'updateSurvey remove user authorization SELECT', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }

                        const usersData = query.result.recordset; 

                        usersData.map(async (userData: any, i: any) => {

                            if(userData.responsible_survey_id) {

                                let updateResponsibleSurveyId;

                                if(userData.responsible_survey_id.includes('/')){
                                    updateResponsibleSurveyId = userData.responsible_survey_id.split('/').map((entity: any) => {
                                        if(surveyId !== entity) return entity;
                                    }).filter((entity: any) => {return entity;}).join(',');
                                    request.input(`responsible_survey_id_r${i}`, sql.VarChar, updateResponsibleSurveyId);
                                }
                                else{
                                    request.input(`responsible_survey_id_r${i}`, sql.VarChar, '');
                                }

                                sqlStr = `UPDATE users 
                                          SET responsible_survey_id = @responsible_survey_id_r${i}, modified_at = GETDATE() 
                                          WHERE id = ${userData.id}`;

                                query = await requestQuery(request, sqlStr) as any;
                                if(query.error){ createSiteLog(siteAlias, 'updateSurvey add user authorization UPDATE', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers', exception: query.errorMessage }); }); return; }
                            }
                        });
                    }

                    //All Done!
                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, `updateSurvey All Done! transaction.commit`, query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Update Subscribers commit', exception: err }); }); return; }
                        return res.json({ status: true, result: query.result, message: 'Survey Updated' });
                    });
                }
            } catch(error){ 
                createSiteLog(siteAlias, 'updateSurvey', error); 
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Update', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateSurvey', error);
        return res.json({ status: false, message: 'Error Update', exception: error });
    }
};

export async function getSearch(req: Request, res: Response) {
    
    try {
        const siteAlias = req.headers['x-site'];

        const keyword = req.query.keyword && req.query.keyword != 'null' ? `'%${req.query.keyword}%'` : `'%%' `;
        const status = req.query.status && req.query.status != 'null' ? `= ${req.query.status}` : `IS NOT NULL `;

        const user = req.user as any;
        let responsibleSurveyIdStr = '';
        let sqlWhereSurveyIdInStr = '';
        if([2,3].includes(user.role_id)){//For Creators and Subcribers
            if(user.responsible_survey_id){
                if(user.responsible_survey_id.includes('/')) responsibleSurveyIdStr = '(' + user.responsible_survey_id.split('/').map((entity: any, i: any) => { return entity; }).join(',') + ')';
                else responsibleSurveyIdStr = `(${user.responsible_survey_id})`;
            }
            sqlWhereSurveyIdInStr = responsibleSurveyIdStr ? `AND s.id IN ${responsibleSurveyIdStr}` : `AND s.id IN (0)`;
        }

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getSearch', 'createRequest'); return res.json({ status: false, message: 'Error Search' }); }
        const sqlStr = `SELECT s.*, FORMAT( s.created_at, 'dd/MM/yyyy') as created_date, FORMAT( s.modified_at, 'dd/MM/yyyy') as modified_date, st.name AS template_name 
                        FROM surveys as s 
                        LEFT JOIN survey_template as st ON s.template_id = st.id 
                        WHERE s.active = 1 AND s.name LIKE ${keyword} 
                        AND s.status ${status} ${sqlWhereSurveyIdInStr}
                        ORDER BY s.modified_at DESC`;
                        
        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSearch', query.errorMessage); return res.json({ status: false, message: 'Error Search', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getSearch', error);
        return res.json(error);
    }
};