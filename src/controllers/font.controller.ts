import { Request, Response } from 'express'
import { createRequest, requestQuery, createSiteLog } from "../database";

export async function getFonts(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getFonts', 'createRequest'); return res.json({ status: false, message: 'Error Get Colors' }); }

        const sqlStr = `SELECT *
                        FROM fonts as f
                        WHERE f.active = 1
                        ORDER BY f.order_no`;
        
        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getFonts', query.errorMessage); return res.json({ status: false, message: 'Error Get Fonts', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Got All Fonts' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getFonts', error);
        return res.json({ status: false, message: 'Error Get Fonts', exception: error });
    }
};