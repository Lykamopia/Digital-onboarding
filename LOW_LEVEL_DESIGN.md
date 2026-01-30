# Low-Level Design: Nib Memo System

## 1. Introduction

This document provides a detailed low-level design for the Nib Memo System. It builds upon the high-level design, specifying the internal implementation details of each component, data structures, APIs, and workflows. This document is intended to guide developers in the implementation and maintenance of the system.

---

## 2. Data Models & Schemas

The data layer is managed by Prisma ORM. The schema defines all data entities, their fields, and relationships.

**Location**: `prisma/schema.prisma`

### 2.1 Core Models

-   **`User`**: Stores user information, roles, and organizational assignments.
    -   `id`, `name`, `email`, `avatar`, `signature`, `hashedPassword`, `status`, `onboardingCompleted`
    -   **Relations**: `role`, `office`, `department`, `division`, `district`, `branch`, `memosSent`, `memosReceived`, `memosCc`, `delegations` (as delegator), `delegatedTo` (as delegate).

-   **`Memo`**: Represents a single memorandum.
    -   `id`, `memo_reference_number`, `subject`, `body`, `status` (`draft`, `sent`, `scheduled`), `createdAt`, `updatedAt`
    -   **Relations**: `from` (User), `to` (many Users), `cc` (many Users), `attachments`, `activity`, `labels`, `replyTo` (self-relation), `replies` (self-relation).

-   **`Activity`**: Tracks every action performed on a memo for audit purposes.
    -   `id`, `action` (e.g., `sent`, `viewed`, `acknowledged`), `timestamp`, `details`, `ipAddress`, `userAgent`
    -   **Relations**: `memo`, `actor` (User).

-   **`Role`**: Defines user roles and their associated permissions.
    -   `id`, `name`, `permissions` (comma-separated string).
    -   **Relation**: `users`.

-   **`Label`**: For categorizing memos.
    -   `id`, `name`, `color`, `type` (`SYSTEM` or `USER`).

-   **`Delegation`**: Manages the delegation of account access.
    -   `id`, `permissions` (comma-separated string).
    -   **Relations**: `delegator` (User), `delegate` (User).

### 2.2 Organizational Structure Models

-   **`Office`**: Top-level organizational unit (e.g., Head Office).
-   **`Department`**: Belongs to a division-based Office.
-   **`Division`**: Belongs to a Department.
-   **`District`**: Belongs to a branch-based Office.
-   **`Branch`**: Belongs to a District.

These models are interconnected to form the organizational hierarchy.

### 2.3 Other Models

-   **`Attachment`**: Stores metadata for files attached to memos.
-   **`PasswordResetToken`**: For handling password reset flows.
-   **`EmailLog`**: Logs all outgoing emails for auditing.
-   **`Setting`**: A key-value store for application-wide settings (e.g., email templates, reference format).

---

## 3. Component & UI Structure

The frontend is built with Next.js App Router, React, and ShadCN UI components.

### 3.1 Main Layout (`/dashboard/layout.tsx`)

-   **`DashboardContentWrapper`**: The primary layout component containing the sidebar, header, and main content area.
-   **`Sidebar`**: Provides navigation. It is collapsible and responsive.
-   **`UserNav`**: Dropdown menu for profile, settings, and logout. Handles delegation switching UI.
-   **`NotificationBell`**: Manages and displays real-time notifications.

### 3.2 Memo Dashboard (`/dashboard/main-dashboard.tsx`)

-   A two-column layout.
-   **`MemoFilters`**: Left-column component for searching, filtering by date, category, and labels.
-   **`MemoList`**: Displays a list of memos based on active filters. Handles selection and context menu actions (reply, archive, etc.).
-   **`MemoDisplay`**: Right-column component that renders the full content of the selected memo. It includes memo details, body, attachments, and the full activity history timeline.

### 3.3 Memo Composer (`/dashboard/new/page.tsx`)

-   A single-page form for creating or editing memos.
-   **`RecipientSelector`**: A multi-select combobox for choosing 'To' and 'CC' recipients.
-   **`Editor`**: A rich-text editor for the memo body.
-   Handles file uploads via a hidden `input` element, displaying previews of attached files.
-   Manages auto-saving drafts via a debounced server action call.
-   Supports replying, replying-all, and assigning from an existing memo, pre-populating fields accordingly.

### 3.4 Admin Section (`/dashboard/admin/*`)

-   A tab-based layout managed by `admin/layout.tsx`.
-   Each tab (Users, Roles, Divisions, etc.) is a client component that fetches data using custom SWR-like hooks (`admin/hooks.ts`).
-   Data management (Create, Update, Delete) is handled through server actions, with UI feedback provided via toasts.
-   Uses reusable `Dialog` and `AlertDialog` components for forms and confirmations.

---

## 4. API Endpoints & Server Actions

Business logic is primarily encapsulated in Next.js Server Actions.

### 4.1 Server Actions (`/src/app/actions/memo.ts`)

This file is the core of the backend logic.

-   **Data Fetching**:
    -   `getDashboardData()`: Fetches memos for different views (inbox, sent, etc.) with complex filtering logic.
    -   `getMemo()`: Fetches a single memo by ID.
    -   `getUsers()`, `getRoles()`, etc.: Fetch organizational data.
    -   `getLoggedInUser()`: Retrieves the current session user, handling delegation context.

-   **Memo Workflow Actions**:
    -   `sendMemo()`: Validates and saves a new memo. Creates activity logs, triggers WebSocket broadcast, and sends email notifications.
    -   `saveDraft()`: Creates or updates a draft memo. Debounced on the client.
    -   `acknowledgeMemo()`: Marks a memo as acknowledged, adding an activity log entry.
    -   `archiveMemo()`: Toggles the archived state for a user on a specific memo.

-   **Admin CRUD Actions**:
    -   `saveUser()`, `deleteUser()`, `resetUserPassword()`
    -   `saveRole()`, `deleteRole()`
    -   `saveDivision()`, `deleteDivision()` (and similarly for all other organizational units).

### 4.2 File Upload API (`/src/api/upload/route.ts`)

-   **`POST /api/upload`**:
    -   **Request**: `FormData` with a `file` and a `type` (e.g., 'attachments', 'profile').
    -   **Process**: Receives the file, sanitizes the filename, creates a unique name, and saves it to the `public/uploads/{type}/` directory on the server's file system.
    -   **Response**: JSON with `{ success: true, path: '/uploads/...' }`.
-   **`DELETE /api/upload`**:
    -   **Request**: JSON with `{ path: '/uploads/...' }`.
    -   **Process**: Deletes the specified file from the file system.

---

## 5. Workflow Logic

### 5.1 Memo Lifecycle

1.  **Creation (Draft)**: User starts composing. `saveDraft` is called automatically every few seconds, creating or updating a `Memo` record with `status: 'draft'`.
2.  **Sending**: User clicks "Send". The `sendMemo` action is called.
    -   A `memo_reference_number` is generated.
    -   The memo `status` is changed to `'sent'`.
    -   An initial `'sent'` `Activity` log is created.
    -   A WebSocket message is broadcast to all clients.
    -   Emails are sent to all recipients.
3.  **Viewing**: A recipient opens the memo. `markAsRead` is called.
    -   A `'viewed'` `Activity` log is created if one doesn't already exist for that user.
    -   If automatic acknowledgment is enabled, `acknowledgeMemo` is called immediately.
4.  **Acknowledging**: User clicks "Acknowledge" (or it's triggered automatically).
    -   `acknowledgeMemo` is called.
    -   The user is connected to the `acknowledgedBy` relation on the `Memo`.
    -   A `'acknowledged'` `Activity` log is created.
5.  **Replying/Assigning**: User clicks "Reply" or "Assign".
    -   They are redirected to the `/dashboard/new` page with query params (`replyTo` or `assignFrom`).
    -   A new draft is created, linked to the original memo. The body of the original memo is quoted.
6.  **Archiving**: User archives a memo.
    -   `archiveMemo` is called.
    -   The user is connected/disconnected from the `archivedBy` relation on the `Memo`.

### 5.2 Delegation Workflow

1.  **Granting Access**: User A goes to their Profile > Delegation settings and adds User B as a delegate with specific permissions (e.g., `delegation:view`, `delegation:send`). This creates a `Delegation` record.
2.  **Switching Account**: User B clicks "Act as [User A]" in their `UserNav` dropdown.
    -   The `update` function from `next-auth/react` is called with `switch_to_delegator_id: User A's ID`.
    -   The `jwt` callback in `lib/auth.ts` detects this, verifies the delegation exists, and modifies the JWT. It stores User B's details in `token.realUser` and overwrites the main token details with User A's.
    -   The session is updated, and the page reloads.
3.  **Acting as Delegate**:
    -   The UI now shows User A's name and indicates that User B is acting on their behalf.
    -   When User B performs an action (e.g., sends a memo), the server action uses `getLoggedInUser()`. This function sees the `isDelegated` session flag and returns User A's data but includes `actingUser: User B` and `delegationPermissions`.
    -   The action (e.g., `sendMemo`) checks `user.actingUser` and verifies `user.delegationPermissions` before proceeding.
    -   The action is performed *as* User A (e.g., `fromId` is User A's ID), but the `Activity` log entry records User B as the `actorId` and adds a `details` string like "Sent by [User B] on behalf of [User A]".
4.  **Returning to Own Account**: User B clicks "Return to My Account".
    -   The `update` function is called with `stop_delegation: true`.
    -   The `jwt` callback restores User B's original details from `token.realUser` into the main token.
    -   The session is updated, and the page reloads.

---

## 6. Permissions & Security Enforcement

-   **Route Protection**: `src/middleware.ts` uses `withAuth` from `next-auth/middleware` to protect all routes except for public ones like `/login`.
-   **Action-Level RBAC**: Server actions begin with a call to `hasPermission('permission_name')`. This function gets the logged-in user's role and checks if the required permission is in the role's `permissions` string. It throws an error if the permission is not present.
-   **Delegation Permissions**: For actions performed by a delegate, the server action checks the `delegationPermissions` array on the `LoggedInUser` object instead of the user's own role permissions.
-   **Password Security**:
    -   Passwords are never stored in plain text. `bcrypt` is used to hash passwords before saving them to the database.
    -   Login attempts are tracked. After `MAX_FAILED_ATTEMPTS`, the user account is locked for `LOCKOUT_DURATION_MINUTES`.
    -   The `isPasswordPwned` check is used during password setting to prevent the use of compromised passwords.
-   **Content Security Policy (CSP)**: A strict CSP is generated and applied in `src/middleware.ts` to mitigate XSS and other injection attacks. A `nonce` is used for inline scripts.

---

## 7. Error Handling & Logging

-   **Client-Side Errors**: User-facing errors (e.g., validation, failed actions) are displayed using `sonner` toast notifications.
-   **Server Action Errors**: Server actions return an `{ error: '...' }` object on failure, which the client-side code checks for and uses to show a toast.
-   **Audit Logging**: The `Activity` model provides a detailed and immutable audit trail for every user interaction with a memo.
-   **Email Logging**: The `EmailLog` model tracks every outgoing email, its status (`sent` or `failed`), and any error messages, providing crucial insight into the notification system's health.

---

## 8. Edge Cases Considered

-   **Concurrent Edits**: The system currently follows a "last write wins" model. For a high-concurrency environment, this could be improved with real-time collaboration features or optimistic locking.
-   **Orphaned Data**: Deletion logic in server actions prevents deleting organizational units (e.g., Departments) if they still have child entities (e.g., Divisions or Users) assigned, returning an error to the user.
-   **Delegation Revocation**: If a delegator revokes access while a delegate is in a delegated session, the delegate's next action will fail because the `jwt` callback in `next-auth` re-validates the user's `tokenVersion` on every request. A change in this version (triggered by `revokeUserTokens`) invalidates the session, forcing a logout.
-   **API Failures**: The Pwned Passwords check is designed to "fail open" (allow the password change) to prevent blocking users if the external API is unavailable.
