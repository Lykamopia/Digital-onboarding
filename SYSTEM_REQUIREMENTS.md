# System Requirements: Nib Memo

## 1. Introduction
This document specifies the functional and non-functional requirements for the Nib Memo System. These requirements serve as the criteria against which the system will be tested and validated.

---

## 2. Functional Requirements

### 2.1 User Management
- **FR-1**: Users must be able to log in securely with an email and password.
- **FR-2**: The system must support Role-Based Access Control (RBAC). At a minimum, 'Admin' and 'Member' roles shall exist with distinct permissions.
- **FR-3**: Admins shall have the ability to manage user accounts, including creation, editing of details, and deactivation.
- **FR-4**: Users shall be able to manage their own profile information, which includes their name, avatar, and a digital signature image.
- **FR-5**: The system shall support account delegation, where one user (the delegator) can grant specific, granular permissions to another user (the delegate) to act on their behalf.
- **FR-6**: Delegates must be able to switch into a delegator's account context and perform only the actions they have been explicitly permitted.

### 2.2 Memo Management
- **FR-7**: Users shall be able to create new memos with fields for 'To', 'CC', 'Subject', 'Body', and file attachments.
- **FR-8**: The system must provide a rich-text editor for composing the memo body, with support for basic formatting, lists, and tables.
- **FR-9**: Users shall be able to save memos as drafts. Drafts must only be visible to the author.
- **FR-10**: The system shall generate a unique, sequential reference number for every memo upon sending, based on a configurable format.
- **FR-11**: Users shall be able to view a list of memos in their inbox, which includes memos sent directly to them or where they are CC'd.
- **FR-12**: Users shall be able to acknowledge the receipt of a memo.
- **FR-13**: The system must support both manual and automatic acknowledgment modes. This setting shall be configurable by an Administrator.
- **FR-14**: Users shall have the ability to reply, reply-all, and assign memos to other users.
- **FR-15**: Users shall be able to archive memos, which will remove them from the active inbox view but not permanently delete them.
- **FR-16**: A complete and immutable activity history (audit trail) must be maintained for every memo, tracking actions such as sending, viewing, acknowledging, and assigning.

### 2.3 Administration
- **FR-17**: Admins shall be able to configure system-wide settings, including the organizational structure (divisions, departments, etc.) and memo reference number formats.
- **FR-18**: Admins shall have access to a global audit log viewer to inspect the activity of any memo in the system.
- **FR-19**: Admins shall be able to create, define, and delete user roles and their associated permissions.
- **FR-20**: Admins shall be able to manage memo labels that can be applied system-wide.

---

## 3. Non-Functional Requirements

### 3.1 Security
- **NFR-1**: All user passwords must be securely hashed using a strong, industry-standard algorithm (e.g., bcrypt).
- **NFR-2**: The system must implement protections against common web vulnerabilities, including but not limited to Cross-Site Scripting (XSS), Cross-Site Request Forgery (CSRF), and SQL Injection.
- **NFR-3**: All data transmitted between the client and server must be encrypted using TLS.
- **NFR-4**: Role-based and delegation permissions must be strictly enforced on all backend actions to prevent unauthorized access or operations.
- **NFR-5**: The system shall implement account lockout mechanisms after a configured number of failed login attempts.

### 3.2 Performance
- **NFR-6**: All critical page loads and user interactions (e.g., opening the inbox, viewing a memo) shall complete within 3 seconds under normal load conditions.
- **NFR-7**: The UI should feel responsive, utilizing optimistic updates for actions like marking as read or archiving.
- **NFR-8**: The system must be capable of handling at least 100 concurrent users without significant degradation in performance.

### 3.3 Usability
- **NFR-9**: The user interface must be responsive and provide an optimal viewing experience on modern desktop and mobile web browsers.
- **NFR-10**: The application must be intuitive and easy to navigate for users with varying levels of technical expertise.
- **NFR-11**: The system must comply with WCAG 2.1 AA accessibility standards.

### 3.4 Reliability & Maintainability
- **NFR-12**: The system should be designed for high availability, with a target uptime of 99.9%.
- **NFR-13**: The system must have robust data backup and recovery mechanisms in place to prevent data loss.
- **NFR-14**: The codebase must be well-structured, with a clear separation of concerns, to facilitate ongoing maintenance and future feature development.
