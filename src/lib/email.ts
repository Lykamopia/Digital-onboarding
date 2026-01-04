
import nodemailer from 'nodemailer';
import type { Memo, User, Role } from './types';
import { getEmailSettings, getGeneralSettings } from '@/app/actions/memo';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true, // For port 465, this should be true
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface MemoEmailOptions {
  to: string;
  subject: string;
  memo: Memo;
  sender: User & { role: Role | null };
  type: 'direct' | 'cc';
}

interface WelcomeEmailOptions {
    to: string;
    name: string;
    password: string;
}

interface PasswordResetEmailOptions {
    to: string;
    name: string;
    password: string;
}


async function generateMemoEmailBody(memo: Memo, sender: User & { role: Role | null }, type: 'direct' | 'cc'): Promise<string> {
    const { notificationsEnabled, headerText, bodyText, footerText } = await getEmailSettings();
    if (!notificationsEnabled) {
        return '';
    }

    const { acknowledgementType } = await getGeneralSettings();
    const useSignature = acknowledgementType === 'SIGNATURE';

    const baseUrl = process.env.BASE_URL || 'http://localhost:3010';
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

    const logoUrl = `https://cdn.brandfetch.io/id3xwknDM-/w/2048/h/2048/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1761145582612`;
    
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
            .button { display: inline-block; background-color: hsl(26, 61%, 36%); color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; }
            .footer { padding: 20px; font-size: 12px; color: #777; text-align: center; background-color: #f1f1f1; }
        </style>
    </head>
    <body>
        <table width="100%" border="0" cellspacing="0" cellpadding="20" style="background-color: #f4f4f4;">
            <tr>
                <td>
                    <div class="container">
                        <div class="header">
                           <img src="${logoUrl}" alt="Nib Memo Logo" style="max-width:80px;height:auto;display:block;margin:0 auto;">
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
                                <a href="${memoUrl}" class="button">View Full Memo</a>
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
    const logoUrl = `https://cdn.brandfetch.io/id3xwknDM-/w/2048/h/2048/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1761145582612`;

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
            .button { display: inline-block; background-color: hsl(26, 61%, 36%); color: #ffffff !important; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; }
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
                           <img src="${logoUrl}" alt="Nib Memo Logo" style="max-width:80px;height:auto;display:block;margin:0 auto;">
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

export async function sendWelcomeEmail({ to, name, password }: WelcomeEmailOptions) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3010';
    const loginUrl = `${baseUrl}/login`;

    const title = "Welcome to Nib Memo!";
    const content = `
        <p>Hello ${name},</p>
        <p>An account has been created for you on the Nib Memo platform. You can now log in using the credentials below.</p>
        <div class="credentials">
            <p><strong>Username/Email:</strong> ${to}</p>
            <p><strong>Temporary Password:</strong> <code>${password}</code></p>
        </div>
        <p>For your security, you will be required to change this temporary password immediately after your first login.</p>
        <div class="button-container">
            <a href="${loginUrl}" class="button">Log In to Your Account</a>
        </div>
        <p>If you have any questions, please contact your system administrator.</p>
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
        console.log('Welcome email sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
}

export async function sendPasswordResetEmail({ to, name, password }: PasswordResetEmailOptions) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3010';
    const loginUrl = `${baseUrl}/login`;

    const title = "Your Password Has Been Reset";
    const content = `
        <p>Hello ${name},</p>
        <p>Your password for the Nib Memo platform has been reset by an administrator. Please use the following temporary password to log in.</p>
        <div class="credentials">
            <p><strong>Username/Email:</strong> ${to}</p>
            <p><strong>Temporary Password:</strong> <code>${password}</code></p>
        </div>
        <p>You will be required to set a new password immediately after logging in.</p>
        <div class="button-container">
            <a href="${loginUrl}" class="button">Log In to Your Account</a>
        </div>
        <p>If you did not request this change or have concerns, please contact your system administrator immediately.</p>
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
        return info;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
}

export async function sendEmail({ to, subject, memo, sender, type }: MemoEmailOptions) {
  const { notificationsEnabled } = await getEmailSettings();
  if (!notificationsEnabled) {
    console.log('Email notifications are disabled. Skipping email to', to);
    return;
  }

  const htmlBody = await generateMemoEmailBody(memo, sender, type);
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
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
