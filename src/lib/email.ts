
import nodemailer from 'nodemailer';
import type { Memo, User } from './types';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  memo: Memo;
  sender: User;
  type: 'direct' | 'cc';
}

function generateEmailBody(memo: Memo, sender: User, type: 'direct' | 'cc'): string {
    const memoUrl = `${process.env.BASE_URL}/dashboard/inbox?id=${memo.id}`;
    const truncatedBody = memo.body.length > 300 ? `${memo.body.substring(0, 300)}...` : memo.body;

    const notificationType = type === 'direct' 
        ? `You have received a new memo from ${sender.name}.`
        : `You have been CC'd on a memo from ${sender.name}.`;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 20px; }
            .header h1 { color: hsl(26, 61%, 36%); margin: 0; }
            .content { font-size: 16px; }
            .memo-details { background-color: #f9f9f9; border-left: 4px solid hsl(37, 100%, 48%); padding: 15px; margin: 20px 0; }
            .memo-details p { margin: 5px 0; }
            .button { display: inline-block; background-color: hsl(26, 61%, 36%); color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Nib Memo</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>${notificationType}</p>
                
                <div class="memo-details">
                    <p><strong>From:</strong> ${sender.name}</p>
                    <p><strong>Subject:</strong> ${memo.subject}</p>
                    <p><strong>Reference:</strong> ${memo.memo_reference_number}</p>
                </div>

                <p><strong>Memo Content Preview:</strong></p>
                <div style="padding: 10px; border: 1px solid #eee; border-radius: 4px;">
                    ${truncatedBody}
                </div>

                <a href="${memoUrl}" class="button">View Full Memo</a>
                
                <p>Thank you,</p>
                <p>The Nib Memo System</p>
            </div>
            <div class="footer">
                <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}


export async function sendEmail({ to, subject, memo, sender, type }: EmailOptions) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: to,
    subject: subject,
    html: generateEmailBody(memo, sender, type),
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
