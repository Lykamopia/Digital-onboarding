import { z } from 'zod';

const DATE_REGEX  = /^\d{2} [A-Z]{3} \d{4}$/;    // e.g. "23 OCT 2025"
const PHONE_REGEX = /^\+?\d{7,15}$/;
// Base64 image data URI (data:image/jpeg;base64,...) or stored path (/uploads/customer-photos/...)
const PICTURE_REGEX = /^(data:image\/|\/uploads\/customer-photos\/)/;

export const CustomerOnboardingSchema = z.object({
  mnemonic:           z.string().min(1, 'Mnemonic is required').max(50),
  shortName:          z.string().min(1, 'Short name is required').max(100),
  fullName1:          z.string().min(1, 'Full name 1 is required').max(200),
  fullName2:          z.string().max(200).optional().or(z.literal('')),
  street:             z.string().min(1, 'Street is required'),
  townCity:           z.string().min(1, 'Town/City is required'),
  country:            z.string().length(2, 'Country must be a 2-letter code'),
  sector:             z.string().min(1, 'Sector is required'),
  accountOfficer:     z.string().min(1, 'Account officer is required'),
  industry:           z.string().min(1, 'Industry is required'),
  target:             z.string().min(1),
  nationality:        z.string().length(2),
  customerStatus:     z.string().min(1),
  residence:          z.string().length(2),
  legalIdNumber:      z.string().min(1, 'Legal ID number is required'),
  nationalIDNumber:   z.string().optional().or(z.literal('')),
  documentName:       z.string().min(1, 'Document name is required'),
  nameOnID:           z.string().min(1, 'Name on ID is required'),
  issueAuthority:     z.string().min(1, 'Issue authority is required'),
  issueDate:          z.string().regex(DATE_REGEX, 'Issue date must be in format DD MMM YYYY (e.g. 01 OCT 2024)'),
  expirationDate:     z.string().regex(DATE_REGEX, 'Expiration date must be in format DD MMM YYYY'),
  language:           z.string().min(1),
  region:             z.string().min(1),
  phoneNumbersRes:    z.string().regex(PHONE_REGEX, 'Invalid phone number').optional().or(z.literal('')),
  mobilePhoneNumbers: z.string().regex(PHONE_REGEX, 'Invalid mobile number').optional().or(z.literal('')),
  title:              z.string().min(1, 'Title is required'),
  givenName:          z.string().min(1, 'Given name is required'),
  familyName:         z.string().min(1, 'Family name is required'),
  gender:             z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'Gender must be MALE or FEMALE' }) }),
  dateOfBirth:        z.string().regex(DATE_REGEX, 'Date of birth must be in format DD MMM YYYY'),
  maritalStatus:      z.enum(['MARRIED', 'SINGLE', 'DIVORCED', 'WIDOWED']),
  occupation:         z.string().optional().or(z.literal('')),
  employersName:      z.string().optional().or(z.literal('')),
  netMonthlyIn:       z.string().optional().or(z.literal('')),
  customerType:       z.string().min(1),
  secureMessage:      z.enum(['Y', 'N']).optional().or(z.literal('')),
  houseNo:            z.string().optional().or(z.literal('')),
  flatNo:             z.string().optional().or(z.literal('')),
  woreda:             z.string().optional().or(z.literal('')),
  kebele:             z.string().optional().or(z.literal('')),
  subcity:            z.string().optional().or(z.literal('')),
  motherName:         z.string().optional().or(z.literal('')),
  // Optional base64-encoded photo — must be a data URI if provided
  picture:            z.string()
                        .refine((v) => !v || PICTURE_REGEX.test(v), {
                          message: 'picture must be a valid base64 image data URI (e.g. data:image/jpeg;base64,...)',
                        })
                        .optional()
                        .or(z.literal('')),
});

export type CustomerOnboardingInput = z.infer<typeof CustomerOnboardingSchema>;
