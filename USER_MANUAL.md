# Nib Memo System: Comprehensive User Manual

## 1. Introduction
The **Nib Memo System** is a high-security, enterprise-grade digital platform designed to manage the internal correspondence of Nib International Bank. It replaces traditional paper-based systems with a modern, auditable, and efficient workflow for memorandums, authority delegations, and organizational communication.

---

## 2. Accessing the System

### 2.1 Login and Authentication
- **Secure Access**: Access the system via your official email and assigned password.
- **Account Lockout**: For security, accounts are automatically locked for 15 minutes after 5 failed login attempts.
- **Session Security**: The system uses idle-time monitoring. You will be automatically logged out after 60 minutes of inactivity to protect sensitive data.

### 2.2 First-Time Setup
- **Invitation**: New users receive an email invitation with a secure link.
- **Password Policy**: Your password must be at least 8 characters and include uppercase, lowercase, numbers, and symbols. The system checks against known data breaches to ensure maximum security.
- **Onboarding Tour**: Upon your first successful login, an interactive guided tour will highlight the core features of your dashboard.

---

## 3. The Dashboard Workspace

### 3.1 Folder Organization
- **Inbox**: Memos sent directly to you or where you are CC'd.
- **Favorites**: Quickly access memos you have marked with a star.
- **Drafts**: Memos you have started but not yet sent.
- **Sent**: A record of all outgoing correspondence.
- **Archive**: Personal storage for completed memos you wish to remove from your active inbox.
- **Delegations**: A specialized view for memos related to authority transfers.

### 3.2 Navigation Features
- **Glassmorphism UI**: All panels and dialogs use a premium "glass" effect for a modern, focused experience.
- **Horizontal Tabs**: In folders with many categories (like Sent or Inbox), use the horizontally scrollable tabs to filter by context (Direct, CC, Replies, etc.).
- **Theme Toggle**: Switch between Light, Dark, and System modes via the moon/sun icon in the top header.

---

## 4. Memo Management

### 4.1 Composing a Memo
- **Rich Text Editor**: Support for bold, italic, underline, lists, and tables.
- **Recipient Selector**: Search by name or email. Includes "Bulk Selection" options to add all users or specific roles (e.g., "All Managers") with a single click.
- **Templates**: Choose from pre-defined professional templates such as *Meeting Agenda*, *Directive*, *Incident Report*, or *Policy Update*.
- **Attachments**: Drag and drop or select files up to 5MB. Previews are available for images and standard document types.

### 4.2 Delegation Mode
When you need to officially transfer authority:
1. Toggle **Delegation Mode** in the composer.
2. Select a **Reason** (Training, Official Duty, etc.) and a **Date Range**.
3. Choose a **Delegate**. 
4. The system automatically generates a professional, continuous-layout legal body and sets the CC to **"All Staff"** for organizational awareness.

### 4.3 Scheduled Memos
Memos can be prepared in advance and set to be distributed automatically at a future date and time.

---

## 5. Memo Interaction & Workflow

### 5.1 Reading and Statuses
- **Read/Unread**: New memos are marked with a blue pulse. Opening them updates the status across the system.
- **Status Badges**: Memos progress through states: `Open` -> `In Progress` -> `Closed`.

### 5.2 Official Acknowledgement
- **Manual Mode**: Click the "Acknowledge" button to officially sign off on receipt.
- **Digital Signatures**: If configured, your saved signature (drawn or uploaded) will be applied to the document.
- **Auto Mode**: If the administrator has enabled it, viewing a memo automatically records your acknowledgement.

### 5.3 Collaboration Tools
- **Reply/Reply All**: Start a threaded conversation linked to the original memo.
- **Assign**: Forward a memo to another user with a specific remark or instruction.
- **Duplicate**: Create a new draft based on an existing memo to save time.
- **Flagging**: Mark specific memos with a red flag for urgent follow-up.

---

## 6. Personal Profile & Security

### 6.1 Profile Customization
- **Avatar**: Upload a professional portrait to help colleagues identify your correspondence.
- **Digital Signature**:
    - **Draw**: Use your mouse or touch screen to draw your official signature.
    - **Upload**: Upload a high-quality scan of your physical signature.
- **Security Background**: Signatures are rendered on a theme-independent white background to ensure legibility in both light and dark modes.

### 6.2 Delegation Settings (Acting on Behalf)
- **Granting Access**: In your profile, add "Delegates" who can act on your behalf.
- **Granular Permissions**: Choose exactly what they can do: *View Memos*, *Save Drafts*, *Send Memos*, or *Acknowledge*.
- **Switching Accounts**: If someone has delegated to you, click your avatar and select "Act As [User]". Your UI will update to show their folders, and any action you take will be logged as "Done by [You] on behalf of [User]".

---

## 7. Administrative Console

### 7.1 Organizational Hierarchy
Admins can define the structure of the bank:
- **Offices**: Top-level units.
- **Departments & Divisions**: Associated with Office-level units.
- **Districts & Branches**: Associated with Branch-level units.
- **Reference Numbers**: Configure the automated numbering format (e.g., `HO-DEPT-2024-0001`).

### 7.2 User & Role Management
- **Bulk Import**: Upload a CSV file to create hundreds of users instantly.
- **RBAC**: Define custom roles with specific permissions (e.g., who can view audit logs or manage labels).
- **Session Revocation**: Admins can force-logout any user if a security concern arises.

### 7.3 System Auditing
- **Audit Log**: A searchable master list of every memo in the system with full activity timelines.
- **Security Logs**: Tracks logins, IP addresses, user-agent changes, and permission denials to detect unauthorized access attempts.
- **Email Logs**: Monitor the delivery status of all outgoing system notifications.

### 7.4 Global Maintenance
- **Bulk Archive Tool**: Archive all unarchived memos within a specific date range for all participants globally to keep the system database performant.
- **Label Management**: Create system-wide tags like "Urgent" or "Confidential" with custom colors.

---

## 8. Real-Time Features
- **Instant Alerts**: New memos trigger immediate browser notifications and optional sound alerts.
- **Live Sync**: The Inbox updates in real-time without requiring a page refresh whenever a new memo is received.
- **Mobile Optimized**: The entire dashboard is fully responsive, featuring a bottom navigation bar for seamless use on smartphones and tablets.

---

## 9. FAQ & Troubleshooting
- **I can't see a memo I was told was sent.** Check your "Delegations" tab or your "Archive".
- **The "Send" button is disabled.** Ensure you have at least one recipient in the "To" field and have entered a subject.
- **My signature looks blurry.** Re-capture your signature using the "Draw" tool or upload a higher-resolution PNG with a transparent background.
