
import AdminEmailPageClient from './email-client';
import { getEmailSettings } from '@/app/actions/memo';

export default async function AdminEmailPage() {
    const initialSettings = await getEmailSettings();
    return <AdminEmailPageClient initialSettings={initialSettings} />;
}
