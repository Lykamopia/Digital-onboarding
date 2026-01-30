# Nibtera Edir System - User Acceptance Testing (UAT) Plan

## 1. Introduction

### 1.1 Purpose
This document outlines the User Acceptance Testing (UAT) plan for the Nibtera Edir System. Its purpose is to validate that the system meets the specified business requirements and is ready for production use by Edir members and administrators.

### 1.2 Scope
This UAT plan covers all major features of the Nibtera Edir System, including:
- User Registration and Authentication.
- Member Profile and Information Management.
- Contribution Tracking and Payment.
- Event Reporting and Claim Submission.
- Administrative review and processing of claims.
- Financial Dashboards and Reporting.
- System Notifications and Announcements.

---

## 2. User Roles

-   **Member**: A standard registered user of the Edir. Can manage their profile, pay contributions, and submit claims.
-   **Admin/Committee**: A user with administrative privileges. Can manage members, contributions, claims, finances, and system settings.

---

## 3. Test Cases

### 3.1 Authentication & User Management

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **AUTH-001** | New User | A new user attempts to register for the Edir. | User can fill out the registration form, submit it, and their account is created with a 'Pending Approval' status. |
| **AUTH-002** | Admin | Admin logs in and navigates to the new member approval screen. | Admin can see the pending member and approve their registration. The member receives a notification. |
| **AUTH-003** | Member | A registered member attempts to log in with valid credentials. | User is successfully logged in and redirected to their personal dashboard. |
| **AUTH-004** | Member | A registered member attempts to log in with invalid credentials. | System displays a "Invalid credentials" error. |
| **AUTH-005** | Member | A logged-in member navigates to their profile page. | Member can view their personal details, contribution history, and edit their profile information. |

### 3.2 Contributions & Payments

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **CON-001** | Admin | Admin sets the monthly contribution amount and schedule. | The new contribution rule is saved and applied to all active members. |
| **CON-002** | Member | Member logs in and views their dashboard when a contribution is due. | The dashboard clearly shows the outstanding amount and provides a "Pay Now" button. |
| **CON-003** | Member | Member clicks "Pay Now" and completes the payment process (simulated). | The contribution is marked as 'Paid'. The member's payment history is updated. A receipt is generated. |
| **CON-004** | Admin | Admin views the financial dashboard. | The dashboard correctly reflects the newly paid contribution, updating the total funds. |

### 3.3 Events & Claims Management

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **CLAIM-001**| Member | Member experiences a qualifying event (e.g., wedding) and submits a new claim. | Member can fill out the claim form, select the event type, and upload supporting documents. The claim is submitted and appears in their history with a 'Pending' status. |
| **CLAIM-002**| Admin | Admin logs in and views the claims dashboard. | The new claim from the member appears in the list of pending claims. |
| **CLAIM-003**| Admin | Admin reviews the claim, verifies documents, and approves it. | The claim status changes to 'Approved'. A notification is sent to the member. The financial system is updated to schedule the disbursement. |
| **CLAIM-004**| Admin | Admin reviews a claim and rejects it due to insufficient documentation. | Admin can add a reason for rejection. The claim status changes to 'Rejected'. The member is notified with the reason. |
| **CLAIM-005**| Member | Member views their claim history after approval. | The claim status is 'Approved', and details of the payout are visible. |

### 3.4 Communication & Governance

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **COMM-001** | Admin | Admin posts a new announcement for all members. | The announcement appears on the dashboard of all logged-in members. |
| **COMM-002** | Member | Member logs in after an announcement is posted. | The new announcement is clearly visible on the member's dashboard. |
| **GOV-001** | Member | Member navigates to the "Bylaws" or "Rules" page. | The member can view the complete, read-only text of the Edir's rules and regulations. |