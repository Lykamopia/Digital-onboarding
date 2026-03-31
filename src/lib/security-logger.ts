
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import type { User } from './types';
import { LogSeverity } from './types';
// Imports for emails removed since critical alerts have been disabled
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
  SESSION_HIJACK_INVALIDATION = 'SESSION_HIJACK_INVALIDATION',

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
  FILE_PREVIEW_SUCCESS = 'FILE_PREVIEW_SUCCESS',

  // Customer Onboarding
  CUSTOMER_ONBOARDING_SUBMITTED = 'CUSTOMER_ONBOARDING_SUBMITTED',
  CUSTOMER_ONBOARDING_APPROVED = 'CUSTOMER_ONBOARDING_APPROVED',
  CUSTOMER_ONBOARDING_REJECTED = 'CUSTOMER_ONBOARDING_REJECTED',
  CUSTOMER_ONBOARDING_FORWARDED = 'CUSTOMER_ONBOARDING_FORWARDED',
  CUSTOMER_ONBOARDING_FORWARD_FAILED = 'CUSTOMER_ONBOARDING_FORWARD_FAILED',
  CUSTOMER_ONBOARDING_DUPLICATE_ATTEMPT = 'CUSTOMER_ONBOARDING_DUPLICATE_ATTEMPT',
}

type LogDetails = {
    event: SecurityEvent;
    severity: LogSeverity;
    actor: User | { id: string; name: string | null; } | null;
    details: string;
    targetId?: string;
    targetType?: string;
};

// Simple in-memory cache to prevent duplicate logs within a short timeframe
const logCache = new Map<string, number>();
const DEBOUNCE_WINDOW_MS = 1000; // 1 second cooldown

function shouldDebounce(key: string): boolean {
    const now = Date.now();
    const lastLogTime = logCache.get(key);

    if (lastLogTime && (now - lastLogTime) < DEBOUNCE_WINDOW_MS) {
        return true; 
    }
    
    logCache.set(key, now);
    
    // Cleanup old cache entries periodically
    if (logCache.size > 100) {
        for (const [k, v] of logCache.entries()) {
            if ((now - v) > DEBOUNCE_WINDOW_MS * 5) {
                logCache.delete(k);
            }
        }
    }
    
    return false;
}

/**
 * Strips ports and standardizes IP addresses.
 */
function getCleanIp(raw: string | null | undefined): string | null {
    if (!raw || raw === 'unknown') return null;
    let ip = raw.split(',')[0].trim();
    
    const colonCount = (ip.match(/:/g) || []).length;
    if (colonCount === 1) {
        return ip.split(':')[0];
    }
    
    if (ip.startsWith('[') && ip.includes(']:')) {
        return ip.split(']:')[0].replace('[', '');
    }
    
    if (ip.includes('.') && colonCount > 1) {
        const parts = ip.split(':');
        const lastPart = parts[parts.length - 1];
        if (/^\d+$/.test(lastPart)) {
            const clean = parts.slice(0, -1).join(':');
            return clean.replace(/^.*:/, ''); 
        }
        return ip.replace(/^.*:/, '');
    }

    return ip;
}

async function triggerCriticalAlert(log: LogDetails, context: { ipAddress: string | null; userAgent: string | null }) {
    // Email alerts for critical events have been disabled per user request.
    // Emails are now strictly reserved for authentication flows (password reset, etc).
    return;
}

export async function logSecurityEvent(log: LogDetails) {
    const headerList = await headers();
    const rawIp = headerList.get('x-forwarded-for') || headerList.get('cf-connecting-ip') || 'unknown';
    const ipAddress = getCleanIp(rawIp);
    const userAgent = headerList.get('user-agent');

    // Debounce to prevent rapid duplicate logs (e.g. browser retries or React double-renders)
    const debounceKey = `${log.event}:${log.actor?.id || 'system'}:${log.targetId || ''}`;
    if (shouldDebounce(debounceKey)) return;

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
