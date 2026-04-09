import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ApiErrorCode = 
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR'
  | 'INVALID_JSON'
  | 'CONFLICT'
  | 'BAD_REQUEST';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: ApiErrorCode;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Formats a ZodError into a human-readable string while avoiding technical enum lists.
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues;
  if (issues.length === 0) return 'Validation failed.';

  // Map of field names to more friendly labels
  const fieldLabels: Record<string, string> = {
    mnemonic: 'Mnemonic',
    shortName: 'Short Name',
    fullName1: 'Full Name',
    street: 'Street',
    townCity: 'Town/City',
    country: 'Country',
    sector: 'Sector',
    industry: 'Industry',
    target: 'Target',
    customerStatus: 'Customer Status',
    legalIdNumber: 'Legal ID Number',
    documentName: 'Document Name',
    nameOnID: 'Name on ID',
    issueAuthority: 'Issue Authority',
    issueDate: 'Issue Date',
    expirationDate: 'Expiration Date',
    language: 'Language',
    region: 'Region',
    mobilePhoneNumbers: 'Mobile Number',
    title: 'Title',
    givenName: 'Given Name',
    familyName: 'Family Name',
    gender: 'Gender',
    dateOfBirth: 'Date of Birth',
    maritalStatus: 'Marital Status',
    customerType: 'Customer Type',
    picture: 'Profile Picture'
  };

  const formattedIssues = issues.map((issue) => {
    const field = issue.path[0] as string;
    const label = fieldLabels[field] || field;

    // Handle enum errors specially to avoid listing all options
    if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      return `The ${label} field has an invalid value. Please provide a valid option.`;
    }

    // Use custom error message if provided in schema, otherwise generic
    if (issue.message && !issue.message.includes('Expected')) {
      return issue.message;
    }

    if (issue.code === z.ZodIssueCode.too_small) {
      return `The ${label} field is required.`;
    }

    if (issue.code === z.ZodIssueCode.invalid_string) {
      return `The ${label} field has an invalid format.`;
    }

    return `Invalid value for ${label}.`;
  });

  // Remove duplicates and return first 2-3 issues to keep it concise
  const uniqueIssues = Array.from(new Set(formattedIssues));
  return uniqueIssues.slice(0, 3).join(' ') + (uniqueIssues.length > 3 ? ' (and more errors found)' : '');
}

/**
 * Standardized error response for APIs.
 */
export function errorResponse(
  message: string,
  code: ApiErrorCode = 'BAD_REQUEST',
  status: number = 400,
  fieldErrors?: Record<string, string[]>
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code
    },
    { status }
  );
}

/**
 * Standardized success response for APIs.
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      ...data
    },
    { status }
  );
}
