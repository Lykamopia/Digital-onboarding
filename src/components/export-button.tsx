'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { listCustomerOnboardings } from '@/app/actions/customer-onboarding';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface ExportButtonProps {
  status?: any;
  region?: string;
  fromDate?: string;
  toDate?: string;
  variant?: 'outline' | 'default' | 'secondary' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function ExportButton({ status, region, fromDate, toDate, variant = 'outline', size = 'sm', className }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Fetch all records for export (or a large enough number)
      const result = await listCustomerOnboardings({
        status,
        region,
        fromDate,
        toDate,
        pageSize: 1000, // Reasonable limit for detailed export
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      if (result.records.length === 0) {
        toast.info("No records to export.");
        return;
      }

      // Prepare data for CSV - Include more detailed fields
      const csvData = result.records.map((r: any) => ({
        'Onboarding ID': r.id,
        'Mnemonic': r.mnemonic,
        'Current Status': r.approvalStatus,
        'Full Name': `${r.givenName || ''} ${r.familyName || ''}`.trim() || r.fullName1,
        'Short Name': r.shortName,
        'Title': r.title,
        'Gender': r.gender,
        'Date of Birth': r.dateOfBirth,
        'Nationality': r.nationality,
        'Legal ID Number': r.legalIdNumber,
        'National ID Number': r.nationalIDNumber,
        'PSU Token (Fayda)': r.psuToken,
        'Mobile Phone': r.mobilePhoneNumbers || '',
        'Residence Phone': r.phoneNumbersRes || '',
        'Submitted By': r.submittedBy?.name || r.submittedBy?.email || 'System',
        'Verifier': r.verifierReviewedBy?.name || 'N/A',
        'Approver': r.approverReviewedBy?.name || 'N/A',
        'Created Date': new Date(r.createdAt).toLocaleString(),
        'Last Updated': new Date(r.updatedAt).toLocaleString(),
        'Core Sync Date': r.forwardedAt ? new Date(r.forwardedAt).toLocaleString() : 'Not Synced',
        'Sync Error Details': r.forwardError || 'None',
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `nib-onboarding-detailed-export-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Export completed", {
        description: `Successfully exported ${result.records.length} records.`
      });
    } catch (error: any) {
      console.error("Export failed:", error);
      toast.error("Export failed", {
        description: error.message || "An error occurred during data export."
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button 
      variant={variant} 
      size={size} 
      className={className} 
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      Detailed Export
    </Button>
  );
}
