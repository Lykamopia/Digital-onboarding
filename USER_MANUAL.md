# **NIB Customer Onboarding Middleware - Comprehensive Manual**

This document provides both the **User Manual** for frontline staff and the **System Manual** for technical administrators.

---

# **PART 1: USER MANUAL**

## **1. Introduction and Overview**
The **NIB Customer Onboarding Middleware** (NCOM) is a dedicated platform designed to digitize and secure the customer onboarding journey at NIB International Bank. It acts as a bridge between data entry (manual or API-driven) and the **T24 Core Banking System**, ensuring that every customer record is validated, reviewed, and authorized before being finalized in the bank's core records.

### **Key Benefits**
- **Error Reduction**: Automated validation prevents common data entry mistakes.
- **Enhanced Security**: Multi-stage approval (Maker-Checker) prevents unauthorized onboarding.
- **Seamless Integration**: Direct synchronization with T24 eliminates manual re-entry.
- **Transparency**: Real-time tracking of every application's status.

---

## **2. Getting Started**

### **2.1 System Requirements**
- **Web Browser**: Latest version of Google Chrome, Microsoft Edge, or Mozilla Firefox.
- **Network**: Access to the bank's internal network (VPN may be required for remote access).

### **2.2 Login and Logout**
1. **Accessing the System**: Navigate to the provided application URL.
2. **Logging In**: Enter your bank email and password.
3. **Logging Out**: Click on your profile icon in the top right and select **Sign Out**. Always log out when leaving your workstation.

### **2.3 First-Time Setup**
- **Password Setup**: New users will receive an automated email invitation. Click the link to set your initial password.
- **Profile Completion**: Go to your **Profile** page to upload your profile picture and digital signature, which may be required for certain authorization steps.

---

## **3. Main Functions / Features**

### **3.1 Customer Onboarding Workflow (Step-by-Step)**

#### **Step 1: Submission (The Maker)**
- **Automatic Ingestion**: Most records are received automatically from external systems (e.g., SuperApp).
- **Status**: Records appear in the dashboard as **PENDING**.
- **Action**: Review the incoming data for completeness.

#### **Step 2: Verification (The Verifier)**
1. Navigate to the **Onboarding Verification & Approval** section.
2. Select a **PENDING** record.
3. Review the customer's identity documents, address, and banking classifications.
4. **Action**: Click **Verify** to move to the next stage, or **Reject** with a comment to send it back.

#### **Step 3: T24 Synchronization (Automated)**
- Once verified, the system automatically builds the T24 payload and attempts synchronization.
- **Status**: Changes to **AWAITING_T24_SYNC** then **PENDING_APPROVER** upon success.

#### **Step 4: Final Approval (The Approver)**
1. Select a record in **PENDING_APPROVER** status.
2. Confirm the T24 response (e.g., Customer ID generated).
3. **Action**: Click **Approve**. The system sends a welcome SMS to the customer and marks the record as **APPROVED**.

### **3.2 Monitoring and KPIs**
- Use the **Middleware Status** dashboard to track real-time metrics:
  - **Backlog Queue**: See exactly how many records are stuck in Verification, Approval, or Sync Failure.
  - **Approval Rate**: Monitor the efficiency of the onboarding pipeline.
  - **Filters**: Sort data by Region, Date Range, or Branch.

---

## **4. Troubleshooting and FAQs**

### **FAQ**
- **Q: Why can't I verify a record I submitted?**
  - **A**: The system enforces "Internal Control Violation" checks. A user cannot act as both Maker and Checker for the same record.
- **Q: What does SYNC_FAILED mean?**
  - **A**: T24 rejected the record (e.g., duplicate National ID). View the **Forward Error** in the record details for the specific reason.

### **Common Troubleshooting**
- **Issue**: Record stuck in `AWAITING_T24_SYNC`.
- **Solution**: Contact the System Administrator to check the T24 API connectivity.

---

## **5. Safety, Security, and Good Practice**
- **Never Share Credentials**: Your login is tied to your digital signature and audit trail.
- **Maker-Checker Integrity**: Do not attempt to bypass the two-stage approval process.
- **Data Privacy**: Ensure customer documents are handled according to the bank's data protection policy.
- **Session Timeout**: The system will log you out after 30 minutes of inactivity. Save your work frequently.

---

## **6. Support and Contacts**
For technical issues or access requests:
- **IT Helpdesk**: [internal-link/email]
- **Onboarding Department**: [internal-extension]

---
---

# **PART 2: SYSTEM MANUAL**

## **1. System Architecture and Environment**

### **1.1 Technology Stack**
- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS & Radix UI

### **1.2 Component Diagram**
The system follows a layered architecture:
- **Client Tier**: React components with Radix UI primitives.
- **Logic Tier**: Next.js Server Actions for business rules and ICV checks.
- **Integration Tier**: REST API clients for T24 Core Banking and SMS Gateway.
- **Data Tier**: PostgreSQL managed via Prisma.

---

## **2. Installation and Configuration**

### **2.1 Environment Variables**
The following variables must be configured in the `.env` file or the environment's secret manager:

| Variable | Status | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | **Required** | PostgreSQL connection string. |
| `SECRET_COOKIE_PASSWORD` | **Required** | Minimum 32-character secret for session encryption. |
| `NEXTAUTH_SECRET` | **Required** | Secret key for NextAuth.js authentication. |
| `T24_API_URL` | **Required** | REST API endpoint for T24 Core Banking. |
| `REDIS_URL` | Optional | For distributed caching or session storage. |
| `SMTP_*` | Optional | SMTP configuration for email invitations. |

### **2.2 Deployment and Operations**

#### **Build and Start**
- **Build**: `npm run build` (Next.js production build).
- **Production**: `npm run start` (Runs on port 3020 by default, override with `PORT`).

#### **Platform**
- **Target**: Firebase App Hosting (configured via `apphosting.yaml` with `maxInstances: 1`).

#### **Database & Seeding**
1. **Sync Schema**: `npx prisma db push` (Development) or `npx prisma migrate deploy` (Production).
2. **Seed Data**: `npx tsx prisma/seed.ts` (Populates initial roles, menu items, and KYC fields).

---

## **3. User Management and Security**

### **3.1 RBAC Implementation**
Permissions are stored as a comma-separated string in the `Role` model. Key permissions include:
- `verifier_customer_onboarding`: Access to Stage 1 review.
- `approver_customer_onboarding`: Access to Stage 2 review and T24 trigger.
- `admin`: Access to organizational and user management.

### **3.2 Security Logging**
The system uses a custom `SecurityLog` model to track:
- **INFO**: Successful logins, routine administrative changes.
- **WARN**: Failed login attempts, permission violations.
- **CRITICAL**: System errors, T24 integration failures.

---

## **4. Operations, Backup, and Maintenance**

### **4.1 Database Transactions**
All critical workflow changes (e.g., approving a record) use Prisma `$transaction` to ensure that status updates, audit logs, and external integration metadata are updated atomically.

### **4.2 Backup Strategy**
- **Daily Backups**: Perform `pg_dump` of the PostgreSQL database.
- **Audit Logs**: The `CustomerOnboardingAuditLog` table should never be truncated as it is the legal record of onboarding.

---

## **5. Integration and Interfaces**

### **5.1 T24 Interface**
- **Method**: POST
- **Endpoint**: `/CustomerCreate`
- **Data Format**: Whitelisted JSON (validated by Zod `T24PayloadSchema`).
- **Idempotency**: The `payloadHash` field prevents duplicate POST requests to T24.

### **5.2 SMS Gateway**
- **Method**: POST
- **Trigger**: Final `APPROVED` or `REJECTED` status change.

---

## **6. Upgrade, Patching, and Change Management**

### **6.1 Code Changes**
1. Implement changes in a feature branch.
2. Run Prisma validation: `npx prisma validate`.
3. Update documentation in the `docs/` folder.

### **6.2 Database Migrations**
Always use `npx prisma migrate deploy` for production updates to ensure schema consistency across environments.

---
