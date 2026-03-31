
'use server'

import prisma from '@/lib/prisma';
import type { Prisma } from '@/lib/types';

// Define the types locally as they are simple and specific to settings
type AcknowledgementType = 'BADGE' | 'SIGNATURE';

type ReferenceFormatSettings = {
    separator: '-' | '/';
    numberLength: number;
};

type GeneralSettings = {
  acknowledgementType: AcknowledgementType;
  referenceFormat: ReferenceFormatSettings;
  acknowledgementMode: 'auto' | 'manual';
  enableCriticalAlerts: boolean;
  showOnboardingTour: boolean;
};

type EmailSettings = {
    notificationsEnabled: boolean;
    headerText: string;
    bodyText: string;
    footerText: string;
};

const defaultGeneralSettings: GeneralSettings = {
    acknowledgementType: 'SIGNATURE',
    acknowledgementMode: 'manual',
    referenceFormat: {
      separator: '-',
      numberLength: 4
    },
    enableCriticalAlerts: true,
    showOnboardingTour: false,
};

const defaultEmailSettings: EmailSettings = {
    notificationsEnabled: true,
    headerText: "NibTera Onboarding Notification",
    bodyText: "Hello,\n\nYou have received a new memo titled '{{subject}}' from {{senderName}}. Please log in to view it.",
    footerText: "This is an automated message. Please do not reply."
};

export async function getGeneralSettings(): Promise<GeneralSettings> {
    try {
        const setting = await prisma.setting.findUnique({ where: { key: 'general' } });
        if (setting && typeof setting.value === 'object' && setting.value !== null) {
            // Merge defaults with saved settings to ensure all keys are present
            const dbSettings = setting.value as Partial<GeneralSettings>;
            return {
                acknowledgementType: dbSettings.acknowledgementType || defaultGeneralSettings.acknowledgementType,
                acknowledgementMode: dbSettings.acknowledgementMode || defaultGeneralSettings.acknowledgementMode,
                referenceFormat: {
                    separator: dbSettings.referenceFormat?.separator || defaultGeneralSettings.referenceFormat.separator,
                    numberLength: dbSettings.referenceFormat?.numberLength || defaultGeneralSettings.referenceFormat.numberLength
                },
                enableCriticalAlerts: dbSettings.enableCriticalAlerts ?? defaultGeneralSettings.enableCriticalAlerts,
                showOnboardingTour: dbSettings.showOnboardingTour ?? defaultGeneralSettings.showOnboardingTour,
            };
        }
    } catch (error) {
        console.error("Failed to fetch general settings, returning defaults:", error);
    }
    return defaultGeneralSettings;
}

export async function getEmailSettings(): Promise<EmailSettings> {
    try {
        const setting = await prisma.setting.findUnique({ where: { key: 'email' } });
        if (setting && typeof setting.value === 'object' && setting.value !== null) {
            return { ...defaultEmailSettings, ...(setting.value as Partial<EmailSettings>) };
        }
    } catch (error) {
        console.error("Failed to fetch email settings, returning defaults:", error);
    }
    return defaultEmailSettings;
}

export async function saveGeneralSettings(settings: GeneralSettings): Promise<void> {
    try {
        await prisma.setting.upsert({
            where: { key: 'general' },
            update: { value: settings as any },
            create: { key: 'general', value: settings as any }
        });
    } catch (error) {
        console.error("Failed to save general settings:", error);
        throw new Error("Failed to save settings.");
    }
}
