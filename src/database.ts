import * as sql from 'mssql';
import * as dotenv from "dotenv";

//Intiial sql pools valibles
export let pool: sql.ConnectionPool;
export let pools = [] as any;

dotenv.config();

const hostname = process.env.HOST as string;
const user = process.env.DBUSER;
const password = process.env.DBPASSWORD;

export async function createPool(config: sql.config) {
    pool = await new sql.ConnectionPool({
        ...config,
        options: {
            encrypt: false,
            rowCollectionOnDone: true,
            useUTC: false,
            enableArithAbort: true
        }
    }).connect();
}

export function createPortalRequest(trans?: sql.Transaction) {
    if (trans == null) {
        return pool.request();
    }
    else {
        return new sql.Request(trans);
    }
}


export async function createSiteLog(siteAlias: any, methodName: any, errorMessage: any){
    
    try {
        const transaction = new sql.Transaction(pool);
        transaction.begin().then(async function () {
            try {
                const request = await createPortalRequest(transaction);
                if(!request){ transaction.rollback(function() { console.log('createSiteLog createPortalRequest rollback'); }); return false; }

                request.input(`site_alias`, sql.VarChar, siteAlias);
                request.input(`error_message`, sql.NVarChar, errorMessage);
                request.input(`method_name`, sql.VarChar, methodName);
                
                let sqlStr = `INSERT INTO sites_log (site_alias, error_message, method_name) 
                              OUTPUT INSERTED.id
                              VALUES (@site_alias, @error_message, @method_name)`;
        
                let query = await requestQuery(request, sqlStr) as any;
                if(query.error){ transaction.rollback(function() { console.log('createSiteLog requestQuery rollback'); }); return false; }

                transaction.commit(function(err) {
                    if(err) transaction.rollback(function() { console.log('createSiteLog requestQuery rollback'); });
                    return true;
                });
            }
            catch(error){
                return false;
            }
        });
    }
    catch(error){
        return false;
    }
}

export async function createRequest(req: any, trans?: sql.Transaction) {
    try {

        let alias = req.headers['x-site'];

        // Checking if the alias of the request site is 
        if(pools[alias]){
            if (trans == null) {
                return pools[alias].request();
            }
            else {
                return new sql.Request(trans);
            }
        }
        
        const request = pool.request();
        const sqlStr = `SELECT * 
                        FROM sites 
                        WHERE active = 1`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error) return query.errorMessage;

                    
        if(query.result.recordset.length){
            const site = query.result.recordset.filter((siteObj: any) => siteObj.alias === alias );

            //Get first
            alias = site[0].alias as any;
            const dbName = site[0].dbname as any;

            const config = {
                server: hostname,
                database: dbName,
                user: user,
                password: password
            }

            pools[alias] = await new sql.ConnectionPool({
                ...config,
                options: {
                    encrypt: false,
                    rowCollectionOnDone: true,
                    useUTC: false,
                    enableArithAbort: true
                }
            }).connect();

            //If success to create a new sql.ConnectionPool
            if(pools[alias]){
                if (trans == null) {
                    return pools[alias].request();
                }
                else {
                    return new sql.Request(trans);
                }
            }
            else{
                return 'No Site Name';
            }
        }

        return 'Invalid Site Name';
        
    }
    catch(error){
        return error;
    }
}

export async function createTransaction(req: any) {
    try {

        let alias = req.headers['x-site'];

        if(pools[alias]){
            return new sql.Transaction(pools[alias]);
        }
        else{
        }
        
        const request = pool.request();
        const sqlStr = `SELECT * 
                        FROM sites 
                        WHERE active = 1`;

        const query = await requestQuery(request, sqlStr) as any;
        if(query.error) return query.errorMessage;

                    
        if(query.result.recordset.length){
            const site = query.result.recordset.filter((siteObj: any) => siteObj.alias === alias );

            alias = site[0].alias as any;
            const dbName = site[0].dbname as any;

            const config = {
                server: hostname,
                database: dbName,
                user: user,
                password: password
            }

            pools[alias] = await new sql.ConnectionPool({
                ...config,
                options: {
                    encrypt: false,
                    rowCollectionOnDone: true,
                    useUTC: false,
                    enableArithAbort: true
                }
            }).connect();


            if(pools[alias]){
                return new sql.Transaction(pools[alias]);
            }
            else{
                return 'No Site Name';
            }
        }

        return 'Invalid Site Name';
        
    }
    catch(error){
        return error;
    }
}

export async function requestQuery(request: any, sqlStr: any){
    return new Promise(async (resolve, reject) => {
        await request.query(sqlStr, async (err: any, result: any) => {
            try{
                if(err) resolve({ error: true, result: result, errorMessage: err });
                resolve({ error: false, result: result, errorMessage: err });
            }catch(error){ 
                resolve({ error: true, result: result, errorMessage: error });
            }
        });
    });
}