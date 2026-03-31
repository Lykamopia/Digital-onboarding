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
- **URL**: `http://localhost:3010/api/customer-onboarding` 
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

## Troubleshooting

| Error Code | Meaning | Solution |
| :--- | :--- | :--- |
| **401 Unauthorized** | Missing or wrong API Key | Check the `X-API-Key` header and `.env`. |
| **422 Unprocessable Entity** | Validation Failed | Look at the `fieldErrors` in the response to see which field is invalid. |
| **429 Too Many Requests** | Rate limit exceeded | Wait 60 seconds before trying again. |
| **500 Server Error** | Database connection issue | Ensure Prisma client is generated and the DB is running. |
