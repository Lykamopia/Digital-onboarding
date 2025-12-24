
import type { 
    User as PrismaUser, 
    Role as PrismaRole,
    Division as PrismaDivision,
    Department as PrismaDepartment,
    Office as PrismaOffice,
    Memo as PrismaMemo,
    Attachment as PrismaAttachment,
    Activity as PrismaActivity,
    Permission as PrismaPermission
} from '@prisma/client';

export type Permission = PrismaPermission;

export type Role = PrismaRole;
export type Division = PrismaDivision;
export type Department = PrismaDepartment;
export type Office = PrismaOffice;

// Extend PrismaUser to include next-auth properties if needed
export type User = PrismaUser & {
    // any custom properties if needed
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
