# Postman Testing Guide: Customer Onboarding Ingestion

To test the middleware ingestion without a production integration, follow these steps to use Postman as your client.

## 1. Configure the API Key
The ingestion endpoint is secured with an API key. You must set this in your environment file.

1. Open `.env` in the root of the project.
2. Add or update the following line:
   ```env
   ONBOARDING_API_KEY=test_middleware_key_2024
   ```
3. Restart your development server (`npm run dev`) to apply the changes.

## 2. Set Up the Postman Request

### Request Configuration
- **Method**: `POST`
- **URL**: `http://localhost:3010/api/public/v1/customer-onboarding` 
  *(Note: Adjust the port if your server is running on a different one)*

### Headers
Add the following headers in the **Headers** tab:
- `X-API-Key`: `test_middleware_key_2024` (or whatever you set in `.env`)
- `Content-Type`: `application/json`

### Body
Select **raw** and **JSON** format, then paste this template:

```json
{
  "mnemonic": "JDOE01",
  "shortName": "John Doe",
  "fullName1": "Johnathan Q. Doe",
  "fullName2": "Test Integration",
  "street": "Bole 03",
  "townCity": "Addis Ababa",
  "country": "ET",
  "sector": "1001",
  "accountOfficer": "RO-001",
  "industry": "2000",
  "target": "RETAIL",
  "nationality": "ET",
  "customerStatus": "ACTIVE",
  "residence": "ET",
  "legalIdNumber": "ID556677",
  "documentName": "PASSPORT",
  "nameOnID": "JOHNATHAN DOE",
  "issueAuthority": "IMMIGRATION",
  "issueDate": "15 JAN 2024",
  "expirationDate": "15 JAN 2029",
  "language": "EN",
  "region": "AA",
  "phoneNumbersRes": "+251111223344",
  "mobilePhoneNumbers": "+251911223344",
  "title": "MR",
  "givenName": "John",
  "familyName": "Doe",
  "gender": "MALE",
  "dateOfBirth": "20 MAY 1985",
  "maritalStatus": "SINGLE",
  "customerType": "INDIVIDUAL",
  "occupation": "Engineer",
  "employersName": "Tech Corp",
  "netMonthlyIn": "50000",
  "secureMessage": "Y",
  "houseNo": "44",
  "woreda": "03",
  "subcity": "BOLE",
  "motherName": "Jane Doe",
  "nationalIDNumber": "NID123456"
}
```

## 3. Verify the Result
1. Click **Send** in Postman.
2. You should receive a `201 Created` response with the system-generated ID.
3. Log in to the Dashboard at `http://localhost:3010/dashboard/customer-onboarding`.
4. You will see the new submission at the top of the **Onboarding Status** list with a `PENDING` status.

---

## Troubleshooting — Ingestion Endpoint

| Error Code | Meaning | Solution |
| :--- | :--- | :--- |
| **401 Unauthorized** | Missing or wrong API Key | Check the `X-API-Key` header and `.env`. |
| **422 Unprocessable Entity** | Validation Failed | Look at the `fieldErrors` in the response to see which field is invalid. |
| **429 Too Many Requests** | Rate limit exceeded | Wait 60 seconds before trying again. |
| **500 Server Error** | Database connection issue | Ensure Prisma client is generated and the DB is running. |

---

## 4. Status Lookup Endpoint

Check the approval status of a submitted customer by their registered phone number.

> **Authentication required** — either a session cookie (browser) or the `X-API-Key` header.

### Request Configuration

- **Method**: `GET`
- **URL**: `http://localhost:3010/api/public/v1/customer-onboarding/status?phoneNumber=%2B251XXXXXXXXX`

> **URL encoding note:** Both `+251...` (bare plus) and `%2B251...` (percent-encoded) are accepted.  
> The server reads the raw query string with `decodeURIComponent` — which preserves a literal `+` — rather than `URLSearchParams`, which would silently convert `+` to a space per the `application/x-www-form-urlencoded` spec and break validation.

### Headers

| Header | Value |
| :--- | :--- |
| `X-API-Key` | `test_middleware_key_2024` (or whatever you set in `.env`) |

### Phone Number Format Rules

The endpoint enforces a **strict** Ethiopian phone number format. No normalization is performed.

| Rule | Detail |
| :--- | :--- |
| Prefix | Must start with exactly `+251` |
| Digits | Exactly **9** numeric digits (`0–9`) after the country code |
| Length | 13 characters total (`+` + `251` + 9 digits) |
| No spaces | Spaces, dashes, or parentheses are **rejected** |
| No alternatives | `09XXXXXXXXX`, `251XXXXXXXXX`, `0251XXXXXXXXX` are all **rejected** |
| Regex | `^\+251\d{9}$` |

#### ✅ Valid examples

Both URL representations of `+` work:

```
# Bare + (works — server uses decodeURIComponent, not URLSearchParams)
?phoneNumber=+251911223344

# Percent-encoded (also works)
?phoneNumber=%2B251911223344
```

#### ❌ Invalid examples (all return `400 INVALID_PHONE_FORMAT`)

```
0911223344          ← missing country code
251911223344        ← missing leading +
+251 911 223 344    ← spaces not allowed
+251-911-223-344    ← dashes not allowed
+2519112233         ← only 8 digits (one short)
+25191122334455     ← 11 digits (two extra)
+2510911223344      ← 10 digits starting with 0
```

---

### Postman Test Cases

#### Test 1 — Valid number, record found (expect `200 OK`)

```
GET http://localhost:3010/api/customer-onboarding/status?phoneNumber=%2B251911223344
X-API-Key: test_middleware_key_2024
```

**Expected response:**

```json
{
  "success": true,
  "status": "PENDING",
  "reviewNote": null,
  "submittedAt": "2026-03-31T08:00:00.000Z",
  "updatedAt": "2026-03-31T08:00:00.000Z",
  "accountNumber": "1000123456789",
  "accountHolderName": "John Doe"
}
```

#### Test 2 — Valid number, no record (expect `404 NOT_FOUND`)

```
GET http://localhost:3010/api/customer-onboarding/status?phoneNumber=%2B251900000000
X-API-Key: test_middleware_key_2024
```

**Expected response:**

```json
{
  "success": false,
  "error": "No onboarding record found for the provided phone number.",
  "code": "NOT_FOUND"
}
```

#### Test 3 — Invalid format, short number (expect `400 INVALID_PHONE_FORMAT`)

```
GET http://localhost:3010/api/customer-onboarding/status?phoneNumber=0911223344
X-API-Key: test_middleware_key_2024
```

**Expected response:**

```json
{
  "success": false,
  "error": "Invalid phone number format. Expected format: +251XXXXXXXXX (9 digits after the country code).",
  "code": "INVALID_PHONE_FORMAT"
}
```

#### Test 4 — Missing parameter (expect `400 MISSING_PARAMETER`)

```
GET http://localhost:3010/api/customer-onboarding/status
X-API-Key: test_middleware_key_2024
```

**Expected response:**

```json
{
  "success": false,
  "error": "phoneNumber query parameter is required.",
  "code": "MISSING_PARAMETER"
}
```

#### Test 5 — No auth (expect `401 UNAUTHORIZED`)

```
GET http://localhost:3010/api/customer-onboarding/status?phoneNumber=%2B251911223344
```
*(No X-API-Key header, no session)*

**Expected response:**

```json
{
  "success": false,
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

---

### Complete Response Shape Reference

All responses — success and error — follow a consistent top-level shape to prevent information leakage through structural differences.

#### Success (`200`)

```json
{
  "success": true,
  "status": "PENDING | APPROVED | REJECTED",
  "reviewNote": "string | null",
  "submittedAt": "ISO 8601 datetime",
  "updatedAt":   "ISO 8601 datetime"
}
```

#### Error (all non-2xx)

```json
{
  "success": false,
  "error":  "Human-readable message",
  "code":   "MACHINE_READABLE_CODE"
}
```

---

### Troubleshooting — Status Endpoint

| HTTP Status | Code | Meaning | Action |
| :--- | :--- | :--- | :--- |
| **400** | `MISSING_PARAMETER` | `phoneNumber` param absent | Add `?phoneNumber=...` to the URL |
| **400** | `INVALID_PHONE_FORMAT` | Number does not match `^\+251\d{9}$` | Fix the number format; URL-encode `+` as `%2B` |
| **401** | `UNAUTHORIZED` | No valid session or API key | Add the `X-API-Key` header |
| **404** | `NOT_FOUND` | Number is valid but not registered | Verify the number matches what was submitted exactly |
| **429** | `RATE_LIMITED` | Exceeded 10 lookups/min | Wait 60 seconds before retrying |
| **500** | `INTERNAL_ERROR` | Unexpected server error | Check server logs; ensure DB is reachable |

> **Security note:** All lookups with a correctly-formatted phone number (both hits and misses) are recorded in the `SecurityLog` table under the events `PHONE_STATUS_LOOKUP_HIT` / `PHONE_STATUS_LOOKUP_MISS`. Monitor this table for unusual miss-heavy patterns that may indicate enumeration attempts.
