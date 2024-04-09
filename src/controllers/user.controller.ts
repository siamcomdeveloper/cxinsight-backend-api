import { Request, Response } from "express";
import { createRequest, requestQuery, createSiteLog } from "../database";
import * as sql from 'mssql';

export async function getUsers(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getUsers', 'createRequest'); return res.json({ status: false, message: 'Error Get Users' }); } 
        
        const sqlStr = `SELECT u.* 
                        FROM users as u 
                        WHERE u.active = 1
                        ORDER BY u.modified_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getUsers', query.errorMessage); return res.json({ status: false, message: 'Error Get Users', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
        });
    } 
    catch(error){
        createSiteLog(req.headers['x-site'], 'getUsers', error);
        return res.json(error);
    }
};

export async function getUser(req: Request, res: Response) {
    
    try{
        const userId = req.params.userId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'getUser', 'createRequest'); return res.json({ status: false, message: 'Error Get An User' }); } 

        const sqlStr = `SELECT u.* 
                        FROM users as u 
                        WHERE u.active = 1 AND u.id = ${userId}
                        ORDER BY u.modified_at DESC`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getUser', query.errorMessage); return res.json({ status: false, message: 'Error Get An User', exception: query.errorMessage }); }

        const user = query.result.recordset[0];
        delete user.password;
        
        return res.json({
            status: true,
            result: user,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getUser', error);
        return res.json(error);
    }
};

export async function deleteUser(req: Request, res: Response) {
    
    try{
        const id = req.params.smsId;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'deleteUser', 'createRequest'); return res.json({ status: false, message: 'Error Delete User' }); } 

        const sqlStr = `UPDATE smses
                        SET active = 0, deleted_at = GETDATE() 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'deleteUser', query.errorMessage); return res.json({ status: false, message: 'Error Delete User', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
            message: 'User deleted'
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'deleteUser', error);
        return res.json(error);
    }
}

export async function updateUser(req: Request, res: Response) {
    
    try {
        const id = req.params.userId;
        const updateUser = req.body;
        const siteAlias = req.headers['x-site'];

        const request = await createRequest(req) as any;
        if(!request){ createSiteLog(siteAlias, 'updateUser', 'createRequest'); return res.json({ status: false, message: 'Error Update A User' }); } 

        let columnsValues = '';
        for (const key in updateUser) {
            if(['role_id', 'approved'].includes(key)){
                request.input(`${key}`, sql.SmallInt, updateUser[key]);
                columnsValues += `${key} = @${key}, `;
            }
            else if(['mobile_number', 'responsible_survey_id'].includes(key)){
                request.input(key, sql.VarChar, updateUser[key]);
                columnsValues += `${key} = @${key}, `;
            }
            else if(['title', 'first_name', 'last_name', 'company_name'].includes(key)){
                request.input(key, sql.NVarChar, updateUser[key]);
                columnsValues += `${key} = @${key}, `;
            }
        }

        const sqlStr = `UPDATE users 
                        SET ${columnsValues}
                        modified_at = GETDATE() 
                        WHERE id = ${id}`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'updateUser', query.errorMessage); return res.json({ status: false, message: 'Error Update A User', exception: query.errorMessage }); }

        return res.json({
            status: true,
            result: query.result,
            message: 'User Updated'
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'updateUser', error);
        return res.json(error);
    }
};