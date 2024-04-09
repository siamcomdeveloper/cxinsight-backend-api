import { Request, Response } from 'express'
import { requestQuery, createSiteLog, createPortalRequest } from "../database";
import BaseService from "../services/base.service";

export async function getEmployees(req: Request, res: Response) {

    try {
        const siteAlias = req.headers['x-site'];

        const requestPortal = await createPortalRequest();
        if(!requestPortal){ createSiteLog(siteAlias, 'getEmployees', 'createPortalRequest'); return res.json({ status: false, message: 'Error getEmployees createPortalRequest', exception: '' }); }

        let sqlStr = `SELECT s.*
                      FROM sites AS s 
                      WHERE s.active = 1 AND s.alias = '${siteAlias}'`;

        let query = await requestQuery(requestPortal, sqlStr) as any;
        if(query.error){ createSiteLog(siteAlias, 'getEmployees createPortalRequest SELECT', query.errorMessage); return res.json({ status: false, message: 'Error getEmployees createPortalRequest SELECT', exception: query.errorMessage }); }

        const queryResultRecordsetPortal = query.result.recordset[0];

        const url = queryResultRecordsetPortal.rem_api_link;
        const username = queryResultRecordsetPortal.rem_api_username;
        const password = queryResultRecordsetPortal.rem_api_password;
        const secretkey = queryResultRecordsetPortal.rem_api_secretkey;

        //Get master project data from the REM api
        const projectData = await BaseService.getRemData('POST', `${url}/Master/GetProject`, username, password, secretkey, '').then(
            async (rp: any) => {
                try{
                    if (rp.Status) {
                        return rp.Data.data;
                    } else {
                        return false;
                    }
                }
                catch(error){ createSiteLog(siteAlias, 'getEmployees BaseService.getRemData', error); return false;}
            }
        );

        let projectIds = [] as any;
        
        //Get project id from master project data
        projectData.map((project: any, index: any) => {
                projectIds.push(project.ProjectID);
        });

        //Get each REM employee user from project id
        let employees = [] as any;
        for(let i = 0; i < projectIds.length; i++){

            const employeeData = await BaseService.getRemData('GET', `${url}/user/userInProjectLoad?project=${projectIds[i]}`, username, password, secretkey, '').then(
                async (rp: any) => {
                    try{
                        if (rp.Status) {
                            return rp.Data.data;
                        } else {
                            return false;
                        }
                    }
                    catch(error){ createSiteLog(siteAlias, 'getEmployees BaseService.getRemData', error); return false;}
                }
            );

            if(employeeData.length){
                employeeData.map((employee: any, index: any) => {
                    employees.push(employee);
                });
            }
        }

        //Remove all duplicates REM employee user from an array of objects
        const uniqueEmployees = [...employees.reduce((map: any, obj: any) => map.set(obj.UserID, obj), new Map()).values()];

        return res.json({ status: true, result: uniqueEmployees, message: 'Got All Employees' });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'getEmployees', error);
        return res.json({ status: false, message: 'Error Get Employees', exception: error });
    }
};