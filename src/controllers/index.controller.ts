import { Request, Response } from 'express'
import { createSiteLog } from "../database";

export function indexWelcome (req: any, res: any): Response {
    return res.json('Welcome to cxm api');
}

export async function frontendLog(req: any, res: any){
    try {
        const siteAlias = req.headers['x-site'];
        if(siteAlias){
            const frontendLog = req.body;
            if(await createSiteLog(siteAlias, frontendLog.method, frontendLog.message)) return res.json({ status: true, message: 'Created Frontend Log' });
            else return res.json({ status: false, message: 'Error Create Frontend Log', exception: 'Error Create Frontend Log' });
        }
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'frontendLog catch', error);
        return res.json({ status: false, message: 'Error Create Frontend Log', exception: 'Error Create Frontend Log' });
    }
}