import { Request, Response } from "express";
import { createTransaction, createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";
import * as sql from 'mssql';

export async function getQuestion(req: Request, res: Response) {

    try{
        const id = req.params.surveyId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getQuestion', 'createRequest'); return res.json({ status: false, message: 'Error Get Question' }); }

        const sqlStr = `SELECT q.* 
                        FROM questions AS q
                        WHERE q.active = 1 AND q.survey_id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getQuestion', query.errorMessage); return res.json({ status: false, message: 'Error Get Question', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getQuestion', error);
        return res.json(error);
    }
};

export async function getQuestionByType(req: Request, res: Response) {

    try{
        const id = req.params.surveyId;
        const no = req.params.orderNo;

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getQuestionByType', 'createRequest'); return res.json({ status: false, message: 'Error Get Question By Type' }); }

        let sqlStr = `SELECT q.* 
                      FROM questions AS q 
                      WHERE q.active = 1 AND q.survey_id = ${id} AND q.order_no = ${no}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getQuestionByType SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Get Question By Type', exception: query.errorMessage }); }

        const queryResultRecordsetLength = query.result.recordset.length;
        const queryResultRecordset = query.result.recordset[0];

        if(queryResultRecordsetLength === 0) return res.json(query.result);

        const questionTypeId = queryResultRecordset.type_id;
        const questionId = queryResultRecordset.id;
        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'question_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'question_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'question_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'question_score';
                break;
            case 5: //text
                questionTypeName = 'question_text';
                break;
            case 6: //dropdown
                questionTypeName = 'question_dropdown';
                break;
            default:
                return res.json({ status: false, message: 'Error Get Question By Type' });
        }

        sqlStr = `SELECT q.*, qtype.*,
                  ( SELECT COUNT(*) FROM answers as a WHERE a.active = 1 AND a.question_id = ${questionId} AND a.survey_id = ${id} ) AS already_responded,
                  ( SELECT s.nickname FROM surveys as s WHERE s.active = 1 AND s.id = ${id} ) AS survey_name
                  FROM questions AS q 
                  LEFT JOIN ${questionTypeName} AS qtype ON q.id = qtype.question_id 
                  WHERE q.active = 1 AND q.survey_id = ${id} AND q.order_no = ${no}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getQuestionByType LEFT JOIN', query.errorMessage); return res.json({ status: false, message: 'Error Get Question By Type', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getQuestionByType', error);
        return res.json(error);
    }
};

 export async function getClientQuestionByType(req: Request, res: Response) {

    try{
        const id = req.params.surveyId;
        const no = req.params.orderNo;
        const siteAlias = req.headers['x-site'];

        // const reCaptchaKey = req.query.re;
        // if(reCaptchaKey === undefined || reCaptchaKey === '' || reCaptchaKey === null) return res.json({ status: false, message: 'Please verify with reCaptcha'});
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getQuestionByType', 'createRequest'); return res.json({ status: false, message: 'Error Get Question By Type' }); }

        let sqlStr = `SELECT q.* 
                      FROM questions AS q 
                      WHERE q.active = 1 AND q.survey_id = ${id} AND q.order_no = ${no}`;

        let query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getQuestionByType SELECT', query.errorMessage); return res.json({ status: false, message: 'Error Get Question By Type', exception: query.errorMessage }); }

        const queryResultRecordsetLength = query.result.recordset.length;
        const queryResultRecordset = query.result.recordset[0];

        if(queryResultRecordsetLength === 0) return res.json(query.result);

        const questionTypeId = queryResultRecordset.type_id;
        const questionId = queryResultRecordset.id;
        let questionTypeName : string = '';

        switch (questionTypeId) {
            case 1: //rating
                questionTypeName = 'question_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'question_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'question_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'question_score';
                break;
            case 5: //text
                questionTypeName = 'question_text';
                break;
            case 6: //dropdown
                questionTypeName = 'question_dropdown';
                break;
            default:
                return res.json({ status: false, message: 'Error Get Question By Type' });
        }

        sqlStr = `SELECT q.*, qtype.*,
                  ( SELECT COUNT(*) FROM answers as a WHERE a.active = 1 AND a.question_id = ${questionId} AND a.survey_id = ${id} ) AS already_responded,
                  ( SELECT s.nickname FROM surveys as s WHERE s.active = 1 AND s.id = ${id} ) AS survey_name
                  FROM questions AS q 
                  LEFT JOIN ${questionTypeName} AS qtype ON q.id = qtype.question_id 
                  WHERE q.active = 1 AND q.survey_id = ${id} AND q.order_no = ${no}`;

        query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getQuestionByType LEFT JOIN', query.errorMessage); return res.json({ status: false, message: 'Error Get Question By Type', exception: query.errorMessage }); }

        return res.json(query.result);
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getQuestionByType', error);
        return res.json(error);
    }
};

export async function designNewTemplateToPage(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const questionTemplateId = parseInt(req.params.questionTemplateId);
        const questionBankLang = parseInt(req.params.questionBankLang);
        const toPageNo = req.params.toPageNo;
        const numQuestion = req.params.numQuestion;

        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'designNewTemplateToPage', 'createPortalRequest'); return res.json({ status: false, message: 'Error designNewTemplateToPage createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error designNewTemplateToPage createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const transaction = await createTransaction(req) as any;
            if(!transaction){ createSiteLog(siteAlias, 'designNewTemplateToPage', 'createTransaction'); return res.json({ status: false, message: 'Error Add A New Question Template To Page' }); }
            transaction.begin().then(async function () {
                try {

                    const request = await createRequest(req, transaction) as any;
                    if(!request){ createSiteLog(siteAlias, 'designNewTemplateToPage', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return; }

                    //step 1
                    let sqlStr = `SET IDENTITY_INSERT questions OFF
                                  INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active]) 
                                  OUTPUT INSERTED.id 
                                  SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [id], [active] FROM ${typeAlias}_question_templates WHERE id = ${questionTemplateId}`;
                    //step 1 : duplicate this current question
                    let query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return; }
            
                    let queryResultRecordset = query.result.recordset[0];
                    let questionsInsertedId = queryResultRecordset.id;
                                
                    //step 2
                    let columnsValues = '';

                    request.input(`survey_id`, sql.SmallInt , surveyId);
                    columnsValues += `survey_id = @survey_id, `;
                    
                    request.input(`page_no`, sql.SmallInt , toPageNo);
                    columnsValues += `page_no = @page_no, `;

                    request.input(`order_no`, sql.SmallInt , parseInt(numQuestion)+1);
                    columnsValues += `order_no = @order_no, `;

                    sqlStr = `UPDATE questions 
                              SET ${columnsValues}
                              modified_at = GETDATE()
                              WHERE id = ` + questionsInsertedId;

                    //step 2: update page_no and order_no to the inserted question
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return;}

                    //step 3
                    //step 4
                    let questionTypeTabelName : string = '';
                    let fromQuestionAdditionColumnName : string = '';
                    let toQuestionAdditionColumnName : string = '';
                    let newQuestionTemplateTypeTabelName : string = '';

                    switch (questionTypeId) {
                        case 1: //rating
                            questionTypeTabelName = 'question_rating';
                            fromQuestionAdditionColumnName = `, [shape], [color], [show_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [shape], [color], [show_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_rating_template`;
                            break;
                        case 2: //multiple choice
                            questionTypeTabelName = 'question_choice';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_choice_template`;
                            break;
                        case 3: //checkbox
                            questionTypeTabelName = 'question_checkbox';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_checkbox_template`;
                            break;
                        case 4: //net promoter score
                            questionTypeTabelName = 'question_score';
                            fromQuestionAdditionColumnName = `, [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]`;
                            toQuestionAdditionColumnName = `, [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_score_template`;
                            break;
                        case 5: //text
                            questionTypeTabelName = 'question_text';
                            fromQuestionAdditionColumnName = `, [hint]`;
                            toQuestionAdditionColumnName = `, [hint]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_text_template`;
                            break;
                        case 6: //dropdown
                            questionTypeTabelName = 'question_dropdown';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_dropdown_template`;
                            break;
                        default:
                            transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: error }); });
                            return;
                    }
                    
                    sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                              INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${toQuestionAdditionColumnName}) 
                              OUTPUT INSERTED.id 
                              SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${fromQuestionAdditionColumnName} FROM ${newQuestionTemplateTypeTabelName} WHERE question_id = ${questionTemplateId}`;

                    //step 3 : duplicate this current question to question type table
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return;}

                    queryResultRecordset = query.result.recordset[0];
                    let questionRatingInsertedId = queryResultRecordset.id;
                                                        
                    //step 4
                    columnsValues = '';

                    request.input(`survey_id_step4`, sql.SmallInt , surveyId);
                    columnsValues += `survey_id = @survey_id_step4, `;

                    request.input(`question_id`, sql.SmallInt , questionsInsertedId);
                    columnsValues += `question_id = @question_id, `;


                    sqlStr = `UPDATE ${questionTypeTabelName} 
                              SET ${columnsValues}
                              modified_at = GETDATE()
                              WHERE id = ` + questionRatingInsertedId;

                    //step 4 : update question_id to the inserted question in question type table
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return;}
                                                                    
                    //step 5
                    sqlStr = `UPDATE surveys
                              SET num_page = num_page + 1, num_question = num_question + 1, modified_at = GETDATE()
                              WHERE id = ` + surveyId;

                    //step 5 : set num_question +1 for the survey that the question moved
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 5', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return;}
            
                    //step 6
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designNewTemplateToPage');
                    if(error){ createSiteLog(siteAlias, 'designNewTemplateToPage step 6', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designNewTemplateToPage transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: query.errorMessage }); }); return; }

                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Question Added'
                        });
                    });
                    
                }
                catch(error){
                    createSiteLog(req.headers['x-site'], 'designNewTemplateToPage', error);
                    transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template To Page', exception: error }); });
                }
            });
        }
        else{
            createSiteLog(siteAlias, `designNewTemplateToPage`, 'The site is not found');
            return res.json({ status: false, message: `else designNewTemplateToPage`, exception: "The site is not found" });
        }

    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designNewTemplateToPage', error);
        return res.json({
            status: false,
            message: 'Error Add A New Question Template To Page',
            exception: error
        });
    }
};

export async function designNewTemplateToQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const questionTemplateId = parseInt(req.params.questionTemplateId);
        const questionBankLang = parseInt(req.params.questionBankLang);
        const toPageNo = req.params.toPageNo;
        const toOrderNo = req.params.toOrderNo;
        const toPosition = req.params.toPosition;

        //after = 1 : OrderNoPosition = toOrderNo + 1, before = 0 : OrderNoPosition = toOrderNo
        const OrderNoPosition = parseInt(toPosition) === 1 ? parseInt(toOrderNo) + 1 : toOrderNo;

        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'designNewTemplateToQuestion', 'createPortalRequest'); return res.json({ status: false, message: 'Error designNewTemplateToQuestion createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error designNewTemplateToPage createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const transaction = await createTransaction(req) as any;
            if(!transaction){ createSiteLog(siteAlias, 'designNewTemplateToQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Add A New Question Template' }); }
            transaction.begin().then(async function () {
                try {
                    const request = await createRequest(req, transaction) as any;
                    if(!request){ createSiteLog(siteAlias, 'designNewTemplateToQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return; }

                    //step 1
                    let sqlStr = `UPDATE questions
                                  SET order_no = order_no + 1, modified_at = GETDATE()
                                  WHERE survey_id = ${surveyId} AND active = 1 AND order_no >= ${OrderNoPosition}`;

                    //step 1 : increase order_no for the question that order_no more than or equal to OrderNoPosition
                    let query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}
                    
                    sqlStr = `SET IDENTITY_INSERT questions OFF
                              INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active]) 
                              OUTPUT INSERTED.id 
                              SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [id], [active] FROM ${typeAlias}_question_templates WHERE id = ${questionTemplateId}`;

                    //step 2 : duplicate this current question
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}
            
                    let queryResultRecordset = query.result.recordset[0];
                    let questionsInsertedId = queryResultRecordset.id;
                                            
                    //step 3
                    let columnsValues = '';

                    request.input(`survey_id`, sql.SmallInt , surveyId);
                    columnsValues += `survey_id = @survey_id, `;
                    
                    request.input(`page_no`, sql.SmallInt , toPageNo);
                    columnsValues += `page_no = @page_no, `;

                    request.input(`order_no`, sql.SmallInt , OrderNoPosition);
                    columnsValues += `order_no = @order_no, `;

                    sqlStr = `UPDATE questions 
                              SET ${columnsValues}
                              modified_at = GETDATE()
                              WHERE id = ${questionsInsertedId}`

                    //step 3 : update page_no and order_no to the inserted question
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}
            
                    //step 4
                    let questionTypeTabelName : string = '';
                    let fromQuestionAdditionColumnName : string = '';
                    let toQuestionAdditionColumnName : string = '';
                    let newQuestionTemplateTypeTabelName : string = '';

                    switch (questionTypeId) {
                        case 1: //rating
                            questionTypeTabelName = 'question_rating';
                            fromQuestionAdditionColumnName = `, [shape], [color], [show_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [shape], [color], [show_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_rating_template`;
                            break;
                        case 2: //multiple choice
                            questionTypeTabelName = 'question_choice';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_choice_template`;
                            break;
                        case 3: //checkbox
                            questionTypeTabelName = 'question_checkbox';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_checkbox_template`;
                            break;
                        case 4: //net promoter score
                            questionTypeTabelName = 'question_score';
                            fromQuestionAdditionColumnName = `, [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]`;
                            toQuestionAdditionColumnName = `, [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_score_template`;
                            break;
                        case 5: //text
                            questionTypeTabelName = 'question_text';
                            fromQuestionAdditionColumnName = `, [hint]`;
                            toQuestionAdditionColumnName = `, [hint]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_text_template`;
                            break;
                        case 6: //dropdown
                            questionTypeTabelName = 'question_dropdown';
                            fromQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            toQuestionAdditionColumnName = `, [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint], [choice]`;
                            newQuestionTemplateTypeTabelName = `${typeAlias}_question_dropdown_template`;
                            break;
                        default:
                            transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: error }); });
                            return;
                    }
                    
                    sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                              INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${toQuestionAdditionColumnName}) 
                              OUTPUT INSERTED.id 
                              SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${fromQuestionAdditionColumnName} FROM ${newQuestionTemplateTypeTabelName} WHERE question_id = ${questionTemplateId}`;

                    //step 4 : duplicate this current question to question type table
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}
            
                    queryResultRecordset = query.result.recordset[0];
                    let questionRatingInsertedId = queryResultRecordset.id;
                                                                    
                    //step 5
                    columnsValues = '';

                    request.input(`survey_id_step5`, sql.SmallInt , surveyId);
                    columnsValues += `survey_id = @survey_id_step5, `;

                    request.input(`question_id`, sql.SmallInt , questionsInsertedId);
                    columnsValues += `question_id = @question_id, `;

                    sqlStr = `UPDATE ${questionTypeTabelName} 
                              SET ${columnsValues}
                              modified_at = GETDATE()
                              WHERE id = ${questionRatingInsertedId}`;

                    //step 5 : update question_id to the inserted question in question type table
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 5', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}
            
                    //step 6  
                    sqlStr = `UPDATE surveys
                              SET num_question = num_question + 1, modified_at = GETDATE()
                              WHERE id = ${surveyId}`

                    //Step 6 : set num_question +1 for the survey that the question moved
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 6', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: query.errorMessage }); }); return;}

                    //step 7
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designNewTemplateToQuestion step 7');
                    if(error){ createSiteLog(siteAlias, 'designNewTemplateToQuestion step 7', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: error }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designNewTemplateToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: err }); }); return; }

                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Question Added'
                        });
                    });
                    
                }
                catch(error){
                    createSiteLog(req.headers['x-site'], 'designNewTemplateToQuestion', error);
                    transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question Template', exception: error }); });
                }
            });
        }
        else{
            createSiteLog(siteAlias, `designNewTemplateToQuestion`, 'The site is not found');
            return res.json({ status: false, message: `else designNewTemplateToQuestion`, exception: "The site is not found" });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designNewTemplateToQuestion', error);
        return res.json({
            status: false,
            message: 'Error Add A New Question Template',
            exception: error
        });
    }
};

export async function designNewToPage(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const toPageNo = req.params.toPageNo;
        const numQuestion = req.params.numQuestion;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designNewToPage', 'createTransaction'); return res.json({ status: false, message: 'Error Add A New Question To Page' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designNewToPage', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page' }); }); return; }

                //step 1
                let sqlStr = `SET IDENTITY_INSERT questions OFF
                              INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active]) 
                              OUTPUT INSERTED.id 
                              SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active] FROM new_question_templates WHERE id = ${questionTypeId}`;

                //step 1 : duplicate this current question
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToPage step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); }); return;}

                let queryResultRecordset = query.result.recordset[0];
                let questionsInsertedId = queryResultRecordset.id;

                //step 2
                let columnsValues = '';

                request.input(`survey_id`, sql.SmallInt , surveyId);
                columnsValues += `survey_id = @survey_id, `;
                
                request.input(`page_no`, sql.SmallInt , toPageNo);
                columnsValues += `page_no = @page_no, `;

                request.input(`order_no`, sql.SmallInt , parseInt(numQuestion)+1);
                columnsValues += `order_no = @order_no, `;

                sqlStr = `UPDATE questions 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${questionsInsertedId}`

                //step 2 : update page_no and order_no to the inserted question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToPage step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); }); return;}
        
                //step 3
                let questionTypeTabelName : string = '';
                let questionAdditionColumnName : string = '';
                let newQuestionTypeTabelName : string = '';
                switch (questionTypeId) {
                    case 1: //rating
                        questionTypeTabelName = 'question_rating';
                        questionAdditionColumnName = ', [shape], [color], [show_label], [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_rating_template';
                        break;
                    case 2: //multiple choice
                        questionTypeTabelName = 'question_choice';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_choice_template';
                        break;
                    case 3: //checkbox
                        questionTypeTabelName = 'question_checkbox';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_checkbox_template';
                        break;
                    case 4: //net promoter score
                        questionTypeTabelName = 'question_score';
                        questionAdditionColumnName = ', [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_score_template';
                        break;
                    case 5: //text
                        questionTypeTabelName = 'question_text';
                        questionAdditionColumnName = ', [hint]';
                        newQuestionTypeTabelName = 'new_question_text_template';
                        break;
                    case 6: //dropdown
                        questionTypeTabelName = 'question_dropdown';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_dropdown_template';
                        break;
                    default:
                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); });
                        return;
                }
                
                sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                          INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName}) 
                          OUTPUT INSERTED.id 
                          SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName} FROM ${newQuestionTypeTabelName} WHERE id = 1`;

                //step 3 : duplicate this current question to question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToPage step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); }); return;}
        
                queryResultRecordset = query.result.recordset[0];
                let questionRatingInsertedId = queryResultRecordset.id;
                                                                
                //step 4
                columnsValues = '';

                request.input(`survey_id_step4`, sql.SmallInt , surveyId);
                columnsValues += `survey_id = @survey_id_step4, `;

                request.input(`question_id`, sql.SmallInt , questionsInsertedId);
                columnsValues += `question_id = @question_id, `;

                sqlStr = `UPDATE ${questionTypeTabelName} 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${questionRatingInsertedId}`

                //step 4 : update question_id to the inserted question in question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToPage step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); }); return;}
        
                //step 5
                sqlStr = `UPDATE surveys 
                          SET num_page = num_page + 1, num_question = num_question + 1, modified_at = GETDATE() 
                          WHERE id = ${surveyId}`;

                //Step 5 : set num_question +1 for the survey that the question moved
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToPage step 5', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: query.errorMessage }); }); return;}
        
                //step 6
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designNewToPage step 6');
                if(error){ createSiteLog(siteAlias, 'designNewToPage step 6', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: error }); }); return; }

                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'designNewToPage transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: err }); }); return; }

                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Question Added'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designNewToPage', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question To Page', exception: error }); });
            }
        });

    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designNewToPage', error);
        return res.json({
            status: false,
            message: 'Error Add A New Question To Page',
            exception: error
        });
    }
};

export async function designNewToQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const toPageNo = req.params.toPageNo;
        const toOrderNo = req.params.toOrderNo;
        const toPosition = req.params.toPosition;

        //after = 1 : OrderNoPosition = toOrderNo + 1, before = 0 : OrderNoPosition = toOrderNo
        const OrderNoPosition = parseInt(toPosition) === 1 ? parseInt(toOrderNo) + 1 : toOrderNo;

        const siteAlias = req.headers['x-site'];
    
        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designNewToQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Add A New Question' }); }
        transaction.begin().then(async function () {
            try {

                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designNewToQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question' }); }); return; }
                
                //step 1
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no + 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no >= ${OrderNoPosition}`;

                //step 1 : increase order_no for the question that order_no more than or equal to OrderNoPosition
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}
        
                //step 2
                sqlStr = `SET IDENTITY_INSERT questions OFF
                          INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active]) 
                          OUTPUT INSERTED.id 
                          SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [required_label], [template_question_id], [active] FROM new_question_templates WHERE id = ${questionTypeId}`;
                //step 2 : duplicate this current question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}

                let queryResultRecordset = query.result.recordset[0];
                let questionsInsertedId = queryResultRecordset.id;
                                        
                //step 3
                let columnsValues = '';

                request.input(`survey_id`, sql.SmallInt , surveyId);
                columnsValues += `survey_id = @survey_id, `;
                
                request.input(`page_no`, sql.SmallInt , toPageNo);
                columnsValues += `page_no = @page_no, `;

                request.input(`order_no`, sql.SmallInt , OrderNoPosition);
                columnsValues += `order_no = @order_no, `;

                sqlStr = `UPDATE questions 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${questionsInsertedId}`

                //step 3 : update page_no and order_no to the inserted question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}
        
                //step 4
                let questionTypeTabelName : string = '';
                let questionAdditionColumnName : string = '';
                let newQuestionTypeTabelName : string = '';
                switch (questionTypeId) {
                    case 1: //rating
                        questionTypeTabelName = 'question_rating';
                        questionAdditionColumnName = ', [shape], [color], [show_label], [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_rating_template';
                        break;
                    case 2: //multiple choice
                        questionTypeTabelName = 'question_choice';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_choice_template';
                        break;
                    case 3: //checkbox
                        questionTypeTabelName = 'question_checkbox';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_checkbox_template';
                        break;
                    case 4: //net promoter score
                        questionTypeTabelName = 'question_score';
                        questionAdditionColumnName = ', [show_label], [low_score_label], [high_score_label], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_score_template';
                        break;
                    case 5: //text
                        questionTypeTabelName = 'question_text';
                        questionAdditionColumnName = ', [hint]';
                        newQuestionTypeTabelName = 'new_question_text_template';
                        break;
                    case 6: //dropdown
                        questionTypeTabelName = 'question_dropdown';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [show_comment_field_logic], [show_comment_when_answer], [comment_field_label], [comment_field_hint]';
                        newQuestionTypeTabelName = 'new_question_dropdown_template';
                        break;
                    default:
                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: error }); });
                        return;
                }
                
                sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                          INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName}) 
                          OUTPUT INSERTED.id 
                          SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName} FROM ${newQuestionTypeTabelName} WHERE id = 1`;

                //step 4 : duplicate this current question to question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}

                queryResultRecordset = query.result.recordset[0];
                let questionRatingInsertedId = queryResultRecordset.id;
                                                                
                //step 5
                columnsValues = '';

                request.input(`survey_id_step5`, sql.SmallInt , surveyId);
                columnsValues += `survey_id = @survey_id_step5, `;

                request.input(`question_id`, sql.SmallInt , questionsInsertedId);
                columnsValues += `question_id = @question_id, `;

                sqlStr = `UPDATE ${questionTypeTabelName} 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${questionRatingInsertedId}`;

                //step 5 : update question_id to the inserted question in question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 5', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}
                                                                            
                //step 6
                sqlStr = `UPDATE surveys
                          SET num_question = num_question + 1, modified_at = GETDATE()
                          WHERE id = ${surveyId}`;

                //step 6 : set num_question +1 for the survey that the question moved
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designNewToQuestion step 6', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: query.errorMessage }); }); return;}

                //step 7
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designNewToQuestion step 7');
                if(error){ createSiteLog(siteAlias, 'designNewToQuestion step 7', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: error }); }); return; }

                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'designNewToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: err }); }); return; }

                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Question Added'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designNewToQuestion', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Add A New Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designNewToQuestion', error);
        return res.json({
            status: false,
            message: 'Error Add A New Question',
            exception: error
        });
    }
};

export async function updateQuestionByType(req: Request, res: Response) { 

    try {
        const questionId = req.params.questionId;
        const questionTypeId = req.params.questionTypeId;
        const updateQuestion = req.body;

        const siteAlias = req.headers['x-site'];

        let questionTypeName : string = '';

        switch (parseInt(questionTypeId)) {
            case 1: //rating
                questionTypeName = 'question_rating';
                break;
            case 2: //multiple choice
                questionTypeName = 'question_choice';
                break;
            case 3: //checkbox
                questionTypeName = 'question_checkbox';
                break;
            case 4: //net promoter score
                questionTypeName = 'question_score';
                break;
            case 5: //text
                questionTypeName = 'question_text';
                break;
            case 6: //dropdown
                questionTypeName = 'question_dropdown';
                break;
            default:
                return res.json({ status: false, message: 'Error Update Question By Type' });
        }
    
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateQuestionByType', 'createRequest'); return res.json({ status: false, message: 'Error Update The Question By Type' }); }

        let columnsValues = '';
        for (const key in updateQuestion) {

            if(['shape', 'color', 'show_label', 'show_comment_field', 'image_enabled', 'show_comment_field_logic', 'limit_selection', 'limit_min', 'limit_max'].includes(key)){
                request.input(key, sql.SmallInt, updateQuestion[key]);
            }
            else request.input(key, sql.NVarChar, updateQuestion[key]);

            columnsValues += key + ' = @' + key + ', ';
        }

        const sqlStr = `UPDATE ${questionTypeName}
                        SET ${columnsValues}
                        modified_at = GETDATE()
                        WHERE question_id = ${questionId}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateQuestionByType', query.errorMessage); return res.json({ status: false, message: 'Error Update The Question By Type', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
            message: 'Question Updated'
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateQuestionByType', error);
        return res.json({
            status: false,
            message: 'Error Update',
            exception: error
        });
    }
};

export async function updateDesginQuestion(req: Request, res: Response) {
    
    try {
        const questionId = req.params.questionId;
        const updateQuestion = req.body;

        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateDesginQuestion', 'createRequest'); return res.json({ status: false, message: 'Error Update The Question' }); }
        
        let columnsValues = '';
        for (const key in updateQuestion) {

            if(['enabled_kpi', 'required', 'enable_consent'].includes(key)){
                request.input(key, sql.SmallInt, updateQuestion[key]);
            }
            else request.input(key, sql.NVarChar, updateQuestion[key]);

            columnsValues += key + ' = @' + key + ', ';
        }

        const sqlStr = `UPDATE questions 
                        SET ${columnsValues}
                        modified_at = GETDATE()
                        WHERE id = ${questionId}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateDesginQuestion', query.errorMessage); return res.json({ status: false, message: 'Error Update The Question', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
            message: 'Question Updated'
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateDesginQuestion', error);
        return res.json({
            status: false,
            message: 'Error Update',
            exception: error
        });
    }
    
};

export async function deleteDesignQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'deleteDesignQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Delete Question' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'deleteDesignQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question' }); }); return; }

                //step 1
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no - 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no > ( SELECT order_no FROM questions WHERE id = ${questionId} )`;
                
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestion step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 2
                sqlStr = `UPDATE questions 
                          SET order_no = -1, active = 0, deleted_at = GETDATE() 
                          WHERE id = ${questionId}`;

                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestion step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //Step 2 : set order_no to -1 for the question that deleted
                let questionTypeTabelName : string = '';
                switch (questionTypeId) {
                    case 1: //rating
                        questionTypeTabelName = 'question_rating';
                        break;
                    case 2: //multiple choice
                        questionTypeTabelName = 'question_choice';
                        break;
                    case 3: //checkbox
                        questionTypeTabelName = 'question_checkbox';
                        break;
                    case 4: //net promoter score
                        questionTypeTabelName = 'question_score';
                        break;
                    case 5: //text
                        questionTypeTabelName = 'question_text';
                        break;
                    case 6: //dropdown
                        questionTypeTabelName = 'question_dropdown';
                        break;
                    default:
                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question' }); });
                        return;
                }

                sqlStr = `UPDATE ${questionTypeTabelName}
                          SET active = 0, deleted_at = GETDATE()
                          WHERE question_id = ${questionId}`;

                //Step 3 : set active to -1 for the question type that deleted
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestion Step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}
                                                    
                sqlStr = `UPDATE surveys 
                          SET num_question = ( SELECT COUNT( * ) FROM questions WHERE survey_id = ${surveyId} AND active = 1 ), modified_at = GETDATE()
                          WHERE id = ${surveyId}`;

                //step 4 : set survey to -1 for the question that deleted
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestion step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 5
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'deleteDesignQuestion step 5');
                if(error){ createSiteLog(siteAlias, 'deleteDesignQuestion step 5', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: error }); }); return; }

                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'deleteDesignQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return; }
                    
                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Question Deleted'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'deleteDesignQuestion', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteDesignQuestion', error);
        return res.json({
            status: false,
            message: 'Error Delete',
            exception: error
        });
    }
};

export async function deleteDesignQuestionSpecial(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial', 'createTransaction'); return res.json({ status: false, message: 'Error Delete The Question' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question' }); }); return; }

                //step 1
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no - 1, page_no = page_no - 1, modified_at = GETDATE()
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no > ( SELECT order_no FROM questions WHERE id = ${questionId} ) AND page_no > ( SELECT page_no FROM questions WHERE id = ${questionId} )`;
                
                //Step 1 : decrease order_no by 1 for all question on the survey 
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial Step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 2
                sqlStr = `UPDATE questions 
                          SET page_no = -1, order_no = -1, active = 0, deleted_at = GETDATE() 
                          WHERE id = ${questionId}`;

                //Step 2 : set order_no to -1 for the question that deleted
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial Step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 3
                let questionTypeTabelName : string = '';
                switch (questionTypeId) {
                    case 1: //rating
                        questionTypeTabelName = 'question_rating';
                        break;
                    case 2: //multiple choice
                        questionTypeTabelName = 'question_choice';
                        break;
                    case 3: //checkbox
                        questionTypeTabelName = 'question_checkbox';
                        break;
                    case 4: //net promoter score
                        questionTypeTabelName = 'question_score';
                        break;
                    case 5: //text
                        questionTypeTabelName = 'question_text';
                        break;
                    case 6: //dropdown
                        questionTypeTabelName = 'question_dropdown';
                        break;
                    default:
                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question' }); });
                        return;
                }

                sqlStr = `UPDATE ${questionTypeTabelName}
                          SET active = 0, deleted_at = GETDATE()
                          WHERE question_id = ${questionId}`;

                //Step 3 : set active to -1 for the question type that deleted
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial Step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 4
                sqlStr = `UPDATE surveys 
                          SET num_question = ( SELECT COUNT( * ) FROM questions WHERE survey_id = ${surveyId} and active = 1 ), num_page = num_page - 1, modified_at = GETDATE() 
                          WHERE id = ${surveyId}`;

                //Step 4 : set survey to -1 for the question that deleted
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial Step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return;}

                //step 5
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'deleteDesignQuestionSpecial Step 5');
                if(error){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial step 5', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: error }); }); return; }

                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'deleteDesignQuestionSpecial transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: query.errorMessage }); }); return; }
                    
                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Question Deleted'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'deleteDesignQuestionSpecial', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Delete The Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteDesignQuestionSpecial', error);
        return res.json({
            status: false,
            message: 'Error delete',
            exception: error
        });
    }
};

export async function designMoveQuestionUp(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const pageNo = req.params.pageNo;
        const orderNo = req.params.orderNo;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designMoveQuestionUp', 'createTransaction'); return res.json({ status: false, message: 'Error Move The Question Up' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designMoveQuestionUp', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up' }); }); return; }

                //step 1
                let sqlStr = `SELECT id, page_no, order_no 
                              FROM questions 
                              WHERE survey_id = ${surveyId} AND order_no = ${( parseInt(orderNo) - 1 )} AND active = 1`;

                //Step 1 : get the swap question page_no and order_no 
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionUp Step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: query.errorMessage }); }); return;}
        
                let queryResultRecordsetLength = query.result.recordset[0].length;
                let queryResultRecordset = query.result.recordset[0];
                let aboveQuestionId = queryResultRecordset.id;
                let abovePageNo = queryResultRecordset.page_no;
                let aboveOrderNo = queryResultRecordset.order_no;

                if(queryResultRecordsetLength === 0) transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: query.errorMessage }); });

                //step 2
                sqlStr = `UPDATE questions 
                          SET page_no = ${abovePageNo}, order_no = ${aboveOrderNo}, modified_at = GETDATE()
                          WHERE id = ${questionId}`;

                //Step 2 : page_no and order_no on current question = above question on the survey 
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionUp Step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: query.errorMessage }); }); return;}

                //step 3
                sqlStr = `UPDATE questions 
                          SET page_no = ${pageNo}, order_no = ${orderNo}, modified_at = GETDATE()
                          WHERE id = ${aboveQuestionId}`;

                //Step 3 : page_no and order_no on above question = current question on the survey 
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionUp Step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: query.errorMessage }); }); return;}

                //step 4
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveQuestionUp Step 4');
                if(error){ createSiteLog(siteAlias, 'designMoveQuestionUp step 4', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: error }); }); return; }

                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'designMoveQuestionUp transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: query.errorMessage }); }); return; }
                    
                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Moved Question Up'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designMoveQuestionUp', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Up', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designMoveQuestionUp', error);
        return res.json({
            status: false,
            message: 'Error Move Up',
            exception: error
        });
    }
};

export async function designMoveQuestionDown(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const pageNo = req.params.pageNo;
        const orderNo = req.params.orderNo;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designMoveQuestionDown', 'createTransaction'); return res.json({ status: false, message: 'Error Move The Question Down' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designMoveQuestionDown', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down' }); }); return; }

                //step 1
                let sqlStr = `SELECT id, page_no, order_no 
                              FROM questions 
                              WHERE survey_id = ${surveyId} AND order_no = ${( parseInt(orderNo) + 1 )} AND active = 1`;

                //Step 1 : get the swap question page_no and order_no 
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionDown Step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: query.errorMessage }); }); return;}
        
                let queryResultRecordsetLength = query.result.recordset[0].length;
                let queryResultRecordset = query.result.recordset[0];
                let belowQuestionId = queryResultRecordset.id;
                let belowPageNo = queryResultRecordset.page_no;
                let belowOrderNo = queryResultRecordset.order_no;

                if(queryResultRecordsetLength === 0) transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: query.errorMessage }); });
                        
                //step 2
                sqlStr = `UPDATE questions 
                          SET page_no = ${belowPageNo}, order_no = ${belowOrderNo}, modified_at = GETDATE()
                          WHERE id = ${questionId}`;

                //Step 2 : page_no and order_no on current question = below question on the survey 
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionDown Step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: query.errorMessage }); }); return;}

                //step 3
                sqlStr = `UPDATE questions 
                          SET page_no = ${pageNo}, order_no = ${orderNo}, modified_at = GETDATE()
                          WHERE id = ${belowQuestionId}`;

                //Step 3 : page_no and order_no on below question = current question on the survey 
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveQuestionDown Step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: query.errorMessage }); }); return;}

                //step 4
                const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveQuestionDown Step 4');
                if(error){ createSiteLog(siteAlias, 'designMoveQuestionDown step 4', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: error }); }); return; }
                                                    
                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'designMoveQuestionDown transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: query.errorMessage }); }); return; }
                    
                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Moved Question Down'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designMoveQuestionDown', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Move The Question Down', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designMoveQuestionDown', error);
        return res.json({
            status: false,
            message: 'Error Move Down'
        });
    }
};

export async function designCopyToQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const questionTypeId = parseInt(req.params.questionTypeId);
        const toPageNo = req.params.toPageNo;
        const toOrderNo = req.params.toOrderNo;
        const toPosition = req.params.toPosition;

        //after = 1 : OrderNoPosition = toOrderNo + 1, before = 0 : OrderNoPosition = toOrderNo
        const OrderNoPosition = parseInt(toPosition) === 1 ? parseInt(toOrderNo) + 1 : toOrderNo;

        const siteAlias = req.headers['x-site'];
    
        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designCopyToQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Copy The Question' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designCopyToQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question' }); }); return; }

                //step 1 
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no + 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no >= ${OrderNoPosition}`;

                //step 1 : increase order_no for the question that order_no more than or equal to OrderNoPosition
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}

                //step 2
                sqlStr = `SET IDENTITY_INSERT questions OFF
                          INSERT INTO questions ([survey_id], [page_no], [type_id], [question_label], [order_no], [required], [active], [required_label]) 
                          OUTPUT INSERTED.id
                          SELECT [survey_id], [page_no], [type_id], [question_label], [order_no], [required], [active], [required_label] FROM questions WHERE id = ${questionId}`;

                //step 2 : duplicate this current question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}

                let queryResultRecordset = query.result.recordset[0];
                let questionsInsertedId = queryResultRecordset.id;
                                
                //step 3
                let columnsValues = '';

                request.input(`page_no`, sql.SmallInt , toPageNo);
                columnsValues += `page_no = @page_no, `;

                request.input(`order_no`, sql.SmallInt , OrderNoPosition);
                columnsValues += `order_no = @order_no, `;

                sqlStr = `UPDATE questions 
                          SET ${columnsValues}
                          modified_at = GETDATE()
                          WHERE id = ${questionsInsertedId}`;

                //step 3 : update page_no and order_no to the inserted question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}
        
                //step 4
                let questionTypeTabelName : string = '';
                let questionAdditionColumnName : string = '';
                switch (questionTypeId) {
                    case 1: //rating
                        questionTypeTabelName = 'question_rating';
                        questionAdditionColumnName = ', [shape], [color], [show_label], [choice], [skip_logic], [show_comment_field], [comment_field_label], [comment_field_hint], [show_comment_field_logic], [show_comment_when_answer]';
                        break;
                    case 2: //multiple choice
                        questionTypeTabelName = 'question_choice';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [comment_field_label], [comment_field_hint], [show_comment_field_logic], [show_comment_when_answer]';
                        break;
                    case 3: //checkbox
                        questionTypeTabelName = 'question_checkbox';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [comment_field_label], [comment_field_hint], [show_comment_field_logic], [show_comment_when_answer]';
                        break;
                    case 4: //net promoter score
                        questionTypeTabelName = 'question_score';
                        questionAdditionColumnName = ', [show_label], [skip_logic], [show_comment_field], [comment_field_label], [comment_field_hint], [show_comment_field_logic], [show_comment_when_answer]';
                        break;
                    case 5: //text
                        questionTypeTabelName = 'question_text';
                        questionAdditionColumnName = ', [hint]';
                        break;
                    case 6: //dropdown
                        questionTypeTabelName = 'question_dropdown';
                        questionAdditionColumnName = ', [choice], [skip_logic], [show_comment_field], [comment_field_label], [comment_field_hint], [show_comment_field_logic], [show_comment_when_answer]';
                        break;
                    default:
                        transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question' }); });
                        return;
                }
                
                sqlStr = `SET IDENTITY_INSERT ${questionTypeTabelName} OFF
                          INSERT INTO ${questionTypeTabelName} ([survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName}) 
                          OUTPUT INSERTED.id 
                          SELECT [survey_id], [question_id], [analyze_entity], [analyze_sentiment], [image_enabled], [image_src_type], [image_name], [image_src], [image_description] ${questionAdditionColumnName} FROM ${questionTypeTabelName} WHERE question_id = ${questionId}`;

                //step 4 : duplicate this current question to question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}

                queryResultRecordset = query.result.recordset[0];
                let questionRatingInsertedId = queryResultRecordset.id;
                                                
                //step 5
                columnsValues = '';

                request.input(`question_id`, sql.SmallInt , questionsInsertedId);
                columnsValues += `question_id = @question_id, `;

                sqlStr = `UPDATE ${questionTypeTabelName} 
                          SET ${columnsValues}
                          modified_at = GETDATE() 
                          WHERE id = ${questionRatingInsertedId}`;

                //step 5 : update question_id to the inserted question in question type table
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 5', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}
                                                            
                //step 6
                sqlStr = `UPDATE surveys
                          SET num_question = num_question + 1, modified_at = GETDATE()
                          WHERE id = ${surveyId}`;

                //step 6 : set num_question +1 for the survey that the question moved
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designCopyToQuestion step 6', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: query.errorMessage }); }); return;}

                //step 7
                const error = await removeAllSkipLogicOnSurveyCopy(req, transaction, surveyId, 'designCopyToQuestion step 7');
                if(error){ createSiteLog(siteAlias, 'designCopyToQuestion step 7', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: error }); }); return; }


                transaction.commit(function(err: any) {
                    if(err){ createSiteLog(siteAlias, 'designCopyToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: err }); }); return; }

                    return res.json({
                        status: true,
                        result: query.result,
                        message: 'Question Copied'
                    });
                });
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designCopyToQuestion', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Copy The Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designCopyToQuestion', error);
        return res.json({
            status: false,
            message: 'Error Copy The Question'
        });
    }
};

export async function designMoveUpToQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const pageNo = req.params.pageNo;
        const orderNo = req.params.orderNo;
        const toPageNo = req.params.toPageNo;
        const toOrderNo = req.params.toOrderNo;
        const toPosition = req.params.toPosition;
        const oneOnPage = parseInt(req.params.oneOnPage) === 1 ? true : false;

        //after = 1 : OrderNoPosition = toOrderNo + 1, before = 0 : OrderNoPosition = toOrderNo
        const OrderNoPosition = parseInt(toPosition) === 1 ? parseInt(toOrderNo) + 1 : toOrderNo;

        const siteAlias = req.headers['x-site'];

        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designMoveUpToQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Move Up The Question' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designMoveUpToQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question' }); }); return; }

                //step 1
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no + 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no < ${orderNo} AND order_no >= ${OrderNoPosition}`;

                //Step 1 : decrease order_no for the question that order_no more than current question but no beyond than toOrderNo
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveUpToQuestion Step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: query.errorMessage }); }); return;}

                //step 2
                sqlStr = `UPDATE questions 
                          SET page_no = ${toPageNo}, order_no = ${OrderNoPosition}, modified_at = GETDATE() 
                          WHERE id = ${questionId}`;
        
                //Step 2 : set page_no and order_no to current question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveUpToQuestion Step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: query.errorMessage }); }); return;}

                //step 3
                if(oneOnPage){

                    sqlStr = `UPDATE surveys 
                              SET num_page = num_page - 1, modified_at = GETDATE() 
                              WHERE id = ${surveyId}`;

                    //Step 3 : set num_page -1 for the survey that the question moved
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designMoveUpToQuestion Step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: query.errorMessage }); }); return;}
                                             
                    //step 4  
                    sqlStr = `UPDATE questions 
                              SET page_no = page_no - 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND page_no > ${pageNo}`;
            
                    //Step 4 : set page_no - 1 for all question that more then current question
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designMoveUpToQuestion Step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: query.errorMessage }); }); return;}

                    //Step 5
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveUpToQuestion Step 5');
                    if(error){ createSiteLog(siteAlias, 'designMoveUpToQuestion Step 5', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: error }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designMoveUpToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: err }); }); return; }
    
                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Question Copied'
                        });
                    });
                }
                else{
                    //else
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveUpToQuestion else');
                    if(error){ createSiteLog(siteAlias, 'designMoveUpToQuestion else', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: error }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designMoveUpToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: err }); }); return; }
    
                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Question Copied'
                        });
                    });
                }
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designMoveUpToQuestion', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Up The Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designMoveUpToQuestion', error);
        return res.json({
            status: false,
            message: 'Error Move'
        });
    }
};

export async function designMoveDownToQuestion(req: Request, res: Response) {
    
    try{
        const surveyId = req.params.surveyId;
        const questionId = req.params.questionId;
        const pageNo = req.params.pageNo;
        const orderNo = req.params.orderNo;
        const toPageNo = req.params.toPageNo;
        const toOrderNo = req.params.toOrderNo;
        const toPosition = req.params.toPosition;
        const oneOnPage = parseInt(req.params.oneOnPage) === 1 ? true : false;

        //after = 1 : OrderNoPosition = toOrderNo + 1, before = 0 : OrderNoPosition = toOrderNo
        const OrderNoPosition = parseInt(toPosition) === 1 ? parseInt(toOrderNo) : parseInt(toOrderNo) - 1;

        const siteAlias = req.headers['x-site'];
    
        const transaction = await createTransaction(req) as any;
        if(!transaction){ createSiteLog(siteAlias, 'designMoveDownToQuestion', 'createTransaction'); return res.json({ status: false, message: 'Error Move Down The Question' }); }
        transaction.begin().then(async function () {
            try {
                const request = await createRequest(req, transaction) as any;
                if(!request){ createSiteLog(siteAlias, 'designMoveDownToQuestion', 'createRequest'); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question' }); }); return; }

                //step 1
                let sqlStr = `UPDATE questions 
                              SET order_no = order_no - 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND order_no > ${orderNo} AND order_no <= ${OrderNoPosition}`;

                //Step 1 : decrease order_no for the question that order_no more than current question but no beyond than toOrderNo
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveDownToQuestion step 1', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: query.errorMessage }); }); return;}
                        
                //step 2
                sqlStr = `UPDATE questions 
                          SET page_no = ${toPageNo}, order_no = ${OrderNoPosition}, modified_at = GETDATE() 
                          WHERE id = ${questionId}`;
        
                //Step 2 : set page_no and order_no to current question
                query = await requestQuery(request, sqlStr) as any;
                if(query.error){ createSiteLog(siteAlias, 'designMoveDownToQuestion step 2', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: query.errorMessage }); }); return;}

                //step 3
                if(oneOnPage){
                    sqlStr = `UPDATE surveys 
                              SET num_page = num_page - 1, modified_at = GETDATE() 
                              WHERE id = ${surveyId}`;

                    //Step 3 : set num_page -1 for the survey that the question moved
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designMoveDownToQuestion step 3', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: query.errorMessage }); }); return;}
                        
                    //step 4
                    sqlStr = `UPDATE questions 
                              SET page_no = page_no - 1, modified_at = GETDATE() 
                              WHERE survey_id = ${surveyId} AND active = 1 AND page_no > ${pageNo}`;
            
                    //Step 4 : set page_no - 1 for all question that more then current question
                    query = await requestQuery(request, sqlStr) as any;
                    if(query.error){ createSiteLog(siteAlias, 'designMoveDownToQuestion step 4', query.errorMessage); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: query.errorMessage }); }); return;}

                    //step 5
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveDownToQuestion step 5');
                    if(error){ createSiteLog(siteAlias, 'designMoveDownToQuestion step 5', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: error }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designMoveDownToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: err }); }); return; }
    
                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Question Copied'
                        });
                    });
                }
                else{
                    //else 
                    const error = await removeAllSkipLogicOnSurvey(req, request, surveyId, 'designMoveDownToQuestion else');
                    if(error){ createSiteLog(siteAlias, 'designMoveDownToQuestion else', error); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: error }); }); return; }

                    transaction.commit(function(err: any) {
                        if(err){ createSiteLog(siteAlias, 'designMoveDownToQuestion transaction.commit', err); transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: err }); }); return; }
    
                        return res.json({
                            status: true,
                            result: query.result,
                            message: 'Moved Down The Question'
                        });
                    });
                }
            }
            catch(error){
                createSiteLog(req.headers['x-site'], 'designMoveDownToQuestion', error);
                transaction.rollback(function() { return res.json({ status: false, message: 'Error Move Down The Question', exception: error }); });
            }
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'designMoveDownToQuestion', error);
        return res.json({
            status: false,
            message: 'Error Move Down'
        });
    }
};

async function requestQueryUpdateSkipLogic(request: any, sqlStr: any, query: any, tableName: any){
    return new Promise(async (resolve, reject) => {

        const queryResultRecordset = query.result.recordset;
        const queryResultRecordsetLength = query.result.recordset.length;

        for(let index = 0; index < queryResultRecordsetLength; index++){
            const data = queryResultRecordset[index];

            //Find the number of choice for Multiple Choice with divide 3 because one skip logic has 3 digit [choice_answer_weight, to_page_no, to_question_no]
            const choiceNum = data.skip_logic.split(',').length / 3;

            let skipLoicStrArr = [];
            for(let i = 1 ; i <= choiceNum; i++) skipLoicStrArr.push(`${i},0,0`);
            const clearSkipLoicStr = skipLoicStrArr.join(',');

            sqlStr = `UPDATE ${tableName} SET skip_logic = '${clearSkipLoicStr}' WHERE id = ${data.id}`;
            query = await requestQuery(request, sqlStr);

            if(query.error){ createSiteLog(request.headers['x-site'], 'requestQueryUpdateSkipLogic', query.errorMessage); resolve({ error: true, errorMessage: query.error }); }
        }
        
        resolve({ error: false });//Success
    });
}

export async function removeAllSkipLogicOnSurvey(req: Request, request: any, surveyId: any, methodName: any) {
    
    try {
        //Global variables
        let query: any, sqlStr, tableName;

        //Rating
        tableName = 'question_rating';
        sqlStr = `UPDATE ${tableName} SET skip_logic = '1,0,0,2,0,0,3,0,0,4,0,0,5,0,0' WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Rating`, query.errorMessage); return query.errorMessage; }

        //Score
        tableName = 'question_score';
        sqlStr = `UPDATE ${tableName} SET skip_logic = '0,5,0,0,6,8,0,0,9,10,0,0' WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Score`, query.errorMessage); return query.errorMessage; }

        //Choice
        tableName = 'question_choice';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Choice`, query.errorMessage); return query.errorMessage; }

        //Choice requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Choice requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        //Checkbox
        tableName = 'question_checkbox';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Checkbox`, query.errorMessage); return query.errorMessage; }

        //Checkbox requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Checkbox requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        //Dropdown
        tableName = 'question_dropdown';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Dropdown`, query.errorMessage); return query.errorMessage; }

        //Dropdown requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurvey ${methodName} Dropdown requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        return false;

    }catch(error){ 
        createSiteLog(req.headers['x-site'], 'removeAllSkipLogicOnSurvey', error);
        return error; 
    }
}

export async function removeAllSkipLogicOnSurveyCopy(req: any, transaction: any, surveyId: any, methodName: any) {
    
    try {
        //Global variables
        let query: any, sqlStr, tableName;

        const request = await createRequest(req, transaction) as any;
        if(!request) return 'removeAllSkipLogicOnSurveyCopy createRequest';
        //Rating
        tableName = 'question_rating';
        sqlStr = `UPDATE ${tableName} SET skip_logic = '1,0,0,2,0,0,3,0,0,4,0,0,5,0,0' WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Rating`, query.errorMessage); return query.errorMessage; }

        //Score
        tableName = 'question_score';
        sqlStr = `UPDATE ${tableName} SET skip_logic = '0,5,0,0,6,8,0,0,9,10,0,0' WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Score`, query.errorMessage); return query.errorMessage; }

        //Choice
        tableName = 'question_choice';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Choice`, query.errorMessage); return query.errorMessage; }

        //Choice requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Choice requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        //Checkbox
        tableName = 'question_checkbox';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Checkbox`, query.errorMessage); return query.errorMessage; }

        //Checkbox requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Checkbox requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        //Dropdown
        tableName = 'question_dropdown';
        sqlStr = `SELECT id, skip_logic FROM ${tableName} WHERE survey_id = ${surveyId}`;
        query = await requestQuery(request, sqlStr);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Dropdown`, query.errorMessage); return query.errorMessage; }

        //Dropdown requestQueryUpdateSkipLogic
        query = await requestQueryUpdateSkipLogic(request, sqlStr, query, tableName);
        if(query.error){ createSiteLog(req.headers['x-site'], `removeAllSkipLogicOnSurveyCopy ${methodName} Dropdown requestQueryUpdateSkipLogic`, query.errorMessage); return query.errorMessage; }

        return false;
                
    }catch(error){
        createSiteLog(req.headers['x-site'], 'removeAllSkipLogicOnSurveyCopy', error);
        return error;
    }
}