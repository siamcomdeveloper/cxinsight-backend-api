import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog } from "../database";

export async function getBackgrounds(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getBackgrounds', 'createRequest'); return res.json({ status: false, message: 'Error Get backgrounds' }); }

        const sqlStr = `SELECT *
                        FROM background_images as b
                        WHERE b.active = 1
                        ORDER BY b.order_no`;
        
        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getBackgrounds', query.errorMessage); return res.json({ status: false, message: 'Error Get backgrounds', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Got All backgrounds' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getBackgrounds', error);
        return res.json({ status: false, message: 'Error Get backgrounds', exception: error });
    }
};