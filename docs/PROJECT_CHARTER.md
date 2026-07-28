# **Project Charter: NIB Customer Onboarding Middleware (NCOM)**

## **Document Control**
| Version | Date | Description | Author |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-05-21 | Initial Project Charter | Project Team |

---

## **Table of Contents**
1. [Project Summary](#1-project-summary)
2. [Project Description](#2-project-description)
    - 2.1 [Benefits of Customer Onboarding Middleware](#21-benefits-of-customer-onboarding-middleware)
    - 2.2 [System Features](#22-system-features)
3. [Project Objective](#3-project-objective)
4. [Project Scope](#4-project-scope)
    - 4.1 [In Scope](#41-in-scope)
    - 4.2 [Out of Scope](#42-out-of-scope)
5. [Project Deliverable](#5-project-deliverable)
6. [Project High-level Risks](#6-project-high-level-risks)
7. [Project Success Criteria](#7-project-success-criteria)
8. [Project Assumption](#8-project-assumption)
9. [Project Key Stakeholders](#9-project-key-stakeholders)
10. [Approvals](#approvals)

---

## **1. Project Summary**
The **NIB Customer Onboarding Middleware (NCOM)** project is designed to develop a secure, web-based middleware application that streamlines the customer acquisition process for NIB International Bank. The system serves as a bridge between external data sources and the T24 Core Banking system, ensuring data integrity through a robust Maker-Checker workflow.

## **2. Project Description**
The NCOM system digitizes the manual onboarding process by providing a centralized platform for data entry, validation, and multi-stage review. It ensures that customer information is verified by multiple internal levels before being synchronized with the bank's core records.

### **2.1 Benefits of Customer Onboarding Middleware**
- **Operational Efficiency**: Reduces the time required to onboard a new customer by automating T24 synchronization.
- **Improved Data Quality**: Enforces strict schema validation to prevent incorrect data from entering the core system.
- **Enhanced Security**: Implements mandatory separation of duties (Maker-Checker) to mitigate fraud and errors.
- **Auditability**: Maintains a complete, chronological audit trail for every application.
- **Real-time Monitoring**: Provides management with visibility into the onboarding pipeline and branch performance.

### **2.2 System Features**
- **Automated T24 Integration**: Whitelisted payload generation and REST API sync.
- **Multi-Stage Review**: Dedicated Verifier and Approver workflow stages.
- **Security Logging**: Tracking of failed logins, ICV violations, and integration errors.
- **Automated Notifications**: SMS alerts for customers upon application approval or rejection.
- **KPI Dashboards**: Visual metrics for total onboardings, backlogs, and rejection rates.
- **RBAC**: Fine-grained role-based access control for different staff levels.

## **3. Project Objective**
- To develop and deploy a production-ready middleware for customer onboarding within the specified timeline.
- To achieve a 90% reduction in manual data entry errors into the T24 system.
- To ensure 100% compliance with internal bank audit requirements for the onboarding process.
- To provide a seamless user experience for bank staff across all branches.

## **4. Project Scope**

### **4.1 In Scope:**
- Development of the Next.js web application and PostgreSQL database schema.
- Implementation of the Maker-Checker workflow (Submitter, Verifier, Approver).
- Integration with T24 REST API and SMS Gateway.
- User and Organizational Unit management modules.
- Security and Audit logging infrastructure.
- Deployment configuration for Firebase App Hosting or similar PaaS.

### **4.2 Out of Scope:**
- Changes to the internal business logic of the T24 Core Banking system.
- Post-onboarding account management or transaction processing.
- Hardware procurement or physical networking infrastructure.
- Digital document OCR or physical archival services.

## **5. Project Deliverable**
- **Software**: Production-ready NCOM Web Application.
- **Database**: Configured PostgreSQL database with seed data.
- **Documentation**: 
    - System Requirements Document (SRD).
    - Low-Level Design (LLD).
    - User and System Manual.
    - Project Charter.
- **Testing**: UAT report and T24 integration test results.

## **6. Project High-level Risks**
- **Integration Delays**: Potential downtime or API changes in the T24 test environment.
- **Data Quality**: Incoming data from source systems may require significant manual correction.
- **Security Vulnerabilities**: Risk of unauthorized access if credentials or environment secrets are compromised.
- **User Adoption**: Resistance from staff transitioning from manual to digital processes.

## **7. Project Success Criteria**
- **Successful T24 Sync**: 100% of approved records are successfully created in T24.
- **Zero Critical Defects**: No critical security or functional bugs in the production environment.
- **Positive Stakeholder Feedback**: Approval and sign-off from IT, Compliance, and Digital Banking.
- **Performance**: System handles concurrent branch requests with sub-500ms UI latency.

## **8. Project Assumption**
- The T24 REST API endpoints will be accessible and stable throughout the development lifecycle.
- The bank's internal network provides sufficient bandwidth for the middleware's operations.
- Key stakeholders will be available for timely review and UAT sign-off.

## **9. Project Key Stakeholders**
- **Project Sponsor**: Head of Digital Banking.
- **Project Manager**: IT Project Management Office.
- **Technical Team**: Full-stack Developers, DBAs, and Security Engineers.
- **Business Users**: Branch Staff, Verifiers, and Approvers.
- **Internal Audit**: Compliance and Risk Management teams.
- **External Partners**: Temenos (T24) support team.

## **Approvals:**
| Role | Name | Signature | Date |
| :--- | :--- | :--- | :--- |
| Project Sponsor | | | |
| Project Manager | | | |
| Head of IT | | | |
| Head of Compliance | | | |
