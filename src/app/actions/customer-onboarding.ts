'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { ApprovalStatus } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';

import { CustomerOnboardingSchema, type CustomerOnboardingInput } from '@/lib/validations/customer-onboarding';
import { processBase64Image, computePayloadHash } from '@/lib/image-processor';

// Helper function to safely parse T24 responses, which may be malformed or double-serialized
async function safeParseT24Response(response: Response): Promise<[any, string]> {
  const rawText = await response.text();
  
  const parseRecursively = (input: any): any => {
    if (typeof input !== 'string') return input;
    try {
      const parsed = JSON.parse(input);
      // If it's still a string, try parsing again (handles double-serialization)
      if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
        return parseRecursively(parsed);
      }
      return parsed;
    } catch {
      // If parsing fails, check if there's a JSON object embedded in the string
      const match = input.match(/\{.*\}/s);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return { raw: input };
        }
      }
      return { raw: input };
    }
  };

  const result = parseRecursively(rawText);
  return [result, rawText];
}


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
  
  const isVerifier = hasRolePermission(user as any, 'verifier_customer_onboarding');
  if (!systemActor && !isVerifier) {
    return { success: false, error: 'You do not have permission to submit customer onboarding (Verifier role required).' };
  }

  const parsed = CustomerOnboardingSchema.safeParse(rawData);
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const { ipAddress, userAgent } = await getRequestContext();

  // ── Name Normalization ─────────────────────────────────────────────────────
  // Prevent common T24 duplication patterns (e.g., "Full Name Full Name")
  let normalizedFullName1 = data.fullName1?.trim() || '';
  const gName = data.givenName?.trim() || '';
  const fName = data.familyName?.trim() || '';
  const combined = `${gName} ${fName}`.trim();

  if (!normalizedFullName1 && combined) {
    normalizedFullName1 = combined;
  } else if (normalizedFullName1 && combined && normalizedFullName1 === `${combined} ${combined}`) {
    normalizedFullName1 = combined;
  }

  // Derive psuToken for presentation alias
  const psuToken = data.psuToken || data.legalIdNumber || data.nationalIDNumber;

  // ── Payload Deduplication Hash ─────────────────────────────────────────────
  const currentPayloadHash = computePayloadHash(data);

  // ── Image Processing ───────────────────────────────────────────────────────
  // If the picture is a base64 string, process it and store as a file
  let finalPicturePath = data.picture || null;
  if (data.picture && data.picture.startsWith('data:image/')) {
    const result = await processBase64Image(data.picture);
    if (!result.success) {
      return { success: false, error: `Image Processing Error: ${result.error}` };
    }
    finalPicturePath = result.filePath || null;
  }

  try {
    const record = await prisma.$transaction(async (tx) => {
      // ── Idempotency, Deduplication and Throttling logic (Inside Transaction) 
      // Perform a serializable-like check by finding the latest record
      const existing = await tx.customerOnboarding.findFirst({ 
        where: { mnemonic: data.mnemonic },
        orderBy: { createdAt: 'desc' } 
      });

      let parentId: string | null = null;
      let status: ApprovalStatus = 'PENDING';

      if (existing) {
        const s = existing.approvalStatus;

        // 1. Cooldown Check (e.g., 2 minutes)
        const COOLDOWN_MS = 2 * 60 * 1000;
        const timeSinceLast = Date.now() - existing.createdAt.getTime();
        if (timeSinceLast < COOLDOWN_MS && (s === 'REJECTED' || s === 'MAKER_REJECTED' || s === 'RESUBMITTED' || s === 'PENDING')) {
           throw new Error(`THROTTLED: Please wait at least 2 minutes between submissions for mnemonic "${data.mnemonic}".`);
        }

        // 2. Exact Payload Duplicate Check
        if (existing.payloadHash === currentPayloadHash && (s === 'REJECTED' || s === 'MAKER_REJECTED' || s === 'RESUBMITTED' || s === 'PENDING')) {
           throw new Error(`DUPLICATE: A submission with identical data already exists for mnemonic "${data.mnemonic}". No changes detected.`);
        }

        // 3. Resubmission logic
        if (s === 'REJECTED' || s === 'MAKER_REJECTED') {
          parentId = existing.id;
          status = 'RESUBMITTED';
        } else {
          // Any other state (PENDING, APPROVED, etc.) is a conflict
          throw new Error(`CONFLICT: Mnemonic "${data.mnemonic}" already exists with status: ${s}`);
        }
      }

      const newRecord = await tx.customerOnboarding.create({
        data: {
          ...data,
          fullName1:          normalizedFullName1,
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
          legalIdNumber:      data.legalIdNumber      || null,
          nationalIDNumber:   data.nationalIDNumber   || null,
          psuToken:           psuToken                || null,
          picture:            finalPicturePath,
          payloadHash:        currentPayloadHash,
          submittedById:      systemActor ? null : (user as any).id,
          approvalStatus:     status,
          parentCustomerId:   parentId,
        },
      });

      await tx.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: newRecord.id,
          actorId:   systemActor ? null : (user as any).id,
          action:    status === 'RESUBMITTED' ? 'RESUBMITTED' : 'SUBMITTED',
          details:   status === 'RESUBMITTED' 
            ? `Customer resubmission for mnemonic: ${data.mnemonic}. Linked to previous attempt: ${parentId}`
            : `Customer onboarding submitted for mnemonic: ${data.mnemonic}`,
          ipAddress,
          userAgent,
        },
      });

      return { record: newRecord, status };
    });

    await logSecurityEvent({
      event: record.status === 'RESUBMITTED' ? SecurityEvent.CUSTOMER_ONBOARDING_SUBMITTED : SecurityEvent.CUSTOMER_ONBOARDING_SUBMITTED,
      severity: LogSeverity.INFO,
      actor: systemActor ? null : user,
      details: `${record.status === 'RESUBMITTED' ? 'Resubmission' : 'New submission'} via ${systemActor ? 'System API' : 'Web UI'}. Mnemonic: ${data.mnemonic}, Record ID: ${record.record.id}`,
      targetId: record.record.id,
      targetType: 'CustomerOnboarding',
    });

    return { success: true, id: record.record.id };
  } catch (err: any) {
    if (err.message.startsWith('CONFLICT:')) {
      return { success: false, error: 'This customer already exists and is awaiting approval.' };
    }
    if (err.message.startsWith('THROTTLED:')) {
      return { success: false, error: err.message.replace('THROTTLED: ', '') };
    }
    if (err.message.startsWith('DUPLICATE:')) {
      return { success: false, error: 'Identical data submission detected. Please ensure you have made necessary corrections before resubmitting.' };
    }
    console.error('[submitCustomerOnboarding]', err);
    return { success: false, error: 'We encountered an issue while submitting the customer onboarding. Please try again.' };
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

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'verifier_customer_onboarding');
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
  // Approvers and Verifiers can see all submissions for review purposes.
  // Others (if any) are restricted to their own submissions.
  const isApprover = hasRolePermission(user, 'approver_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
  const isVerifier = hasRolePermission(user, 'verifier_customer_onboarding');
  
  if (!isApprover && !isVerifier) {
    where.submittedById = user.id;
  }

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
        select: {
          // Standard metadata
          id: true,
          mnemonic: true,
          approvalStatus: true,
          createdAt: true,
          updatedAt: true,
          forwardedAt: true,
          forwardError: true,
          
          // Identity (List essentials)
          shortName: true,
          fullName1: true,
          fullName2: true,
          givenName: true,
          familyName: true,
          title: true,
          gender: true,
          dateOfBirth: true,
          nationality: true,
          legalIdNumber: true,
          nationalIDNumber: true,
          psuToken: true,
          
          // Contact (List essentials)
          mobilePhoneNumbers: true,
          phoneNumbersRes: true,
          
          // Relations (Selected fields only)
          submittedBy: { select: { id: true, name: true, email: true } },
          approverReviewedBy:  { select: { id: true, name: true, email: true } },
          verifierReviewedBy: { select: { id: true, name: true, email: true } },
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

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'verifier_customer_onboarding');
  if (!canReview && !canSubmit) return { success: false as const, error: 'Access denied.' };

  try {
    const record = await prisma.customerOnboarding.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
        approverReviewedBy:  { select: { id: true, name: true, email: true } },
        verifierReviewedBy: { select: { id: true, name: true, email: true } },
        auditLogs: {
          orderBy: { timestamp: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!record) return { success: false as const, error: 'Record not found.' };
    
    const isApprover = hasRolePermission(user, 'approver_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
    const isVerifier = hasRolePermission(user, 'verifier_customer_onboarding');

    if (!isApprover && !isVerifier && record.submittedById !== user.id) {
      return { success: false as const, error: 'Access denied.' };
    }

    // Extract T24 response data if available
    const forwardResponse = record.forwardResponse as any;
    const accountNumber = forwardResponse?.accountNumber || null;
    const accountHolderName = forwardResponse?.accountHolderName || null;

    const enhancedRecord = {
      ...record,
      accountNumber,
      accountHolderName,
    };

    return { success: true as const, record: enhancedRecord };
  } catch (err) {
    console.error('[getCustomerOnboarding]', err);
    return { success: false as const, error: 'Failed to fetch record.' };
  }
}

/**
 * Fetches historical data for comparison when a record is a resubmission.
 * Links to parentCustomerId and provides side-by-side data.
 */
export async function getHistoricalComparison(recordId: string) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const canReview = hasRolePermission(user, 'review_customer_onboarding') || 
                    hasRolePermission(user, 'approver_customer_onboarding') ||
                    hasRolePermission(user, 'verifier_customer_onboarding');
  if (!canReview) return { success: false, error: 'Access denied.' };

  const { ipAddress, userAgent } = await getRequestContext();

  try {
    const current = await prisma.customerOnboarding.findUnique({
      where: { id: recordId },
      select: { parentCustomerId: true, mnemonic: true }
    });

    if (!current || !current.parentCustomerId) {
      return { success: false, error: 'No historical record found for this submission.' };
    }

    const previous = await prisma.customerOnboarding.findUnique({
      where: { id: current.parentCustomerId },
      include: {
        submittedBy: { select: { id: true, name: true } },
        verifierReviewedBy: { select: { id: true, name: true } },
        approverReviewedBy: { select: { id: true, name: true } },
      }
    });

    if (!previous) {
      return { success: false, error: 'Parent record could not be found.' };
    }

    // Audit log this access
    await prisma.customerOnboardingAuditLog.create({
      data: {
        customerOnboardingId: recordId,
        actorId: user.id,
        action: 'VIEW_HISTORY',
        details: `User viewed historical comparison with rejected record: ${previous.id} (Mnemonic: ${current.mnemonic})`,
        ipAddress,
        userAgent,
      }
    });

    return { success: true, previous };
  } catch (err) {
    console.error('[getHistoricalComparison]', err);
    return { success: false, error: 'Failed to fetch historical comparison.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW  – refined two-step verifier–approver–T24 sequence
// ─────────────────────────────────────────────────────────────────────────────
export async function reviewCustomerOnboarding(opts: {
  id: string;
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { id, decision, note } = opts;
  const { ipAddress, userAgent } = await getRequestContext();

  // Enforce mandatory comments for rejections
  if (decision === 'REJECTED' && (!note || note.trim().length === 0)) {
    return { success: false, error: 'Review comments are mandatory for rejection actions.' };
  }

  try {
    const existing = await prisma.customerOnboarding.findUnique({ 
      where: { id },
      include: { 
        submittedBy:      { select: { id: true, name: true } }, 
        verifierReviewedBy:  { select: { id: true, name: true } },
        approverReviewedBy:       { select: { id: true, name: true } }
      }
    });
    if (!existing) return { success: false, error: 'Record not found.' };

    const isVerifierRole = hasRolePermission(user, 'verifier_customer_onboarding');
    const isApproverRole = hasRolePermission(user, 'approver_customer_onboarding');
    const isAdmin = hasRolePermission(user, 'admin');

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: Verifier Decision (PENDING, REQUIRES_REVIEW, or RESUBMITTED)
    // ─────────────────────────────────────────────────────────────────────────
    if (existing.approvalStatus === 'PENDING' || existing.approvalStatus === 'REQUIRES_REVIEW' || existing.approvalStatus === 'RESUBMITTED') {
      if (!isVerifierRole && !isAdmin) {
        return { success: false, error: 'You do not have the Verifier role required for this action.' };
      }

      // Verifier-Approver enforcement: Person who submitted cannot be the Verifier reviewer
      if (existing.submittedById === user.id && !isAdmin) {
        return { success: false, error: 'Internal Control Violation: As the submitter, you cannot perform the first review.' };
      }

      const nextStatus: ApprovalStatus = decision === 'APPROVED' ? 'PENDING_APPROVER' : 'VERIFIER_REJECTED';
      const auditAction = decision === 'APPROVED' ? 'VERIFIER_VERIFIED' : 'VERIFIER_REJECTED';

      await prisma.$transaction(async (tx) => {
        await tx.customerOnboarding.update({
          where: { id },
          data: {
            approvalStatus:    nextStatus,
            verifierReviewedById: user.id,
            verifierReviewedAt:   new Date(),
            verifierReviewNote:   note || null,
          },
        });

        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId:   user.id,
            action:    auditAction,
            details:   note || `Stage 1 (Verifier) ${decision === 'APPROVED' ? 'verified' : 'rejected'} by ${user.name}`,
            ipAddress,
            userAgent,
          },
        });
      });

      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Stage 1 (Verifier) ${decision === 'APPROVED' ? 'Verification' : 'Rejection'} complete. Status: ${nextStatus}. Mnemonic: ${existing.mnemonic}`,
        targetId: id,
        targetType: 'CustomerOnboarding',
      });

      return { success: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2: Approver Decision (PENDING_APPROVER, SYNC_FAILED, or VERIFIER_REJECTED)
    // ─────────────────────────────────────────────────────────────────────────
    if (existing.approvalStatus === 'PENDING_APPROVER' || existing.approvalStatus === 'SYNC_FAILED' || existing.approvalStatus === 'VERIFIER_REJECTED') {
      if (!isApproverRole && !isAdmin) {
        return { success: false, error: 'You do not have the Approver role required for this action.' };
      }

      // Verifier-Approver enforcement: Final approver must be different from the Verifier reviewer
      if (existing.verifierReviewedById === user.id && !isAdmin) {
        return { success: false, error: 'Internal Control Violation: As the Stage 1 reviewer (Verifier), you cannot perform the final Approver review.' };
      }

      let nextStatus: ApprovalStatus;
      let auditAction: string;
      let triggerT24 = false;

      if (existing.approvalStatus === 'PENDING_APPROVER' || (existing.approvalStatus === 'SYNC_FAILED' && decision === 'APPROVED')) {
        if (decision === 'APPROVED') {
          nextStatus = 'AWAITING_T24_RESPONSE';
          auditAction = 'APPROVER_APPROVED_SENDING_TO_CORE';
          triggerT24 = true;
        } else {
          // Approver rejects Verifier's approval -> Revert to Verifier
          nextStatus = 'REQUIRES_REVIEW';
          auditAction = 'APPROVER_REJECTED_TO_VERIFIER';
        }
      } else if (existing.approvalStatus === 'VERIFIER_REJECTED') {
        if (decision === 'REJECTED') {
          // Approver confirms Verifier's rejection -> Final REJECTED
          nextStatus = 'REJECTED';
          auditAction = 'APPROVER_REJECTED_CONFIRM';
        } else {
          // Approver approves Verifier's rejection -> Revert to Verifier for correction
          nextStatus = 'REQUIRES_REVIEW';
          auditAction = 'APPROVER_APPROVED_TO_VERIFIER';
        }
      } else {
          // SYNC_FAILED and decision is REJECTED
          nextStatus = 'REQUIRES_REVIEW';
          auditAction = 'APPROVER_REJECTED_SYNC_FAILED';
      }

      await prisma.$transaction(async (tx) => {
        await tx.customerOnboarding.update({
          where: { id },
          data: {
            approvalStatus: nextStatus,
            approverReviewedById:   user.id,
            approverReviewedAt:     new Date(),
            approverReviewNote:     note || null,
          },
        });

        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId:   user.id,
            action:    auditAction,
            details:   note || `Stage 2 (Approver) ${decision.toLowerCase()} (Transition to ${nextStatus}) by ${user.name}`,
            ipAddress,
            userAgent,
          },
        });
      });

      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Stage 2 (Approver) decision complete. Final Status: ${nextStatus}. Mnemonic: ${existing.mnemonic}`,
        targetId: id,
        targetType: 'CustomerOnboarding',
      });

      if (triggerT24) {
        const syncResult = await forwardToCoreBanking(id, user.id);
        if (!syncResult.success) {
          return { 
            success: false, 
            error: syncResult.error || 'The approval was recorded, but the T24 core sync failed. Please check the sync error and retry.' 
          };
        }
        return { 
          success: true, 
          message: 'Customer successfully approved and synchronized with T24 core banking.' 
        };
      }

      return { success: true };
    }

    return { success: false, error: `The customer's application is currently in the ${existing.approvalStatus} state and cannot be reviewed at this time.` };

  } catch (err) {
    console.error('[reviewCustomerOnboarding]', err);
    return { success: false, error: 'An unexpected error occurred while processing the review. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FORWARD  – sends an record to the T24 core banking endpoint
// ─────────────────────────────────────────────────────────────────────────────
export async function forwardToCoreBanking(id: string, actorId?: string) {
  const record = await prisma.customerOnboarding.findUnique({ where: { id } });
  if (!record) throw new Error(`Record ${id} not found`);
  
  // Only records that are AWAITING_T24_RESPONSE or SYNC_FAILED can be forwarded
  if (record.approvalStatus !== 'AWAITING_T24_RESPONSE' && record.approvalStatus !== 'SYNC_FAILED' && record.approvalStatus !== 'APPROVED') {
    throw new Error(`Only records awaiting core response or failed sync can be forwarded (current: ${record.approvalStatus})`);
  }
  
  // If it's already fully approved and forwarded, skip
  if (record.approvalStatus === 'APPROVED' && record.forwardedAt) {
    return { success: true, alreadyForwarded: true };
  }

  const { ipAddress, userAgent } = await getRequestContext();

  // Enforce strict T24 contract compliance (42 explicitly defined fields)
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
    legalIdNumber:      record.legalIdNumber?.substring(0, 10) ?? null,
    documentName:       record.documentName,
    nameOnID:           record.nameOnID,
    issueAuthority:     record.issueAuthority,
    issueDate:          record.issueDate ? '01 OCT 2024' : null,
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
    nationalIDNumber:   record.nationalIDNumber?.substring(0, 10) ?? null,
  };

  const T24_ENDPOINT = process.env.T24_API_URL || 'https://nibteratest.nibbank.com.et/api/Test/CustomerCreate';
  const T24_API_KEY  = process.env.T24_API_KEY;

  console.log('\n================================================================');
  console.log(`🚀 [T24 INGESTION START] Record ID: ${id}`);
  console.log(`👤 ACTOR: ${actorId || 'System'}`);
  console.log(`📍 ENDPOINT: ${T24_ENDPOINT}`);
  console.log('================================================================\n');

  try {
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };
    if (T24_API_KEY) {
      fetchHeaders['Authorization'] = `Bearer ${T24_API_KEY}`;
      console.log('🔑 Auth: API Key provided');
    } else {
      console.log('⚠️ Auth: No API Key provided in environment');
    }

    console.log('\n� [T24 PAYLOAD]');
    console.log(JSON.stringify(payload, null, 2));
    console.log('----------------------------------------------------------------\n');

    console.log(`⏳ Sending POST request to T24...`);
    const startTime = Date.now();
    
    // Workaround for SSL issues in internal environments
    const T24_SKIP_SSL = process.env.T24_SKIP_SSL === 'true';
    if (T24_SKIP_SSL) {
      console.log('⚠️ SSL verification is disabled for T24 ingestion (T24_SKIP_SSL=true)');
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    let response: Response;
    try {
      response = await fetch(T24_ENDPOINT, {
        method:  'POST',
        headers: fetchHeaders,
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(30_000),
      });
    } catch (fetchErr: any) {
      console.error('❌ Fetch attempt failed:', fetchErr);
      if (fetchErr.name === 'AbortError' || fetchErr.message?.includes('timeout')) {
        throw new Error(`Connection to T24 timed out after 30 seconds. Please check if the service is reachable.`);
      }
      if (fetchErr.message?.includes('fetch failed')) {
        throw new Error(`Network error: Could not connect to T24 at ${T24_ENDPOINT}. This is likely a DNS, firewall, or SSL issue.`);
      }
      throw fetchErr;
    } finally {
      // Reset SSL check after the call if we changed it
      if (T24_SKIP_SSL) {
        // We don't want to leave it as '0' forever, but setting it back to '1' 
        // might be tricky if other concurrent requests need it.
        // However, in a bank internal server, it might be acceptable.
        // process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
      }
    }

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || 'unknown';

    console.log(` [T24 RESPONSE] Status: ${response.status}, Duration: ${duration}ms, Content-Type: ${contentType}`);
    
    const [responseData, rawBody] = await safeParseT24Response(response);
    console.log(' [T24 RAW BODY]', rawBody);
    console.log(' [T24 PARSED DATA]', responseData);
    console.log('================================================================\n');

    if (response.ok) {
      // ── Business-level failure detection (case-insensitive) ───────────────
      // Ensure we are working with an object for property checks
      const isObject = responseData && typeof responseData === 'object' && !Array.isArray(responseData);
      const status = isObject ? String(responseData?.status || '').toLowerCase() : '';
      const hasErrorField = isObject && !!responseData?.error;

      if (status === 'failed' || status === 'error' || hasErrorField) {
        let errorMsg = isObject ? (responseData?.error || responseData?.message) : null;
        
        // Handle nested JSON in the error field (e.g., {"messages": [...]})
        if (typeof errorMsg === 'string' && errorMsg.startsWith('{')) {
          try {
            const nested = JSON.parse(errorMsg);
            if (nested.messages && Array.isArray(nested.messages)) {
              // Deduplicate and join messages
              errorMsg = Array.from(new Set(nested.messages)).join('; ');
            } else if (nested.error) {
              errorMsg = nested.error;
            } else if (nested.message) {
              errorMsg = nested.message;
            }
          } catch {
            // If parsing fails, stick with the raw string
          }
        }

        const finalMsg = errorMsg || 'T24 returned a failure status without details.';
        throw new Error(`T24_BUSINESS_ERROR: ${finalMsg}`);
      }

      await prisma.customerOnboarding.update({
        where: { id },
        data: {
          forwardedAt: new Date(),
          forwardError: null,
          forwardResponse: responseData, // Always store the parsed (or raw) response
          approvalStatus: 'APPROVED', // Final status after successful T24 response
        },
      });

      await prisma.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId: actorId || null,
          action: 'FORWARDED_AND_APPROVED',
          details: `Record successfully forwarded to T24 and officially APPROVED. Duration: ${duration}ms.`,
          ipAddress,
          userAgent,
        },
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

    } else {
      const errorDetails = `Status: ${response.status} ${response.statusText}. Body: ${rawBody}`;
      throw new Error(`T24 forwarding failed. ${errorDetails}`);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`\n💥 [T24 INGESTION FAILED]`);
    console.error(`ID: ${id}`);
    console.error(`ERROR: ${errorMessage}\n`);

    await prisma.$transaction(async (tx) => {
      await tx.customerOnboarding.update({
        where: { id },
        data:  { 
            forwardError: errorMessage,
            approvalStatus: 'SYNC_FAILED' // Failure moves to SYNC_FAILED
        },
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

    // Return the actual business error message to the user if it's a T24 business error
    if (errorMessage.startsWith('T24_BUSINESS_ERROR: ')) {
      return { success: false, error: errorMessage.replace('T24_BUSINESS_ERROR: ', '') };
    }

    return { success: false, error: 'We were unable to forward the customer information to the core banking system. Please try again later.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL RETRY FORWARD (called from review panel by reviewer)
// ─────────────────────────────────────────────────────────────────────────────
export async function retryForwardToCoreBanking(id: string) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding') || hasRolePermission(user, 'verifier_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }
  
  // Set status back to AWAITING_T24_RESPONSE before retrying
  await prisma.customerOnboarding.update({
      where: { id },
      data: { approvalStatus: 'AWAITING_T24_RESPONSE', forwardError: null }
  });

  return forwardToCoreBanking(id, user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK RETRY FORWARD (called from review panel by reviewer)
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkRetryForwardToCoreBanking(ids: string[]) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }

  if (!ids.length) {
    return { success: false, error: 'No records selected for bulk retry.' };
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      // Set status back to AWAITING_T24_RESPONSE before retrying
      await prisma.customerOnboarding.update({
          where: { id },
          data: { approvalStatus: 'AWAITING_T24_RESPONSE', forwardError: null }
      });
      const result = await forwardToCoreBanking(id, user.id);
      results.push({ id, success: result.success, error: result.error });
    } catch (err: any) {
      results.push({ id, success: false, error: err.message || 'Unknown error during retry.' });
    }
  }

  const allSuccess = results.every(r => r.success);
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.length - successCount;

  if (allSuccess) {
    return { success: true, message: `Successfully retried ${successCount} customer(s) to T24 core banking.`, results };
  } else if (successCount > 0) {
    return { success: false, error: `Retried ${successCount} successfully, but ${failedCount} failed.`, results };
  } else {
    return { success: false, error: `Failed to retry any of the selected customers.`, results };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK REVIEW – three-step verifier–sync–approver workflow
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkReviewCustomerOnboarding(opts: {
  ids: string[];
  decision: 'APPROVED' | 'REJECTED';
}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }

  const { ids, decision } = opts;
  if (!ids.length) return { success: false, error: 'No records selected.' };

  const { ipAddress, userAgent } = await getRequestContext();

  try {
    const isVerifier = hasRolePermission(user, 'verifier_customer_onboarding');
    const isApprover = hasRolePermission(user, 'approver_customer_onboarding');
    const isAdmin = hasRolePermission(user, 'admin');

    const results = await prisma.$transaction(async (tx) => {
      // 1. Stage 1: Verifier Decision (PENDING, REQUIRES_REVIEW, or RESUBMITTED)
      const stage1Batch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: { in: ['PENDING', 'REQUIRES_REVIEW', 'RESUBMITTED'] },
          ...(isAdmin ? {} : { NOT: { submittedById: user.id } })
        },
        select: { id: true }
      });

      if (stage1Batch.length > 0 && !isVerifier && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 1 (Verifier) bulk actions.");
      }
      
      const stage1Ids = stage1Batch.map(r => r.id);
      if (stage1Ids.length > 0) {
        const nextStatus = decision === 'APPROVED' ? 'PENDING_APPROVER' : 'VERIFIER_REJECTED';

        await tx.customerOnboarding.updateMany({
          where: { id: { in: stage1Ids } },
          data: { 
            approvalStatus: nextStatus, 
            verifierReviewedById: user.id, 
            verifierReviewedAt: new Date(),
            verifierReviewNote: decision === 'REJECTED' ? 'Bulk rejected by Verifier' : null
          }
        });
        await tx.customerOnboardingAuditLog.createMany({
          data: stage1Ids.map(rid => ({
            customerOnboardingId: rid,
            actorId: user.id,
            action: decision === 'APPROVED' ? 'VERIFIER_VERIFIED' : 'VERIFIER_REJECTED',
            details: `Bulk Stage 1 (Verifier) ${decision === 'APPROVED' ? 'verification' : 'rejection'}.`,
            ipAddress, userAgent
          }))
        });
      }

      // 2. Stage 2: Approver Decision (PENDING_APPROVER, SYNC_FAILED, or VERIFIER_REJECTED)
      
      // 2a. Handle PENDING_APPROVER or SYNC_FAILED (only approvals)
      const stage2ApproveBatch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: { in: ['PENDING_APPROVER', 'SYNC_FAILED'] }, 
          ...(isAdmin ? {} : { NOT: { verifierReviewedById: user.id } })
        },
        select: { id: true }
      });

      if (stage2ApproveBatch.length > 0 && !isApprover && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 2 (Approver) bulk actions.");
      }
      
      const stage2ApproveIds = stage2ApproveBatch.map(r => r.id);
      let approverApprovedIds: string[] = [];
      if (stage2ApproveIds.length > 0) {
        if (decision === 'APPROVED') {
          approverApprovedIds = stage2ApproveIds;
          const nextStatus = 'AWAITING_T24_RESPONSE';

          await tx.customerOnboarding.updateMany({
            where: { id: { in: stage2ApproveIds } },
            data: { 
              approvalStatus: nextStatus, 
              approverReviewedById: user.id, 
              approverReviewedAt: new Date(),
              approverReviewNote: null
            }
          });
          await tx.customerOnboardingAuditLog.createMany({
            data: stage2ApproveIds.map(rid => ({
              customerOnboardingId: rid,
              actorId: user.id,
              action: 'APPROVER_APPROVED_SENDING_TO_CORE',
              details: `Bulk Stage 2 (Approver) approved and sending to core.`,
              ipAddress, userAgent
            }))
          });
        } else {
          // Bulk rejection for Stage 2
          const nextStatus = 'REQUIRES_REVIEW';
          await tx.customerOnboarding.updateMany({
            where: { id: { in: stage2ApproveIds } },
            data: { 
              approvalStatus: nextStatus, 
              approverReviewedById: user.id, 
              approverReviewedAt: new Date(),
              approverReviewNote: 'Bulk rejected by Approver'
            }
          });
          await tx.customerOnboardingAuditLog.createMany({
            data: stage2ApproveIds.map(rid => ({
              customerOnboardingId: rid,
              actorId: user.id,
              action: 'APPROVER_REJECTED_TO_VERIFIER',
              details: `Bulk Stage 2 (Approver) rejected and reverted to Verifier.`,
              ipAddress, userAgent
            }))
          });
        }
      }

      // 2b. Handle VERIFIER_REJECTED (only rejections)
      const stage2ConfirmRejectBatch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: 'VERIFIER_REJECTED', 
          ...(isAdmin ? {} : { NOT: { verifierReviewedById: user.id } })
        },
        select: { id: true }
      });

      if (stage2ConfirmRejectBatch.length > 0 && !isApprover && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 2 (Approver) bulk actions.");
      }

      const stage2ConfirmRejectIds = stage2ConfirmRejectBatch.map(r => r.id);
      if (stage2ConfirmRejectIds.length > 0) {
        if (decision === 'REJECTED') {
            const nextStatus = 'REJECTED'; // Confirmed final rejection
            await tx.customerOnboarding.updateMany({
              where: { id: { in: stage2ConfirmRejectIds } },
              data: { 
                approvalStatus: nextStatus, 
                approverReviewedById: user.id, 
                approverReviewedAt: new Date(),
                approverReviewNote: 'Bulk rejection confirmed by Approver'
              }
            });
            await tx.customerOnboardingAuditLog.createMany({
              data: stage2ConfirmRejectIds.map(rid => ({
                customerOnboardingId: rid,
                actorId: user.id,
                action: 'APPROVER_REJECTED_CONFIRM',
                details: `Bulk Stage 2 (Approver) final rejection confirmed.`,
                ipAddress, userAgent
              }))
            });
        }
      }

      return { 
        count: stage1Ids.length + stage2ApproveIds.length + stage2ConfirmRejectIds.length, 
        approverApproved: approverApprovedIds
      };
    });

    if (results.count > 0) {
      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Bulk ${decision} performed on ${results.count} records.`,
      });

      // Trigger T24 Sync for Approver-approved records
      for (const rid of results.approverApproved) {
        forwardToCoreBanking(rid, user.id).catch(err => 
          console.error(`[bulk-approver-sync fail] ID: ${rid}`, err)
        );
      }
    }

    return { success: true, count: results.count };
  } catch (err) {
    console.error('[bulkReviewCustomerOnboarding]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to process bulk decision.' };
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
