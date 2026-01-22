
# Memo Management System - User Acceptance Testing (UAT) Plan

## 1. Introduction

### 1.1 Purpose
This document outlines the User Acceptance Testing (UAT) plan for the Nib Memo Management System. Its purpose is to provide a comprehensive set of test cases to validate that the system meets all specified business requirements, functions as expected, and is ready for production deployment. This document serves as the single source of truth for the UAT team to conduct testing and provide formal sign-off.

### 1.2 Scope
This UAT plan covers all features, workflows, and UI components of the Memo Management System, including but not limited to:
- User Authentication and Security
- Memo Creation, Sending, and Management (Inbox, Sent, Drafts, etc.)
- Advanced Memo Features (Acknowledgement, Assigning, Replying)
- User Profile Management
- Administrative Functions (User, Role, and Organizational Structure Management)
- System Settings and Configuration
- Real-time Notifications
- Responsive Design and Mobile Experience

### 1.3 Target Audience
This document is intended for the UAT team, project stakeholders, product owners, and the development team.

### 1.4 Test Approach
Testers are expected to execute each test case as described, documenting the actual results and noting any deviations from the expected outcomes. Testing should be performed by users assuming the specified roles (e.g., Admin, Member) to ensure role-based access control is functioning correctly.

---

## 2. General System Requirements

| Test ID | Feature | Requirement | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **GBL-001** | Browser Compatibility | System must be fully functional on the latest versions of Chrome, Firefox, Edge, and Safari. | All UI elements render correctly and all features work as expected across supported browsers. |
| **GBL-002** | Responsiveness | The application UI must adapt seamlessly to desktop, tablet, and mobile screen sizes. | No broken layouts, overlapping text, or horizontal scrolling on any device. Mobile view uses bottom navigation. |
| **GBL-003** | Performance | Pages and data should load within 3 seconds under normal network conditions. UI interactions should feel instant. | Application feels responsive and fast. No noticeable lag during navigation or data fetching. |
| **GBL-004** | Accessibility | System should adhere to WCAG 2.1 AA standards, including keyboard navigation, screen reader support, and sufficient color contrast. | All interactive elements are focusable and operable via keyboard. All images have `alt` text. Forms are properly labeled. |
| **GBL-005** | UI/UX Consistency | All pages must share a consistent design language (colors, fonts, spacing, component styles, border radius). | The application has a cohesive and professional look and feel. The `0.5rem` border radius is applied consistently. |

---

## 3. User Roles & Permissions

This section defines the system's user roles. All subsequent tests should be performed by users assigned to these roles to validate access control.

| Role | Permissions | Description |
| :--- | :--- | :--- |
| **Admin** | All permissions enabled. | Can manage all aspects of the system, including users, roles, organizational structure, and system-wide settings. Has full access to all memos for archival purposes. |
| **Member** | `view_dashboard`, `manage_memos` | A standard user who can create, send, receive, and manage their own memos. Cannot access the Admin panel. |

---

## 4. Authentication Module

### 4.1 Login Page (`/login`)
- **Purpose**: To allow registered users to securely access the system.
- **Allowed Roles**: All users (registered and unregistered).
- **UI Elements**: Email Input, Password Input, "Show/Hide Password" Button, "Sign In" Button, Logo, Decorative Background.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-001** | Successful Login | User has valid credentials and is not locked out. | 1. Enter valid email. 2. Enter valid password. 3. Click "Sign In". | System authenticates the user and redirects to the dashboard (`/dashboard/inbox`). A success toast appears. | User is successfully logged in and redirected. |
| **AUTH-002** | Invalid Password | User has a valid email but provides an incorrect password. | 1. Enter valid email. 2. Enter incorrect password. 3. Click "Sign In". | System shows an "Invalid credentials" error toast. User remains on the login page. Login attempt counter is incremented. | User is not logged in. Error toast is displayed. |
| **AUTH-003** | Invalid Email | User enters an email that is not registered in the system. | 1. Enter non-existent email. 2. Enter any password. 3. Click "Sign In". | System shows an "Invalid credentials" error toast. User remains on the login page. | User is not logged in. Error toast is displayed. |
| **AUTH-004** | Empty Credentials | User clicks "Sign In" without entering credentials. | Click "Sign In" with empty fields. | Form validation messages appear under each field ("Invalid email address.", "Password is required."). | User cannot submit the form. Validation messages are shown. |
| **AUTH-005** | Account Lockout | A user has entered the wrong password 4 times (1 less than `MAX_FAILED_ATTEMPTS`). | 1. Enter valid email. 2. Enter incorrect password. 3. Click "Sign In". | The system logs the 5th failed attempt. The account is locked. An error toast appears stating the account is locked and for how long (e.g., 15 minutes). The form is disabled. | User cannot log in. A lockout timer appears on the UI, counting down the remaining lockout time. |
| **AUTH-006** | Attempt Login While Locked | User's account is locked. | Attempt to log in with any credentials. | The form is disabled and the lockout timer is visible. Login attempt is blocked. | The "Sign In" button is disabled. |
| **AUTH-007** | Successful Login After Lockout | User's lockout period has expired. | 1. Enter valid email. 2. Enter correct password. 3. Click "Sign In". | The system authenticates the user. The `failedLoginAttempts` counter is reset to 0, and `lockoutUntil` is cleared. | User is successfully logged in. |
| **AUTH-008** | Inactive Account Login | User's account status is 'inactive'. | Attempt to log in with valid credentials. | System shows an error toast: "Your account is deactivated. Please contact an administrator." | User is not logged in. Correct error message is displayed. |
| **AUTH-009** | Show/Hide Password | User is typing a password. | Click the "eye" icon in the password field. | The password field's type toggles between 'text' and 'password'. The icon changes between `Eye` and `EyeOff`. | User can view and hide their password input. |

### 4.2 Forced Password Change (`/dashboard/change-password`)
- **Purpose**: To force new users or users with reset passwords to set a new, secure password before accessing the application.
- **Allowed Roles**: Any user with the `mustChangePassword` flag set to `true`.
- **UI Elements**: New Password Input, Confirm Password Input, Password Strength Indicator, "Update Password" Button, Decorative Background.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-010** | Forced Redirect | A user with `mustChangePassword=true` logs in. | User successfully logs in. | User is immediately redirected to `/dashboard/change-password`. All other navigation is blocked. | User lands on the change password page and cannot access other parts of the app. |
| **AUTH-011** | Successful Password Change | User is on the forced change password page. | 1. Enter a new, strong password that meets all policy rules. 2. Confirm the password. 3. Click "Update Password". | System validates the password. The password is updated in the database. The `mustChangePassword` flag is set to `false`. User is redirected to `/dashboard/inbox`. A success toast appears. | User is redirected and can now access the full application. |
| **AUTH-012** | Password Policy Violation | User enters a password that does not meet the strength requirements. | Enter a weak password (e.g., "password"). | The form shows validation errors based on the rules defined in `password-policy.ts` (e.g., "Password must contain an uppercase letter."). The Password Strength Indicator reflects the failed rules. | Form submission is blocked. User sees clear feedback on why the password is not acceptable. |
| **AUTH-013** | Password Mismatch | User enters two different passwords. | 1. Enter a strong password in the first field. 2. Enter a different password in the second field. | Form shows a "Passwords don't match" validation error under the confirmation field. | Form submission is blocked. |
| **AUTH-014** | Pwned Password Check | User enters a password known to be in a data breach (e.g., "password123"). | Enter a pwned password. | System checks against the HIBP Pwned Passwords API. A validation error appears: "This password has been exposed in a data breach...". | Form submission is blocked. |

### 4.3 Logout & Session Management
- **Purpose**: To securely terminate a user's session.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AUTH-015** | Manual Logout | User is logged in. | Click the user avatar -> "Log out". | The user's `tokenVersion` is incremented in the database, invalidating the JWT. The user is redirected to `/login`. | User is logged out and cannot use the back button to access protected pages. |
| **AUTH-016** | Session Inactivity Timeout | User is logged in and remains idle for 15 minutes. | Do nothing for 15 minutes. | The `useIdleTimer` hook triggers a logout. The user is redirected to `/login?error=SessionExpired`. | User is automatically logged out. A toast appears on the login page explaining the session expired. |
| **AUTH-017** | Session Concurrency | User is logged in on two different browsers (Tab A, Tab B). | Log out from Tab A. | The `tokenVersion` is incremented. When Tab B makes its next request, the JWT's `tokenVersion` will not match the database `tokenVersion`. | The session in Tab B is invalidated, and the user is redirected to the login page. |

---

## 5. Dashboard & Memo Views

### 5.1 Main Dashboard (`/dashboard/*`)
- **Purpose**: To provide the main interface for viewing and interacting with memos.
- **UI Elements**: Two-pane layout (Memo List, Memo Display) on desktop, single-pane on mobile, Filters, Memo List Items, Memo Detail View.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DASH-001** | Two-Pane Layout (Desktop) | User is on a desktop device. | View any memo list (Inbox, Sent, etc.). | The memo list appears in the left pane, and either an empty state or the selected memo appears in the right pane. | Both panes are visible and functional. |
| **DASH-002** | Single-Pane Navigation (Mobile) | User is on a mobile device. | 1. View a memo list. 2. Tap on a memo. | 1. Only the memo list is visible. 2. The memo list is replaced by the memo detail view. A back button is present to return to the list. | Navigation between list and detail is smooth and intuitive for mobile. |
| **DASH-003** | Empty State | User navigates to a folder (e.g., Inbox) with no memos. | Navigate to an empty "Inbox". | The memo display pane shows an illustration (`InboxEmptyIllustration`) and text: "Inbox Zero...". | An appropriate and helpful empty state is displayed instead of a blank area. |
| **DASH-004** | Select Memo | User is viewing a memo list. | Click on a memo in the list. | The selected memo is highlighted in the list. Its content is displayed in the right pane. The URL updates with `?id=<memoId>`. If the memo was unread, it is now marked as read (UI updates optimistically, server action fires). | Memo is displayed correctly. Read status updates. |
| **DASH-005** | Deselect Memo (Mobile) | User is viewing a memo on mobile. | Click the "Back" arrow in the memo display header. | The memo display is replaced by the memo list view. The `id` is removed from the URL query string. | User is returned to the memo list. |
| **DASH-006** | Deep Link to Memo | User navigates directly to a URL with a memo ID (e.g., `/dashboard/inbox?id=...`). | Open the URL in a new tab. | The memo list loads, and the specified memo is automatically selected and displayed. | The correct memo is shown on page load. |

### 5.2 Memo List (`@/components/memo-list.tsx`)
- **Purpose**: To display a list of memos with key information.
- **UI Elements**: Avatar, Sender/Recipient Name, Subject, Timestamp, Status Badge, Body Snippet, Favorite Star, Context Menu.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DASH-007** | Display Information | N/A | View the memo list. | Each item correctly shows the sender/recipient, subject, relative timestamp, and a snippet of the body. | All information is accurate and legible. |
| **DASH-008** | Unread Indicator | An inbox memo is unread. | View the inbox. | The memo item has a bolded title and a visual indicator (blue dot or similar) to signify it is unread. | Unread memos are clearly distinguishable from read memos. |
| **DASH-009** | Favorite Memo | A memo is not favorited. | Click the star icon on the memo item. | The star icon fills with a yellow color (optimistic update). A toast "Memo favorited" appears. The memo may move to the top of the list. | The memo is now favorited. The UI reflects this change instantly. |
| **DASH-010**| Unfavorite Memo | A memo is favorited. | Click the filled star icon. | The star icon becomes an outline (optimistic update). A toast "Memo unfavorited" appears. | The memo is no longer favorited. |
| **DASH-011**| Flag Memo | A memo is not flagged. | Right-click memo -> "Flag". | A red border/indicator appears on the memo item. A toast "Memo Flagged" appears. | The memo is now flagged. |
| **DASH-012** | Context Menu Actions | User has appropriate permissions. | Right-click on a memo in the inbox. | A context menu appears with relevant actions (Reply, Assign, Archive, Favorite, etc.). | All permitted actions are available and functional. |
| **DASH-013**| Hover Actions | User has appropriate permissions. | Hover over a memo item. | A set of quick action icons (e.g., Archive, Reply) appears on the right side of the item. | Hover actions appear and are functional. |

### 5.3 Memo Detail View (`@/components/memo-display.tsx`)
- **Purpose**: To display the full content and metadata of a single memo.
- **UI Elements**: Header (To, From, CC, Subject, etc.), Body, Attachments, Action Buttons (Acknowledge, Reply, etc.), Activity History.

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DASH-014**| Display All Fields | A memo with CC, attachments, and labels is selected. | View the memo. | All fields (From, To, CC, Subject, Date, Attachments, Labels) are correctly displayed. | All memo metadata is visible and accurate. |
| **DASH-015**| Render Body | Memo body contains HTML (lists, tables, bold text). | View the memo. | The memo body is rendered as formatted HTML inside the `prose` container. | All HTML content is displayed correctly, not as raw text. |
| **DASH-016**| Download Attachment | Memo has an attachment. | Click on an attachment link. | The browser initiates a download for the correct file. | User can successfully download attachments. |
| **DASH-017**| Activity History | Memo has a history of actions (sent, viewed, assigned). | Scroll to the bottom of the memo. | The activity history section lists each event with the actor's name, avatar, action type, details, and timestamp, sorted chronologically. | The full history of the memo is accurately displayed. |

---

## 6. Memo Actions & Workflows

### 6.1 Acknowledgement
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACK-001** | Button Visibility (Label) | Memo has a label with `requiresAcknowledgement=true`. User is a recipient and has not acknowledged. | View the memo. | The "Acknowledge" button is visible and prominent. | Button appears when required by a label. |
| **ACK-002** | Button Visibility (Global Setting) | Admin has enabled the global acknowledgement setting. Memo has no specific labels. User is a recipient and has not acknowledged. | View the memo. | The "Acknowledge" button is visible. | Button appears when required by the global setting. |
| **ACK-003**| Button Hidden | Memo does not meet any acknowledgement criteria. | View the memo. | The "Acknowledge" button is not visible. | Button is hidden when not required. |
| **ACK-004**| Successful Acknowledgement | The "Acknowledge" button is visible. | Click "Acknowledge" -> "Confirm & Acknowledge". | An "acknowledged" event is added to the activity history. The button disappears. The user's acknowledgement (badge or signature) appears next to their name in the "To" field. A success toast appears. | The memo is successfully acknowledged. |
| **ACK-005**| Signature Acknowledgement | `acknowledgementType` is 'SIGNATURE'. User has an uploaded signature. | Acknowledge the memo. | The user's saved signature image appears next to their name in the recipient list. | Signature is correctly displayed. |
| **ACK-006**| Badge Acknowledgement | `acknowledgementType` is 'BADGE'. | Acknowledge the memo. | A status badge with "Acknowledged" appears next to the user's name. | Badge is correctly displayed. |

### 6.2 Reply, Reply All, Assign
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-001** | Reply | User is a direct recipient of a memo. | Click "Reply". | User is redirected to `/dashboard/new`. The "To" field is pre-filled with the original sender. The subject is pre-filled with "Re: [Original Subject]". The original memo content is quoted in the body. | The reply composition page is correctly pre-populated. |
| **ACT-002** | Reply All | Memo has multiple recipients (To/CC). User is a direct recipient. | Click "Reply All". | User is redirected to `/dashboard/new`. "To" is pre-filled with the original sender. "CC" is pre-filled with all other To/CC recipients. Subject and body are pre-filled as in a normal reply. | All original recipients are correctly added to the new memo. |
| **ACT-003** | Assign | User is a recipient of a memo. | Click "Assign". | User is redirected to `/dashboard/new`. The subject is pre-filled with "Fw: [Original Subject]". The original memo content is quoted in the body. "To" and "CC" fields are empty. | The assign composition page is correctly pre-populated. |
| **ACT-004**| Action Restrictions (CC user) | User is a CC recipient, not a direct (`to`) recipient. | View the memo. | The "Acknowledge" button is visible, but "Reply," "Reply All," and "Assign" buttons are not visible or are disabled. | CC'd users can acknowledge but cannot perform other primary actions. |
| **ACT-005**| Action Restrictions (Sender) | User is the sender of the memo. | View the memo in the "Sent" folder. | "Acknowledge," "Reply," and "Reply All" buttons are not visible. | Senders cannot perform actions on memos they have sent. |

### 6.3 Drafts
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DFT-001**| Auto-Save Draft | User is composing a new memo. | Type in the subject or body and then pause for 2 seconds. | A "Saving..." badge appears, followed by "Saved at [time]". A `draftId` is added to the URL if it's a new memo. | Draft is automatically saved without user intervention. |
| **DFT-002**| Continue Draft | User navigates to the "Drafts" folder. | Click on a saved draft memo. | User is taken to `/dashboard/new?id=<draftId>` and the composition form is populated with the saved draft content. | User can seamlessly continue editing a draft. |
| **DFT-003**| Delete Draft | User is editing a draft. | Click "Delete Draft" -> "Delete". | The draft is permanently deleted. User is redirected to `/dashboard/inbox`. A success toast appears. | Draft is successfully deleted. |
| **DFT-004**| Sending a Draft | User is editing a draft and clicks "Send Memo". | Click "Send Memo". | The memo is sent. The draft version is deleted from the database. | The memo is sent successfully and no longer appears in the "Drafts" folder. |

---

## 7. Admin Panel (`/dashboard/admin/*`)

- **Precondition for all tests in this section**: User must have the 'Admin' role.

### 7.1 User Management
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADM-USR-001**| View User List | N/A | Navigate to `/dashboard/admin/users`. | A table of all users is displayed, showing Name, Email, Role, Assignment, and Status. | All users are listed with correct information. |
| **ADM-USR-002**| Create New User | N/A | Click "Add User". Fill out the form with valid details (Name, Email, Role, Office, etc.). Click "Save User". | A new user is created. The user appears in the user list. A welcome email with a temporary password is sent to the user's email address. | User is created successfully. `mustChangePassword` is `true` for the new user. |
| **ADM-USR-003**| Edit User | N/A | Click "Edit" on a user. Change their role and department. Click "Save User". | The user's details are updated in the database. The changes are reflected in the user list. A success toast appears. | User details are updated correctly. |
| **ADM-USR-004**| Deactivate/Activate User | A user is 'active'. | Click "Deactivate" on a user. | The user's status changes to 'inactive'. The user is immediately unable to log in or maintain their session. The action can be reversed by clicking "Activate". | User status can be toggled successfully. |
| **ADM-USR-005**| Reset User Password | N/A | Click "Reset Password" on a user -> "Reset Password". | The user's password is reset to a new, strong temporary password. `mustChangePassword` is set to `true`. An email is sent to the user with the new password. A success toast appears. | The user can log in with the new temporary password and is forced to change it. |
| **ADM-USR-006**| Bulk Import Users | N/A | 1. Click "Import". 2. Download the CSV template. 3. Fill it with valid user data. 4. Upload the file. 5. Click "Start Import". | The system processes the CSV. A summary dialog shows the number of successful imports and failures. Successful users are added to the system. | Users from the CSV are created correctly. Error reporting is accurate. |
| **ADM-USR-007**| Delete User | User has not authored any memos. | Click "Delete User" on a user -> "Delete User". | The user is permanently deleted from the system. | User is removed. |
| **ADM-USR-008**| Fail to Delete User | User has authored one or more memos. | Attempt to delete the user. | An error toast appears: "Cannot delete user. They are the author of X memo(s)...". | Deletion is blocked to maintain data integrity. |

### 7.2 Role & Permission Management
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADM-ROL-001**| View Role List | N/A | Navigate to `/dashboard/admin/roles`. | A table shows all roles and the number of users assigned to each. | All roles are displayed correctly. |
| **ADM-ROL-002**| Create New Role | N/A | 1. Click "Add New Role". 2. Enter a name. 3. Select a set of permissions. 4. Click "Save Role". | A new role is created with the specified permissions. It appears in the role list. | Role is created successfully. |
| **ADM-ROL-003**| Edit Role Permissions | A non-Admin role exists. | 1. Click "Edit" on the role. 2. Add or remove permissions. 3. Click "Save Role". | The role's permissions are updated. Users with this role immediately have their access adjusted. | Changes to permissions are reflected in user access. |
| **ADM-ROL-004**| Delete Role | A role has 0 users assigned. | Click "Delete" on the role -> "Continue". | The role is permanently deleted. | Role is removed from the system. |
| **ADM-ROL-005**| Fail to Delete Role | A role has 1 or more users assigned. | Attempt to delete the role. | An error toast appears: "Cannot delete role. It is currently assigned to... users." | Deletion is blocked. |

### 7.3 Organizational Structure Management (Offices, Departments, etc.)
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADM-ORG-001**| Create/Edit/Delete an Office | N/A | Navigate to `/dashboard/admin/offices`. Use the UI to add, edit, and delete an office. | All CRUD operations work as expected. Deletions are blocked if the office has associated districts/departments. | The organizational hierarchy can be managed successfully. |
| **ADM-ORG-002**| Create/Edit/Delete a Department | An office exists. | Navigate to `/dashboard/admin/departments`. Use the UI to add, edit, and delete a department, assigning it to an office. | All CRUD operations work as expected. Deletions are blocked if the department has associated divisions. | The organizational hierarchy can be managed successfully. |
| **ADM-ORG-003**| Cascading Selects in User Form | Admin is creating/editing a user. | 1. Select an Office. 2. Select a Department. | 1. The Department dropdown is populated only with departments belonging to the selected office. 2. The Division dropdown is populated only with divisions belonging to the selected department. | The form's dropdowns update dynamically to ensure a valid organizational assignment. |

### 7.4 General & Email Settings
| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADM-SET-001**| Change Acknowledgement Type | Admin is logged in. | Navigate to `/dashboard/admin/general`. Toggle the "Enable Digital Signatures" switch and click "Save Settings". | The `acknowledgementType` setting is updated globally. The behavior for acknowledgements in the memo view changes accordingly for all users. | The global acknowledgement behavior can be configured. |
| **ADM-SET-002**| Disable Email Notifications | Admin is logged in. | Navigate to `/dashboard/admin/email`. Toggle off "Email Notifications" and click "Save Settings". | All outgoing email notifications for new memos are disabled system-wide. | No emails are sent when a new memo is created. |
| **ADM-SET-003**| Customize Email Template | Admin is logged in. | Navigate to `/dashboard/admin/email`. Modify the Header, Body, or Footer text fields and save. | The live preview updates instantly. Future emails sent by the system use the new template content. | Email templates are customizable. |

---

## 8. Notifications

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NOTIF-001**| Real-time Notification | User A is logged in. User B sends a new memo to User A. | User B sends the memo. | A toast notification appears on User A's screen. The bell icon shows an unread count. A notification sound plays (if enabled). | User A is notified in real-time without a page refresh. |
| **NOTIF-002**| Notification List | User has unread notifications. | Click the bell icon. | A dropdown appears listing all unread notifications, with the newest at the top. | All unread notifications are displayed. |
| **NOTIF-003**| Click Notification | User has an unread notification in the dropdown. | Click on a notification. | User is navigated to the corresponding memo detail view (`/dashboard/inbox?id=...`). The notification is removed from the dropdown list. The unread count decreases. | Clicking a notification opens the relevant memo and marks it as read. |
| **NOTIF-004**| Mark All as Read | User has multiple unread notifications. | Click the bell -> "Mark all as read". | The unread count on the bell icon disappears. The notification list becomes empty. The `mark-all-memos-as-read` event is dispatched. | All notifications are cleared from the UI. |
| **NOTIF-005**| Disable Notifications | User disables notifications in settings. | A new memo is sent to the user. | No toast appears. No sound plays. The bell icon still updates its count. | User-level settings for toasts and sounds are respected. |

---

## 9. Profile Management

| Test ID | Feature | Preconditions | User Actions | System Behavior | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PROF-001**| View Profile | User is logged in. | Navigate to `/dashboard/profile`. | The page displays the user's current Name, Email, Avatar, Signature, and Organizational Info. | All profile information is displayed correctly. |
| **PROF-002**| Update Profile Info | User is on the profile page. | Change Name and Email fields. Click "Save All Changes". | The user's details are updated. A success toast appears. The user nav in the header updates instantly with the new name/email. | Profile text fields can be updated successfully. |
| **PROF-003**| Upload New Avatar | User is on the profile page. | Click the camera icon on the avatar. Select a valid image file (<5MB). | A preview of the new avatar is shown. Click "Save All Changes". | The avatar is uploaded. The user nav avatar and all other instances of the user's avatar update across the app (cache-busted). | Avatar can be updated. |
| **PROF-004**| Create/Update Signature | User is on the profile page. | Click "Edit Signature". Draw a signature in the pad. Click "Save Signature". Click "Save All Changes". | The signature is saved. The preview on the profile page updates. This new signature will be used for future acknowledgements. | Signature can be created and updated. |
