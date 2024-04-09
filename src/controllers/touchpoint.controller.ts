import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog, createPortalRequest } from "../database";

export async function getTouchpoints(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        
        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getTouchpoints', 'createPortalRequest'); return res.json({ status: false, message: 'Error getTouchpoints createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getTouchpoints createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getTouchpoints createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];
        if(queryResultRecordsetPortal){

            const typeAlias = queryResultRecordsetPortal.business_type_alias;

            const request = await createRequest(req) as any;
            if(!request){ createSiteLog(siteAlias, 'getTouchpoints', 'createRequest'); return res.json({ status: false, message: 'Error Get Touchpoints' }); } 
            
            const sqlStr = `SELECT t.* 
                            FROM ${typeAlias}_touchpoints as t
                            ORDER BY t.id ASC`;

            const query = await requestQuery(request, sqlStr) as any;
            if(query.error){ createSiteLog(siteAlias, 'getTouchpoints', query.errorMessage); return res.json({ status: false, message: 'Error Get Touchpoints', exception: query.errorMessage }); }

            return res.json({
                status: true,
                result: query.result,
            });
        }
        else{
            createSiteLog(siteAlias, `getTouchpoints`, 'The site is not found');
            return res.json({ status: false, message: `else getTouchpoints`, exception: "The site is not found" });
        }
        
    } catch(error){
        createSiteLog(req.headers['x-site'], 'getTouchpoints', error);
        return res.json(error);
    }
};