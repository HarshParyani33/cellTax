import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"));
app.use(cookieParser());
app.use(passport.initialize());

import "./config/passport.js";

// Routes Import
import authRouter from './routes/auth.routes.js';

// Routes Declaration
app.use("/api/v1/auth", authRouter);

export { app };
