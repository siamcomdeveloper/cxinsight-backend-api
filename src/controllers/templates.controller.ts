import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";

export async function getTemplates(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        
        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getTemplates', 'createPortalRequest'); return res.json({ status: false, message: 'Error getTemplates createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getTemplates createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getTemplates createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];
        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getTemplates', 'createRequest'); return res.json({ status: false, message: 'Error Get Templates' }); } 

            const sqlStr = `SELECT t.*
                            FROM ${typeAlias}_question_templates as t
                            ORDER BY t.id ASC`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getTemplates', query.errorMessage); return res.json({ status: false, message: 'Error Get Templates', exception: query.errorMessage }); }

            return res.json({
                status: true,
                result: query.result,
                type: typeAlias
            });
        }
        else{
            createSiteLog(siteAlias, `getTemplates`, 'The site is not found');
            return res.json({ status: false, message: `else getTemplates`, exception: "The site is not found" });
        }

    } catch(error){
        createSiteLog(req.headers['x-site'], 'getTemplates', error);
        return res.json(error);
    }
};

export async function getTouchpointAreaOfImpact(req: Request, res: Response) {

    try{
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getTouchpointAreaOfImpact', 'createPortalRequest'); return res.json({ status: false, message: 'Error getTouchpointAreaOfImpact createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getTouchpointAreaOfImpact createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getTouchpointAreaOfImpact createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];
        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getTouchpointAreaOfImpact', 'createRequest'); return res.json({ status: false, message: 'Error Get A Touchpoint' }); } 

            const sqlStr = `SELECT 
                            TOP 1 *,
                            ( SELECT COUNT(p.id) FROM projects as p ) AS num_projects,
                            ( SELECT COUNT(t.id) FROM ${typeAlias}_touchpoints as t ) AS num_touchpoints,
                            ( SELECT COUNT(ar.id) FROM ${typeAlias}_area_of_impacts as ar ) AS num_area_of_impacts,
                            STUFF(( select ',' + name  from projects FOR XML PATH('')),1,1,'') AS name_projects,
                            STUFF(( select ',' + name  from ${typeAlias}_touchpoints FOR XML PATH('')),1,1,'') AS name_touchpoints,
                            STUFF(( select ',' + name  from ${typeAlias}_area_of_impacts FOR XML PATH('')),1,1,'') AS name_area_of_impacts 
                            FROM surveys AS s 
                            WHERE s.active = 1`;

            console.log(sqlStr);
            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getTouchpointAreaOfImpact', query.errorMessage); return res.json({ status: false, message: 'Error Get A Touchpoint', exception: query.errorMessage }); }

            return res.json({
                status: true,
                result: query.result,
                message: 'Got Touchpoints and AreaOfImpacts Details'
            });
        }
        else{
            createSiteLog(siteAlias, `getTouchpointAreaOfImpact`, 'The site is not found');
            return res.json({ status: false, message: `else getTouchpointAreaOfImpact`, exception: "The site is not found" });
        }

    } catch(error){
        createSiteLog(req.headers['x-site'], 'getTouchpointAreaOfImpact', error);
        return res.json({
            status: false,
            message: 'Error to get Touchpoints and AreaOfImpacts Details',
            exception: error
        });
    }
};