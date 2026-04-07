'use server';

import prisma from '@/lib/prisma';
import { getLoggedInUser } from '@/app/actions/memo';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, format, eachDayOfInterval, eachMonthOfInterval, isWithinInterval } from 'date-fns';

export type KPIData = {
  summary: {
    totalOnboarded: number;
    pendingVerification: number;
    pendingApproval: number;
    syncFailed: number;
    approvalRate: number;
    rejectionRate: number;
    averageProcessingTime: number; // in hours
  };
  workload: {
    verifiers: { name: string; count: number }[];
    approvers: { name: string; count: number }[];
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
};

export type KPIMetadata = {
  branches: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  roles: { id: string; name: string }[];
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

    return { success: true, data: { branches, districts, roles } };
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
    const resubmissions = records.filter(r => r.parentCustomerId !== null).length;

    // 2. Workload
    const verifierWorkload: Record<string, number> = {};
    const approverWorkload: Record<string, number> = {};

    records.forEach(r => {
      if (r.verifierReviewedBy?.name) {
        verifierWorkload[r.verifierReviewedBy.name] = (verifierWorkload[r.verifierReviewedBy.name] || 0) + 1;
      }
      if (r.approverReviewedBy?.name) {
        approverWorkload[r.approverReviewedBy.name] = (approverWorkload[r.approverReviewedBy.name] || 0) + 1;
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
        },
        workload: {
          verifiers: Object.entries(verifierWorkload).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
          approvers: Object.entries(approverWorkload).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10),
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
        resubmissions,
      },
    };
  } catch (err) {
    console.error('[getKPIData]', err);
    return { success: false, error: 'Failed to fetch KPI data.' };
  }
}
