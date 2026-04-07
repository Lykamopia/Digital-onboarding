import { Metadata } from 'next';
import KPIDashboardClient from './kpi-dashboard-client';
import { getKPIData, getKPIMetadata } from '@/app/actions/kpi';
import { DashboardContentWrapper } from '../dashboard-content-wrapper';

export const metadata: Metadata = {
  title: 'KPI Dashboard | Customer Onboarding',
  description: 'Comprehensive KPI dashboard for customer onboarding metrics.',
};

export default async function KPIDashboardPage() {
  const [result, metadataResult] = await Promise.all([
    getKPIData({ dateRange: 'month' }),
    getKPIMetadata()
  ]);
  
  const initialData = result.success ? result.data : null;
  const metadata = metadataResult.success ? metadataResult.data : null;
  const error = !result.success ? result.error : (metadataResult.success ? null : metadataResult.error);

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">KPI Dashboard</h2>
      </div>
      <KPIDashboardClient 
        initialData={initialData} 
        initialError={error} 
        metadata={metadata}
      />
    </div>
  );
}
