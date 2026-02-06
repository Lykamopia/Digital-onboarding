
import prisma from '@/lib/prisma';
import type { AcknowledgementType } from '@/lib/types';

export async function getEmailSettings() {
    const settings = await prisma.setting.findUnique({ where: { key: 'email' } });
    const defaultSettings = { 
        notificationsEnabled: true, 
        headerText: 'New Memo Notification', 
        bodyText: 'Hello,\n\n{{notificationType}}\n\nPlease find the details of the memo below.',
        footerText: 'This is an automated message. Please do not reply.' 
    };
    return settings ? { ...defaultSettings, ...(settings.value as any) } : defaultSettings;
}

const defaultGeneralSettings = { 
    acknowledgementType: 'SIGNATURE' as AcknowledgementType,
    referenceFormat: {
        separator: '-' as '-' | '/',
        numberLength: 4,
    },
    acknowledgementMode: 'manual' as 'auto' | 'manual',
};

export async function getGeneralSettings() {
    const settings = await prisma.setting.findUnique({ where: { key: 'general' } });
    if (settings) {
        const dbSettings = settings.value as any;
        const mergedSettings = { ...defaultGeneralSettings, ...dbSettings };
        mergedSettings.referenceFormat = { ...defaultGeneralSettings.referenceFormat, ...dbSettings.referenceFormat };
        return mergedSettings;
    }
    return defaultGeneralSettings;
}
