
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import type { User } from './types';
import { LogSeverity } from './types';
import { sendEmail } from './email';
import { getEmailSettings, getGeneralSettings } from '@/app/actions/settings';

export enum SecurityEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LOGOUT = 'LOGOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  EMAIL_CHANGE_REQUEST = 'EMAIL_CHANGE_REQUEST',
  EMAIL_CHANGE_SUCCESS = 'EMAIL_CHANGE_SUCCESS',
  BULK_USER_IMPORT = 'BULK_USER_IMPORT',
  
  // Passwords & Security
  PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_CHANGE_SUCCESS = 'PASSWORD_CHANGE_SUCCESS',
  SESSION_HIJACK_ATTEMPT = 'SESSION_HIJACK_ATTEMPT',
  USER_AGENT_MISMATCH = 'USER_AGENT_MISMATCH',

  // Role Management
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',
  
  // Delegation
  DELEGATION_GRANTED = 'DELEGATION_GRANTED',
  DELEGATION_UPDATED = 'DELEGATION_UPDATED',
  DELEGATION_REVOKED = 'DELEGATION_REVOKED',
  DELEGATION_SESSION_START = 'DELEGATION_SESSION_START',
  DELEGATION_SESSION_END = 'DELEGATION_SESSION_END',

  // System & Org Structure
  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
  OFFICE_CREATED = 'OFFICE_CREATED',
  OFFICE_UPDATED = 'OFFICE_UPDATED',
  OFFICE_DELETED = 'OFFICE_DELETED',
  DEPARTMENT_CREATED = 'DEPARTMENT_CREATED',
  DEPARTMENT_UPDATED = 'DEPARTMENT_UPDATED',
  DEPARTMENT_DELETED = 'DEPARTMENT_DELETED',
  DIVISION_CREATED = 'DIVISION_CREATED',
  DIVISION_UPDATED = 'DIVISION_UPDATED',
  DIVISION_DELETED = 'DIVISION_DELETED',
  DISTRICT_CREATED = 'DISTRICT_CREATED',
  DISTRICT_UPDATED = 'DISTRICT_UPDATED',
  DISTRICT_DELETED = 'DISTRICT_DELETED',
  BRANCH_CREATED = 'BRANCH_CREATED',
  BRANCH_UPDATED = 'BRANCH_UPDATED',
  BRANCH_DELETED = 'BRANCH_DELETED',
  LABEL_CREATED = 'LABEL_CREATED',
  LABEL_UPDATED = 'LABEL_UPDATED',
  LABEL_DELETED = 'LABEL_DELETED',

  // Bulk Actions
  BULK_ARCHIVE_ACTION = 'BULK_ARCHIVE_ACTION',

  // File Handling
  FILE_UPLOAD_SUCCESS = 'FILE_UPLOAD_SUCCESS',
  FILE_DOWNLOAD_SUCCESS = 'FILE_DOWNLOAD_SUCCESS',
}

type LogDetails = {
    event: SecurityEvent;
    severity: LogSeverity;
    actor: User | { id: string; name: string | null; } | null;
    details: string;
    targetId?: string;
    targetType?: string;
};

// A simple in-memory cache to debounce identical log entries within a short timeframe.
// This is primarily to prevent duplicate logs from React 18's Strict Mode double-invoking effects in development.
const logCache = new Map<string, number>();
const DEBOUNCE_WINDOW_MS = 1000; // 1 second

function shouldDebounce(key: string): boolean {
    const now = Date.now();
    const lastLogTime = logCache.get(key);

    if (lastLogTime && (now - lastLogTime) < DEBOUNCE_WINDOW_MS) {
        return true; // Debounce this log
    }
    
    logCache.set(key, now);
    
    // Periodically clean up old entries from the cache to prevent memory leaks.
    if (logCache.size > 50) {
        for (const [k, v] of logCache.entries()) {
            if ((now - v) > DEBOUNCE_WINDOW_MS * 5) {
                logCache.delete(k);
            }
        }
    }
    
    return false;
}


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

    // Create a unique key for the event to allow for debouncing.
    // This is particularly useful for events that might be triggered rapidly,
    // like PERMISSION_DENIED from a double-invoked `useEffect` in React Strict Mode.
    const debounceKey = `${log.event}:${log.actor?.id}:${log.targetId || ''}`;
    if (shouldDebounce(debounceKey)) {
        return; // Skip logging this event as it's a likely duplicate.
    }

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
