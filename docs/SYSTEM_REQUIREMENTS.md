# **System Requirements Document (SRD)**

## **1. Executive Summary**
The **NIB Customer Onboarding Middleware (NCOM)** is a strategic digital initiative by NIB International Bank to modernize its customer acquisition process. The system provides a secure, automated, and auditable bridge between external customer data sources and the **T24 Core Banking System**. By implementing a robust two-stage approval workflow (Maker-Checker), NCOM ensures high data quality, regulatory compliance, and operational efficiency.

## **2. Business Context and Objectives**
### **Business Context**
Currently, customer onboarding involves manual data entry into the core banking system, which is prone to errors, lacks centralized tracking, and slows down the customer acquisition lifecycle.

### **Objectives**
- **Digitization**: Replace manual entry with an automated API-driven and web-based onboarding process.
- **Data Integrity**: Enforce strict validation rules to ensure only clean data reaches T24.
- **Security & Compliance**: Implement mandatory review stages and full audit trails to satisfy internal controls and regulatory requirements.
- **Efficiency**: Reduce the time-to-onboard by automating T24 synchronization and customer notifications.

## **3. Project Scope**
### **In-Scope**
- Development of a web-based middleware for customer data validation and review.
- Implementation of a 2-stage approval workflow (Verifier and Approver).
- Integration with T24 Core Banking REST API for customer creation.
- Integration with SMS Gateway for automated notifications.
- Administrative modules for user, role, and organizational unit management.
- Real-time KPI dashboards for monitoring the onboarding pipeline.

### **Out-of-Scope**
- Modification of existing T24 core banking logic.
- Direct management of customer accounts post-creation.
- Physical document scanning or OCR (data is assumed to be provided via API or manual entry).

## **4. Business Requirements**

### **4.1 Functional Requirements**
- **User Management & Authentication**: Secure credentials via NextAuth.js and Role-Based Access Control (RBAC).
- **Onboarding Workflow**: Capture customer data, validate against Zod schemas, and manage status transitions (PENDING → VERIFIED → SYNCED → APPROVED).
- **Conflict Prevention**: Enforce Maker-Checker rules (e.g., Submitter cannot be the Verifier).
- **T24 Integration**: Whitelisted payload generation and REST API synchronization with error handling.
- **Notifications**: Automated SMS alerts upon approval or rejection.
- **Audit & Security**: Comprehensive logging of all actions and security-sensitive events.

### **4.2 Non-Functional Requirements**
- **Performance**: UI response under 500ms; T24 calls within 30 seconds.
- **Scalability**: Support for concurrent requests across the bank's branch network.
- **Security**: SHA-256 payload hashing for idempotency; Bcrypt hashing for passwords; SSL/TLS for all external communications.
- **Reliability**: Use of Prisma transactions for data consistency and graceful error handling.
- **Usability**: Responsive UI built with Tailwind CSS and Radix UI.

## **5. Stakeholders and Users**
- **Frontline Staff (Submitters)**: Capture and submit customer data.
- **Branch Managers / Verifiers**: Perform the first-level data verification.
- **Operations Officers / Approvers**: Perform final authorization and trigger T24 sync.
- **System Administrators**: Manage users, roles, and bank organizational structures.
- **IT Support**: Monitor system health and integration logs.
- **Internal Audit**: Review audit trails for compliance.

## **6. Assumptions, Dependencies, and Constraints**
### **Assumptions**
- Customer data provided via external APIs is mostly complete and requires only final verification.
- Users have basic proficiency in web-based applications.

### **Dependencies**
- **T24 Core Banking**: Availability of the REST API endpoints.
- **SMS Gateway**: Availability of the bank's communication API.
- **Network**: Stable internal bank network for system access and external integrations.

### **Constraints**
- Data must strictly follow T24's payload requirements (e.g., specific field lengths and formats).
- Regulatory compliance requires a mandatory separation of duties (Maker-Checker).

## **7. High-Level Business Process**
### **Current State**
1. Frontline staff collects physical documents.
2. Data is manually typed into T24.
3. Errors are often caught only after the record is created.
4. No centralized tracking of pending applications.

### **Future State (with NCOM)**
1. Data is ingested via API or manual entry into NCOM.
2. System performs immediate schema validation.
3. Verifier reviews data for accuracy.
4. System automatically syncs with T24.
5. Approver performs final check.
6. Customer automatically receives an SMS with their new account details.

## **8. High-Level Timeline, Risks, and Benefits**
### **Timeline**
- **Phase 1**: Requirements & Design (Completed).
- **Phase 2**: Development & Internal Testing (In-Progress).
- **Phase 3**: UAT & T24 Integration Testing.
- **Phase 4**: Deployment & Training.

### **Risks**
- **Integration Risk**: Potential downtime or API changes in the T24 system.
- **Data Quality**: Incomplete data from source systems requiring manual intervention.

### **Benefits**
- **90% Reduction** in manual data entry errors.
- **Real-time visibility** into the customer onboarding backlog.
- **Full Auditability** of the entire lifecycle of a customer record.

## **9. Approval and Sign-off**
This document requires review and approval from the following departments:
- **Digital Banking Department**
- **IT Operations**
- **Compliance & Internal Audit**

---
**Version**: 1.1  
**Last Updated**: 2026-05-20
