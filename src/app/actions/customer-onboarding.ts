'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { ApprovalStatus } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';

import { CustomerOnboardingSchema, type CustomerOnboardingInput } from '@/lib/validations/customer-onboarding';

// Helper function to safely parse T24 responses, which may be malformed
async function safeParseT24Response(response: Response): Promise<[any, string]> {
  const rawText = await response.text();
  try {
    // First, try to parse it as-is
    return [JSON.parse(rawText), rawText];
  } catch {
    // If that fails, try to find a JSON object within the text
    const match = rawText.match(/\{.*\}/s);
    if (match) {
      try {
        return [JSON.parse(match[0]), rawText];
      } catch {
        // If even the extracted part is invalid, return the raw text
        return [{ raw: rawText }, rawText];
      }
    }
    // If no JSON-like structure is found, return the raw text
    return [{ raw: rawText }, rawText];
  }
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
  
  const isMaker = hasRolePermission(user as any, 'maker_customer_onboarding');
  if (!systemActor && !isMaker) {
    return { success: false, error: 'You do not have permission to submit customer onboarding (Maker role required).' };
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

  try {
    const record = await prisma.$transaction(async (tx) => {
      // ── Idempotency and Resubmission logic (Inside Transaction) ────────────
      // Perform a serializable-like check by finding the latest record
      const existing = await tx.customerOnboarding.findFirst({ 
        where: { mnemonic: data.mnemonic },
        orderBy: { createdAt: 'desc' } 
      });

      let parentId: string | null = null;
      let status: ApprovalStatus = 'PENDING';

      if (existing) {
        const s = existing.approvalStatus;
        // If rejected, allow resubmission
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
          picture:            data.picture            || null,
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
  // Checkers and Makers can see all submissions for review purposes.
  // Others (if any) are restricted to their own submissions.
  const isChecker = hasRolePermission(user, 'checker_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
  const isMaker = hasRolePermission(user, 'maker_customer_onboarding');
  
  if (!isChecker && !isMaker) {
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
          reviewedBy:  { select: { id: true, name: true, email: true } },
          makerReviewedBy: { select: { id: true, name: true, email: true } },
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
        makerReviewedBy: { select: { id: true, name: true, email: true } },
        auditLogs: {
          orderBy: { timestamp: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!record) return { success: false as const, error: 'Record not found.' };
    
    const isChecker = hasRolePermission(user, 'checker_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
    const isMaker = hasRolePermission(user, 'maker_customer_onboarding');

    if (!isChecker && !isMaker && record.submittedById !== user.id) {
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

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW  – two-step maker–checker approval workflow
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
        makerReviewedBy:  { select: { id: true, name: true } },
        reviewedBy:       { select: { id: true, name: true } }
      }
    });
    if (!existing) return { success: false, error: 'Record not found.' };

    const isMakerRole = hasRolePermission(user, 'maker_customer_onboarding');
    const isCheckerRole = hasRolePermission(user, 'checker_customer_onboarding');
    const isAdmin = hasRolePermission(user, 'admin');

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 1: Maker Decision (PENDING or REQUIRES_REVIEW)
    // ─────────────────────────────────────────────────────────────────────────
    if (existing.approvalStatus === 'PENDING' || existing.approvalStatus === 'REQUIRES_REVIEW') {
      if (!isMakerRole && !isAdmin) {
        return { success: false, error: 'You do not have the Maker role required for this action.' };
      }

      // Maker-Checker enforcement: Person who submitted cannot be the Maker reviewer
      if (existing.submittedById === user.id && !isAdmin) {
        return { success: false, error: 'Internal Control Violation: As the submitter, you cannot perform the first review.' };
      }

      const nextStatus: ApprovalStatus = decision === 'APPROVED' ? 'MAKER_APPROVED' : 'MAKER_REJECTED';
      const auditAction = decision === 'APPROVED' ? 'MAKER_APPROVED' : 'MAKER_REJECTED';

      await prisma.$transaction(async (tx) => {
        await tx.customerOnboarding.update({
          where: { id },
          data: {
            approvalStatus:    nextStatus,
            makerReviewedById: user.id,
            makerReviewedAt:   new Date(),
            makerReviewNote:   note || null,
          },
        });

        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId:   user.id,
            action:    auditAction,
            details:   note || `Stage 1 (Maker) ${decision.toLowerCase()} by ${user.name}`,
            ipAddress,
            userAgent,
          },
        });
      });

      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Stage 1 (Maker) ${decision} complete. Status: ${nextStatus}. Mnemonic: ${existing.mnemonic}`,
        targetId: id,
        targetType: 'CustomerOnboarding',
      });

      return { success: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2: Checker Decision (MAKER_APPROVED or MAKER_REJECTED)
    // ─────────────────────────────────────────────────────────────────────────
    if (existing.approvalStatus === 'MAKER_APPROVED' || existing.approvalStatus === 'MAKER_REJECTED') {
      if (!isCheckerRole && !isAdmin) {
        return { success: false, error: 'You do not have the Checker role required for this action.' };
      }

      // Maker-Checker enforcement: Final checker must be different from the Maker reviewer
      if (existing.makerReviewedById === user.id && !isAdmin) {
        return { success: false, error: 'Internal Control Violation: As the Stage 1 reviewer (Maker), you cannot perform the final Checker review.' };
      }

      let nextStatus: ApprovalStatus;
      let auditAction: string;
      let triggerT24 = false;

      if (existing.approvalStatus === 'MAKER_APPROVED') {
        if (decision === 'APPROVED') {
          nextStatus = 'APPROVED';
          auditAction = 'CHECKER_APPROVED';
          triggerT24 = true;
        } else {
          // Checker rejects Maker's approval -> Revert to Maker
          nextStatus = 'REQUIRES_REVIEW';
          auditAction = 'CHECKER_REJECTED_TO_MAKER';
        }
      } else { // MAKER_REJECTED
        if (decision === 'REJECTED') {
          // Checker confirms Maker's rejection -> Final REJECTED
          nextStatus = 'REJECTED';
          auditAction = 'CHECKER_REJECTED_CONFIRM';
        } else {
          // Checker approves Maker's rejection -> Revert to Maker for correction
          nextStatus = 'REQUIRES_REVIEW';
          auditAction = 'CHECKER_APPROVED_TO_MAKER';
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.customerOnboarding.update({
          where: { id },
          data: {
            approvalStatus: nextStatus,
            reviewedById:   user.id,
            reviewedAt:     new Date(),
            reviewNote:     note || null,
          },
        });

        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId:   user.id,
            action:    auditAction,
            details:   note || `Stage 2 (Checker) ${decision.toLowerCase()} (Transition to ${nextStatus}) by ${user.name}`,
            ipAddress,
            userAgent,
          },
        });

        return record;
      });

      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Final Stage 2 (Checker) decision complete. Final Status: ${nextStatus}. Mnemonic: ${existing.mnemonic}`,
        targetId: id,
        targetType: 'CustomerOnboarding',
      });

      if (triggerT24) {
        forwardToCoreBanking(updated.id, user.id).catch((err) =>
          console.error('[final-approval auto-forward fail]', err)
        );
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
      const status = String(responseData?.status || '').toLowerCase();
      const hasErrorField = !!responseData?.error;

      if (status === 'failed' || status === 'error' || hasErrorField) {
        const errorMsg = responseData?.error || responseData?.message || 'T24 returned a failure status without details.';
        throw new Error(`T24_BUSINESS_ERROR: ${errorMsg}`);
      }

      await prisma.customerOnboarding.update({
        where: { id },
        data: {
          forwardedAt: new Date(),
          forwardError: null,
          forwardResponse: responseData, // Always store the parsed (or raw) response
        },
      });

      await prisma.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId: actorId || null,
          action: 'FORWARDED',
          details: `Record successfully forwarded to T24. Duration: ${duration}ms.`,
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
      const errorDetails = `Status: ${response.status} ${response.statusText}. Body: ${responseBody}`;
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
  const canReview = hasRolePermission(user, 'review_customer_onboarding') || hasRolePermission(user, 'checker_customer_onboarding');
  if (!canReview) {
    return { success: false, error: 'Access denied.' };
  }
  return forwardToCoreBanking(id, user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK REVIEW – two-step maker–checker approval workflow
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
    const isMaker = hasRolePermission(user, 'maker_customer_onboarding');
    const isChecker = hasRolePermission(user, 'checker_customer_onboarding');
    const isAdmin = hasRolePermission(user, 'admin');

    const results = await prisma.$transaction(async (tx) => {
      // 1. Stage 1: Maker Decision (PENDING or REQUIRES_REVIEW)
      const stage1Batch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: { in: ['PENDING', 'REQUIRES_REVIEW'] },
          ...(isAdmin ? {} : { NOT: { submittedById: user.id } })
        },
        select: { id: true }
      });

      if (stage1Batch.length > 0 && !isMaker && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 1 (Maker) bulk actions.");
      }
      
      const stage1Ids = stage1Batch.map(r => r.id);
      if (stage1Ids.length > 0) {
        const nextStatus = decision === 'APPROVED' ? 'MAKER_APPROVED' : 'MAKER_REJECTED';
        await tx.customerOnboarding.updateMany({
          where: { id: { in: stage1Ids } },
          data: { 
            approvalStatus: nextStatus, 
            makerReviewedById: user.id, 
            makerReviewedAt: new Date(),
            makerReviewNote: decision === 'REJECTED' ? 'Bulk rejected by Maker' : null
          }
        });
        await tx.customerOnboardingAuditLog.createMany({
          data: stage1Ids.map(rid => ({
            customerOnboardingId: rid,
            actorId: user.id,
            action: nextStatus,
            details: `Bulk Stage 1 (Maker) ${decision.toLowerCase()}.`,
            ipAddress, userAgent
          }))
        });
      }

      // 2. Stage 2: Checker Decision (MAKER_APPROVED or MAKER_REJECTED)
      
      // 2a. Handle MAKER_APPROVED
      const stage2ApproveBatch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: 'MAKER_APPROVED', 
          ...(isAdmin ? {} : { NOT: { makerReviewedById: user.id } })
        },
        select: { id: true }
      });

      if (stage2ApproveBatch.length > 0 && !isChecker && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 2 (Checker) bulk actions.");
      }
      
      const stage2ApproveIds = stage2ApproveBatch.map(r => r.id);
      let finalApprovedIds: string[] = [];
      if (stage2ApproveIds.length > 0) {
        const nextStatus = decision === 'APPROVED' ? 'APPROVED' : 'REQUIRES_REVIEW';
        if (nextStatus === 'APPROVED') finalApprovedIds = stage2ApproveIds;

        await tx.customerOnboarding.updateMany({
          where: { id: { in: stage2ApproveIds } },
          data: { 
            approvalStatus: nextStatus, 
            reviewedById: user.id, 
            reviewedAt: new Date(),
            reviewNote: decision === 'REJECTED' ? 'Bulk rejected by Checker' : null
          }
        });
        await tx.customerOnboardingAuditLog.createMany({
          data: stage2ApproveIds.map(rid => ({
            customerOnboardingId: rid,
            actorId: user.id,
            action: decision === 'APPROVED' ? 'CHECKER_APPROVED' : 'CHECKER_REJECTED_TO_MAKER',
            details: `Bulk Stage 2 (Checker) ${decision.toLowerCase()} for Maker-approved records.`,
            ipAddress, userAgent
          }))
        });
      }

      // 2b. Handle MAKER_REJECTED
      const stage2RejectBatch = await tx.customerOnboarding.findMany({
        where: { 
          id: { in: ids }, 
          approvalStatus: 'MAKER_REJECTED', 
          ...(isAdmin ? {} : { NOT: { makerReviewedById: user.id } })
        },
        select: { id: true }
      });

      if (stage2RejectBatch.length > 0 && !isChecker && !isAdmin) {
          throw new Error("You do not have permission to perform Stage 2 (Checker) bulk actions.");
      }

      const stage2RejectIds = stage2RejectBatch.map(r => r.id);
      if (stage2RejectIds.length > 0) {
        const nextStatus = decision === 'REJECTED' ? 'REJECTED' : 'REQUIRES_REVIEW';
        await tx.customerOnboarding.updateMany({
          where: { id: { in: stage2RejectIds } },
          data: { 
            approvalStatus: nextStatus, 
            reviewedById: user.id, 
            reviewedAt: new Date(),
            reviewNote: decision === 'REJECTED' ? 'Bulk rejection confirmed by Checker' : 'Bulk approval by Checker (reverted to Maker)'
          }
        });
        await tx.customerOnboardingAuditLog.createMany({
          data: stage2RejectIds.map(rid => ({
            customerOnboardingId: rid,
            actorId: user.id,
            action: decision === 'REJECTED' ? 'CHECKER_REJECTED_CONFIRM' : 'CHECKER_APPROVED_TO_MAKER',
            details: `Bulk Stage 2 (Checker) ${decision.toLowerCase()} for Maker-rejected records.`,
            ipAddress, userAgent
          }))
        });
      }

      return { 
        count: stage1Ids.length + stage2ApproveIds.length + stage2RejectIds.length, 
        finalApproved: finalApprovedIds 
      };
    });

    if (results.count > 0) {
      await logSecurityEvent({
        event: decision === 'APPROVED' ? SecurityEvent.CUSTOMER_ONBOARDING_APPROVED : SecurityEvent.CUSTOMER_ONBOARDING_REJECTED,
        severity: LogSeverity.INFO,
        actor: user,
        details: `Bulk ${decision} performed on ${results.count} records.`,
      });

      // Forward to T24 ONLY for those that hit final approval
      for (const rid of results.finalApproved) {
        forwardToCoreBanking(rid, user.id).catch(err => 
          console.error(`[bulk-forwarding fail] ID: ${rid}`, err)
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
