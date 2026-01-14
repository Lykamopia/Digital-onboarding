
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
} from '@prisma/client';

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

// Extend PrismaUser to include next-auth properties if needed
export type User = PrismaUser & {
    // any custom properties if needed
    mustChangePassword?: boolean;
    office?: Office | null;
    department?: Department | null;
    division?: Division | null;
    district?: District | null;
    branch?: Branch | null;
    role: Role | null;
};

export type Attachment = PrismaAttachment;

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
    forwardFromId?: string | null;
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

    