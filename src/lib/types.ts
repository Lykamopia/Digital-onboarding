
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
} from '@prisma/client';

export type Permission = 'view_dashboard' | 'manage_memos' | 'view_admin' | 'manage_divisions' | 'manage_departments' | 'manage_offices' | 'manage_users' | 'manage_roles' | 'manage_archive' | 'manage_branches' | 'manage_districts';

export type Role = PrismaRole;
export type Office = PrismaOffice;

export type Department = PrismaDepartment & {
    office: PrismaOffice;
};
export type District = PrismaDistrict & {
    office: PrismaOffice;
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
    branch?: Branch;
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
};

export type Activity = PrismaActivity & {
    actor: User;
};

// Composite type for memos with all their relations
export type MemoWithActivity = Memo & {
  activity: Activity[];
};

// Add status to User type for better type safety
export type UserWithStatus = User & {
    status: 'active' | 'inactive';
}
