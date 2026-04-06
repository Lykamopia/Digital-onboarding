# **Low Level Design (LLD)**

## **1. Data Model Specification**

### **1.1 CustomerOnboarding Model**
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `String (cuid)` | Unique identifier. |
| `mnemonic` | `String` | Idempotent key for customer lookup. |
| `approvalStatus` | `Enum (ApprovalStatus)` | PENDING, VERIFIER_APPROVED, VERIFIER_REJECTED, AWAITING_T24_SYNC, AWAITING_T24_RESPONSE, SYNC_FAILED, PENDING_APPROVER, APPROVED, REJECTED, REQUIRES_REVIEW, RESUBMITTED. |
| `parentCustomerId` | `String?` | Links to the previous attempt (for resubmissions). |
| `shortName` | `String` | Short name of the customer. |
| `fullName1` | `String` | Full name (Line 1). |
| `psuToken` | `String?` | External identifier (e.g., National ID). |
| `picture` | `String?` | Path to the customer's photo file. |
| `payloadHash` | `String?` | SHA-256 hash of the onboarding payload for deduplication. |
| `forwardedAt` | `DateTime?` | Timestamp of successful T24 ingestion. |
| `forwardError` | `String?` | Details of T24 ingestion failure. |
| `forwardResponse` | `Json?` | Raw response data from T24 API. |
| `smsSentAt` | `DateTime?` | Timestamp of SMS notification. |
| `smsStatus` | `String?` | SENT or FAILED. |
| `verifierReviewedById` | `String?` | User ID of the Stage 1 reviewer. |
| `approverReviewedById` | `String?` | User ID of the Stage 2 reviewer. |
| `submittedById` | `String?` | User ID of the initial submitter. |

---

## **2. Server Action Implementation**

### **2.1 `submitCustomerOnboarding(rawData, systemActor)`**
- **Validation**: Parses `rawData` using `CustomerOnboardingSchema` (Zod).
- **Name Normalization**: Ensures `fullName1` is not redundant (e.g., "First Last First Last").
- **Deduplication**: 
  1. Finds the latest record for the same `mnemonic`.
  2. Enforces a 2-minute cooldown between submissions.
  3. Checks `payloadHash` for identical data submissions.
- **Resubmission**: Links the new record to the previous `REJECTED` attempt using `parentCustomerId`.
- **Transaction**: Performs record creation and audit logging within a Prisma `$transaction`.

### **2.2 `reviewCustomerOnboarding(opts)`**
- **Decision Logic**:
  - **Stage 1 (Verifier)**:
    - If `APPROVED`: Status -> `PENDING_APPROVER`.
    - If `REJECTED`: Status -> `VERIFIER_REJECTED`.
  - **Stage 2 (Approver)**:
    - If `APPROVED`: Status -> `AWAITING_T24_RESPONSE` -> Trigger `forwardToCoreBanking`.
    - If `REJECTED`: Status -> `REQUIRES_REVIEW` (reverts to Verifier) or `REJECTED` (final).
- **Internal Control Violation (ICV) Checks**: 
  - Submitter cannot be the Verifier.
  - Verifier cannot be the Approver.
- **Audit Logging**: Captures decision details and actor metadata.
- **SMS Trigger**: Sends rejection SMS for final `REJECTED` status.

### **2.3 `forwardToCoreBanking(id, actorId)`**
- **Payload Building**: Strictly builds a whitelisted object based on `T24PayloadSchema`.
- **T24 API Call**: Sends a POST request to the configured `T24_API_URL` with an optional `T24_API_KEY`.
- **Response Handling**:
  - **Success**: Status -> `APPROVED`, updates `forwardedAt`, stores `forwardResponse`, and sends approval SMS.
  - **Business Error**: Status -> `SYNC_FAILED`, logs the specific error message from T24.
  - **Network Error**: Status -> `SYNC_FAILED`, logs the exception.

---

## **3. Component Design**

### **3.1 Customer Onboarding Form (`customer-onboarding-form.tsx`)**
- **Input Fields**: Divided into logical sections (Identity, Address, Contact, Legal ID, Banking, Financials).
- **State Management**: Uses `react-hook-form` with `zodResolver` for real-time validation.
- **Image Upload**: Handles base64 conversion and preview for the customer photo.
- **Submission Feedback**: Displays loading states and server-side validation errors.

### **3.2 Review Client (`review-client.tsx`)**
- **Decision Buttons**: Approve and Reject buttons with confirmation dialogs.
- **Note Input**: Mandatory comments field for rejection actions.
- **Status Badges**: Visual indicators for the current `approvalStatus`.
- **Audit History**: Displays the chronological list of actions taken on the record.

---

## **4. Integration Details**

### **4.1 T24 API Contract**
- **Endpoint**: `POST /CustomerCreate`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <T24_API_KEY>`
- **Payload Schema (Key Fields)**:
  - `mnemonic`: Unique lookup key.
  - `shortName`, `fullName1`, `givenName`, `familyName`: Customer names.
  - `legalIdNumber`: Limited to 10 digits for T24 compatibility.
  - `phoneNumber`: Mandatory contact number.
  - `title`, `gender`, `maritalStatus`: Enforced enum values.

### **4.2 SMS Gateway Contract**
- **Method**: `POST` (REST API).
- **Parameters**: `recipient` (phone number), `message` (content).
- **Response**: `ok` (boolean), `status` (integer), `error` (string).

---

## **5. Error Handling Strategy**
- **Client-Side**: Real-time Zod validation feedback.
- **Server-Side**: 
  - **Zod Schema**: `T24PayloadSchema.strict()` prevents unknown fields.
  - **Safe Parse**: `safeParseT24Response` recursively handles double-serialized JSON.
  - **Database Transactions**: Ensures atomicity for linked updates (e.g., status change + audit log).
  - **Security Logging**: Critical failures (e.g., ICV violations) are logged for administrative review.
