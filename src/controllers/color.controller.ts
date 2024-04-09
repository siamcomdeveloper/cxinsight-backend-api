import { Request, Response } from 'express'
import { createRequest, requestQuery, createSiteLog } from "../database";
import * as sql from 'mssql';

export async function getColors(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];
        
        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getColors', 'createRequest'); return res.json({ status: false, message: 'Error Get Colors' }); }

        const sqlStr = `SELECT c.hex_code
                        FROM colors as c
                        WHERE c.active = 1
                        ORDER BY c.order_no`;
        
        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getColors', query.errorMessage); return res.json({ status: false, message: 'Error Get Colors', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Got All Colors' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getColors', error);
        return res.json({ status: false, message: 'Error Get Color', exception: error });
    }
};

export async function addCustomColor(req: Request, res: Response){
    
    try {
        const customColorData = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'addCustomColor', 'createRequest'); return res.json({ status: false, message: 'Error Add A New Custom Color' }); }

        request.input('hex_code', sql.VarChar, customColorData.hex_code);
        request.input('order_no', sql.SmallInt, customColorData.order_no);

        const sqlStr = `INSERT INTO colors (hex_code, order_no) 
                        OUTPUT INSERTED.id
                        VALUES (@hex_code, @order_no)`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'addCustomColor', query.errorMessage); return res.json({ status: false, message: 'Error Add A New Custom Color', exception: query.errorMessage }); }

        return res.json({ status: true, result: query.result, message: 'Added A New Custom Color' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'createAnswer', error);
        return res.json({ status: false, message: 'Error Add A New Custom Color', exception: error });
    }
}