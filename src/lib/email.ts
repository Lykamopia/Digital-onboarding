
import nodemailer from 'nodemailer';
import type { Memo, User } from './types';
import { getEmailSettings } from '@/app/actions/memo';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: true, // For port 465, this should be true
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // If using port 587, secure should be false and you might need tls options
  // secure: false, 
  // tls: {
  //   ciphers:'SSLv3'
  // }
});

interface EmailOptions {
  to: string;
  subject: string;
  memo: Memo;
  sender: User;
  type: 'direct' | 'cc';
}

async function generateEmailBody(memo: Memo, sender: User, type: 'direct' | 'cc'): Promise<string> {
    const { notificationsEnabled, headerText, bodyText, footerText } = await getEmailSettings();
    if (!notificationsEnabled) {
        return '';
    }

    const memoUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/inbox?id=${memo.id}`;
    
    const notificationType = type === 'direct' 
        ? `You have received a new memo from <strong>${sender.name}</strong>.`
        : `You have been CC'd on a memo from <strong>${sender.name}</strong>.`;
    
    const processedBody = bodyText
        .replace(/{{notificationType}}/g, notificationType)
        .replace(/{{senderName}}/g, sender.name)
        .replace(/{{subject}}/g, memo.subject)
        .replace(/{{reference}}/g, memo.memo_reference_number || '')
        .replace(/{{memoUrl}}/g, memoUrl)
        .replace(/\n/g, '<br>');

    const logoUrl = 'https://cdn.brandfetch.io/id3xwknDM-/w/2048/h/2048/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1761145582612';

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
                           <img src="${logoUrl}" alt="Nib Memo Logo">
                        </div>
                        <div class="content">
                            <h2>${headerText}</h2>
                            <p>${processedBody}</p>
                            
                            <div class="memo-details">
                                <p><strong>From:</strong> ${sender.name}</p>
                                <p><strong>Subject:</strong> ${memo.subject}</p>
                                <p><strong>Reference:</strong> ${memo.memo_reference_number}</p>
                            </div>

                            <div class="button-container">
                                <a href="${memoUrl}" class="button">View Full Memo</a>
                            </div>
                            
                            <p>Thank you,<br>The Nib Memo System</p>
                        </div>
                    </div>
                     <div class="footer">
                        <p>${footerText}</p>
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}


export async function sendEmail({ to, subject, memo, sender, type }: EmailOptions) {
  const { notificationsEnabled } = await getEmailSettings();
  if (!notificationsEnabled) {
    console.log('Email notifications are disabled. Skipping email to', to);
    return;
  }

  const htmlBody = await generateEmailBody(memo, sender, type);
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
