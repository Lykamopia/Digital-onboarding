'use server';

import prisma from '@/lib/prisma';
import { getLoggedInUser } from '@/app/actions/memo';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, format, eachDayOfInterval, eachMonthOfInterval, isWithinInterval } from 'date-fns';

import { REGION_MAPPING } from '@/lib/region-mapping';

export type KPIData = {
  summary: {
    totalOnboarded: number;
    pendingVerification: number;
    pendingApproval: number;
    syncFailed: number;
    approvalRate: number;
    rejectionRate: number;
    averageProcessingTime: number;
    linkedAccounts: number;
    totalRejected: number;
    backlog: number;
    resubmissionRate: number;
    successRateAfterResubmission: number;
    avgAttemptsBeforeApproval: number;
    statusCounts: Record<ApprovalStatus, number>;
  };
  workload: {
    verifiers: { name: string; count: number; approved: number; rejected: number }[];
    approvers: { name: string; count: number; approved: number; rejected: number }[];
  };
  trends: {
    labels: string[];
    onboarded: number[];
    rejected: number[];
  };
  syncStatus: {
    success: number;
    failure: number;
    pending: number;
  };
  smsStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
  processingTimeByStage: {
    verification: number; // avg hours
    approval: number;     // avg hours
    sync: number;         // avg hours
  };
  distribution: {
    regional: { name: string; count: number }[];
    gender: { name: string; count: number }[];
    age: { name: string; count: number }[];
    maritalStatus: { name: string; count: number }[];
    townCity: { name: string; count: number }[];
    subcity: { name: string; count: number }[];
  };
  resubmissions: number;
};

export type KPIFilters = {
  dateRange: 'day' | 'week' | 'month' | 'year' | 'custom';
  fromDate?: Date;
  toDate?: Date;
  status?: ApprovalStatus;
  branchId?: string;
  districtId?: string;
  role?: string;
  region?: string;
};

export type KPIMetadata = {
  branches: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  regions: { id: string; label: string }[];
};

export async function getKPIMetadata(): Promise<{ success: true; data: KPIMetadata } | { success: false; error: string }> {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const [branches, districts, roles] = await Promise.all([
      prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.district.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.role.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);

    const regions = Object.entries(REGION_MAPPING).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));

    return { success: true, data: { branches, districts, roles, regions } };
  } catch (err) {
    console.error('[getKPIMetadata]', err);
    return { success: false, error: 'Failed to fetch metadata.' };
  }
}

export async function getKPIData(filters: KPIFilters): Promise<{ success: true; data: KPIData } | { success: false; error: string }> {
  const user = await getLoggedInUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  // Role-based visibility logic
  const isAdmin = user.role?.name === 'admin' || (user.role?.permissions || '').includes('admin');
  const isDistrictManager = (user.role?.permissions || '').includes('manage_districts');
  const isBranchManager = (user.role?.permissions || '').includes('manage_branches');

  const where: Prisma.CustomerOnboardingWhereInput = {};

  // Apply organizational filters based on role
  if (!isAdmin) {
    if (isDistrictManager && user.districtId) {
      where.submittedBy = { districtId: user.districtId };
    } else if (isBranchManager && user.branchId) {
      where.submittedBy = { branchId: user.branchId };
    } else {
      // Regular verifier/approver - see all for their branch or just their own?
      // Usually KPIs are for the branch/unit. Let's assume branch for now.
      if (user.branchId) {
        where.submittedBy = { branchId: user.branchId };
      }
    }
  }

  // Apply explicit filters from UI
  if (filters.branchId) where.submittedBy = { ...where.submittedBy as any, branchId: filters.branchId };
  if (filters.districtId) where.submittedBy = { ...where.submittedBy as any, districtId: filters.districtId };
  if (filters.role) where.submittedBy = { ...where.submittedBy as any, roleId: filters.role };
  if (filters.status) where.approvalStatus = filters.status;
  if (filters.region) where.region = filters.region;

  // Date Range logic
  let start: Date;
  let end: Date = endOfDay(new Date());

  switch (filters.dateRange) {
    case 'day':
      start = startOfDay(new Date());
      break;
    case 'week':
      start = startOfWeek(new Date());
      break;
    case 'month':
      start = startOfMonth(new Date());
      break;
    case 'year':
      start = startOfYear(new Date());
      break;
    case 'custom':
      start = filters.fromDate ? startOfDay(filters.fromDate) : startOfMonth(new Date());
      end = filters.toDate ? endOfDay(filters.toDate) : endOfDay(new Date());
      break;
    default:
      start = startOfMonth(new Date());
  }

  where.createdAt = { gte: start, lte: end };

  try {
    // 1. Fetch all relevant records in one go for efficiency (if dataset is manageable)
    // For very large datasets, we should use aggregate queries.
    const records = await prisma.customerOnboarding.findMany({
      where,
      include: {
        verifierReviewedBy: { select: { name: true } },
        approverReviewedBy: { select: { name: true } },
        submittedBy: { select: { name: true, branchId: true, districtId: true } },
      },
    });

    const total = records.length;
    const onboarded = records.filter(r => r.approvalStatus === 'APPROVED').length;
    const pendingVerification = records.filter(r => ['PENDING', 'RESUBMITTED', 'REQUIRES_REVIEW'].includes(r.approvalStatus)).length;
    const pendingApproval = records.filter(r => r.approvalStatus === 'PENDING_APPROVER').length;
    const syncFailed = records.filter(r => r.approvalStatus === 'SYNC_FAILED').length;
    const rejected = records.filter(r => r.approvalStatus === 'REJECTED' || r.approvalStatus === 'VERIFIER_REJECTED').length;
    const resubmissionsCount = records.filter(r => r.parentCustomerId !== null).length;

    // Backlog includes all statuses where interaction is needed:
    // PENDING, RESUBMITTED, REQUIRES_REVIEW (for Verifier)
    // PENDING_APPROVER (for Approver)
    // SYNC_FAILED (for Retry)
    const backlog = records.filter(r => 
      ['PENDING', 'RESUBMITTED', 'REQUIRES_REVIEW', 'PENDING_APPROVER', 'SYNC_FAILED'].includes(r.approvalStatus)
    ).length;

    // Status counts for one KPI
    const statusCounts: Record<ApprovalStatus, number> = {
      PENDING: 0,
      VERIFIER_REJECTED: 0,
      SYNC_FAILED: 0,
      PENDING_APPROVER: 0,
      APPROVED: 0,
      REJECTED: 0,
      REQUIRES_REVIEW: 0,
      RESUBMITTED: 0,
      AWAITING_T24_SYNC: 0,
      AWAITING_T24_RESPONSE: 0,
      VERIFIER_APPROVED: 0,
    };
    records.forEach(r => {
      if (r.approvalStatus in statusCounts) {
        statusCounts[r.approvalStatus]++;
      }
    });

    // KPI: % of rejected users who resubmit
    // We need to look at historical data for this. Since we only have current records in 'where',
    // this might be tricky with just 'records'. 
    // Let's approximate from the loaded records if they have parentCustomerId.
    const resubmissionRate = rejected > 0 ? (resubmissionsCount / rejected) * 100 : 0;

    // KPI: Success rate after resubmission
    const resubmittedRecords = records.filter(r => r.parentCustomerId !== null);
    const successAfterResubmit = resubmittedRecords.filter(r => r.approvalStatus === 'APPROVED').length;
    const successRateAfterResubmission = resubmittedRecords.length > 0 
      ? (successAfterResubmit / resubmittedRecords.length) * 100 
      : 0;

    // KPI: Avg number of attempts before approval
    // We calculate this based on approved records that were resubmissions
    const approvedResubmissions = records.filter(r => r.approvalStatus === 'APPROVED' && r.parentCustomerId !== null);
    // This is hard to calculate accurately without recursive lookups, so we'll estimate 
    // based on audit logs if possible, or just default to 1 + resubmission flag.
    const avgAttemptsBeforeApproval = onboarded > 0 
      ? (onboarded + approvedResubmissions.length) / onboarded 
      : 0;

    // Calculate linked accounts (where linkingError is null in the T24 response)
    const linkedAccounts = records.filter(r => {
      if (r.approvalStatus !== 'APPROVED' || !r.forwardResponse) return false;
      const response = r.forwardResponse as any;
      const linkingError = response.linkingError;
      return linkingError === null || linkingError === undefined;
    }).length;

    // 2. Workload
    const verifierWorkload: Record<string, { count: number; approved: number; rejected: number }> = {};
    const approverWorkload: Record<string, { count: number; approved: number; rejected: number }> = {};

    records.forEach(r => {
      if (r.verifierReviewedBy?.name) {
        const name = r.verifierReviewedBy.name;
        if (!verifierWorkload[name]) verifierWorkload[name] = { count: 0, approved: 0, rejected: 0 };
        verifierWorkload[name].count++;
        if (r.approvalStatus === 'PENDING_APPROVER' || r.approvalStatus === 'APPROVED') {
          verifierWorkload[name].approved++;
        } else if (r.approvalStatus === 'REJECTED' || r.approvalStatus === 'VERIFIER_REJECTED') {
          verifierWorkload[name].rejected++;
        }
      }
      if (r.approverReviewedBy?.name) {
        const name = r.approverReviewedBy.name;
        if (!approverWorkload[name]) approverWorkload[name] = { count: 0, approved: 0, rejected: 0 };
        approverWorkload[name].count++;
        if (r.approvalStatus === 'APPROVED' || r.approvalStatus === 'AWAITING_T24_RESPONSE' || r.approvalStatus === 'AWAITING_T24_SYNC') {
          approverWorkload[name].approved++;
        } else if (r.approvalStatus === 'REQUIRES_REVIEW') {
          approverWorkload[name].rejected++;
        }
      }
    });

    // 3. Processing Time (Avg hours)
    let totalVerificationTime = 0;
    let verificationCount = 0;
    let totalApprovalTime = 0;
    let approvalCount = 0;
    let totalSyncTime = 0;
    let syncCount = 0;

    records.forEach(r => {
      if (r.verifierReviewedAt) {
        totalVerificationTime += (r.verifierReviewedAt.getTime() - r.createdAt.getTime());
        verificationCount++;
      }
      if (r.approverReviewedAt && r.verifierReviewedAt) {
        totalApprovalTime += (r.approverReviewedAt.getTime() - r.verifierReviewedAt.getTime());
        approvalCount++;
      }
      if (r.forwardedAt && r.approverReviewedAt) {
        totalSyncTime += (r.forwardedAt.getTime() - r.approverReviewedAt.getTime());
        syncCount++;
      }
    });

    const avgVerification = verificationCount > 0 ? (totalVerificationTime / verificationCount / (1000 * 60 * 60)) : 0;
    const avgApproval = approvalCount > 0 ? (totalApprovalTime / approvalCount / (1000 * 60 * 60)) : 0;
    const avgSync = syncCount > 0 ? (totalSyncTime / syncCount / (1000 * 60 * 60)) : 0;

    // 4. Trends
    let labels: string[] = [];
    let onboardedTrend: number[] = [];
    let rejectedTrend: number[] = [];

    if (filters.dateRange === 'year') {
      const months = eachMonthOfInterval({ start, end });
      labels = months.map(m => format(m, 'MMM'));
      onboardedTrend = months.map(m => records.filter(r => r.approvalStatus === 'APPROVED' && isWithinInterval(r.createdAt, { start: startOfMonth(m), end: endOfMonth(m) })).length);
      rejectedTrend = months.map(m => records.filter(r => (r.approvalStatus === 'REJECTED' || r.approvalStatus === 'VERIFIER_REJECTED') && isWithinInterval(r.createdAt, { start: startOfMonth(m), end: endOfMonth(m) })).length);
    } else {
      const days = eachDayOfInterval({ start, end });
      labels = days.map(d => format(d, 'MMM dd'));
      onboardedTrend = days.map(d => records.filter(r => r.approvalStatus === 'APPROVED' && isWithinInterval(r.createdAt, { start: startOfDay(d), end: endOfDay(d) })).length);
      rejectedTrend = days.map(d => records.filter(r => (r.approvalStatus === 'REJECTED' || r.approvalStatus === 'VERIFIER_REJECTED') && isWithinInterval(r.createdAt, { start: startOfDay(d), end: endOfDay(d) })).length);
    }

    // 5. Sync Status
    const syncSuccess = records.filter(r => r.approvalStatus === 'APPROVED' && r.forwardedAt).length;
    const syncFailure = records.filter(r => r.approvalStatus === 'SYNC_FAILED').length;
    const syncPending = records.filter(r => r.approvalStatus === 'AWAITING_T24_RESPONSE' || r.approvalStatus === 'AWAITING_T24_SYNC').length;

    // 6. SMS Status
    const smsSent = records.filter(r => r.smsStatus === 'SENT').length;
    const smsFailed = records.filter(r => r.smsStatus === 'FAILED').length;
    const smsPending = records.filter(r => r.smsStatus === null && (r.approvalStatus === 'APPROVED' || r.approvalStatus === 'REJECTED')).length;

    // 7. Distributions
    const regionalDist: Record<string, number> = {};
    const genderDist: Record<string, number> = {};
    const ageDist: Record<string, number> = {
      'Under 18': 0,
      '18-25': 0,
      '26-35': 0,
      '36-45': 0,
      '46-60': 0,
      'Over 60': 0,
    };
    const maritalDist: Record<string, number> = {};
    const townCityDist: Record<string, number> = {};
    const subcityDist: Record<string, number> = {};

    records.forEach(r => {
      // Region
      if (r.region) {
        regionalDist[r.region] = (regionalDist[r.region] || 0) + 1;
      }
      // Gender
      if (r.gender) {
        genderDist[r.gender] = (genderDist[r.gender] || 0) + 1;
      }
      // Marital Status
      if (r.maritalStatus) {
        maritalDist[r.maritalStatus] = (maritalDist[r.maritalStatus] || 0) + 1;
      }
      // Town/City
      if (r.townCity) {
        townCityDist[r.townCity] = (townCityDist[r.townCity] || 0) + 1;
      }
      // Subcity
      if (r.subcity) {
        subcityDist[r.subcity] = (subcityDist[r.subcity] || 0) + 1;
      }
      // Age calculation
      if (r.dateOfBirth) {
        try {
          // Assuming dateOfBirth format is "DD MMM YYYY" as seen in other actions
          const dob = new Date(r.dateOfBirth);
          if (!isNaN(dob.getTime())) {
            const age = new Date().getFullYear() - dob.getFullYear();
            if (age < 18) ageDist['Under 18']++;
            else if (age <= 25) ageDist['18-25']++;
            else if (age <= 35) ageDist['26-35']++;
            else if (age <= 45) ageDist['36-45']++;
            else if (age <= 60) ageDist['46-60']++;
            else ageDist['Over 60']++;
          }
        } catch (e) {
          // Skip invalid dates
        }
      }
    });

    return {
      success: true,
      data: {
        summary: {
          totalOnboarded: onboarded,
          pendingVerification,
          pendingApproval,
          syncFailed,
          approvalRate: total > 0 ? (onboarded / total) * 100 : 0,
          rejectionRate: total > 0 ? (rejected / total) * 100 : 0,
          averageProcessingTime: avgVerification + avgApproval + avgSync,
          linkedAccounts,
          totalRejected: rejected,
          backlog,
          resubmissionRate,
          successRateAfterResubmission,
          avgAttemptsBeforeApproval,
          statusCounts,
        },
        workload: {
          verifiers: Object.entries(verifierWorkload).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count).slice(0, 10),
          approvers: Object.entries(approverWorkload).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count).slice(0, 10),
        },
        trends: {
          labels,
          onboarded: onboardedTrend,
          rejected: rejectedTrend,
        },
        syncStatus: {
          success: syncSuccess,
          failure: syncFailure,
          pending: syncPending,
        },
        smsStatus: {
          sent: smsSent,
          failed: smsFailed,
          pending: smsPending,
        },
        processingTimeByStage: {
          verification: avgVerification,
          approval: avgApproval,
          sync: avgSync,
        },
        distribution: {
          regional: Object.entries(regionalDist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          gender: Object.entries(genderDist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          age: Object.entries(ageDist).map(([name, count]) => ({ name, count })),
          maritalStatus: Object.entries(maritalDist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
          townCity: Object.entries(townCityDist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
          subcity: Object.entries(subcityDist).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        },
        resubmissions: resubmissionsCount,
      },
    };
  } catch (err) {
    console.error('[getKPIData]', err);
    return { success: false, error: 'Failed to fetch KPI data.' };
  }
}
