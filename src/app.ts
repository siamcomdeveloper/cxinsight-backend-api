import express, { Application } from 'express';
import morgan from 'morgan'; //HTTP request logger middleware for node.js
import * as dotenv from "dotenv"; //variables from a .env file

//Custom Helper Libraries
import { createPool } from './database';
import "./middlewares/passport";

//Routes
import IndexRoutes from './routes/index.routes';
import SurveyRoutes from "./routes/survey.routes";
import SurveyStatisticRoutes from "./routes/surveyStatistic.routes";
import collectorRoutes from "./routes/collector.routes";
import emailRoutes from "./routes/email.routes";
import responseRoutes from "./routes/response.routes";
import anwserRoutes from "./routes/answer.routes";
import questionRoutes from "./routes/question.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import touchpointRoutes from "./routes/touchpoint.routes";
import templateRoutes from "./routes/templates.routes";
import uploadRoutes from "./routes/upload.routes";
import colorRoutes from "./routes/color.routes";
import fontRoutes from "./routes/font.routes";
import backgroundRoutes from "./routes/background.routes";
import employeeRoutes from "./routes/employee.routes";

export class App {

    app: Application;
    
    constructor(private port: number){
        this.app = express();
        this.setting(port);
        this.middlewares();
        this.routes();
    }

    setting(port: number){
        this.app.set('port', port);
    }

    middlewares(){
        this.app.use(morgan('dev'));
        this.app.use(express.json());
        this.app.use(express.static('public'));
    }

    routes(){
        this.app.use(function(req, res, next) {
          res.header("Access-Control-Allow-Origin", "*");
          res.header("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, X-Forwarded-*, Content-Type, Accept, Authorization, x-site, x-business");
          next();
        });
        this.app.use(IndexRoutes);
        this.app.use('/surveys', SurveyRoutes);
        this.app.use('/surveys_statistic', SurveyStatisticRoutes);
        this.app.use('/collector', collectorRoutes);
        this.app.use('/email', emailRoutes);
        this.app.use('/response', responseRoutes);
        this.app.use('/answer', anwserRoutes);
        this.app.use('/question', questionRoutes);
        this.app.use('/auth', authRoutes);
        this.app.use('/user', userRoutes);
        this.app.use('/projects', projectRoutes);
        this.app.use('/touchpoints', touchpointRoutes);
        this.app.use('/templates', templateRoutes);
        this.app.use('/upload', uploadRoutes);
        this.app.use('/color', colorRoutes);
        this.app.use('/font', fontRoutes);
        this.app.use('/background', backgroundRoutes);
        this.app.use('/employees', employeeRoutes);
    }

    async listen(){

        // Calling valiables from the .env file (ex. process.env.xxx)
        dotenv.config();
        
        const hostname = process.env.HOST as string;
        const database = process.env.DATABASE as string;
        const port = process.env.PORT;
        const user = process.env.DBUSER;
        const password = process.env.DBPASSWORD;

        const JWTSecret = process.env.JWT_SECRET;

        console.log({hostname, database, port, user, password, JWTSecret});

        await this.app.listen(port, () => {

            console.log(`Listening on port ${port}`);
            
            createPool({
                server: hostname,
                database: database,
                user: user,
                password: password
            })
            .then(() => {
                console.log(`pool connected`);
            })
            .catch((err: any) => {
                console.log(`pool connect error`, err);
            });

        });
      
    }

}