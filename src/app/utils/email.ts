import nodemailer from "nodemailer";
import { envVars } from "../../config/env.js";
import AppError from "../errorHelpers/AppError.js";
import { StatusCodes } from "http-status-codes";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";


export const transporter = nodemailer.createTransport({
    host: envVars.EMAIL_HOST,
    port: envVars.EMAIL_PORT,
    secure: envVars.EMAIL_SECURE,
    auth: {
        user: envVars.EMAIL_USER,
        pass: envVars.EMAIL_PASSWORD,
    },
});


interface EmailOptions {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    attachments?: {
        filename: string;
        content: string | Buffer;
        contentType: string;
    }[];
}

export const sendEmail = async ({ subject, to, templateName, templateData, attachments }: EmailOptions) => {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const templatePath = path.resolve(__dirname, `../templates/${templateName}.ejs`);
        const html = await ejs.renderFile(templatePath, templateData);
        const info = await transporter.sendMail({
            from: `"LostX" <${envVars.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: attachment.content,
                contentType: attachment.contentType,
            })),
        });
        console.log(`Email sending successfully to ${to} with subject ${subject} message id ${info.messageId} and response ${info.response}`);
        return info;
    } catch (error: any) {
        console.log('Email sending failed', error.message);
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, error.message);
    }
}