# Nib Memo System - User Acceptance Testing (UAT) Plan

## 1. Introduction

### 1.1 Purpose
This document outlines the User Acceptance Testing (UAT) plan for the Nib Memo System. Its purpose is to validate that the system meets the specified business requirements and is ready for production use by all users and administrators.

### 1.2 Scope
This UAT plan covers all major features of the Nib Memo System, including:
- User Registration and Authentication.
- User Profile and Signature Management.
- Memo Creation, Sending, and Distribution.
- Memo Acknowledgment and Tracking.
- Administrative review and management of users, roles, and settings.
- System Dashboards and Reporting.
- System Notifications and Alerts.

---

## 2. User Roles

-   **User**: A standard registered user of the system. Can create, send, receive, and manage their own memos.
-   **Admin**: A user with administrative privileges. Can manage users, roles, system-wide settings, and view all system activity.

---

## 3. Test Cases

### 3.1 Authentication & User Management

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **AUTH-001** | New User | A new user receives an invitation email and clicks the setup link. | User is directed to a secure page to set their password. |
| **AUTH-002** | User | A registered user attempts to log in with valid credentials. | User is successfully logged in and redirected to their memo dashboard (Inbox). |
| **AUTH-003** | User | A registered user attempts to log in with invalid credentials. | System displays a "Invalid credentials" error message. |
| **AUTH-004** | User | A logged-in user navigates to their profile page. | User can view their personal details and organizational assignment. |
| **AUTH-005** | User | A logged-in user uploads a new profile picture and digital signature. | The new images are displayed on the profile page and saved successfully. |

### 3.2 Memo Creation & Workflow

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **MEMO-001** | User | User creates a new memo, adds recipients, a subject, body content, and an attachment. | The memo is saved as a draft. The user can preview the memo. |
| **MEMO-002** | User | User sends the created memo. | The memo is moved from 'Drafts' to 'Sent'. Recipients receive an in-app and email notification. |
| **MEMO-003** | User (Recipient) | A recipient opens the new memo from their inbox. | The memo is displayed correctly. The memo is automatically marked as read. The 'Acknowledge' button is visible. |
| **MEMO-004** | User (Recipient) | Recipient clicks the 'Acknowledge' button. | The memo is marked as acknowledged. The sender can see the acknowledgment in the memo's activity trail. |
| **MEMO-005** | User | User replies to a received memo. | A new compose window opens with the subject pre-filled with 'Re:' and the original recipients populated. |

### 3.3 Administration

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **ADMIN-001** | Admin | Admin navigates to the 'Users' settings page. | Admin can view a list of all users, their roles, and status. |
| **ADMIN-002** | Admin | Admin creates a new user role with a specific set of permissions. | The new role is saved and can be assigned to users. |
| **ADMIN-003** | Admin | Admin navigates to the 'General' settings and changes the acknowledgment mode from manual to automatic. | The setting is saved. When a user reads a memo, it is now automatically acknowledged. |
| **ADMIN-004** | Admin | Admin views the system audit log. | Admin can see a detailed timeline of all memo activities across the system. |

### 3.4 Communication & UI

| Test ID | Role | Test Case Description | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **COMM-001** | User (Recipient) | User receives a new memo while logged in. | A toast notification appears. The notification bell shows an unread count. |
| **UI-001** | User | User views their dashboard on a mobile device. | The layout is responsive and all primary functions (viewing, composing) are accessible. |
