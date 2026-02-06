
import nodemailer from 'nodemailer';
import type { Memo, User, Role, Prisma } from './types';
import prisma from './prisma';
import { getEmailSettings, getGeneralSettings } from '@/app/actions/settings';

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

type EmailSettings = {
    notificationsEnabled: boolean;
    headerText: string;
    bodyText: string;
    footerText: string;
};

type GeneralSettings = {
    acknowledgementType: 'BADGE' | 'SIGNATURE';
};

interface MemoEmailOptions {
  to: string;
  subject: string;
  memo?: Memo;
  sender?: User & { role: Role | null };
  type?: 'direct' | 'cc';
  emailSettings: EmailSettings;
  generalSettings?: GeneralSettings;
  html?: string;
}

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


async function generateMemoEmailBody(
    memo: Memo, 
    sender: User & { role: Role | null }, 
    type: 'direct' | 'cc',
    emailSettings: EmailSettings,
    generalSettings: GeneralSettings
): Promise<string> {
    const { notificationsEnabled, headerText, bodyText, footerText } = emailSettings;
    if (!notificationsEnabled) {
        return '';
    }

    const { acknowledgementType } = generalSettings;
    const useSignature = acknowledgementType === 'SIGNATURE';

    const memoUrl = `${baseUrl}/dashboard/inbox?id=${memo.id}`;
    
    const senderNameWithRole = sender.role 
        ? `${sender.name} <span style="font-size: 0.8em; font-style: italic; color: #666;">(${sender.role.name})</span>`
        : sender.name;

    const notificationType = type === 'direct' 
        ? `You have received a new memo from <strong>${senderNameWithRole}</strong>.`
        : `You have been CC'd on a memo from <strong>${senderNameWithRole}</strong>.`;
    
    const processedBody = bodyText
        .replace(/{{notificationType}}/g, notificationType)
        .replace(/{{senderName}}/g, senderNameWithRole)
        .replace(/{{subject}}/g, memo.subject)
        .replace(/{{reference}}/g, memo.memo_reference_number || '')
        .replace(/{{memoUrl}}/g, memoUrl)
        .replace(/\n/g, '<br>');
    
    const signatureBlock = useSignature && sender.signature
        ? `<div><img src="${baseUrl}${sender.signature.startsWith('/') ? sender.signature : '/' + sender.signature}" alt="Signature" style="height: 40px; margin-top: 10px;"></div>`
        : '';


    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${headerText}</title>
        <style>
            body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f4f4f4; font-family: Arial, sans-serif; color: #333; }
            .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
            .header { background-color: hsl(0, 0, 100); padding: 20px; text-align: center; }
            .header img { max-width: 150px; }
            .content { padding: 30px; }
            .content h2 { font-size: 20px; color: #333; margin-top: 0; }
            .content p { font-size: 16px; line-height: 1.6; }
            .memo-details { background-color: #f9f9f9; border-left: 4px solid hsl(37, 100%, 48%); padding: 15px; margin: 20px 0; }
            .memo-details p { margin: 5px 0; font-size: 14px; }
            .button-container { text-align: center; margin: 30px 0; }
            .footer { padding: 20px; font-size: 12px; color: #777; text-align: center; background-color: #f1f1f1; }
        </style>
    </head>
    <body>
        <table width="100%" border="0" cellspacing="0" cellpadding="20" style="background-color: #f4f4f4;">
            <tr>
                <td>
                    <div class="container">
                        <div class="header">
                           <img src="${logoUrl}" alt="Nib Memo Logo" style="width:60px;height:60px;display:block;margin:0 auto;">
                        </div>
                        <div class="content">
                            <h2>${headerText}</h2>
                            <p>${processedBody}</p>
                            
                            <div class="memo-details">
                                <p><strong>From:</strong> ${senderNameWithRole}</p>
                                <p><strong>Subject:</strong> ${memo.subject}</p>
                                <p><strong>Reference:</strong> ${memo.memo_reference_number}</p>
                            </div>

                            <div class="button-container">
                                <a href="${memoUrl}" style="display: inline-block; background-color: #9A4D1C; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">View Full Memo</a>
                            </div>
                            
                            <p>Thank you,</p>
                            <p>The Nib Memo System</p>
                        </div>
                         <div class="footer">
                            ${signatureBlock}
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
                           <img src="${logoUrl}" alt="Nib Memo Logo" style="width:60px;height:60px;display:block;margin:0 auto;">
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
    const expirationHours = 24;

    const title = "Welcome to Nib Memo! Please Verify Your Account";
    const content = `
        <p>Hello ${name},</p>
        <p>An account has been created for you on the Nib Memo platform. To get started, please set your password by clicking the link below.</p>
        <p>This link is valid for <strong>${expirationHours} hours</strong>.</p>
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
        <p>We received a request to reset your password for the Nib Memo platform. You can reset your password by clicking the link below.</p>
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

export async function sendEmail({ to, subject, memo, sender, type, emailSettings, generalSettings, html }: MemoEmailOptions) {
  if (!emailSettings.notificationsEnabled && !html) {
    console.log('Email notifications are disabled. Skipping email to', to);
    return;
  }

  let htmlBody;
  if (html) {
      htmlBody = html;
  } else if (memo && sender && type && generalSettings) {
      htmlBody = await generateMemoEmailBody(memo, sender, type, emailSettings, generalSettings);
  }

  if (!htmlBody) return;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: to,
    subject: subject,
    html: htmlBody,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
     await logEmail({
        to: to,
        cc: memo ? memo.cc.map(u => u.email).join(', ') : undefined,
        subject,
        body: htmlBody,
        status: 'sent',
        triggerEvent: memo ? 'new_memo' : 'system_alert',
        relatedEntityId: memo ? memo.id : undefined,
        messageId: info.messageId,
    });
    return info;
  } catch (error: any) {
    console.error('Error sending email:', error);
    await logEmail({
        to: to,
        cc: memo ? memo.cc.map(u => u.email).join(', ') : undefined,
        subject,
        body: htmlBody,
        status: 'failed',
        triggerEvent: memo ? 'new_memo' : 'system_alert',
        relatedEntityId: memo ? memo.id : undefined,
        errorMessage: error.message,
    });
    throw error;
  }
}
