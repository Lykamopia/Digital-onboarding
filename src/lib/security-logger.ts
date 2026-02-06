
'use server';

import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import type { User } from './types';
import { sendEmail } from './email';
import { getEmailSettings, getGeneralSettings } from '@/app/actions/settings';

export enum SecurityEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LOGOUT = 'LOGOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE_SUCCESS = 'PASSWORD_CHANGE_SUCCESS',

  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',
  
  DELEGATION_GRANTED = 'DELEGATION_GRANTED',
  DELEGATION_UPDATED = 'DELEGATION_UPDATED',
  DELEGATION_REVOKED = 'DELEGATION_REVOKED',
  DELEGATION_SESSION_START = 'DELEGATION_SESSION_START',
  DELEGATION_SESSION_END = 'DELEGATION_SESSION_END',

  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
}

export enum LogSeverity {
    INFO = 'INFO',
    WARN = 'WARN',
    CRITICAL = 'CRITICAL',
}

type LogDetails = {
    event: SecurityEvent;
    severity: LogSeverity;
    actor: User | { id: string; name: string | null; } | null;
    details: string;
    targetId?: string;
    targetType?: string;
};

async function triggerCriticalAlert(log: LogDetails, context: { ipAddress: string | null; userAgent: string | null }) {
    const { enableCriticalAlerts } = await getGeneralSettings();
    if (!enableCriticalAlerts) {
        return;
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.warn('Cannot send critical alert: ADMIN_EMAIL not set in .env');
        return;
    }

    try {
        const emailSettings = await getEmailSettings();
        const subject = `[CRITICAL ALERT] Security Event: ${log.event}`;
        const body = `
            <h2>A critical security event has occurred in the Nib Memo System.</h2>
            <p><strong>Event:</strong> ${log.event}</p>
            <p><strong>Severity:</strong> ${log.severity}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Actor:</strong> ${log.actor?.name || 'System/Unknown'} (ID: ${log.actor?.id || 'N/A'})</p>
            <p><strong>Details:</strong> ${log.details}</p>
            <p><strong>Target:</strong> ${log.targetType || 'N/A'} (ID: ${log.targetId || 'N/A'})</p>
            <p><strong>IP Address:</strong> ${context.ipAddress || 'N/A'}</p>
            <p><strong>User Agent:</strong> ${context.userAgent || 'N/A'}</p>
        `;
        
        await sendEmail({
            to: adminEmail,
            subject: subject,
            html: `<html><body>${body}</body></html>`,
            emailSettings: {
                ...emailSettings,
                bodyText: body
            },
        } as any);

        console.log(`Critical alert for event '${log.event}' sent to ${adminEmail}`);

    } catch (error) {
        console.error('Failed to send critical alert email:', error);
    }
}

export async function logSecurityEvent(log: LogDetails) {
    const headerList = headers();
    const ipAddress = headerList.get('x-forwarded-for') || headerList.get('cf-connecting-ip');
    const userAgent = headerList.get('user-agent');

    try {
        await prisma.securityLog.create({
            data: {
                event: log.event,
                severity: log.severity,
                actorId: log.actor?.id,
                details: log.details,
                targetId: log.targetId,
                targetType: log.targetType,
                ipAddress: ipAddress,
                userAgent: userAgent,
            },
        });

        if (log.severity === LogSeverity.CRITICAL) {
            await triggerCriticalAlert(log, { ipAddress, userAgent });
        }

    } catch (error) {
        console.error('Failed to write security log:', error);
    }
}
