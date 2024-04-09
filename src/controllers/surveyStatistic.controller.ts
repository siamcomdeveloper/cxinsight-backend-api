import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog } from "../database";

export async function getSurveysStatistic(req: Request, res: Response) {

    try {
        const user = req.user as any;
        const siteAlias = req.headers['x-site'];
        
        let responsibleSurveyIdStr = '';
        let sqlWhereSurveyIdInStr = '';
        if( [0,2,3].includes(user.role_id)){//For Creators and Subcribers
            if(user.responsible_survey_id) if(user.responsible_survey_id.includes('/')) responsibleSurveyIdStr = '(' + user.responsible_survey_id.split('/').map((entity: any, i: any) => { return entity; }).join(',') + ')';
            else responsibleSurveyIdStr = `(${user.responsible_survey_id})`;
            sqlWhereSurveyIdInStr = responsibleSurveyIdStr ? `AND s.id IN ${responsibleSurveyIdStr}` : `AND s.id IN (0)`;
        }

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getSurveysStatistic', 'createRequest'); return res.json({ status: false, message: 'Erorr Get Survey Statistic' }); } 

        const sqlStr = `SELECT COUNT(*) as draftsv FROM surveys as s WHERE status = 1 and active = 1 ${sqlWhereSurveyIdInStr} GROUP BY status 
                        SELECT COUNT(*) as opensv FROM surveys as s WHERE status = 2 and active = 1 ${sqlWhereSurveyIdInStr} GROUP BY status 
                        SELECT SUM(total_responses) AS total_responses, AVG(completion_rate) AS completion_rate, AVG(time_spent) AS time_spent FROM surveys as s WHERE status IN (2,3) and active = 1 ${sqlWhereSurveyIdInStr};
                        SELECT COUNT(*) as total_clicked FROM responses as r LEFT JOIN surveys as s ON r.survey_id = s.id WHERE s.active = 1 ${sqlWhereSurveyIdInStr} and r.active = 1 and r.complete_status in (2,3)
                        SELECT COUNT(*) as total_completed FROM responses as r LEFT JOIN surveys as s ON r.survey_id = s.id WHERE s.active = 1 ${sqlWhereSurveyIdInStr} and r.active = 1 and r.complete_status in (3)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getSurveysStatistic', query.errorMessage); return res.json({ status: false, message: 'Erorr Get Survey Statistic', exception: query.errorMessage }); }

        return res.status(200).json(query.result);

    } catch(error){
        createSiteLog(req.headers['x-site'], 'getSurveysStatistic', error);
        return res.json(error);
    }
};