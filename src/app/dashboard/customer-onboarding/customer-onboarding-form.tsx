'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  User, MapPin, CreditCard, Phone, Briefcase, ChevronRight, ChevronLeft,
  Send, Loader2, CheckCircle2, AlertCircle, Building2,
} from 'lucide-react';

import { submitCustomerOnboarding } from '@/app/actions/customer-onboarding';
import { CustomerOnboardingSchema, type CustomerOnboardingInput } from '@/lib/validations/customer-onboarding';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge }    from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { id: 0, label: 'Personal Info',    icon: User,      description: 'Basic identity details' },
  { id: 1, label: 'Address',          icon: MapPin,    description: 'Residential address' },
  { id: 2, label: 'Identification',   icon: CreditCard, description: 'Legal ID document' },
  { id: 3, label: 'Contact & Banking',icon: Phone,     description: 'Contact & classification' },
  { id: 4, label: 'Employment',       icon: Briefcase, description: 'Job & financial info' },
  { id: 5, label: 'Review & Submit',  icon: Building2, description: 'Confirm & submit' },
] as const;

// ─── Field helpers ────────────────────────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {message}
    </p>
  );
}

function FormField({
  label, required, error, children, hint,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
      <FieldError message={error} />
    </div>
  );
}

// ─── Step components ─────────────────────────────────────────────────────────
function PersonalInfoStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const { register, formState: { errors }, setValue, watch } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Mnemonic" required error={errors.mnemonic?.message} hint="Unique customer ID (e.g. N4560963890)">
        <Input {...register('mnemonic')} placeholder="N4560963890" />
      </FormField>
      <FormField label="Title" required error={errors.title?.message}>
        <Select value={watch('title')} onValueChange={(v) => setValue('title', v as CustomerOnboardingInput['title'], { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select title" /></SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {[
              'ABBA', 'ATO', 'Ambassador', 'Assi.Professor', 'B.General', 'Brother', 'CEO', 'CMDR', 'Capitain', 'Colonel', 
              'Commander', 'DR', 'Dai', 'Daikon', 'Excellency', 'Foreign.Secretary', 'G.Secretary', 'General(Army)', 
              'GeneralAirForce', 'Haji', 'Honourable', 'Kes', 'L.Colonel', 'L.General', 'Lieutant', 'Lieutenant', 'MISS', 
              'MR', 'MRS', 'MS', 'Major', 'Major.General', 'Mayor', 'Megabi.Haddis', 'Meri.Geta', 'Muftih', 'Pastor', 
              'President', 'Professor', 'Qadhi', 'R.Admiral(CMDR)', 'R.AdmiralUpper', 'REV', 'Sheikh', 'Sir', 'Sister', 
              'Speaker', 'Ustaz', 'V.President', 'Vice.Admiral', 'W/O', 'W/T', 'WOY', 'WRO'
            ].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Given Name" required error={errors.givenName?.message}>
        <Input {...register('givenName')} placeholder="First name" />
      </FormField>
      <FormField label="Family Name" required error={errors.familyName?.message}>
        <Input {...register('familyName')} placeholder="Last name" />
      </FormField>
      <FormField label="Short Name" required error={errors.shortName?.message} hint="Name as shown on account">
        <Input {...register('shortName')} placeholder="FIRST FIRST FIRST" />
      </FormField>
      <FormField label="Full Name 1" required error={errors.fullName1?.message}>
        <Input {...register('fullName1')} placeholder="Full legal name" />
      </FormField>
      <FormField label="Full Name 2" error={errors.fullName2?.message} hint="Optional secondary name line">
        <Input {...register('fullName2')} placeholder="(optional)" />
      </FormField>
      <FormField label="Gender" required error={errors.gender?.message}>
        <Select value={watch('gender')} onValueChange={(v) => setValue('gender', v as 'MALE' | 'FEMALE', { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="MALE">MALE</SelectItem>
            <SelectItem value="FEMALE">FEMALE</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Date of Birth" required error={errors.dateOfBirth?.message} hint="Format: DD MMM YYYY (e.g. 23 OCT 2000)">
        <Input {...register('dateOfBirth')} placeholder="23 OCT 2000" />
      </FormField>
      <FormField label="Marital Status" required error={errors.maritalStatus?.message}>
        <Select value={watch('maritalStatus')} onValueChange={(v) => setValue('maritalStatus', v as CustomerOnboardingInput['maritalStatus'], { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
          <SelectContent>
            {['DIVORCED', 'MARRIED', 'OTHER', 'PARTNER', 'SINGLE', 'WIDOWED'].map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Nationality" required error={errors.nationality?.message} hint="2-letter country code">
        <Input {...register('nationality')} placeholder="ET" maxLength={2} className="uppercase" />
      </FormField>
      <FormField label="National ID" error={errors.nationalIDNumber?.message}>
        <Input {...register('nationalIDNumber')} placeholder="324235434" />
      </FormField>
      <FormField label="Mother's Name" error={errors.motherName?.message}>
        <Input {...register('motherName')} placeholder="Mother's name" />
      </FormField>
    </div>
  );
}

function AddressStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const { register, formState: { errors }, setValue, watch } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Street" required error={errors.street?.message}>
        <Input {...register('street')} placeholder="NIB NIB NIB" />
      </FormField>
      <FormField label="Town / City" required error={errors.townCity?.message}>
        <Input {...register('townCity')} placeholder="Addis Ababa" />
      </FormField>
      <FormField label="Country" required error={errors.country?.message} hint="2-letter ISO code">
        <Input {...register('country')} placeholder="ET" maxLength={2} className="uppercase" />
      </FormField>
      <FormField label="Region" required error={errors.region?.message}>
        <Input {...register('region')} placeholder="ET00" />
      </FormField>
      <FormField label="Sub-city" error={errors.subcity?.message}>
        <Input {...register('subcity')} placeholder="LIDAET" />
      </FormField>
      <FormField label="Woreda" error={errors.woreda?.message}>
        <Input {...register('woreda')} placeholder="NNN" />
      </FormField>
      <FormField label="Kebele" error={errors.kebele?.message}>
        <Input {...register('kebele')} placeholder="NNN" />
      </FormField>
      <FormField label="House No." error={errors.houseNo?.message}>
        <Input {...register('houseNo')} placeholder="121212" />
      </FormField>
      <FormField label="Flat No." error={errors.flatNo?.message}>
        <Input {...register('flatNo')} placeholder="12121" />
      </FormField>
      <FormField label="Residence" required error={errors.residence?.message} hint="2-letter country code">
        <Input {...register('residence')} placeholder="ET" maxLength={2} className="uppercase" />
      </FormField>
    </div>
  );
}

function IdentificationStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Legal ID Number" required error={errors.legalIdNumber?.message}>
        <Input {...register('legalIdNumber')} placeholder="121212" />
      </FormField>
      <FormField label="Document Name" required error={errors.documentName?.message} hint="e.g. EIC, Passport, Kebele ID">
        <Input {...register('documentName')} placeholder="EIC" />
      </FormField>
      <FormField label="Name on ID" required error={errors.nameOnID?.message}>
        <Input {...register('nameOnID')} placeholder="12459636" />
      </FormField>
      <FormField label="Issue Authority" required error={errors.issueAuthority?.message}>
        <Input {...register('issueAuthority')} placeholder="MIBBANL" />
      </FormField>
      <FormField label="Issue Date" required error={errors.issueDate?.message} hint="Format: DD MMM YYYY (e.g. 01 OCT 2024)">
        <Input {...register('issueDate')} placeholder="01 OCT 2024" />
      </FormField>
      <FormField label="Expiration Date" required error={errors.expirationDate?.message} hint="Format: DD MMM YYYY">
        <Input {...register('expirationDate')} placeholder="23 OCT 2025" />
      </FormField>
    </div>
  );
}

function ContactBankingStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const { register, formState: { errors }, setValue, watch } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Residential Phone" error={errors.phoneNumbersRes?.message}>
        <Input {...register('phoneNumbersRes')} placeholder="+251953241316" type="tel" />
      </FormField>
      <FormField label="Mobile Phone" error={errors.mobilePhoneNumbers?.message}>
        <Input {...register('mobilePhoneNumbers')} placeholder="+251953241316" type="tel" />
      </FormField>
      <FormField label="Language" required error={errors.language?.message} hint="Language code (e.g. 1 = Amharic)">
        <Input {...register('language')} placeholder="1" />
      </FormField>
      <FormField label="Sector" required error={errors.sector?.message}>
        <Input {...register('sector')} placeholder="1000" />
      </FormField>
      <FormField label="Account Officer" required error={errors.accountOfficer?.message}>
        <Input {...register('accountOfficer')} placeholder="6001" />
      </FormField>
      <FormField label="Industry" required error={errors.industry?.message}>
        <Input {...register('industry')} placeholder="1001" />
      </FormField>
      <FormField label="Target" required error={errors.target?.message}>
        <Input {...register('target')} placeholder="2" />
      </FormField>
      <FormField label="Customer Status" required error={errors.customerStatus?.message}>
        <Input {...register('customerStatus')} placeholder="2" />
      </FormField>
      <FormField label="Customer Type" required error={errors.customerType?.message} hint="e.g. A = Individual">
        <Input {...register('customerType')} placeholder="A" />
      </FormField>
      <FormField label="Ownership" required error={errors.ownership?.message}>
        <Input {...register('ownership')} placeholder="1000" />
      </FormField>
      <FormField label="Secure Message" error={errors.secureMessage?.message}>
        <Select value={watch('secureMessage') || ''} onValueChange={(v) => setValue('secureMessage', v as 'Y' | 'N', { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Y">Y – Yes</SelectItem>
            <SelectItem value="N">N – No</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </div>
  );
}

function EmploymentStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <FormField label="Occupation" error={errors.occupation?.message}>
        <Input {...register('occupation')} placeholder="BANK" />
      </FormField>
      <FormField label="Employer's Name" error={errors.employersName?.message}>
        <Input {...register('employersName')} placeholder="NIB" />
      </FormField>
      <FormField label="Net Monthly Income (ETB)" error={errors.netMonthlyIn?.message}>
        <Input {...register('netMonthlyIn')} placeholder="40000" type="number" min="0" />
      </FormField>
    </div>
  );
}

function ReviewStep({ form }: { form: ReturnType<typeof useForm<CustomerOnboardingInput>> }) {
  const data = form.getValues();
  const sections: { title: string; fields: { label: string; value?: string | null }[] }[] = [
    {
      title: 'Personal Information',
      fields: [
        { label: 'Mnemonic',       value: data.mnemonic },
        { label: 'Title',          value: data.title },
        { label: 'Given Name',     value: data.givenName },
        { label: 'Family Name',    value: data.familyName },
        { label: 'Gender',         value: data.gender },
        { label: 'Date of Birth',  value: data.dateOfBirth },
        { label: 'Marital Status', value: data.maritalStatus },
        { label: 'Nationality',    value: data.nationality },
        { label: 'PSU Token',      value: data.psuToken || data.legalIdNumber || data.nationalIDNumber },
      ],
    },
    {
      title: 'Address',
      fields: [
        { label: 'Street',    value: data.street },
        { label: 'Town/City', value: data.townCity },
        { label: 'Country',   value: data.country },
        { label: 'Region',    value: data.region },
        { label: 'Sub-city',  value: data.subcity },
        { label: 'Woreda',    value: data.woreda },
      ],
    },
    {
      title: 'Identification',
      fields: [
        { label: 'Document',      value: data.documentName },
        { label: 'Issue Date',    value: data.issueDate },
        { label: 'Expiry Date',   value: data.expirationDate },
        { label: 'Authority',     value: data.issueAuthority },
      ],
    },
    {
      title: 'Contact & Banking',
      fields: [
        { label: 'Mobile',      value: data.mobilePhoneNumbers },
        { label: 'Phone (Res)', value: data.phoneNumbersRes },
        { label: 'Sector',      value: data.sector },
        { label: 'Industry',    value: data.industry },
        { label: 'Cust. Type',  value: data.customerType },
        { label: 'Ownership',   value: data.ownership },
      ],
    },
    {
      title: 'Employment',
      fields: [
        { label: 'Occupation',     value: data.occupation },
        { label: 'Employer',       value: data.employersName },
        { label: 'Monthly Income', value: data.netMonthlyIn ? `ETB ${data.netMonthlyIn}` : undefined },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Please review all details carefully before submitting. Once submitted, the record will be placed in a
          <strong> PENDING</strong> state and must be approved by an authorised reviewer before being forwarded to core banking.
        </p>
      </div>
      <div className="grid gap-5">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold text-primary mb-3">{section.title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {section.fields.map((field) => (
                field.value ? (
                  <div key={field.label} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{field.label}</p>
                    <p className="text-sm font-medium break-all">{field.value}</p>
                  </div>
                ) : null
              ))}
            </div>
            <Separator className="mt-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────
export function CustomerOnboardingForm() {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const form = useForm<CustomerOnboardingInput>({
    resolver: zodResolver(CustomerOnboardingSchema),
    mode: 'onChange',
    defaultValues: {
      country: 'ET', nationality: 'ET', residence: 'ET',
      language: '1', region: 'ET00', secureMessage: 'Y',
      gender: 'MALE', maritalStatus: 'MARRIED', customerType: 'A',
      ownership: '1000',
    },
  });

  const { handleSubmit, trigger, formState: { errors } } = form;

  // Fields that belong to each step for targeted validation
  const STEP_FIELDS: (keyof CustomerOnboardingInput)[][] = [
    ['mnemonic','title','givenName','familyName','shortName','fullName1','gender','dateOfBirth','maritalStatus','nationality','nationalIDNumber'],
    ['street','townCity','country','region','residence'],
    ['legalIdNumber','documentName','nameOnID','issueAuthority','issueDate','expirationDate'],
    ['language','sector','accountOfficer','industry','target','customerStatus','customerType', 'ownership'],
    [],
    [],
  ];

  async function handleNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function onSubmit(data: CustomerOnboardingInput) {
    setSubmitting(true);
    try {
      const result = await submitCustomerOnboarding(data);
      if (result.success) {
        setSubmitted(true);
        setSubmittedId(result.id ?? null);
        toast.success('Customer onboarding submitted!', {
          description: 'Your submission is now pending review.',
        });
      } else {
        toast.error(result.error || 'Submission failed');
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, msgs]) => {
            form.setError(field as keyof CustomerOnboardingInput, {
              type: 'server',
              message: (msgs as string[])[0],
            });
          });
        }
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center gap-6"
      >
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Submission Successful</h2>
          <p className="text-muted-foreground max-w-md">
            The customer onboarding record has been saved and is now <Badge variant="secondary">PENDING</Badge> review
            by an authorised committee member. You will be notified upon approval.
          </p>
          {submittedId && (
            <p className="text-xs text-muted-foreground mt-2">Reference ID: <code className="font-mono bg-muted px-1 rounded">{submittedId}</code></p>
          )}
        </div>
        <Button variant="outline" onClick={() => { setSubmitted(false); form.reset(); setStep(0); }}>
          Submit Another
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone   = i < step;
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all',
                  isActive && 'bg-primary text-primary-foreground shadow-sm',
                  isDone   && 'bg-primary/10 text-primary cursor-pointer hover:bg-primary/20',
                  !isActive && !isDone && 'text-muted-foreground cursor-default',
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {s.label}
                {isDone && <CheckCircle2 className="h-3 w-3" />}
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current step card */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            {React.createElement(STEPS[step].icon, { className: 'h-4 w-4 text-primary' })}
            {STEPS[step].label}
          </CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <PersonalInfoStep form={form} />}
              {step === 1 && <AddressStep form={form} />}
              {step === 2 && <IdentificationStep form={form} />}
              {step === 3 && <ContactBankingStep form={form} />}
              {step === 4 && <EmploymentStep form={form} />}
              {step === 5 && <ReviewStep form={form} />}
            </motion.div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-5 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>

              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={submitting} className="min-w-[140px]">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Review
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <p className="text-xs text-destructive text-center">
          {Object.keys(errors).length} field(s) need attention. Please check the highlighted steps.
        </p>
      )}
    </div>
  );
}
