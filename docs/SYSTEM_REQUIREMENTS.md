# **System Requirements Document (SRD)**

## **Project Overview**
**Project Name**: NIB Customer Onboarding Middleware
**Objective**: To streamline and digitize the customer onboarding process for NIB International Bank by providing a middleware application that validates, reviews, and synchronizes customer data with the T24 core banking system.

---

## **1. Functional Requirements**

### **1.1 User Management & Authentication**
- **Authentication**: Users must authenticate using secure credentials (handled by NextAuth.js).
- **Role-Based Access Control (RBAC)**:
  - **Submitter/Verifier**: Can submit customer onboarding requests.
  - **Verifier**: Performs the first-level review (Stage 1).
  - **Approver**: Performs the final review and triggers T24 synchronization (Stage 2).
  - **Admin**: Manages organizational units (branches, departments, districts, etc.), roles, and users.
- **Session Management**: Secure session handling with idle timeout features.

### **1.2 Customer Onboarding Workflow**
- **Submission**: Capture detailed customer information (Personal, Address, Contact, Legal ID, Banking, Financials).
- **Data Validation**: Enforce strict data validation using Zod schemas for both internal storage and T24 payload compliance.
- **Two-Stage Approval**:
  - **Stage 1 (Verification)**: A Verifier reviews and verifies the submission.
  - **Stage 2 (Approval)**: An Approver reviews and triggers the final synchronization.
- **Conflict Prevention**: 
  - Submitter cannot be the Verifier for the same record.
  - Verifier cannot be the Approver for the same record.
- **Idempotency & Deduplication**: Prevent duplicate submissions for the same mnemonic within a 2-minute cooldown period.
- **Resubmission**: Support resubmitting rejected applications while maintaining a link to the original record for audit history.

### **1.3 T24 Integration**
- **Payload Generation**: Automatically build a strictly whitelisted JSON payload for the T24 REST API.
- **Synchronization**: Forward approved records to the T24 endpoint (`/CustomerCreate`).
- **Response Handling**: Parse and store responses from T24, including account numbers and error messages.
- **Retry Mechanism**: Allow re-forwarding records that failed synchronization (`SYNC_FAILED`).

### **1.4 Communication & Notifications**
- **SMS Alerts**: Send automated SMS notifications to customers upon approval or rejection of their onboarding request.
- **Audit Logs**: Track all actions (Submission, Review, Forwarding, Resubmission) with timestamps, actor IDs, and IP addresses.
- **Security Logs**: Log critical events (e.g., failed logins, permission violations) with severity levels.

### **1.5 Administrative Modules**
- **Organizational Structure**: Manage hierarchical units: Offices -> Departments -> Divisions and Districts -> Branches.
- **User Management**: Create and manage users within specific organizational units and roles.
- **Role Management**: Define and assign permissions to various roles.

---

## **2. Non-Functional Requirements**

### **2.1 Performance**
- **Response Time**: UI actions (e.g., list fetching) should complete within 500ms under normal load.
- **T24 Ingestion**: External API calls should handle timeouts gracefully (30-second limit).

### **2.2 Scalability**
- The system must support concurrent onboarding requests from multiple branches across the bank's network.

### **2.3 Security**
- **Data Integrity**: Use payload hashing to detect data changes during resubmissions.
- **Encryption**: All sensitive data (passwords, etc.) must be hashed before storage.
- **Auditability**: Every change to a customer onboarding record must be logged in an audit trail.
- **SSL/TLS**: All communications with external APIs (T24, SMS) should ideally use HTTPS.

### **2.4 Reliability**
- **Transaction Management**: Use database transactions (Prisma `$transaction`) to ensure data consistency during complex operations.
- **Error Handling**: Graceful handling of network failures and T24 business-level errors.

### **2.5 Usability**
- **Clean UI**: A modern, responsive dashboard built with Tailwind CSS and Radix UI components.
- **Input Guidance**: Clear validation errors and status indicators (badges) for easy monitoring.

---

## **3. External Dependencies**
- **Database**: PostgreSQL (v15+).
- **ORM**: Prisma.
- **Core Banking**: T24 REST API.
- **Communication**: SMS Gateway API.
- **Runtime**: Node.js environment (Next.js App Router).
