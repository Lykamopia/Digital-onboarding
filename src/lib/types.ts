
import type { 
    User as PrismaUser, 
    Role as PrismaRole,
    Division as PrismaDivision,
    Department as PrismaDepartment,
    Office as PrismaOffice,
    Memo as PrismaMemo,
    Attachment as PrismaAttachment,
    Activity as PrismaActivity,
    Branch as PrismaBranch,
    District as PrismaDistrict,
    Label as PrismaLabel,
    EmailLog as PrismaEmailLog,
    Delegation as PrismaDelegation,
    Prisma,
} from '@prisma/client';
import { delegationPermissions } from './permissions';

export type Permission = 
    | 'view_dashboard' 
    | 'manage_memos' 
    | 'view_admin' 
    | 'manage_divisions' 
    | 'manage_departments' 
    | 'manage_offices' 
    | 'manage_users' 
    | 'manage_roles' 
    | 'manage_archive' 
    | 'manage_audit_log'
    | 'manage_branches' 
    | 'manage_districts' 
    | 'manage_labels' 
    | 'manage_general_settings'
    | 'manage_email_settings';

export type DelegationPermission = typeof delegationPermissions[number]['id'];

export type DateRange = {
    from?: Date;
    to?: Date;
};

export type Role = PrismaRole;
export type Office = PrismaOffice & {
    departments?: Department[];
    districts?: District[];
};
export type Label = PrismaLabel;
export type AcknowledgementType = 'BADGE' | 'SIGNATURE';

export type Department = PrismaDepartment & {
    office: PrismaOffice;
    divisions: PrismaDivision[];
};
export type District = PrismaDistrict & {
    office: PrismaOffice;
    branches: PrismaBranch[];
};

export type Division = PrismaDivision & {
    department: Department;
};
export type Branch = PrismaBranch & {
    district: District;
};

// Base user type from Prisma, extended for UI needs
export type User = PrismaUser & {
    onboardingCompleted?: boolean;
    office?: Office | null;
    department?: Department | null;
    division?: Division | null;
    district?: District | null;
    branch?: Branch | null;
    role: Role | null;
    delegations?: Delegation[];
    delegatedTo?: Delegation[];
};

// Represents the user for the current session, which might be a delegated one
export type LoggedInUser = User & {
    actingUser?: { id: string; name: string | null; email: string | null; };
    delegationPermissions?: DelegationPermission[];
};

export type Attachment = PrismaAttachment;
export type EmailLog = PrismaEmailLog;
export type Delegation = PrismaDelegation & {
    delegator: User;
    delegate: User;
};

// Base types from Prisma
export type Memo = PrismaMemo & {
    from: User;
    to: User[];
    cc: User[];
    attachments: Attachment[];
    current_holder?: User | null;
    previous_holders?: User[];
    acknowledgedBy?: User[];
    archivedBy?: User[];
    favoritedBy?: { id: string }[];
    flaggedBy?: { id: string }[];
    labels: Label[];
    assignedFromId?: string | null;
};

export type Activity = PrismaActivity & {
    actor: User;
    ipAddress?: string | null;
    userAgent?: string | null;
};

// Composite type for memos with all their relations
export type MemoWithActivity = Memo & {
  activity: Activity[];
};

export type FullMemo = MemoWithActivity & {
    replies: Memo[];
    replyTo: Memo | null;
};

// Add status to User type for better type safety
export type UserWithStatus = User & {
    status: 'active' | 'inactive';
}

export type { Prisma };
