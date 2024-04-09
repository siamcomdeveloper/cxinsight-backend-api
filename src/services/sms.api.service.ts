// import Response from "response";
import axios from "axios";
import RequestResponse from "./request.response";
import * as dotenv from "dotenv";
dotenv.config();

export default class SmsAPIService {

    public static getCredit(apiKey: any, secretKey: any): Promise<RequestResponse> {

        const baseURL: string = "https://portal-otp.smsmkt.com/api/get-credit";

        axios.defaults.headers = {
            'Content-Type' : 'application/json',
            'api_key' : `${apiKey}`,
            'secret_key' : `${secretKey}`,
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.get(baseURL)
            .then(function (response) {
                return new RequestResponse(response.data.status, response.data, "Got SMS Credit", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error getCredit API", error);
            });

        return res;
    }

    public static sendSMS(data: any, apiKey: any, secretKey: any): Promise<RequestResponse> {

        const baseURL: string = "https://portal-otp.smsmkt.com/api/send-message";

        axios.defaults.headers = {
            'Content-Type' : 'application/json',
            'api_key' : `${apiKey}`,
            'secret_key' : `${secretKey}`,
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.post(baseURL, data)
            .then(function (response) {
                return new RequestResponse(true, response.data, "Send SMS", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error Send SMS API", error);
            });

        return res;
    }

    public static sendSMSInfobip(data: any, apiKey: any): Promise<RequestResponse> {

        const baseURL: string = "https://api.infobip.com/sms/1/text/single";

        axios.defaults.headers = {
            'Authorization' : `App ${apiKey}`,
            'Content-Type' : 'application/json',
            'Accept' : 'application/json',
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.post(baseURL, data)
            .then(function (response) {
                return new RequestResponse(true, response.data, "Send SMS", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error Send SMS API", error);
            });

        return res;
    }
    
    public static bitlyShorten(longUrl: any, accessToken: any): Promise<RequestResponse> {

        const baseURL: string = "https://api-ssl.bitly.com/v4/shorten";

        axios.defaults.headers = {
            'Host' : 'api-ssl.bitly.com',
            'Content-Type' : 'application/json',
            'Authorization' : `Bearer ${accessToken}`,
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.post(baseURL, longUrl)
            .then(function (response) {
                return new RequestResponse(true, response.data, "Got bitly Shorten URL", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error bitly Shorten URL", error);
            });

        return res;
    }

}