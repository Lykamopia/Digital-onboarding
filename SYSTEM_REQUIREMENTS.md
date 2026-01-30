# High-Level Design: Nib Memo System

## 1. Introduction

### 1.1 Purpose
This document outlines the high-level system design for the Nib Memo System. It defines the system architecture, major functional modules, core workflows, and non-functional requirements. This design serves as a foundational blueprint for the development, deployment, and future scalability of the platform.

### 1.2 Scope
The Nib Memo System is a digital platform designed to manage the complete lifecycle of internal memorandums. The system will handle memo creation, multi-level distribution, tracking, acknowledgment, delegation, and archiving. The primary interface will be a responsive web application accessible on both desktop and mobile devices, providing a secure and auditable communication channel.

### 1.3 Definitions, Acronyms, and Abbreviations
-   **Memo**: An official internal document.
-   **User**: A registered and active participant in the system.
-   **Admin**: A user with administrative privileges.
-   **RBAC**: Role-Based Access Control.
-   **Delegator**: A user who grants access to their account.
-   **Delegate**: A user who is granted access to act on behalf of another user.

---

## 2. System Architecture

The Nib Memo System is built on a robust, scalable, and maintainable three-tier architecture. This separation of concerns ensures that each part of the system can be developed, managed, and scaled independently.

![System Architecture Diagram](https://placehold.co/800x400/FFF/333?text=System%20Architecture:%203-Tier%20Model)
*<p align="center">A diagram illustrating a standard three-tier architecture: Presentation, Logic, and Data.</p>*

### 2.1 Presentation Layer (Frontend)
This is the client-facing part of the system that users interact with directly.
-   **Technology**: A responsive web application built with a modern framework (e.g., Next.js, React).
-   **Responsibilities**:
    -   Rendering an intuitive and accessible user interface for all system modules.
    -   Handling user input, view-state management, and client-side validation.
    -   Communicating with the Application Layer via secure server actions and API calls.
    -   Providing real-time updates using WebSockets for notifications.

### 2.2 Application/Logic Layer (Backend)
This layer contains the core business logic and acts as the brain of the system.
-   **Technology**: A set of services and APIs (e.g., built with Next.js Server Actions, Node.js).
-   **Responsibilities**:
    -   Implementing all business rules for user management, memo workflows, and delegation.
    -   Managing user authentication (login, password management) and authorization (RBAC, permissions).
    -   Processing data and orchestrating workflows between different modules.
    -   Handling file uploads and storage management.
    -   Integrating with third-party services like email notification systems.

### 2.3 Data Layer (Database)
This layer is responsible for the persistent storage and retrieval of all system data.
-   **Technology**: A relational database (e.g., PostgreSQL) accessed via an ORM (e.g., Prisma).
-   **Responsibilities**:
    -   Storing data in a structured, secure, and reliable manner.
    -   Ensuring data integrity through schemas and relationships for entities like Users, Memos, Roles, and Activities.
    -   Providing a data access API for the Application Layer.
    -   Managing backups and recovery.

---

## 3. Major Modules & Interactions

The system is composed of several interconnected modules, each responsible for a specific set of functionalities.

![Module Interaction Diagram](https://placehold.co/800x500/FFF/333?text=Module%20Interaction%20Diagram)
*<p align="center">A flow diagram showing how major modules like User Management, Memo Workflow, and Delegation interact.</p>*

### 3.1 User Management & Authentication
-   **Description**: Manages the user lifecycle, profiles, roles, and security.
-   **Features**:
    -   Secure user registration, login with password hashing, and account lockout policies.
    -   Role-Based Access Control (RBAC) with extensible roles (e.g., **Admin**, **Member**).
    -   User profile management, including personal details and a digital signature.
    -   Password management (secure reset, strength policies).

### 3.2 Memo Workflow Management
-   **Description**: The core operational module for the entire memo lifecycle.
-   **Features**:
    -   **Creation**: Rich-text editor, file attachments, and memo templates.
    -   **Distribution**: Define 'To' and 'CC' recipients from the organizational structure.
    -   **Tracking**: Real-time status updates (`Draft`, `Sent`, `Read`, `Acknowledged`).
    -   **Workflow**: Logic for acknowledgment (manual/auto), replies, and assignments.
    -   **Audit Trail**: A comprehensive, immutable log of every action performed on a memo.

### 3.3 Delegation Management
-   **Description**: Allows users to securely delegate account access to others.
-   **Features**:
    -   **Granting Access**: Users can select a delegate and assign specific permissions (e.g., view, send, acknowledge).
    -   **Context Switching**: Delegates can switch to act on behalf of the delegator from their own account.
    -   **Traceability**: All actions taken by a delegate are explicitly logged in the memo's activity history (e.g., "Sent by [Delegate] on behalf of [Delegator]").
    -   **Revocation**: Delegators can revoke access at any time.

### 3.4 Communication & Notifications
-   **Description**: Keeps users informed of memo-related activities.
-   **Features**:
    -   **Real-time In-App Alerts**: Uses WebSockets for instant notifications.
    -   **Email Notifications**: Sends formatted emails for critical events (e.g., new memo, password reset).
    -   **Configurable**: Admins can enable/disable and customize email templates.

### 3.5 Settings & Configuration
-   **Description**: A centralized module for administrators to manage system-wide settings.
-   **Features**:
    -   Manage organizational structure (Offices, Departments, Divisions, etc.).
    -   Configure memo reference number formats.
    -   Set system-wide acknowledgment policies (manual vs. automatic).
    -   Manage user roles and their associated permissions.

### 3.6 Reporting & Auditing
-   **Description**: Provides insights into system usage and ensures accountability.
-   **Features**:
    -   **Admin Dashboard**: Key metrics on system activity (memos sent, acknowledgment rates).
    -   **Audit Trail Viewer**: A searchable interface for admins to review the activity history of any memo.
    -   **Data Export**: Functionality to export audit logs and memo lists for compliance and reporting.

---

## 4. Core Workflows

### 4.1 Memo Lifecycle
1.  **Creation**: A user creates a `Memo` record with a `draft` status. Changes are auto-saved.
2.  **Sending**: The user sends the memo. Its status changes to `sent`. A unique `memo_reference_number` is generated. An initial "sent" `Activity` log is created.
3.  **Notification**: A WebSocket event is broadcast to all clients. Email notifications are sent to all recipients.
4.  **Viewing**: A recipient opens the memo. The system creates a "viewed" `Activity` log for that user if it's their first time viewing it.
5.  **Acknowledgment**:
    -   **Automatic Mode**: If enabled, the memo is acknowledged immediately upon being viewed. An "acknowledged" `Activity` log is created.
    -   **Manual Mode**: The recipient must click an "Acknowledge" button. This action creates the "acknowledged" `Activity` log.
6.  **Archiving**: A user archives a memo, linking their user ID to the memo's archived list. This removes it from their active inbox view but does not delete it.

### 4.2 Delegation Workflow
1.  **Granting**: User A (Delegator) selects User B (Delegate) from their profile and assigns permissions (e.g., `delegation:view`, `delegation:send`). This creates a `Delegation` record in the database.
2.  **Switching**: User B, from their own account, clicks "Act as [User A]". The session token is updated to reflect User A's identity, while securely storing User B's real identity.
3.  **Acting**: User B now sees User A's memos. When User B sends a memo, the backend logic verifies they have the `delegation:send` permission. The `Memo` is created with User A as the `from` user, but the `Activity` log records the action as "Sent by [User B] on behalf of [User A]".
4.  **Returning**: User B clicks "Return to My Account". The session token is reverted to User B's original state.

---

## 5. Non-Functional Requirements

-   **Security**:
    -   All data must be encrypted in transit (TLS) and at rest.
    -   Implement strict Content Security Policy (CSP) and other security headers to prevent XSS and other attacks.
    -   Enforce RBAC and delegation permissions on all backend actions.
    -   Prevent use of compromised passwords by checking against services like HIBP.
-   **Scalability**: The architecture must support a growing number of users and transactions. The backend should be stateless to allow for horizontal scaling.
-   **Reliability**: The system must be highly available (e.g., >99.9% uptime) and include robust data backup and recovery mechanisms.
-   **Usability**: The UI must be intuitive, responsive, and accessible (WCAG 2.1 AA compliant) for users with varying levels of technical expertise.
-   **Performance**: All critical user interactions (page loads, sending memos) should complete within 2-3 seconds. The UI should provide optimistic updates where possible to feel instantaneous.
-   **Maintainability**: The codebase must be well-organized, with a clear separation of concerns, to facilitate future updates and bug fixes.