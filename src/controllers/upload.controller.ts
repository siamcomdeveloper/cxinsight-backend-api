import { Request, Response } from "express";
import sharp from "sharp";
import sizeOf from "image-size";
import fs from "fs-extra";
import * as dotenv from "dotenv";
import { createSiteLog } from "../database";

dotenv.config();
const hostName = process.env.DOMAIN_NAME_BACKEND;

export async function uploadImage(req: any, res: Response) {

    try {
        let currentFileName = req.file.filename.split('.')[0];
        let currentFileType = '.'+req.file.filename.split('.')[1];

        let path = `${hostName}/images/${req.headers['x-site']}/images/${currentFileName}${currentFileType}`;

        const publicPath = `public/images/${req.headers['x-site']}/images`;

        let newResizeFileName = '';
        let newQualityFileName = '';

        const imageInfo = await asPromiseFsReadFile(req, currentFileName, currentFileType, publicPath, res) as any;

        //jpeg image process
        if(currentFileType === '.jpeg'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){
                
                let errSharp = await asPromiseSharpResizeJpeg(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/images/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityJpeg(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityJpeg(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/images/${newQualityFileName}${currentFileType}`;
            }
        }
        //png image process
        else if(currentFileType === '.png'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){

                let errSharp = await asPromiseSharpResizePng(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/images/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityPng(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityPng(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/images/${newQualityFileName}${currentFileType}`;
            }
        }
        
        return res.json({
            name: req.file.originalname,
            status: "done",
            url: path,
            thumbUrl: path,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'uploadImage', error);
        return res.json(error);
    }
};

export async function uploadBg(req: any, res: Response) {

    try {
        let currentFileName = req.file.filename.split('.')[0];
        let currentFileType = '.'+req.file.filename.split('.')[1];

        let path = `${hostName}/images/${req.headers['x-site']}/bg/${currentFileName}${currentFileType}`;

        const publicPath = `public/images/${req.headers['x-site']}/bg`;

        let newResizeFileName = '';
        let newQualityFileName = '';

        const imageInfo = await asPromiseFsReadFile(req, currentFileName, currentFileType, publicPath, res) as any;

        //jpeg image process
        if(currentFileType === '.jpeg'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){

                let errSharp = await asPromiseSharpResizeJpeg(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/bg/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityJpeg(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityJpeg(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/bg/${newQualityFileName}${currentFileType}`;
            }
        }
        //png image process
        else if(currentFileType === '.png'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){

                let errSharp = await asPromiseSharpResizePng(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/bg/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityPng(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityPng(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/bg/${newQualityFileName}${currentFileType}`;
            }
        }

        return res.json({
            name: req.file.originalname,
            status: "done",
            url: path,
            thumbUrl: path,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'uploadBg', error);
        return res.json(error);
    }

};

export async function uploadConsent(req: any, res: Response) {

    try {
        let currentFileName = req.file.filename.split('.')[0];
        let currentFileType = '.'+req.file.filename.split('.')[1];

        let path = `${hostName}/images/${req.headers['x-site']}/consent/${currentFileName}${currentFileType}`;

        const publicPath = `public/images/${req.headers['x-site']}/consent`;

        let newResizeFileName = '';
        let newQualityFileName = '';

        const imageInfo = await asPromiseFsReadFile(req, currentFileName, currentFileType, publicPath, res) as any;
        
        //jpeg image process
        if(currentFileType === '.jpeg'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){

                let errSharp = await asPromiseSharpResizeJpeg(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/consent/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityJpeg(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityJpeg(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/consent/${newQualityFileName}${currentFileType}`;
            }
        }
        //png image process
        else if(currentFileType === '.png'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 1024 pixel or height > 1024
            if(imageInfo.width > 1024 || imageInfo.height > 1024){

                let errSharp = await asPromiseSharpResizePng(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/consent/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 500k
            if(req.file.size > (500 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityPng(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityPng(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/consent/${newQualityFileName}${currentFileType}`;
            }
        }
        
        return res.json({
            name: req.file.originalname,
            status: "done",
            url: path,
            thumbUrl: path,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'uploadBg', error);
        return res.json(error);
    }

};

export async function uploadLogoBanner(req: any, res: Response) {

    try {
        let currentFileName = req.file.filename.split('.')[0];
        let currentFileType = '.'+req.file.filename.split('.')[1];

        let path = `${hostName}/images/${req.headers['x-site']}/logo_banner/${currentFileName}${currentFileType}`;

        const publicPath = `public/images/${req.headers['x-site']}/logo_banner`;

        let newResizeFileName = '';
        let newQualityFileName = '';

        const imageInfo = await asPromiseFsReadFile(req, currentFileName, currentFileType, publicPath, res) as any;
        
        //jpeg image process
        if(currentFileType === '.jpeg'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 2048 pixel or height > 2048
            if(imageInfo.width > 2048 || imageInfo.height > 2048){

                let errSharp = await asPromiseSharpResizeJpeg2048(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/logo_banner/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 1m
            if(req.file.size > (1000 * 1000)){

                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityJpeg80(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityJpeg80(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/logo_banner/${newQualityFileName}${currentFileType}`;
            }
        }
        //png image process
        else if(currentFileType === '.png'){

            newResizeFileName = Date.now().toString();

            //Resize the image file which the resolution is more than width > 2048 pixel or height > 2048
            if(imageInfo.width > 2048 || imageInfo.height > 2048){

                let errSharp = await asPromiseSharpResizePng2048(req, currentFileName, currentFileType, newResizeFileName, publicPath, 'currentFileName resized!');
                if(errSharp){ return res.json({ status: false, message: errSharp }); }

                const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName resizing removed!');
                if(errUnlink){ return res.json({ status: false, message: errUnlink }); }

                currentFileName = '';
                
                path = `${hostName}/images/${req.headers['x-site']}/logo_banner/${newResizeFileName}${currentFileType}`;
            }

            //Reduce the image quality which the file size if more then 1m
            if(req.file.size > (500 * 1000)){
                
                newQualityFileName = Date.now().toString();

                if(currentFileName){
                    let errSharp = await asPromiseSharpQualityPng80(req, currentFileName, currentFileType, newQualityFileName, publicPath, 'currentFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, currentFileName, currentFileType, publicPath, 'currentFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }
                else{
                    let errSharp = await asPromiseSharpQualityPng80(req, newResizeFileName, currentFileType, newQualityFileName, publicPath, 'newResizeFileName quality!');
                    if(errSharp){ return res.json({ status: false, message: errSharp }); }

                    const errUnlink = await asPromiseFsUnlink(req, newResizeFileName, currentFileType, publicPath, 'newResizeFileName quality removed!');
                    if(errUnlink){ return res.json({ status: false, message: errUnlink }); }
                }

                path = `${hostName}/images/${req.headers['x-site']}/logo_banner/${newQualityFileName}${currentFileType}`;
            }
        }
        
        return res.json({
            name: req.file.originalname,
            status: "done",
            url: path,
            thumbUrl: path,
        });
    }
    catch(error){
        createSiteLog(req.headers['x-site'], 'uploadLogoBanner', error);
        return res.json(error);
    }

};

function asPromiseSharpResizeJpeg(req: any, currentFileName: any, currentFileType: any, newResizeFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .resize(1024, 1024, { fit: sharp.fit.inside, background: 'white' })
                .toFile(`${publicPath}/${newResizeFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpResizeJpeg', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpResizeJpeg', error);
            resolve(error);
        }
    });
}

function asPromiseSharpResizePng(req: any, currentFileName: any, currentFileType: any, newResizeFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .resize(1024, 1024, { fit: sharp.fit.inside, background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(`${publicPath}/${newResizeFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpResizePng', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpResizePng', error);
            resolve(error);
        }
    });
}

function asPromiseSharpResizeJpeg2048(req: any, currentFileName: any, currentFileType: any, newResizeFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .resize(2048, 2048, { fit: sharp.fit.inside, background: 'white' })
                .toFile(`${publicPath}/${newResizeFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpResizeJpeg2048', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpResizeJpeg2048', error);
            resolve(error);
        }
    });
}

function asPromiseSharpResizePng2048(req: any, currentFileName: any, currentFileType: any, newResizeFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .resize(2048, 2048, { fit: sharp.fit.inside, background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toFile(`${publicPath}/${newResizeFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpResizePng2048', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpResizePng2048', error);
            resolve(error);
        }
    });
}

function asPromiseSharpQualityJpeg(req: any, currentFileName: any, currentFileType: any, newQualityFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .jpeg({quality : 50})
                .toFile(`${publicPath}/${newQualityFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityJpeg', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityJpeg', error);
            resolve(error);
        }
    });
}

function asPromiseSharpQualityPng(req: any, currentFileName: any, currentFileType: any, newQualityFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .png({quality : 50})
                .toFile(`${publicPath}/${newQualityFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityPng', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityPng', error);
            resolve(error);
        }
    });
}

function asPromiseSharpQualityJpeg80(req: any, currentFileName: any, currentFileType: any, newQualityFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .jpeg({quality : 80})
                .toFile(`${publicPath}/${newQualityFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityJpeg80', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityJpeg80', error);
            resolve(error);
        }
    });
}

function asPromiseSharpQualityPng80(req: any, currentFileName: any, currentFileType: any, newQualityFileName: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            sharp(`${publicPath}/${currentFileName}${currentFileType}`)
                .png({quality : 80})
                .toFile(`${publicPath}/${newQualityFileName}${currentFileType}`, (err: any, info: any) => { 
                    try{
                        if(err) resolve(err);
                        resolve(false);
                    }
                    catch(error){
                        createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityPng80', error);
                        resolve(error);
                    }
                });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseSharpQualityPng80', error);
            resolve(error);
        }
    });
}

function asPromiseFsUnlink(req: any, currentFileName: any, currentFileType: any, publicPath: any, logStr: any) {
    return new Promise((resolve, reject) => {
        try{
            fs.unlink(`${publicPath}/${currentFileName}${currentFileType}`, err => {
                try{
                    if(err) resolve(err);
                    resolve(false);
                }
                catch(error){
                    createSiteLog(req.headers['x-site'], 'asPromiseFsUnlink', error);
                    resolve(error);
                }
            });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseFsUnlink', error);
            resolve(error);
        }
    });
}

function asPromiseFsReadFile(req: any, currentFileName: any, currentFileType: any, publicPath: any, res: any) {
    return new Promise((resolve, reject) => {
        try{
            fs.readFile(`${publicPath}/${currentFileName}${currentFileType}`, (err, buf) => {
                try{
                    if (err) return res.json({ status: false, message: err }); 
                    const imageInfo = sizeOf.imageSize(buf);
                    resolve(imageInfo);
                }
                catch(error){
                    createSiteLog(req.headers['x-site'], 'asPromiseFsReadFile', error);
                    resolve(error);
                }
            });
        }
        catch(error){
            createSiteLog(req.headers['x-site'], 'asPromiseFsReadFile', error);
            resolve(error);
        }
    });
}