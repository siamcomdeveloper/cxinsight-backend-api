import { Router } from "express";
import multer from "multer";
import passport from 'passport';
import "../middlewares/passport";
const router = Router();

import { uploadImage, uploadLogoBanner, uploadBg, uploadConsent } from "../controllers/upload.controller";

// Configuration for Multer whether where the file will be stored and rename images file.
const storageImages = multer.diskStorage({ 
    destination: function (req, file, cb) {
        cb(null, `public/images/${req.headers['x-site']}/images`)
    },
    filename: function (req, file, cb) {
        const typeName = file.mimetype === "image/png" ? ".png" : ".jpeg";
        cb(null, Date.now() + typeName)
    }
});

// Configuration for Multer whether where the file will be stored and rename bg file.
const storageBg = multer.diskStorage({ 
    destination: function (req, file, cb) {
        cb(null, `public/images/${req.headers['x-site']}/bg`)
    },
    filename: function (req, file, cb) {
        const typeName = file.mimetype === "image/png" ? ".png" : ".jpeg";
        cb(null, Date.now() + typeName)
    }
});

// Configuration for Multer whether where the file will be stored and rename logo_banner file.
const storageLogoBanner = multer.diskStorage({ 
    destination: function (req, file, cb) {
        cb(null, `public/images/${req.headers['x-site']}/logo_banner`)
    },
    filename: function (req, file, cb) {
        const typeName = file.mimetype === "image/png" ? ".png" : ".jpeg";
        cb(null, Date.now() + typeName)
    }
});

// Configuration for Multer whether where the file will be stored and rename consent file.
const storageConsent = multer.diskStorage({ 
    destination: function (req, file, cb) {
        cb(null, `public/images/${req.headers['x-site']}/consent`)
    },
    filename: function (req, file, cb) {
        const typeName = file.mimetype === "image/png" ? ".png" : ".jpeg";
        cb(null, Date.now() + typeName)
    }
});

// File filter configuration the image file.
const fileFilter = function (req: any, file: any, cb: any) {
    var allowedMimes = ['image/jpeg', 'image/pjpeg', 'image/png'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        console.log('Invalid file type. Only jpg, png image files are allowed.');
        cb({
            success: false,
            message: 'Invalid file type. Only jpg, png image files are allowed.'
        }, false);
    }
};

// Define a multer storage location and the filter configuration for the image file.
const fileUploadImages = multer({ storage: storageImages, fileFilter: fileFilter, /*limits: { fileSize: 200 * 1024 * 1024 }*/ }); //Configuration
const fileUploadBg = multer({ storage: storageBg, fileFilter: fileFilter, /*limits: { fileSize: 200 * 1024 * 1024 }*/ }); //Configuration
const fileUploadLogoBanner = multer({ storage: storageLogoBanner, fileFilter: fileFilter, /*limits: { fileSize: 200 * 1024 * 1024 }*/ }); //Configuration
const fileUploadConsent = multer({ storage: storageConsent, fileFilter: fileFilter, /*limits: { fileSize: 200 * 1024 * 1024 }*/ }); //Configuration

router.route('/')
    .post(passport.authenticate('authorized', {session: false}), fileUploadImages.single('file'), uploadImage)

router.route('/client')
    .post(fileUploadImages.single('file'), uploadImage)//client can access

router.route('/client/consent')
    .post(fileUploadConsent.single('file'), uploadConsent)//client can access

router.route('/logo-banner')
    .post(passport.authenticate('authorized', {session: false}), fileUploadLogoBanner.single('file'), uploadLogoBanner)

router.route('/bg')
    .post(passport.authenticate('authorized', {session: false}), fileUploadBg.single('file'), uploadBg)

export default router;