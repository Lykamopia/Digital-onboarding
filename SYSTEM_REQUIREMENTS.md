# System Requirements Specification (SRS) for Memo Management System

## 1. Introduction

### 1.1 Purpose
This document provides a detailed description of the requirements for the Memo Management System. It outlines the functional and non-functional requirements of the system, serving as the primary guide for designers, developers, and testers to ensure the final product meets the specified business needs and quality standards.

### 1.2 Scope
The scope of this system includes the complete lifecycle management of internal memorandums. Key functionalities include secure user authentication, role-based access control, memo creation, distribution (sending, CC), and management (inbox, sent, drafts, archive), advanced memo workflows (acknowledgement, forwarding, replying), user and system administration, and real-time notifications. The system is designed as a web application accessible on modern desktop and mobile browsers.

### 1.3 Definitions, Acronyms, and Abbreviations
- **MMS**: Memo Management System
- **UAT**: User Acceptance Testing
- **UI**: User Interface
- **UX**: User Experience
- **JWT**: JSON Web Token
- **RBAC**: Role-Based Access Control
- **WCAG**: Web Content Accessibility Guidelines
- **HIBP**: Have I Been Pwned (a service for checking breached passwords)
- **Admin**: System Administrator role with full privileges.
- **Member**: Standard user role with permissions to manage their own memos.
- **CSR**: Client-Side Rendering
- **SSR**: Server-Side Rendering

---

## 2. Overall Description

### 2.1 Product Perspective
The Memo Management System is a self-contained, secure web application designed to replace traditional paper-based or email-based internal communication systems within an organization. It provides a centralized platform for creating, sending, tracking, and archiving official memorandums, ensuring data integrity, security, and a clear audit trail for all communications.

### 2.2 Product Features
The major features of the system are:
- Secure User Authentication and Session Management
- Role-Based Access Control (Admin, Member)
- Comprehensive Memo Management (Create, Read, Update, Delete)
- Memo Distribution and Tracking (To, CC, Forward, Reply, Acknowledgement)
- Advanced Memo Organization (Labels, Favorites, Flagging, Archive)
- Real-time In-App and Email Notifications
- Full-featured Admin Panel for System Management
- User Profile Management (Avatar, Signature)
- Responsive UI for Desktop, Tablet, and Mobile Devices

### 2.3 User Classes and Characteristics
| Role | Description | Technical Expertise | Responsibilities |
| :--- | :--- | :--- | :--- |
| **Admin** | Manages the entire system, including users, roles, organizational structure, and settings. Has oversight of all memos for archival and compliance purposes. | Moderate to High. Familiar with system administration concepts. | - Configure system settings.<br>- Manage user accounts and roles.<br>- Maintain organizational hierarchy.<br>- Monitor system health and audit logs. |
| **Member** | A standard employee who uses the system for daily communication. | Low. Requires an intuitive and user-friendly interface. | - Create, send, and receive memos.<br>- Manage their personal inbox, drafts, and sent items.<br>- Acknowledge and reply to memos as required. |

### 2.4 Operating Environment
- The system shall be a web application hosted on a secure server environment.
- It must be accessible over HTTPS.
- The backend shall be built with Next.js and a Node.js server.
- The database shall be a PostgreSQL database managed via Prisma ORM.
- The front-end must be compatible with the latest stable versions of Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari.

### 2.5 Design and Implementation Constraints
- The UI must be built using React, Next.js, ShadCN UI components, and Tailwind CSS.
- All GenAI functionality must be implemented using Genkit.
- The UI design must be consistent, professional, and adhere to a modern aesthetic with a border radius of `0.5rem` on major components.
- The system must use JWT for session management, with mechanisms to handle session expiry and concurrency.
- The system must enforce a strong password policy, including checks against known data breaches via the HIBP API.
- All file uploads (attachments, avatars) must be handled securely, with validation for file size and type.

---

## 3. System Features (Functional Requirements)

### 3.1 Authentication
- **FR-AUTH-01 (Login):** The system shall provide a secure login page at `/login` for users to authenticate using their registered email and password.
- **FR-AUTH-02 (Invalid Credentials):** The system shall display a generic "Invalid credentials" error upon failed login attempts due to an incorrect email or password, to prevent user enumeration.
- **FR-AUTH-03 (Account Lockout):** The system shall lock a user's account for a configurable duration (default: 15 minutes) after a configurable number of failed login attempts (default: 5). The UI must display a countdown timer.
- **FR-AUTH-04 (Inactive Account):** The system shall prevent users with an 'inactive' status from logging in and display an appropriate error message.
- **FR-AUTH-05 (Show/Hide Password):** The login form shall provide a toggle to show or hide the password input.
- **FR-AUTH-06 (Forced Password Change):** Users with the `mustChangePassword` flag set to `true` shall be immediately redirected to a `/dashboard/change-password` page upon login and be blocked from accessing any other part of the application until they update their password.
- **FR-AUTH-07 (Password Policy):** The system shall enforce a configurable password policy (e.g., length, character types) and validate against it on the password change form. It must also check for pwned passwords.
- **FR-AUTH-08 (Logout):** The system shall provide a logout function that invalidates the user's current session token (e.g., by incrementing a `tokenVersion`) and redirects them to the login page.
- **FR-AUTH-09 (Session Inactivity Timeout):** The system shall automatically log out a user after a configurable period of inactivity (default: 15 minutes).
- **FR-AUTH-10 (Session Concurrency):** The system shall invalidate a user's session on one device/browser if they log out from another device/browser.

### 3.2 Memo Management
- **FR-MEMO-01 (Create Memo):** Authorized users shall be able to compose a new memo, specifying recipients (To, CC), a subject, a body, and optional labels and attachments.
- **FR-MEMO-02 (Drafts):** The system shall automatically save a memo being composed as a draft at regular intervals (e.g., every 2 seconds of inactivity). Users shall be able to access and continue editing drafts from a "Drafts" folder.
- **FR-MEMO-03 (Send Memo):** Upon sending, a memo shall be delivered to the inboxes of all 'To' and 'CC' recipients. The draft version shall be deleted.
- **FR-MEMO-04 (Inbox View):** Users shall have an "Inbox" that displays all memos where they are a direct recipient, CC'd recipient, or the current holder. Unread memos must be visually distinct.
- **FR-MEMO-05 (Sent View):** Users shall have a "Sent" folder that displays all memos they have sent.
- **FR-MEMO-06 (Archive):** Users shall be able to archive memos from their view. Archived memos shall be accessible in a separate "Archive" folder and will not appear in other views.
- **FR-MEMO-07 (Favorite):** Users shall be able to mark any memo as a "favorite." Favorited memos should be easily identifiable and accessible via a "Favorites" filter/view.
- **FR-MEMO-08 (Flag):** Users shall be able to "flag" a memo for follow-up. Flagged memos should be visually distinct.
- **FR-MEMO-09 (Memo Detail View):** Clicking a memo in a list shall display its full content, including header details (From, To, CC, Subject), body, attachments, and activity history.
- **FR-MEMO-10 (Read Status):** A memo shall be marked as 'read' for a user once they view it in the detail view. This action should be recorded in the activity history.
- **FR-MEMO-11 (Reply):** A recipient shall be able to reply to the original sender. The composition form shall be pre-filled with the sender in the 'To' field, the subject prefixed with "Re:", and the original memo content quoted.
- **FR-MEMO-12 (Reply All):** A recipient shall be able to reply to the sender and all other recipients. The form shall be pre-filled as with a normal reply, but with all original To/CC users (except the replier) added to the CC field.
- **FR-MEMO-13 (Forward):** A recipient shall be able to forward a memo to new recipients. The composition form shall be pre-filled with the subject prefixed with "Fw:", the original memo content quoted, and empty To/CC fields.
- **FR-MEMO-14 (Acknowledgement):**
    - The system shall display an "Acknowledge" button on a memo if a global setting requires it OR if the memo has a label with `requiresAcknowledgement=true`.
    - Only direct recipients or current holders who have not yet acknowledged can see the button.
    - Upon acknowledgement, the button shall disappear, and a visual indicator (badge or signature) shall appear next to the user's name. This action must be recorded in the activity history.
- **FR-MEMO-15 (CC Restrictions):** Users who are only CC'd on a memo shall be able to acknowledge it but shall be restricted from replying, replying all, or forwarding it.

### 3.3 Admin Panel
- **FR-ADMIN-01 (User Management):** Admins shall be able to perform full CRUD (Create, Read, Update, Delete) operations on user accounts.
    - Create: A new user is created with a strong, temporary password and the `mustChangePassword` flag set. A welcome email is sent.
    - Read: Admins can view a list of all users and their details.
    - Update: Admins can modify a user's name, email, role, organizational assignment, and status (active/inactive).
    - Delete: Admins can delete a user only if they have not authored any memos, to preserve data integrity.
- **FR-ADMIN-02 (Bulk User Import):** Admins shall be able to bulk-import users by uploading a CSV file. The system must provide a template and report on successful and failed imports.
- **FR-ADMIN-03 (Role Management):** Admins shall be able to perform CRUD operations on roles (except the default 'Admin' role). This includes assigning specific permissions to each role. A role cannot be deleted if it is assigned to any users.
- **FR-ADMIN-04 (Organizational Structure):** Admins shall be able to manage the organizational hierarchy (Offices, Departments, Divisions, Districts, Branches) through dedicated UI pages. Deletion of a parent entity (e.g., an Office) shall be blocked if it has child entities (e.g., Departments).
- **FR-ADMIN-05 (General Settings):** Admins shall be able to configure system-wide settings, such as the default acknowledgement behavior (Badge vs. Signature).
- **FR-ADMIN-06 (Email Settings):** Admins shall be able to enable/disable email notifications and customize the content of the email templates.
- **FR-ADMIN-07 (Archive Management):** Admins shall have access to a global archive view of all memos and be able to restore or permanently delete them.

### 3.4 Notifications
- **FR-NOTIF-01 (Real-time):** When a user receives a new memo, they shall be notified in real-time via a UI toast notification and an update to the notification bell icon count, without requiring a page refresh.
- **FR-NOTIF-02 (Notification List):** Users shall be able to click the bell icon to view a list of their unread notifications.
- **FR-NOTIF-03 (Notification Interaction):** Clicking a notification in the list shall navigate the user to the corresponding memo and mark the notification as read (removing it from the list).
- **FR-NOTIF-04 (Email):** The system shall send an email notification to users upon receiving a new memo, if enabled in the admin settings.

### 3.5 User Profile
- **FR-PROF-01 (View Profile):** Users shall be able to view their own profile information, including name, email, avatar, signature, and organizational assignment.
- **FR-PROF-02 (Update Profile):** Users shall be able to update their name, email, and upload a new avatar image.
- **FR-PROF-03 (Signature Management):** Users shall be able to create or update their digital signature using a signature pad. This signature will be used for memo acknowledgements.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-PERF-01 (Page Load):** All pages and data lists must load within 3 seconds under typical network conditions.
- **NFR-PERF-02 (UI Interaction):** UI interactions (e.g., opening a modal, selecting a memo) should feel instantaneous, with feedback provided for any operation lasting longer than 300ms.
- **NFR-PERF-03 (API Response):** Server-side actions and API calls should complete within 500ms for standard operations.

### 4.2 Security
- **NFR-SEC-01 (Data Transmission):** All data transmitted between the client and server must be encrypted using TLS (HTTPS).
- **NFR-SEC-02 (Password Storage):** User passwords must be stored securely using a strong, salted hashing algorithm (e.g., bcrypt).
- **NFR-SEC-03 (Access Control):** The system must strictly enforce Role-Based Access Control (RBAC) for all actions and data access. All server actions must validate the user's permissions before execution.
- **NFR-SEC-04 (Input Sanitization):** All user-generated content (memo bodies, names, etc.) must be properly sanitized to prevent Cross-Site Scripting (XSS) attacks. HTML in memo bodies must be sanitized to allow a safe subset of tags.
- **NFR-SEC-05 (File Uploads):** File uploads must be scanned for malicious content, and access to uploaded files must be restricted to authorized users.

### 4.3 Usability & UI/UX
- **NFR-USAB-01 (Consistency):** The application must maintain a consistent and professional design language across all pages, including colors, fonts, spacing, and component styles.
- **NFR-USAB-02 (Responsiveness):** The UI must be fully responsive and adapt seamlessly to desktop, tablet, and mobile screen sizes without horizontal scrolling or broken layouts.
- **NFR-USAB-03 (Mobile Navigation):** On mobile devices, the primary navigation must be a fixed bottom navigation bar, providing an intuitive, app-like experience.
- **NFR-USAB-04 (Feedback):** The system must provide clear and immediate feedback for user actions, including loading indicators, success toasts, and descriptive error messages.

### 4.4 Reliability
- **NFR-REL-01 (Uptime):** The system should strive for 99.9% uptime.
- **NFR-REL-02 (Data Integrity):** The system must ensure the integrity of memo data. Deleting users or organizational units must be blocked if they are linked to existing memos, preventing orphaned records.
- **NFR-REL-03 (Error Handling):** The system must handle unexpected errors gracefully, presenting the user with a helpful message and logging detailed error information on the server for troubleshooting.

### 4.5 Browser Compatibility
- **NFR-COMP-01 (Supported Browsers):** The system must be fully functional and render correctly on the two most recent major versions of Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari.

### 4.6 Accessibility
- **NFR-ACC-01 (WCAG Compliance):** The application should adhere to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. This includes:
    - All interactive elements must be focusable and operable via keyboard.
    - Sufficient color contrast must be maintained.
    - All images must have appropriate `alt` text.
    - Forms must be correctly labeled, and ARIA attributes used where necessary.
    - The application must be navigable and usable with screen readers.
