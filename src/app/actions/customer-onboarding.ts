'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { ApprovalStatus } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';

import { CustomerOnboardingSchema, type CustomerOnboardingInput } from '@/lib/validations/customer-onboarding';

// ─── helpers ─────────────────────────────────────────────────────────────────
async function getRequestContext() {
  const headerList = await headers();
  const rawIp = headerList.get('x-forwarded-for') || headerList.get('cf-connecting-ip') || 'unknown';
  const ipAddress = rawIp.split(',')[0].trim();
  const userAgent = headerList.get('user-agent') || null;
  return { ipAddress, userAgent };
}

function hasRolePermission(user: NonNullable<Awaited<ReturnType<typeof getLoggedInUser>>>, permission: string): boolean {
  return (user.role?.permissions || '').split(',').map(p => p.trim()).includes(permission);
}



// ─────────────────────────────────────────────────────────────────────────────
// SUBMIT  – creates a new PENDING record (idempotent on mnemonic)
// ─────────────────────────────────────────────────────────────────────────────
export async function submitCustomerOnboarding(rawData: CustomerOnboardingInput, systemActor?: { id: string; name: string }) {
  const user = systemActor || await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  
  const isMaker = hasRolePermission(user as any, 'submit_customer_onboarding') || hasRolePermission(user as any, 'maker_customer_onboarding');
  if (!systemActor && !isMaker) {
    return { success: false, error: 'You do not have permission to submit customer onboarding.' };
  }

  const parsed = CustomerOnboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const { ipAddress, userAgent } = await getRequestContext();

  // Idempotency check
  const existing = await prisma.customerOnboarding.findUnique({ where: { mnemonic: data.mnemonic } });
  if (existing) {
    await logSecurityEvent({
      event: SecurityEvent.CUSTOMER_ONBOARDING_DUPLICATE_ATTEMPT,
      severity: LogSeverity.WARN,
      actor: user,
      details: `Duplicate submission attempt for mnemonic: ${data.mnemonic}`,
      targetId: existing.id,
      targetType: 'CustomerOnboarding',
    });
    return { success: false, error: `A submission for mnemonic "${data.mnemonic}" already exists (status: ${existing.approvalStatus}).` };
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      const newRecord = await tx.customerOnboarding.create({
        data: {
          ...data,
          fullName2:          data.fullName2          || null,
          phoneNumbersRes:    data.phoneNumbersRes    || null,
          mobilePhoneNumbers: data.mobilePhoneNumbers || null,
          occupation:         data.occupation         || null,
          employersName:      data.employersName      || null,
          netMonthlyIn:       data.netMonthlyIn       || null,
          secureMessage:      data.secureMessage      || null,
          houseNo:            data.houseNo            || null,
          flatNo:             data.flatNo             || null,
          woreda:             data.woreda             || null,
          kebele:             data.kebele             || null,
          subcity:            data.subcity            || null,
          motherName:         data.motherName         || null,
          nationalIDNumber:   data.nationalIDNumber   || null,
          picture:            data.picture            || null,
          submittedById:      systemActor ? null : (user as any).id,
          approvalStatus:     'PENDING',
        },
      });

      await tx.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: newRecord.id,
          actorId:   systemActor ? null : (user as any).id,
          action:    'SUBMITTED',
          details:   `Customer onboarding submitted for mnemonic: ${data.mnemonic}`,
          ipAddress,
          userAgent,
        },
      });

      return newRecord;
    });

    await logSecurityEvent({
      event: SecurityEvent.CUSTOMER_ONBOARDING_SUBMITTED,
      severity: LogSeverity.INFO,
      actor: systemActor ? null : user,
      details: `Customer onboarding submitted via ${systemActor ? 'System API' : 'Web UI'}. Mnemonic: ${data.mnemonic}, Record ID: ${record.id}`,
      targetId: record.id,
      targetType: 'CustomerOnboarding',
    });



    return { success: true, id: record.id };
  } catch (err) {
    console.error('[submitCustomerOnboarding]', err);
    return { success: false, error: 'Failed to save submission. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST  – paginated list for the review panel
// ─────────────────────────────────────────────────────────────────────────────
export async function listCustomerOnboardings(opts: {
  status?: ApprovalStatus;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fromDate?: string;
  toDate?: string;
  gender?: string;
} = {}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'maker_customer_onboarding');
  if (!canReview && !canSubmit) return { success: false as const, error: 'Access denied.' };

  const { 
    status, 
    page = 1, 
    pageSize = 20, 
    search, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    fromDate,
    toDate,
    gender
  } = opts;
  const skip = (page - 1) * pageSize;

  const where: Record<string, any> = {};
  if (status) where.approvalStatus = status;
  // Non-reviewers can only see their own submissions
  if (!canReview) where.submittedById = user.id;

  if (search) {
    where.OR = [
      { mnemonic:   { contains: search, mode: 'insensitive' } },
      { fullName1:  { contains: search, mode: 'insensitive' } },
      { givenName:  { contains: search, mode: 'insensitive' } },
      { familyName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate)   where.createdAt.lte = new Date(toDate);
  }

  if (gender && gender !== 'ALL') {
    where.gender = gender;
  }

  try {
    const [records, total] = await Promise.all([
      prisma.customerOnboarding.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
          reviewedBy:  { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.customerOnboarding.count({ where }),
    ]);

    return { success: true as const, records, total, page, pageSize };
  } catch (err) {
    console.error('[listCustomerOnboardings]', err);
    return { success: false as const, error: 'Failed to fetch records.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET ONE with full audit log
// ─────────────────────────────────────────────────────────────────────────────
export async function getCustomerOnboarding(id: string) {
  const user = await getLoggedInUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'maker_customer_onboarding');
  if (!canReview && !canSubmit) return { success: false as const, error: 'Access denied.' };

  try {
    const record = await prisma.customerOnboarding.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        reviewedBy:  { select: { id: true, name: true, email: true } },
        auditLogs: {
          orderBy: { timestamp: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!record) return { success: false as const, error: 'Record not found.' };
    if (!canReview && record.submittedById !== user.id) {
      return { success: false as const, error: 'Access denied.' };
    }

    return { success: true as const, record };
  } catch (err) {
    console.error('[getCustomerOnboarding]', err);
    return { success: false as const, error: 'Failed to fetch record.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW  – approve or reject a PENDING submission
// ─────────────────────────────────────────────────────────────────────────────
export async function reviewCustomerOnboarding(opts: {
  id: string;
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'You do not have permission to review customer onboarding submissions.' };
  }

  const { id, decision, note } = opts;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return { success: false, error: 'Invalid decision.' };
  }

  const { ipAddress, userAgent } = await getRequestContext();

  try {
    const existing = await prisma.customerOnboarding.findUnique({ where: { id } });
    if (!existing) return { success: false, error: 'Record not found.' };
    
    // Maker-Checker enforcement: Maker cannot be Checker
    if (existing.submittedById === user.id) {
       return { success: false, error: 'Internal Control Violation: You cannot review a record that you submitted.' };
    }

    if (existing.approvalStatus !== 'PENDING') {
      return { success: false, error: `Cannot review a submission that is already ${existing.approvalStatus}.` };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.customerOnboarding.update({
        where: { id },
        data: {
          approvalStatus: decision,
          reviewedById:   user.id,
          reviewedAt:     new Date(),
          reviewNote:     note || null,
        },
      });

      await tx.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId:   user.id,
          action:    decision,
          details:   note || `Submission ${decision.toLowerCase()} by ${user.name}`,
          ipAddress,
          userAgent,
        },
      });

      return record;
    });

    await logSecurityEvent({
      event: decision === 'APPROVED'
        ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED
        : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
      severity: LogSeverity.INFO,
      actor: user,
      details: `Customer onboarding ${decision}. Mnemonic: ${existing.mnemonic}. Note: ${note || 'N/A'}`,
      targetId: id,
      targetType: 'CustomerOnboarding',
    });

    // Trigger automated forwarding immediately only if APPROVED
    if (decision === 'APPROVED') {
      forwardToCoreBanking(updated.id, user.id).catch((err) =>
        console.error('[auto-forward trigger fail]', err)
      );
    }



    return { success: true };
  } catch (err) {
    console.error('[reviewCustomerOnboarding]', err);
    return { success: false, error: 'Failed to process decision. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORWARD  – sends an APPROVED record to the T24 core banking endpoint
// ─────────────────────────────────────────────────────────────────────────────
export async function forwardToCoreBanking(id: string, actorId?: string) {
  const record = await prisma.customerOnboarding.findUnique({ where: { id } });
  if (!record) throw new Error(`Record ${id} not found`);
  if (record.approvalStatus !== 'APPROVED') {
    throw new Error(`Only APPROVED records can be forwarded (current: ${record.approvalStatus})`);
  }
  if (record.forwardedAt) {
    return { success: true, alreadyForwarded: true };
  }

  const { ipAddress, userAgent } = await getRequestContext();

  const payload = {
    mnemonic:           record.mnemonic,
    shortName:          record.shortName,
    fullName1:          record.fullName1,
    fullName2:          record.fullName2,
    street:             record.street,
    townCity:           record.townCity,
    country:            record.country,
    sector:             record.sector,
    accountOfficer:     record.accountOfficer,
    industry:           record.industry,
    target:             record.target,
    nationality:        record.nationality,
    customerStatus:     record.customerStatus,
    residence:          record.residence,
    legalIdNumber:      record.legalIdNumber,
    documentName:       record.documentName,
    nameOnID:           record.nameOnID,
    issueAuthority:     record.issueAuthority,
    issueDate:          record.issueDate,
    expirationDate:     record.expirationDate,
    language:           record.language,
    region:             record.region,
    phoneNumbersRes:    record.phoneNumbersRes,
    mobilePhoneNumbers: record.mobilePhoneNumbers,
    title:              record.title,
    givenName:          record.givenName,
    familyName:         record.familyName,
    gender:             record.gender,
    dateOfBirth:        record.dateOfBirth,
    maritalStatus:      record.maritalStatus,
    occupation:         record.occupation,
    employersName:      record.employersName,
    netMonthlyIn:       record.netMonthlyIn,
    customerType:       record.customerType,
    secureMessage:      record.secureMessage,
    houseNo:            record.houseNo,
    flatNo:             record.flatNo,
    woreda:             record.woreda,
    kebele:             record.kebele,
    subcity:            record.subcity,
    motherName:         record.motherName,
    nationalIDNumber:   record.nationalIDNumber,
    picture:            record.picture,
    approvalStatus:     record.approvalStatus,
  };

  const T24_ENDPOINT = process.env.T24_API_URL || 'https://nibteratest.nibbank.com.et/api/Test/CustomerCreate';
  const T24_API_KEY  = process.env.T24_API_KEY;

  try {
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };
    if (T24_API_KEY) fetchHeaders['Authorization'] = `Bearer ${T24_API_KEY}`;

    console.log('\n================================================================');
    console.log('🚀 [T24 FORWARDING] PREPARING PAYLOAD FOR CORE BANKING');
    console.log('📍 ENDPOINT:', T24_ENDPOINT);
    console.log('📦 ENVELOPE:', JSON.stringify(payload, null, 2));
    console.log('================================================================\n');

    const response = await fetch(T24_ENDPOINT, {
      method:  'POST',
      headers: fetchHeaders,
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(30_000),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`T24 responded with ${response.status}: ${responseText}`);
    }

    try {
      let parsedBody = JSON.parse(responseText);
      
      // Some APIs accidentally double-serialize JSON (returning a string instead of an object)
      if (typeof parsedBody === 'string') {
        try {
          parsedBody = JSON.parse(parsedBody);
        } catch (e) {
          // Ignore, it's just a regular string
        }
      }

      if (parsedBody && typeof parsedBody === 'object') {
        const statusValue = parsedBody.status || parsedBody.Status;
        if (typeof statusValue === 'string' && statusValue.toLowerCase() === 'failed') {
          // Build string to easily log the inner error message if available
          const innerErrorMessage = parsedBody.error || parsedBody.Error || parsedBody.message || parsedBody.Message || '';
          throw new Error(`T24 Business Logic Failed: ${innerErrorMessage ? innerErrorMessage : responseText}`);
        }
      }
    } catch (e: any) {
      if (e.message.startsWith('T24 Business Logic Failed')) {
        throw e;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerOnboarding.update({
        where: { id },
        data: { forwardedAt: new Date(), forwardError: null },
      });
      await tx.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId:   actorId || null,
          action:    'FORWARDED',
          details:   `Payload forwarded to core banking (T24). HTTP ${response.status}. Response: ${responseText}`,
          ipAddress,
          userAgent,
        },
      });
    });

    await logSecurityEvent({
      event:    SecurityEvent.CUSTOMER_ONBOARDING_FORWARDED,
      severity: LogSeverity.INFO,
      actor:    actorId ? { id: actorId, name: null } : null,
      details:  `Mnemonic ${record.mnemonic} forwarded to T24 core banking. HTTP ${response.status}`,
      targetId: id,
      targetType: 'CustomerOnboarding',
    });



    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await prisma.$transaction(async (tx) => {
      await tx.customerOnboarding.update({
        where: { id },
        data:  { forwardError: errorMessage },
      });
      await tx.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId:   actorId || null,
          action:    'FORWARD_FAILED',
          details:   `Failed to forward to T24: ${errorMessage}`,
          ipAddress,
          userAgent,
        },
      });
    });

    await logSecurityEvent({
      event:    SecurityEvent.CUSTOMER_ONBOARDING_FORWARD_FAILED,
      severity: LogSeverity.CRITICAL,
      actor:    actorId ? { id: actorId, name: null } : null,
      details:  `Failed to forward mnemonic ${record.mnemonic} to T24. Error: ${errorMessage}`,
      targetId: id,
      targetType: 'CustomerOnboarding',
    });



    return { success: false, error: errorMessage };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL RETRY FORWARD (called from review panel by reviewer)
// ─────────────────────────────────────────────────────────────────────────────
export async function retryForwardToCoreBanking(id: string) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }
  return forwardToCoreBanking(id, user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK REVIEW – approve or reject multiple PENDING submissions
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkReviewCustomerOnboarding(opts: {
  ids: string[];
  decision: 'APPROVED' | 'REJECTED';
}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }

  const { ids, decision } = opts;
  if (!ids.length) return { success: false, error: 'No records selected.' };

  const { ipAddress, userAgent } = await getRequestContext();

  try {
    const results = await prisma.$transaction(async (tx) => {
      // Only update PENDING records and enforce Maker-Checker:
      // Exclude those submitted by the current user
      const recordsToUpdate = await tx.customerOnboarding.findMany({
        where: { 
           id: { in: ids }, 
           approvalStatus: 'PENDING',
           NOT: { submittedById: user.id }
        },
        select: { id: true, mnemonic: true }
      });

      if (recordsToUpdate.length === 0) return { count: 0, records: [] };

      const actualIds = recordsToUpdate.map(r => r.id);

      await tx.customerOnboarding.updateMany({
        where: { id: { in: actualIds } },
        data: {
          approvalStatus: decision,
          reviewedById:   user.id,
          reviewedAt:     new Date(),
        }
      });

      // Create audit logs for each record in the transaction
      // Note: mapping array for createMany
      const auditLogData = actualIds.map(recordId => ({
        customerOnboardingId: recordId,
        actorId:   user.id,
        action:    decision,
        details:   `Bulk ${decision.toLowerCase()} action performed.`,
        ipAddress,
        userAgent,
      }));

      await tx.customerOnboardingAuditLog.createMany({
        data: auditLogData,
      });

      return { count: actualIds.length, records: recordsToUpdate };
    });

    if (results.count > 0) {
      // Log security events for bulk action
      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Bulk ${decision} performed on ${results.count} records.`,
      });

      // Sequential forwarding and broadcasting (outside transaction to avoid DB locks)
      for (const r of results.records) {
        if (decision === 'APPROVED') {
          forwardToCoreBanking(r.id, user.id).catch(err => 
            console.error(`[bulk-auto-forward fail] ID: ${r.id}`, err)
          );
        }
      }
    }

    return { success: true, count: results.count };
  } catch (err) {
    console.error('[bulkReviewCustomerOnboarding]', err);
    return { success: false, error: 'Failed to process bulk decision. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT  – Fetch records for CSV export (optionally only by IDs)
// ─────────────────────────────────────────────────────────────────────────────
export async function exportCustomerOnboardings(opts: {
  ids?: string[];
  status?: ApprovalStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fromDate?: string;
  toDate?: string;
  gender?: string;
} = {}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  if (!canReview) return { success: false as const, error: 'Access denied.' };

  const { ids, status, search, sortBy = 'createdAt', sortOrder = 'desc', fromDate, toDate, gender } = opts;

  const where: Record<string, any> = {};
  if (ids && ids.length > 0) {
    where.id = { in: ids };
  } else {
    if (status) where.approvalStatus = status;
    if (search) {
      where.OR = [
        { mnemonic:   { contains: search, mode: 'insensitive' } },
        { fullName1:  { contains: search, mode: 'insensitive' } },
        { givenName:  { contains: search, mode: 'insensitive' } },
        { familyName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate)   where.createdAt.lte = new Date(toDate);
    }
    if (gender && gender !== 'ALL') where.gender = gender;
  }

  try {
    const records = await prisma.customerOnboarding.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: {
        submittedBy: { select: { name: true } },
        reviewedBy:  { select: { name: true } },
      },
      // Limit to 50k to prevent server OOM for now
      take: 50000 
    });

    return { success: true as const, records };
  } catch (err) {
    console.error('[exportCustomerOnboardings]', err);
    return { success: false as const, error: 'Failed to export records.' };
  }
}
