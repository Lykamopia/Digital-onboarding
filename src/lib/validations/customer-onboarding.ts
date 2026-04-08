import { z } from 'zod';

const DATE_REGEX  = /^\d{2} [A-Z]{3} \d{4}$/;    // e.g. "23 OCT 2025"
const PHONE_REGEX = /^\+?\d{7,15}$/;
// Base64 image data URI (data:image/jpeg;base64,...) or stored path (/uploads/customer-photos/...)
const PICTURE_REGEX = /^(data:image\/|\/uploads\/customer-photos\/)/;

export const CustomerOnboardingSchema = z.object({
  mnemonic:           z.string().min(1, 'Mnemonic is required').max(50),
  shortName:          z.string().min(1, 'Short name is required').max(100),
  fullName1:          z.string().min(1, 'Full name 1 is required').max(200),
  fullName2:          z.string().max(200).optional().nullable().or(z.literal('')),
  street:             z.string().min(1, 'Street is required'),
  townCity:           z.string().min(1, 'Town/City is required'),
  country:            z.string().length(2, 'Country must be a 2-letter code'),
  sector:             z.string().min(1, 'Sector is required'),
  accountOfficer:     z.string().optional().nullable().or(z.literal('')),
  industry:           z.string().min(1, 'Industry is required'),
  target:             z.string().min(1),
  nationality:        z.string().length(2).optional().nullable().or(z.literal('')),
  customerStatus:     z.string().min(1),
  residence:          z.string().length(2).optional().nullable().or(z.literal('')),
  legalIdNumber:      z.string().min(1, 'Legal ID number is required'),
  nationalIDNumber:   z.string().optional().nullable().or(z.literal('')),
  documentName:       z.string().min(1, 'Document name is required'),
  nameOnID:           z.string().min(1, 'Name on ID is required'),
  issueAuthority:     z.string().min(1, 'Issue authority is required'),
  issueDate:          z.string().regex(DATE_REGEX, 'Issue date must be in format DD MMM YYYY (e.g. 01 OCT 2024)'),
  expirationDate:     z.string().regex(DATE_REGEX, 'Expiration date must be in format DD MMM YYYY'),
  language:           z.string().min(1),
  region:             z.string().min(1),
  phoneNumbersRes:    z.string().optional().nullable().or(z.literal('')),
  mobilePhoneNumbers: z.string().regex(PHONE_REGEX, 'Invalid mobile number').optional().nullable().or(z.literal('')),
  title:              z.enum([
    'ABBA', 'ATO', 'Ambassador', 'Assi.Professor', 'B.General', 'Brother', 'CEO', 'CMDR', 'Captain', 'Colonel', 
    'Commander', 'DR', 'Dai', 'Daikon', 'Excellency', 'Foreign.Secretary', 'G.Secretary', 'General(Army)', 
    'GeneralAirForce', 'Haji', 'Honourable', 'Kes', 'L.Colonel', 'L.General', 'Lieutenant', 'MISS', 
    'MR', 'MRS', 'MS', 'Major', 'Major.General', 'Mayor', 'Megabi.Haddis', 'Meri.Geta', 'Muftih', 'Pastor', 
    'President', 'Professor', 'Qadhi', 'R.Admiral(CMDR)', 'R.AdmiralUpper', 'REV', 'Sheikh', 'Sir', 'Sister', 
    'Speaker', 'Ustaz', 'V.President', 'Vice.Admiral', 'W/O', 'W/T', 'WOY', 'WRO'
  ]),
  givenName:          z.string().min(1, 'Given name is required'),
  familyName:         z.string().min(1, 'Family name is required'),
  gender:             z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'Gender must be MALE or FEMALE' }) }),
  dateOfBirth:        z.string().regex(DATE_REGEX, 'Date of birth must be in format DD MMM YYYY'),
  maritalStatus:      z.enum(['DIVORCED', 'MARRIED', 'OTHER', 'PARTNER', 'SINGLE', 'WIDOWED']),
  occupation:         z.string().optional().nullable().or(z.literal('')),
  employersName:      z.string().optional().nullable().or(z.literal('')),
  netMonthlyIn:       z.string().optional().nullable().or(z.literal('')),
  customerType:       z.string().min(1),
  secureMessage:      z.string().optional().nullable().or(z.literal('')),
  ownership:          z.string().min(1).default('1000'),
  houseNo:            z.string().optional().nullable().or(z.literal('')),
  flatNo:             z.string().optional().nullable().or(z.literal('')),
  woreda:             z.string().optional().nullable().or(z.literal('')),
  kebele:             z.string().optional().nullable().or(z.literal('')),
  subcity:            z.string().optional().nullable().or(z.literal('')),
  motherName:         z.string().optional().nullable().or(z.literal('')),
  // Optional base64-encoded photo — must be a data URI if provided
  picture:            z.string()
                        .refine((v) => !v || PICTURE_REGEX.test(v), {
                          message: 'picture must be a valid base64 image data URI (e.g. data:image/jpeg;base64,...)',
                        })
                        .optional()
                        .or(z.literal('')),
});

export type CustomerOnboardingInput = z.infer<typeof CustomerOnboardingSchema>;
