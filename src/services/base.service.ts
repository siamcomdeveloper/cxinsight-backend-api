// import Response from "response";
import axios from "axios";
import RequestResponse from "./request.response";
import * as dotenv from "dotenv";
dotenv.config();

export default class BaseService {

    public static getFromUrl(url: string, obj: any): Promise<RequestResponse> {

        let res = axios.get(url, obj)
        .then(response => {
            return new RequestResponse(response.data.status, response.data, `get from ${url} successfully`, '');
        })
        .catch(function (error) {
            return new RequestResponse(false, null, `get from ${url} error`, '');
        });

        return res;
        
    }

    public static postToUrl(url: string, obj: any): Promise<RequestResponse> {

        let res = axios.post(url, obj)
        .then(function (response) {
            return new RequestResponse(true, response.data, `post to ${url} successfully`, '');
        })
        .catch(function (error) {
            return new RequestResponse(false, null, `post to ${url} error`, error);
        });

        return res;
    }

    public static getRemData(method: any, urlApi: any, username: any, password: any, secretKey: any, data: any): Promise<RequestResponse> {

        axios.defaults.headers = {
            'Content-Type' : 'application/json',
            'rem-api-username' : `${username}`,
            'rem-api-password' : `${password}`,
            'rem-api-secretkey' : `${secretKey}`
        }

        let res;

        if(method === 'GET'){

            res = axios.get(urlApi, { data: data })
                .then(function (response) {
                    return new RequestResponse(true, response.data, "Got REM Data", '');
                })
                .catch(function (error) {
                    return new RequestResponse(false, null, "Error Get REM Data", error);
                });
        }
        else{
            res = axios.post(urlApi, data)
                .then(function (response) {
                    return new RequestResponse(true, response.data, "Got REM Data", '');
                })
                .catch(function (error) {
                    return new RequestResponse(false, null, "Error Get REM Data", error);
                });
        }

        return res;
    }

}