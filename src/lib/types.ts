
import type { 
    User as PrismaUser, 
    Role as PrismaRole,
    Division as PrismaDivision,
    Department as PrismaDepartment,
    Office as PrismaOffice,
    SecurityLog as PrismaSecurityLog,
    CustomerOnboarding as PrismaCustomerOnboarding,
    CustomerOnboardingAuditLog as PrismaCustomerOnboardingAuditLog,
    Prisma,
} from '@prisma/client';
export type Permission = 
    | 'manage_divisions' 
    | 'manage_departments' 
    | 'manage_offices' 
    | 'manage_users' 
    | 'manage_roles' 
    | 'manage_branches' 
    | 'manage_districts' 
    | 'manage_security_logs'
    | 'approver_customer_onboarding'
    | 'verifier_customer_onboarding'
    | 'admin';

export type DateRange = {
    from?: Date;
    to?: Date;
};

export type DelegationReason = 'Personal Case' | 'Official Duty' | 'Training';

export type Role = PrismaRole;
export type Office = PrismaOffice & {
    departments?: Department[];
};
export type AcknowledgementType = 'BADGE' | 'SIGNATURE';

export type Department = PrismaDepartment & {
    office: PrismaOffice;
    divisions: PrismaDivision[];
};

export type Division = PrismaDivision & {
    department: Department;
};

// Base user type from Prisma, extended for UI needs
export type User = PrismaUser & {
    onboardingCompleted?: boolean;
    office?: Office | null;
    department?: Department | null;
    division?: Division | null;
    role: Role | null;
};

export type LoggedInUser = User & {
    actingUser?: { id: string; name: string | null; email: string | null; };
};

export type SecurityLog = PrismaSecurityLog;

export enum LogSeverity {
    INFO = 'INFO',
    WARN = 'WARN',
    CRITICAL = 'CRITICAL',
}


export type { Prisma };

// ─── Customer Onboarding ──────────────────────────────────────
export type OnboardingActor = { id: string, name: string | null, email: string | null };

export type CustomerOnboarding = PrismaCustomerOnboarding & {
    submittedBy?: OnboardingActor | null;
    approverReviewedBy?: OnboardingActor | null;
    verifierReviewedBy?: OnboardingActor | null;
    auditLogs?: CustomerOnboardingAuditLog[];
};

export type CustomerOnboardingAuditLog = PrismaCustomerOnboardingAuditLog & {
    actor?: OnboardingActor | null;
};

// ─── Bulk Import ──────────────────────────────────────────────
export interface BulkImportResult {
    successCount: number;
    errorCount: number;
    errors: { rowIndex: number; email: string; error: string }[];
}
