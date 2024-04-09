// import Response from "response";
import axios from "axios";
import RequestResponse from "./request.response";
import * as dotenv from "dotenv";
dotenv.config();

export default class GoogleAPIService {

    public static getGoogleNaturalLanguageAPI(url: string, googleApiKey: string, obj: JSON): Promise<RequestResponse> {

        let baseURL: string = "https://language.googleapis.com/v1/documents:";

        axios.defaults.headers = {
            'Accept': 'application/json',
            'Content-Type' : 'application/json',
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.post(baseURL + url + `?key=${googleApiKey}`, obj)
            .then(function (response) {
                return new RequestResponse(true, response.data, "Got Google Natural Language API", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error Google Natural Language API", error);
            });

        return res;
    }
    
    public static getGoogleTranslationAPI(url: string, googleApiKey: string, obj: JSON): Promise<RequestResponse> {

        let baseURL: string = "https://translation.googleapis.com/language/translate/v2/";

        axios.defaults.headers = {
            'Accept': 'application/json',
            'Content-Type' : 'application/json',
            'rem-api-username' : '',
            'rem-api-password' : '',
            'rem-api-secretkey' : ''
        }

        let res = axios.post(baseURL + url + `?key=${googleApiKey}`, obj)
            .then(function (response) {
                return new RequestResponse(true, response.data, "Got Translation API", '');
            })
            .catch(function (error) {
                return new RequestResponse(false, null, "Error GoogleTranslation API", error);
            });

        return res;
    }

    public static verifyGoogleReCaptcha(clientSideKey: any): Promise<RequestResponse> {

        const siteVerifyUrl = 'https://www.google.com/recaptcha/api/siteverify';

        const postParams = {
            'secret': process.env.reCAPTCHA,
            'response' : clientSideKey
        }

        const urlParams = new URLSearchParams(Object.entries(postParams)).toString();
        
        const config = {
            headers: {
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/x-www-form-urlencoded',
                'rem-api-username' : '',
                'rem-api-password' : '',
                'rem-api-secretkey' : ''
            }
        };
          
        let res = axios.post(siteVerifyUrl, urlParams, config)
        .then(function (response) {
            return new RequestResponse(true, response.data, `verify Google ReCaptcha successfully`, '');
        })
        .catch(function (error) {
            return new RequestResponse(false, null, `Error to verify Google ReCaptcha`, error);
        });

        return res;
    }

}