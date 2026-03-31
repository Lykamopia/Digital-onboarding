

import nodemailer from 'nodemailer';
import type { Prisma } from './types';
import prisma from './prisma';

const baseUrl = process.env.BASE_URL || 'http://localhost:3010';
const logoUrl = 'https://cdn.brandfetch.io/id3xwknDM-/w/2048/h/2048/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1769246323397';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true, // For port 465, this should be true
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});



interface VerificationEmailOptions {
    to: string;
    name: string;
    token: string;
}

interface PasswordResetEmailOptions {
    to: string;
    name: string;
    token: string;
}

interface EmailChangeVerificationOptions {
    to: string; // new email
    name: string;
    token: string;
    userId: string;
}

interface EmailChangeNotificationOptions {
    to: string; // old email
    name: string;
    newEmail: string;
}

async function logEmail(data: Omit<Prisma.EmailLogCreateInput, 'from'>) {
    try {
        await prisma.emailLog.create({
            data: {
                from: process.env.EMAIL_FROM || 'noreply@example.com',
                ...data
            }
        });
    } catch (logError) {
        console.error("Failed to log email:", logError);
    }
}


function generateAuthEmailBody(title: string, content: string): string {
    const { footerText } = { footerText: 'This is an automated message. Please do not reply.' };

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body { margin: 0; padding: 0; width: 100% !important; background-color: #f4f4f4; font-family: Arial, sans-serif; color: #333; }
            .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
            .header { padding: 20px; text-align: center; }
            .header img { max-width: 150px; }
            .content { padding: 30px; }
            .content h2 { font-size: 20px; color: #333; margin-top: 0; }
            .content p { font-size: 16px; line-height: 1.6; }
            .credentials { background-color: #f9f9f9; border-left: 4px solid hsl(37, 100%, 48%); padding: 15px; margin: 20px 0; }
            .credentials p { margin: 5px 0; font-size: 14px; }
            .button-container { text-align: center; margin: 30px 0; }
            .footer { padding: 20px; font-size: 12px; color: #777; text-align: center; background-color: #f1f1f1; }
            code { background-color: #eee; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
        </style>
    </head>
    <body>
        <table width="100%" border="0" cellspacing="0" cellpadding="20" style="background-color: #f4f4f4;">
            <tr>
                <td>
                    <div class="container">
                        <div class="header">
                           <img src="${logoUrl}" alt="NibTera Onboarding Logo" style="width:60px;height:60px;display:block;margin:0 auto;">
                        </div>
                        <div class="content">
                            <h2>${title}</h2>
                            ${content}
                        </div>
                         <div class="footer">
                            <p>${footerText}</p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

export async function sendVerificationEmail({ to, name, token }: VerificationEmailOptions) {
    const verificationLink = `${baseUrl}/set-password?token=${token}`;
    const expirationHours = 1;

    const title = "Welcome to NibTera Onboarding! Please Verify Your Account";
    const content = `
        <p>Hello ${name},</p>
        <p>An account has been created for you on the NibTera Onboarding platform. To get started, please set your password by clicking the link below.</p>
        <p>This link is valid for <strong>${expirationHours} hour</strong>.</p>
        <div class="button-container">
            <a href="${verificationLink}" style="background-color: #9A4D1C; color: #ffffff; display: inline-block; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Set Your Password</a>
        </div>
        <p>If you did not request this, please ignore this email.</p>
    `;
    
    const htmlBody = generateAuthEmailBody(title, content);

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: title,
        html: htmlBody,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);
        const user = await prisma.user.findUnique({ where: { email: to } });
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'sent',
            triggerEvent: 'welcome_user',
            relatedEntityId: user?.id,
            messageId: info.messageId,
        });
        return info;
    } catch (error: any) {
        console.error('Error sending verification email:', error);
         const user = await prisma.user.findUnique({ where: { email: to } });
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'failed',
            triggerEvent: 'welcome_user',
            relatedEntityId: user?.id,
            errorMessage: error.message,
        });
        throw error;
    }
}

export async function sendPasswordResetEmail({ to, name, token }: PasswordResetEmailOptions) {
    const resetLink = `${baseUrl}/set-password?token=${token}`;
    const expirationHours = 1;

    const title = "Your Password Reset Request";
    const content = `
        <p>Hello ${name},</p>
        <p>We received a request to reset your password for the NibTera Onboarding platform. You can reset your password by clicking the link below.</p>
        <p>This link is valid for <strong>${expirationHours} hour</strong>.</p>
        <div class="button-container">
            <a href="${resetLink}" style="background-color: #9A4D1C; color: #ffffff; display: inline-block; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Reset Your Password</a>
        </div>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
    `;

    const htmlBody = generateAuthEmailBody(title, content);
    
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: title,
        html: htmlBody,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);
        const user = await prisma.user.findUnique({ where: { email: to } });
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'sent',
            triggerEvent: 'password_reset',
            relatedEntityId: user?.id,
            messageId: info.messageId,
        });
        return info;
    } catch (error: any) {
        console.error('Error sending password reset email:', error);
        const user = await prisma.user.findUnique({ where: { email: to } });
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'failed',
            triggerEvent: 'password_reset',
            relatedEntityId: user?.id,
            errorMessage: error.message,
        });
        throw error;
    }
}

export async function sendEmailChangeVerificationEmail({ to, name, token, userId }: EmailChangeVerificationOptions) {
    const verificationLink = `${baseUrl}/verify-email?token=${token}`;
    const expirationHours = 1;

    const title = "Confirm Your New Email Address";
    const content = `
        <p>Hello ${name},</p>
        <p>You requested to change your email address for the NibTera Onboarding platform to this one. Please confirm this change by clicking the link below.</p>
        <p>This link is valid for <strong>${expirationHours} hour</strong>.</p>
        <div class="button-container">
            <a href="${verificationLink}" style="background-color: #9A4D1C; color: #ffffff; display: inline-block; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Confirm New Email</a>
        </div>
        <p>If you did not request this change, you can safely ignore this email.</p>
    `;
    
    const htmlBody = generateAuthEmailBody(title, content);

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: title,
        html: htmlBody,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email change verification sent: %s', info.messageId);
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'sent',
            triggerEvent: 'email_change_verification',
            relatedEntityId: userId,
            messageId: info.messageId,
        });
        return info;
    } catch (error: any) {
        console.error('Error sending email change verification:', error);
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'failed',
            triggerEvent: 'email_change_verification',
            relatedEntityId: userId,
            errorMessage: error.message,
        });
        throw error;
    }
}

export async function sendEmailChangeNotificationEmail({ to, name, newEmail }: EmailChangeNotificationOptions) {
    const title = "Email Change Request for Your NibTera Onboarding Account";
    const content = `
        <p>Hello ${name},</p>
        <p>This is a notification that a request has been made to change the email address associated with your NibTera Onboarding account to <strong>${newEmail}</strong>.</p>
        <p>A verification email has been sent to the new address. Your email will not be changed until it is verified.</p>
        <p><strong>If you did not make this request, please change your password immediately and contact an administrator.</strong></p>
    `;

    const htmlBody = generateAuthEmailBody(title, content);
    
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: to,
        subject: title,
        html: htmlBody,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email change notification sent: %s', info.messageId);
        const user = await prisma.user.findUnique({ where: { email: to } });
        await logEmail({
            to,
            subject: title,
            body: htmlBody,
            status: 'sent',
            triggerEvent: 'email_change_notice',
            relatedEntityId: user?.id,
            messageId: info.messageId,
        });
        return info;
    } catch (error: any) {
        console.error('Error sending email change notification:', error);
        await logEmail({
            to: to,
            subject: title,
            body: htmlBody,
            status: 'failed',
            triggerEvent: 'email_change_notice',
            relatedEntityId: (await prisma.user.findUnique({ where: { email: to } }))?.id,
            errorMessage: error.message,
        });
        throw error;
    }
}
