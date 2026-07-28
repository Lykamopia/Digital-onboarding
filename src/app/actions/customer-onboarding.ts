'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { logSecurityEvent, SecurityEvent } from '@/lib/security-logger';
import { LogSeverity } from '@/lib/types';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { getLoggedInUser } from '@/app/actions/memo';

import { CustomerOnboardingSchema, type CustomerOnboardingInput } from '@/lib/validations/customer-onboarding';
import { processBase64Image, computePayloadHash } from '@/lib/image-processor';
import { sendSms } from '@/lib/sms';
import { getRegionLabel, getRegionId } from '@/lib/region-mapping';
import { resolveAccountOfficer, resolveProductType } from '@/lib/onboarding-defaults';

// ─── T24 Payload Schema (Strict Whitelist & Validation) ────────────────────────
// This schema enforces the exact fields and formats required by the T24 core banking API.
// It also strips any undefined or extra data to maintain full contract compliance.
const T24PayloadSchema = z.object({
  mnemonic:           z.string(),
  shortName:          z.string(),
  fullName1:          z.string(),
  fullName2:          z.string().optional().nullable(),
  street:             z.string(),
  townCity:           z.string(),
  country:            z.string().length(2),
  sector:             z.string(),
  // Channel routing — T24 opens the account under this officer and product.
  accountOfficer:     z.string().min(1, 'accountOfficer is required by T24; set DEFAULT_ACCOUNT_OFFICER or have the channel send accountOfficer'),
  product:            z.string().min(1, 'product is required by T24; set DEFAULT_PRODUCT_TYPE in the environment or have the channel send productType'),
  industry:           z.string(),
  target:             z.string(),
  nationality:        z.string().optional().nullable(),
  customerStatus:     z.string(),
  residence:          z.string().optional().nullable(),
  legalIdNumber:      z.string(),
  documentName:       z.string(),
  nameOnID:           z.string(),
  issueAuthority:     z.string(),
  issueDate:          z.string(),
  expirationDate:     z.string(),
  language:           z.string(),
  region:             z.string(),
  phoneNumbersRes:    z.string().optional().nullable(),
  phoneNumber:        z.string(),
  title:              z.enum([
    'ABBA', 'ATO', 'Ambassador', 'Assi.Professor', 'B.General', 'Brother', 'CEO', 'CMDR', 'Capitain', 'Colonel', 
    'Commander', 'DR', 'Dai', 'Daikon', 'Excellency', 'Foreign.Secretary', 'G.Secretary', 'General(Army)', 
    'GeneralAirForce', 'Haji', 'Honourable', 'Kes', 'L.Colonel', 'L.General', 'Lieutant', 'Lieutenant', 'MISS', 
    'MR', 'MRS', 'MS', 'Major', 'Major.General', 'Mayor', 'Megabi.Haddis', 'Meri.Geta', 'Muftih', 'Pastor', 
    'President', 'Professor', 'Qadhi', 'R.Admiral(CMDR)', 'R.AdmiralUpper', 'REV', 'Sheikh', 'Sir', 'Sister', 
    'Speaker', 'Ustaz', 'V.President', 'Vice.Admiral', 'W/O', 'W/T', 'WOY', 'WRO'
  ]),
  givenName:          z.string(),
  familyName:         z.string(),
  gender:             z.string(),
  dateOfBirth:        z.string(),
  maritalStatus:      z.enum(['DIVORCED', 'MARRIED', 'OTHER', 'PARTNER', 'SINGLE', 'WIDOWED']),
  occupation:         z.string().optional().nullable(),
  employersName:      z.string().optional().nullable(),
  netMonthlyIn:       z.string().optional().nullable(),
  customerType:       z.string(),
  secureMessage:      z.string().optional().nullable(),
  houseNo:            z.string().optional().nullable(),
  flatNo:             z.string().optional().nullable(),
  woreda:             z.string().optional().nullable(),
  kebele:             z.string().optional().nullable(),
  subcity:            z.string().optional().nullable(),
  motherName:         z.string().optional().nullable(),
  nationalIDNumber:   z.string().optional().nullable(),
  ownership:          z.string(),
  faydaPsutoken2:     z.string(),
}).strict(); // Enforce NO extra fields

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
/**
 * Sanitizes fields for T24 core banking ingestion.
 * Rules:
 * 1. Remove/Replace special characters: ',/-_*' (underscore becomes space)
 * 2. Trim to max 15 characters
 * 3. Convert to uppercase
 */
function sanitizeForT24(val: string | null | undefined): string {
  if (!val) return '';
  
  // Replace underscore with space as per user example 'SELF_EMPLOYED' -> 'SELF EMPLOYED'
  let cleaned = val.replace(/_/g, ' ');
  
  // Remove other specified characters: ', / - * and others
  // We keep alphanumeric and spaces, removing everything else to be safe
  cleaned = cleaned.replace(/[',/\-*]/g, '');
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, '');
  
  // Collapse multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Max 15 characters and uppercase
  return cleaned.substring(0, 15).toUpperCase();
}

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

  // Region Mapping: Map region ID to label
  if (data.region) {
    data.region = getRegionLabel(data.region);
  }

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
           throw new Error(`DUPLICATE: ${s} A submission with identical data already exists for mnemonic "${data.mnemonic}". No changes detected.`);
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
          ownership:          data.ownership          || '1000',
          // Channel routing: honour what the requester sent, else fall back
          accountOfficer:     resolveAccountOfficer(data.accountOfficer),
          productType:        resolveProductType(data.productType) || null,
          industry:           '1499',
          target:             '220',
          customerStatus:     '1',
          documentName:       'NATIONAL.ID',
          issueAuthority:     'NID',
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
      const status = err.message.split(': ')[1] || 'PENDING';
      if (status === 'PENDING' || status === 'AWAITING_T24_SYNC' || status === 'AWAITING_T24_RESPONSE' || status === 'VERIFIER_APPROVED' || status === 'PENDING_APPROVER') {
        return { success: false, error: `You have already submitted a request for this customer, and it is currently in a PENDING state. Please wait for the initial request to be processed.` };
      }
      return { success: false, error: 'This customer already exists and is awaiting approval.' };
    }
    if (err.message.startsWith('THROTTLED:')) {
      return { success: false, error: err.message.replace('THROTTLED: ', '') };
    }
    if (err.message.startsWith('DUPLICATE:')) {
      const status = err.message.split('DUPLICATE: ')[1]?.split(' ')[0] || '';
      if (status === 'PENDING') {
        return { success: false, error: `You have already submitted a request for this customer, and it is currently in a PENDING state. Please wait for the initial request to be processed.` };
      }
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
  region?: string;
  maritalStatus?: string;
  ageMin?: number;
  ageMax?: number;
} = {}) {
  const user = await getLoggedInUser();
  if (!user) return { success: false as const, error: 'Unauthorized' };

  const canReview = hasRolePermission(user, 'verifier_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'verifier_customer_onboarding');
  const canView   = hasRolePermission(user, 'viewer_customer_onboarding');
  if (!canReview && !canSubmit && !canView) return { success: false as const, error: 'Access denied.' };

  const { 
    status, 
    page = 1, 
    pageSize = 20, 
    search, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    fromDate,
    toDate,
    gender,
    region,
    maritalStatus,
    ageMin,
    ageMax,
  } = opts;

  // Sanitize age inputs: enforce non-negative and integer values
  const sanitizedAgeMin = (ageMin !== undefined && ageMin !== null && !isNaN(Number(ageMin))) ? Math.max(0, Math.floor(Number(ageMin))) : undefined;
  const sanitizedAgeMax = (ageMax !== undefined && ageMax !== null && !isNaN(Number(ageMax))) ? Math.max(0, Math.floor(Number(ageMax))) : undefined;

  const skip = (page - 1) * pageSize;

  // Build the base 'where' object for Prisma
  const where: Record<string, any> = {};
  
  if (status && status !== 'ALL') {
    if (status === 'ACCOUNT_NOT_LINKED') {
      where.approvalStatus = 'APPROVED';
      where.forwardedAt = { not: null };
      where.forwardResponse = {
        path: ['linkingError'],
        not: Prisma.AnyNull,
      };
    } else {
      where.approvalStatus = status;
    }
  }

  if (region && region !== 'ALL') {
    where.region = region;
  }

  if (maritalStatus && maritalStatus !== 'ALL') {
    where.maritalStatus = maritalStatus; 
  }

  if (gender && gender !== 'ALL') {
    where.gender = gender;
  }

  if (fromDate || toDate) {
    const dateQuery: any = {};
    if (fromDate) dateQuery.gte = new Date(fromDate);
    if (toDate)   dateQuery.lte = new Date(toDate);
    where.createdAt = dateQuery;
  }

  const isApprover = hasRolePermission(user, 'approver_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
  const isVerifier = hasRolePermission(user, 'verifier_customer_onboarding');
  const isViewer   = hasRolePermission(user, 'viewer_customer_onboarding');
  if (!isApprover && !isVerifier && !isViewer) {
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

  try {
    let records: any[] = [];
    let total = 0;

    // Use Raw SQL ONLY if age filtering is required
    if (sanitizedAgeMin !== undefined || sanitizedAgeMax !== undefined) {
      const conditions: string[] = [];
      const values: any[] = [];

      // Rebuild conditions for Raw SQL - ENSURE INDEPENDENCE
      if (status && status !== 'ALL') {
        if (status === 'ACCOUNT_NOT_LINKED') {
          conditions.push(`"approvalStatus" = 'APPROVED'`);
          conditions.push(`"forwardedAt" IS NOT NULL`);
          conditions.push(`("forwardResponse"::jsonb->>'linkingError' IS NOT NULL AND "forwardResponse"::jsonb->>'linkingError' != '')`);
        } else {
          conditions.push(`"approvalStatus" = $${values.length + 1}::"ApprovalStatus"`);
          values.push(status);
        }
      }
      if (region && region !== 'ALL') {
        conditions.push(`"region" = $${values.length + 1}`);
        values.push(region);
      }
      if (maritalStatus && maritalStatus !== 'ALL') {
        conditions.push(`"maritalStatus" = $${values.length + 1}`);
        values.push(maritalStatus);
      }
      if (gender && gender !== 'ALL') {
        conditions.push(`"gender" = $${values.length + 1}`);
        values.push(gender);
      }
      if (fromDate) {
        conditions.push(`"createdAt" >= $${values.length + 1}::timestamp`);
        values.push(new Date(fromDate));
      }
      if (toDate) {
        conditions.push(`"createdAt" <= $${values.length + 1}::timestamp`);
        values.push(new Date(toDate));
      }
      if (!isApprover && !isVerifier && !isViewer) {
        conditions.push(`"submittedById" = $${values.length + 1}`);
        values.push(user.id);
      }
      if (search) {
        const s = `%${search}%`;
        conditions.push(`("mnemonic" ILIKE $${values.length + 1} OR "fullName1" ILIKE $${values.length + 1} OR "givenName" ILIKE $${values.length + 1} OR "familyName" ILIKE $${values.length + 1})`);
        values.push(s);
      }

      // Age conditions (The reason we are in this block)
      if (sanitizedAgeMin !== undefined) {
        conditions.push(`to_date("dateOfBirth", 'DD MON YYYY') <= (CURRENT_DATE - (INTERVAL '1 year' * $${values.length + 1}))`);
        values.push(sanitizedAgeMin);
      }
      if (sanitizedAgeMax !== undefined) {
        conditions.push(`to_date("dateOfBirth", 'DD MON YYYY') >= (CURRENT_DATE - (INTERVAL '1 year' * ($${values.length + 1} + 1)) + INTERVAL '1 day')`);
        values.push(sanitizedAgeMax);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
      const limitClause = `LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      
      const countQuery = `SELECT COUNT(*)::int as total FROM "CustomerOnboarding" ${whereClause}`;
      const dataQuery = `SELECT * FROM "CustomerOnboarding" ${whereClause} ${orderClause} ${limitClause}`;

      const [countResult, dataResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(countQuery, ...values),
        prisma.$queryRawUnsafe<any[]>(dataQuery, ...values, pageSize, skip)
      ]);

      total = countResult[0]?.total || 0;
      records = dataResult;
    } else {
      // Standard Prisma query for cases without age filtering
      const [prismaRecords, prismaTotal] = await Promise.all([
        prisma.customerOnboarding.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            submittedBy: { select: { id: true, name: true, email: true, status: true } },
            approverReviewedBy:  { select: { id: true, name: true, email: true, status: true } },
            verifierReviewedBy: { select: { id: true, name: true, email: true, status: true } },
          },
        }),
        prisma.customerOnboarding.count({ where }),
      ]);
      records = prismaRecords;
      total = prismaTotal;
    }

    const mappedRecords = records.map(record => ({
      ...record,
      region: getRegionLabel(record.region)
    }));

    return { success: true as const, records: mappedRecords, total, page, pageSize };
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

  const canReview = hasRolePermission(user, 'verifier_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  const canSubmit = hasRolePermission(user, 'submit_customer_onboarding') || hasRolePermission(user, 'verifier_customer_onboarding');
  const canView   = hasRolePermission(user, 'viewer_customer_onboarding');
  if (!canReview && !canSubmit && !canView) return { success: false as const, error: 'Access denied.' };

  try {
    const record = await prisma.customerOnboarding.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, name: true, email: true, status: true } },
        approverReviewedBy:  { select: { id: true, name: true, email: true, status: true } },
        verifierReviewedBy: { select: { id: true, name: true, email: true, status: true } },
        auditLogs: {
          orderBy: { timestamp: 'asc' },
          include: { actor: { select: { id: true, name: true, email: true, status: true } } },
        },
      },
    });

    if (!record) return { success: false as const, error: 'Record not found.' };
    
    const isApprover = hasRolePermission(user, 'approver_customer_onboarding') || hasRolePermission(user, 'review_customer_onboarding');
    const isVerifier = hasRolePermission(user, 'verifier_customer_onboarding');
    const isViewer   = hasRolePermission(user, 'viewer_customer_onboarding');

    if (!isApprover && !isVerifier && !isViewer && record.submittedById !== user.id) {
      return { success: false as const, error: 'Access denied.' };
    }

    // Extract T24 response data if available
    const forwardResponse = record.forwardResponse as any;
    const accountNumber = forwardResponse?.accountNumber || null;
    const accountHolderName = forwardResponse?.accountHolderName || null;
    const allAccounts = forwardResponse?.allAccounts || null;

    const enhancedRecord = {
      ...record,
      region: getRegionLabel(record.region),
      accountNumber,
      accountHolderName,
      allAccounts,
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

  const canReview = hasRolePermission(user, 'verifier_customer_onboarding') || 
                    hasRolePermission(user, 'approver_customer_onboarding') ||
                    hasRolePermission(user, 'viewer_customer_onboarding');
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
        submittedBy: { select: { id: true, name: true, email: true, status: true } },
        verifierReviewedBy: { select: { id: true, name: true, email: true, status: true } },
        approverReviewedBy: { select: { id: true, name: true, email: true, status: true } },
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
        submittedBy:      { select: { id: true, name: true, email: true, status: true } }, 
        verifierReviewedBy:  { select: { id: true, name: true, email: true, status: true } },
        approverReviewedBy:       { select: { id: true, name: true, email: true, status: true } }
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

      const nextStatus: ApprovalStatus = decision === 'APPROVED' ? 'PENDING_APPROVER' : 'REJECTED';
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

      if (decision === 'REJECTED') {
        const phone = existing.mobilePhoneNumbers || existing.phoneNumbersRes;
        if (phone) {
          const smsText = `Dear ${existing.givenName}, your onboarding request is rejected. Please contact us for further clarification or assistance. For enquiries, call toll-free 9698.`;
          try {
            const smsRes = await sendSms(phone, smsText);
            await prisma.customerOnboarding.update({
              where: { id },
              data: {
                smsSentAt: new Date(),
                smsStatus: smsRes.ok ? 'SENT' : 'FAILED',
                smsError: smsRes.ok ? null : (smsRes.error || `Status ${smsRes.status}`),
              }
            });
          } catch (smsErr) {
            console.error('[SMS Rejection Error]', smsErr);
          }
        }
        return { success: true, rejectedByVerifier: true };
      }

      return { success: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STAGE 2: Approver Decision (PENDING_APPROVER or SYNC_FAILED)
    // ─────────────────────────────────────────────────────────────────────────
    if (existing.approvalStatus === 'PENDING_APPROVER' || existing.approvalStatus === 'SYNC_FAILED') {
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

      if (decision === 'APPROVED') {
        nextStatus = 'AWAITING_T24_RESPONSE';
        auditAction = 'APPROVER_APPROVED_SENDING_TO_CORE';
        triggerT24 = true;
      } else {
        nextStatus = 'REQUIRES_REVIEW';
        auditAction = 'APPROVER_REJECTED_TO_VERIFIER';
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
        const customerId = syncResult.responseData?.customerId;
        return { 
          success: true, 
          message: customerId 
            ? `Customer successfully approved and synchronized with T24 core banking. Customer ID: ${customerId}`
            : 'Customer successfully approved and synchronized with T24 core banking.'
        };
      }

      // Handle Rejection SMS (if decision is REJECTED and it's a final state)
      if (decision === 'REJECTED' && nextStatus === 'REJECTED') {
        const phone = existing.mobilePhoneNumbers || existing.phoneNumbersRes;
        if (phone && !existing.smsSentAt) {
          const smsText = `Dear ${existing.givenName}, your onboarding request is rejected. Please contact us for further clarification or assistance. For enquiries, call toll-free 9698.`;
          
          try {
            const smsRes = await sendSms(phone, smsText);
            await prisma.customerOnboarding.update({
              where: { id },
              data: {
                smsSentAt: new Date(),
                smsStatus: smsRes.ok ? 'SENT' : 'FAILED',
                smsError: smsRes.ok ? null : (smsRes.error || `Status ${smsRes.status}`),
              }
            });
          } catch (smsErr) {
            console.error('[SMS Rejection Error]', smsErr);
          }
        }
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

  // ── Channel Routing ───────────────────────────────────────────────────────
  // The officer and product decide which account T24 opens and under whom, so
  // the channel's own values win. Resolved again here (not just at submit time)
  // so records created before this field existed still forward cleanly.
  const resolvedAccountOfficer = resolveAccountOfficer(record.accountOfficer);
  const resolvedProductType    = resolveProductType(record.productType);

  // ── Build Whitelisted T24 Payload ─────────────────────────────────────────
  // We enforce strict contract compliance by only including defined fields
  // and handling optional/nullable logic as per the new T24 schema.

  const payload: Record<string, any> = {
    mnemonic:           record.mnemonic.toUpperCase(),
    shortName:          record.shortName.toUpperCase(),
    fullName1:          record.fullName1.toUpperCase(),
    street:             sanitizeForT24(record.street),
    townCity:           sanitizeForT24(record.townCity),
    country:            sanitizeForT24(record.country),
    sector:             record.sector.toUpperCase(),
    accountOfficer:     resolvedAccountOfficer.toUpperCase(),
    product:            resolvedProductType.toUpperCase(),
    industry:           record.industry = "1499",
    target:             record.target = "220",
    customerStatus:     record.customerStatus = "1",
    legalIdNumber:      record.legalIdNumber ? record.legalIdNumber.substring(0, 10).toUpperCase() : '',
    documentName:       record.documentName = "NATIONAL.ID",
    nameOnID:           record.nameOnID.toUpperCase(),
    issueAuthority:     record.issueAuthority = "NID",
    issueDate:          record.issueDate.toUpperCase(),
    expirationDate:     record.expirationDate.toUpperCase(),
    language:           record.language.toUpperCase(),
    region:             sanitizeForT24(getRegionId(record.region)),
    phoneNumber:        (record.mobilePhoneNumbers || '').toUpperCase(),
    title:              record.title.toUpperCase(),
    givenName:          record.givenName.toUpperCase(),
    familyName:         record.familyName.toUpperCase(),
    gender:             record.gender.toUpperCase(),
    dateOfBirth:        record.dateOfBirth.toUpperCase(),
    maritalStatus:      record.maritalStatus.toUpperCase(),
    customerType:       record.customerType.toUpperCase(),
    ownership:          ((record as any).ownership || '1000').toUpperCase(),
    faydaPsutoken2:     record.legalIdNumber ? record.legalIdNumber.toUpperCase() : '',
  };

  // Handle Optional/Nullable Fields (Omit if empty or matches default/null criteria)
  if (record.fullName2)           payload.fullName2 = record.fullName2.toUpperCase();
  if (record.phoneNumbersRes)      payload.phoneNumbersRes = record.phoneNumbersRes.toUpperCase();
  if (record.secureMessage)        payload.secureMessage = record.secureMessage.toUpperCase();
  if (record.flatNo)               payload.flatNo = record.flatNo.toUpperCase();
  if (record.kebele)               payload.kebele = record.kebele.toUpperCase();
  if (record.houseNo)              payload.houseNo = record.houseNo.toUpperCase();
  if (record.woreda)              payload.woreda = sanitizeForT24(record.woreda);
  if (record.subcity)             payload.subcity = sanitizeForT24(record.subcity);
  if (record.motherName)           payload.motherName = record.motherName.toUpperCase();
  if (record.nationalIDNumber)     payload.nationalIDNumber = record.nationalIDNumber.substring(0, 10).toUpperCase();
  if (record.occupation)           payload.occupation = sanitizeForT24(record.occupation);
  if (record.employersName)        payload.employersName = sanitizeForT24(record.employersName);
  if (record.netMonthlyIn)         payload.netMonthlyIn = record.netMonthlyIn.toUpperCase();

  // Omit nationality/residence if "ET" as per contract
  if (record.nationality && record.nationality !== 'ET') payload.nationality = record.nationality.toUpperCase();
  if (record.residence && record.residence !== 'ET')     payload.residence = record.residence.toUpperCase();
 
   // ── Final Validation & Whitelisting ───────────────────────────────────────
   // We parse the payload through the strict schema to strip any undefined
   // or extra data and ensure all types are correct before transmission.
   const validation = T24PayloadSchema.safeParse(payload);
   if (!validation.success) {
     const errorMsg = `T24 Payload Validation Failed: ${validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`;
     console.error(`❌ [VALIDATION ERROR] ${errorMsg}`);
     throw new Error(errorMsg);
   }
   
   const cleanPayload = validation.data;

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
     console.log(JSON.stringify(cleanPayload, null, 2));
     console.log('----------------------------------------------------------------\n');

     console.log(`⏳ Sending POST request to T24...`);
     const startTime = Date.now();
     
     // Workaround for SSL issues in internal environments
     const T24_SKIP_SSL = process.env.T24_SKIP_SSL === 'true';

     let response: Response;
     try {
       // @ts-ignore - 'agent' is supported in Node.js fetch
       const fetchOptions: any = {
         method:  'POST',
         headers: fetchHeaders,
         body:    JSON.stringify(cleanPayload),
       };

       // Use a scoped HTTPS agent if SSL verification needs to be disabled for this specific request
       if (T24_SKIP_SSL) {
         console.log('⚠️ SSL verification is disabled ONLY for this T24 ingestion request (T24_SKIP_SSL=true)');
         const https = require('https');
         fetchOptions.agent = new https.Agent({
           rejectUnauthorized: false
         });
       }

       response = await fetch(T24_ENDPOINT, fetchOptions);
     } catch (fetchErr: any) {
      console.error('❌ Fetch attempt failed:', fetchErr);
      if (fetchErr.name === 'AbortError' || fetchErr.message?.includes('timeout')) {
        throw new Error(`The connection to T24 timed out. Please check if the service is reachable.`);
      }
      if (fetchErr.message?.includes('fetch failed')) {
        throw new Error(`Network error: Could not connect to T24 at ${T24_ENDPOINT}. This is likely a DNS, firewall, or SSL issue.`);
      }
      throw fetchErr;
    } finally {
      // SSL check is now scoped to the request agent, no global cleanup needed
    }

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || 'unknown';

    console.log(` [T24 RESPONSE] Status: ${response.status}, Duration: ${duration}ms, Content-Type: ${contentType}`);
    
    const [responseData, rawBody] = await safeParseT24Response(response);
    console.log(' [T24 RAW BODY]', rawBody);
    console.log(' [T24 PARSED DATA]', responseData);
    console.log('================================================================\n');

    // ── Business-level failure detection (case-insensitive) ───────────────
    // We check both for a failed status field or a non-2xx HTTP response
    const isObject = responseData && typeof responseData === 'object' && !Array.isArray(responseData);
    const t24Status = isObject ? String(responseData?.status || '').toLowerCase() : '';
    const hasErrorField = isObject && !!responseData?.error;
    const isFailed = t24Status === 'failed' || t24Status === 'error' || hasErrorField || !response.ok;

    if (isFailed) {
      // User request: Show 'message' in toast, and 'error' in the detailed error area
      const toastMsg = isObject ? (responseData?.message || 'Customer and account creation failed.') : (response.ok ? 'T24 returned a failure status.' : `HTTP Error ${response.status}`);
      let detailedError = isObject ? (responseData?.error || responseData?.message || toastMsg) : toastMsg;
      
      // Handle nested JSON in the error field (e.g., {"messages": [...]})
      if (typeof detailedError === 'string' && detailedError.startsWith('{')) {
        try {
          const nested = JSON.parse(detailedError);
          if (nested.messages && Array.isArray(nested.messages)) {
            detailedError = Array.from(new Set(nested.messages)).join('; ');
          } else if (nested.error) {
            detailedError = nested.error;
          } else if (nested.message) {
            detailedError = nested.message;
          }
        } catch {
          // Keep raw if parse fails
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.customerOnboarding.update({
          where: { id },
          data: {
            forwardResponse: responseData,
            forwardError: detailedError,
            approvalStatus: 'SYNC_FAILED',
            accountOfficer: resolvedAccountOfficer,
            productType:    resolvedProductType || null,
            industry:       record.industry,
            target:         record.target,
            customerStatus: record.customerStatus,
            documentName:   record.documentName,
            issueAuthority: record.issueAuthority,
          },
        });
        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId: actorId || null,
            action: 'FORWARD_FAILED',
            details: `T24 Business Error: ${detailedError}`,
            ipAddress,
            userAgent,
          },
        });
      });

      return { success: false, error: toastMsg };
    }

    // If we reach here, response.ok must be true and no business errors were found
    const digitalFlag = (responseData as any)?.isDigitalAccount;
    const isDigitalAccount =
      typeof digitalFlag === 'boolean'
        ? digitalFlag
        : typeof digitalFlag === 'string'
          ? ['yes', 'true', '1'].includes(digitalFlag.trim().toLowerCase())
          : false;
    
    if (!isDigitalAccount) {
      const toastMsg = (responseData as any)?.message || 'Digital account not created on core banking.';
      const detailedError = (responseData as any)?.error || toastMsg;
      
      await prisma.$transaction(async (tx) => {
        await tx.customerOnboarding.update({
          where: { id },
          data: {
            forwardResponse: responseData,
            forwardError: detailedError,
            approvalStatus: 'SYNC_FAILED',
            accountOfficer: resolvedAccountOfficer,
            productType:    resolvedProductType || null,
            industry:       record.industry,
            target:         record.target,
            customerStatus: record.customerStatus,
            documentName:   record.documentName,
            issueAuthority: record.issueAuthority,
          },
        });
        await tx.customerOnboardingAuditLog.create({
          data: {
            customerOnboardingId: id,
            actorId: actorId || null,
            action: 'FORWARD_FAILED',
            details: `T24 success but isDigitalAccount is not YES. ${detailedError}`,
            ipAddress,
            userAgent,
          },
        });
      });
      return { success: false, error: toastMsg };
    }

    await prisma.customerOnboarding.update({
        where: { id },
        data: {
          forwardedAt: new Date(),
          forwardError: null,
          forwardResponse: responseData, // Always store the parsed (or raw) response
          approvalStatus: 'APPROVED', // Final status after successful T24 response
          // Persist the forced defaults to the database
          accountOfficer: resolvedAccountOfficer,
          productType:    resolvedProductType || null,
          industry:       record.industry,
          target:         record.target,
          customerStatus: record.customerStatus,
          documentName:   record.documentName,
          issueAuthority: record.issueAuthority,
        },
      });

      // Handle Approval SMS
      const phone = record.mobilePhoneNumbers || record.phoneNumbersRes;
      if (phone && !record.smsSentAt) {
        const smsText = `Dear ${record.givenName}, your onboarding request is approved. Welcome to NIB International Bank. Please complete your NIBtera Online registration within 24 hrs to activate your account. For enquiries, call toll-free 9698.`;
        try {
          const smsRes = await sendSms(phone, smsText);
          await prisma.customerOnboarding.update({
            where: { id },
            data: {
              smsSentAt: new Date(),
              smsStatus: smsRes.ok ? 'SENT' : 'FAILED',
              smsError: smsRes.ok ? null : (smsRes.error || `Status ${smsRes.status}`),
            }
          });
        } catch (smsErr) {
          console.error('[SMS Approval Error]', smsErr);
        }
      }

      await prisma.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId: actorId || null,
          action: 'FORWARDED_AND_APPROVED',
          details: `Record successfully forwarded to T24 and officially APPROVED. Account officer: ${resolvedAccountOfficer}, product: ${resolvedProductType}. Duration: ${duration}ms.`,
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

      return { success: true, responseData };

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
            approvalStatus: 'SYNC_FAILED', // Failure moves to SYNC_FAILED
            accountOfficer: resolvedAccountOfficer,
            productType:    resolvedProductType || null,
            industry:       record.industry,
            target:         record.target,
            customerStatus: record.customerStatus,
            documentName:   record.documentName,
            issueAuthority: record.issueAuthority,
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
  
  // Strict Access: Only users with approver role should be allowed to retry forwarding
  const canRetry = hasRolePermission(user, 'approver_customer_onboarding');
  if (!canRetry) {
    return { success: false, error: 'Access denied. Only approvers can retry T24 synchronization.' };
  }

  const record = await prisma.customerOnboarding.findUnique({ where: { id } });
  if (!record) return { success: false, error: 'Record not found' };

  // Validate Record State: Only allow retry if status is SYNC_FAILED
  if (record.approvalStatus !== 'SYNC_FAILED') {
    return { success: false, error: `Retry rejected. Record must be in SYNC_FAILED state (current state: ${record.approvalStatus}).` };
  }
  
  // Enforce Workflow Integrity: Do not allow direct overwriting without validation
  // Set status back to AWAITING_T24_RESPONSE before retrying
  await prisma.customerOnboarding.update({
      where: { id },
      data: { 
        approvalStatus: 'AWAITING_T24_RESPONSE', 
        forwardError: null 
      }
  });

  // Add Audit Logging
  const { ipAddress, userAgent } = await getRequestContext();
  await prisma.customerOnboardingAuditLog.create({
    data: {
      customerOnboardingId: id,
      actorId: user.id,
      action: 'T24_SYNC_RETRY_INITIATED',
      details: `User ${user.email} initiated a manual T24 sync retry for mnemonic ${record.mnemonic}.`,
      ipAddress,
      userAgent
    }
  });

  return forwardToCoreBanking(id, user.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK RETRY FORWARD (called from review panel by reviewer)
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkRetryForwardToCoreBanking(ids: string[]) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  
  // Strict Access: Only users with approver role should be allowed to retry forwarding
  const canRetry = hasRolePermission(user, 'approver_customer_onboarding');
  if (!canRetry) {
    return { success: false, error: 'Access denied. Only approvers can perform bulk T24 synchronization retries.' };
  }

  if (!ids.length) {
    return { success: false, error: 'No records selected for bulk retry.' };
  }

  const results: { id: string; success: boolean; error?: string }[] = [];
  const { ipAddress, userAgent } = await getRequestContext();

  for (const id of ids) {
    try {
      const record = await prisma.customerOnboarding.findUnique({ where: { id }, select: { approvalStatus: true, mnemonic: true } });
      
      // Validate Record State: Only allow retry if status is SYNC_FAILED
      if (!record || record.approvalStatus !== 'SYNC_FAILED') {
        results.push({ id, success: false, error: `Invalid state: ${record?.approvalStatus || 'Not found'}` });
        continue;
      }

      // Enforce Workflow Integrity: Do not allow direct overwriting without validation
      // Set status back to AWAITING_T24_RESPONSE before retrying
      await prisma.customerOnboarding.update({
          where: { id },
          data: { 
            approvalStatus: 'AWAITING_T24_RESPONSE', 
            forwardError: null 
          }
      });

      // Add Audit Logging for Bulk Retry
      await prisma.customerOnboardingAuditLog.create({
        data: {
          customerOnboardingId: id,
          actorId: user.id,
          action: 'T24_SYNC_RETRY_INITIATED',
          details: `User ${user.email} initiated a manual T24 sync retry (Bulk).`,
          ipAddress,
          userAgent
        }
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
// RETRY SEND SMS (called from review panel if SMS fails)
// ─────────────────────────────────────────────────────────────────────────────
export async function retrySendSms(id: string) {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };
  
  // Enforce strict role-based access control on the SMS trigger function
  // Requirement: SMS is only active for approver, not verifier
  const canTriggerSms = hasRolePermission(user, 'approver_customer_onboarding');
  if (!canTriggerSms) {
    return { success: false, error: 'Access denied. You do not have permission to trigger SMS notifications.' };
  }

  const record = await prisma.customerOnboarding.findUnique({ where: { id } });
  if (!record) return { success: false, error: 'Record not found' };

  const phone = record.mobilePhoneNumbers || record.phoneNumbersRes;
  if (!phone) return { success: false, error: 'No phone number available' };

  let smsText = '';
  if (record.approvalStatus === 'APPROVED') {
    smsText = `Dear ${record.givenName}, your onboarding request is approved. Welcome to NIB International Bank. Please complete your NIBtera Online registration within 24 hrs to activate your account. For enquiries, call toll-free 9698.`;
  } else if (record.approvalStatus === 'REJECTED') {
    smsText = `Dear ${record.givenName}, your onboarding request is rejected. Please contact us for further clarification or assistance. For enquiries, call toll-free 9698.`;
  } else {
    return { success: false, error: 'SMS can only be sent for approved or rejected requests.' };
  }

  try {
    const smsRes = await sendSms(phone, smsText);
    
    // Implement safeguards to preserve historical SMS records
    // We update current status but logging ensures historical trail
    await prisma.customerOnboarding.update({
      where: { id },
      data: {
        smsSentAt: new Date(),
        smsStatus: smsRes.ok ? 'SENT' : 'FAILED',
        smsError: smsRes.ok ? null : (smsRes.error || `Status ${smsRes.status}`),
      }
    });

    // Add Audit Logging for SMS Retry
    const { ipAddress, userAgent } = await getRequestContext();
    await prisma.customerOnboardingAuditLog.create({
      data: {
        customerOnboardingId: id,
        actorId: user.id,
        action: smsRes.ok ? 'SMS_RETRY_SUCCESS' : 'SMS_RETRY_FAILED',
        details: `User ${user.email} retried SMS notification to ${phone}. Result: ${smsRes.ok ? 'Success' : 'Failed'}.`,
        ipAddress,
        userAgent
      }
    });

    if (smsRes.ok) {
      return { success: true, message: 'SMS sent successfully.' };
    } else {
      return { success: false, error: smsRes.error || `Failed to send SMS (Status ${smsRes.status})` };
    }
  } catch (err: any) {
    console.error('[retrySendSms Error]', err);
    return { success: false, error: err.message || 'An error occurred while retrying SMS.' };
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
  
  const canReview = hasRolePermission(user, 'verifier_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
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
        const nextStatus = decision === 'APPROVED' ? 'PENDING_APPROVER' : 'REJECTED';

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

        if (decision === 'REJECTED') {
          for (const rid of stage1Ids) {
            const record = await tx.customerOnboarding.findUnique({ where: { id: rid } });
            if (record) {
              const phone = record.mobilePhoneNumbers || record.phoneNumbersRes;
              if (phone) {
                const smsText = `Dear ${record.givenName}, your onboarding request is rejected. Please contact us for further clarification or assistance. For enquiries, call toll-free 9698.`;
                try {
                  const smsRes = await sendSms(phone, smsText);
                  await tx.customerOnboarding.update({
                    where: { id: rid },
                    data: {
                      smsSentAt: new Date(),
                      smsStatus: smsRes.ok ? 'SENT' : 'FAILED',
                      smsError: smsRes.ok ? null : (smsRes.error || `Status ${smsRes.status}`),
                    }
                  });
                } catch (smsErr) {
                  console.error('[SMS Rejection Error]', smsErr);
                }
              }
            }
          }
        }
      }

      // 2. Stage 2: Approver Decision (PENDING_APPROVER or SYNC_FAILED)
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

      return { 
        count: stage1Ids.length + stage2ApproveIds.length, 
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

  const canReview = hasRolePermission(user, 'verifier_customer_onboarding') || hasRolePermission(user, 'approver_customer_onboarding');
  const canViewer = hasRolePermission(user, 'viewer_customer_onboarding');
  if (!canReview && !canViewer) return { success: false as const, error: 'Access denied.' };

  const { ids, status, search, sortBy = 'createdAt', sortOrder = 'desc', fromDate, toDate, gender } = opts;

  const where: Record<string, any> = {};
  if (ids && ids.length > 0) {
    where.id = { in: ids };
  } else {
    if (status) {
      if ((status as string) === 'ACCOUNT_NOT_LINKED') {
        where.approvalStatus = 'APPROVED';
        where.forwardedAt = { not: null };
        where.forwardResponse = {
          path: ['linkingError'],
          not: Prisma.AnyNull,
        };
      } else {
        where.approvalStatus = status;
      }
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
    if (gender && gender !== 'ALL') where.gender = gender;
  }

  try {
    const records = await prisma.customerOnboarding.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: {
        submittedBy: { select: { name: true, email: true, status: true } },
        approverReviewedBy:  { select: { name: true, email: true, status: true } },
      },
      // Limit to 50k to prevent server OOM for now
      take: 50000 
    });

    // Apply region mapping to all records
    const mappedRecords = records.map(record => ({
      ...record,
      region: getRegionLabel(record.region)
    }));

    return { success: true as const, records: mappedRecords };
  } catch (err) {
    console.error('[exportCustomerOnboardings]', err);
    return { success: false as const, error: 'Failed to export records.' };
  }
}
