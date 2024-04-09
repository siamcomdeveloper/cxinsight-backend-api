import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog } from "../database";

export async function getProjects(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getProjects', 'createRequest'); return res.json({ status: false, message: 'Error Get Projects' }); }

        const sqlStr = `SELECT p.id, p.name 
                        FROM projects as p 
                        WHERE active = 1
                        ORDER BY p.id ASC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getProjects', query.errorMessage); return res.json({ status: false, message: 'Error Get Projects', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getProjects', error);
        return res.json(error);
    }
};