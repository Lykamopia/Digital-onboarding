
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";
import type { AcknowledgementType } from "@/lib/types";
import { useSettings } from "@/components/settings-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

function GeneralSettingsSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function GeneralSettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        acknowledgementType: settings.acknowledgementType || 'SIGNATURE',
        acknowledgementMode: settings.acknowledgementMode || 'manual',
        referenceFormat: settings.referenceFormat || {
          separator: '-',
          numberLength: 4
        },
        enableCriticalAlerts: settings.enableCriticalAlerts ?? true,
        showOnboardingTour: settings.showOnboardingTour ?? true,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
        await updateSettings(localSettings);
        toast.success("Settings Saved", { description: "General settings have been updated." });
    } catch {
        toast.error("Error", { description: "Could not save settings." });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAcknowledgementTypeChange = (checked: boolean) => {
    setLocalSettings(prev => ({ ...prev, acknowledgementType: checked ? 'SIGNATURE' : 'BADGE' }));
  }

  const handleAcknowledgementModeChange = (checked: boolean) => {
    setLocalSettings(prev => ({ ...prev, acknowledgementMode: checked ? 'manual' : 'auto' }));
  }

  const handleCriticalAlertsChange = (checked: boolean) => {
    setLocalSettings(prev => ({ ...prev, enableCriticalAlerts: checked }));
  }

  const handleOnboardingTourChange = (checked: boolean) => {
    setLocalSettings(prev => ({ ...prev, showOnboardingTour: checked }));
  }

  const handleReferenceFormatChange = (field: string, value: string | number) => {
    setLocalSettings(prev => ({
        ...prev,
        referenceFormat: {
            ...(prev.referenceFormat || { separator: '-', numberLength: 4 }), // Default structure
            [field]: value
        }
    }));
  };

  if (loading || !localSettings) {
    return <GeneralSettingsSkeleton />;
  }
  
  const exampleSeparator = localSettings.referenceFormat.separator || '-';
  const year = new Date().getFullYear();
  const sequence = '1'.padStart(localSettings.referenceFormat.numberLength || 4, '0');

  const divPath = ['OFFICE', 'DEPT', 'DIV'].join(exampleSeparator);
  const branchPath = ['OFFICE', 'DIST', 'BRANCH'].join(exampleSeparator);
  
  const exampleRefDiv = `${divPath}${exampleSeparator}${year}${exampleSeparator}${sequence}`;
  const exampleRefBranch = `${branchPath}${exampleSeparator}${year}${exampleSeparator}${sequence}`;


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Acknowledgement Settings</CardTitle>
          <CardDescription>
            Configure how users acknowledge receipt of memos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <Label htmlFor="ack-type" className="text-base">
                Enable Digital Signatures
                </Label>
                <p className="text-sm text-muted-foreground">
                When enabled, users' uploaded signatures will be used for acknowledgements. Otherwise, a standard badge will be used.
                </p>
            </div>
            <Switch
                id="ack-type"
                checked={localSettings.acknowledgementType === 'SIGNATURE'}
                onCheckedChange={handleAcknowledgementTypeChange}
            />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
                <Label htmlFor="ack-mode" className="text-base">
                Require Manual Acknowledgment
                </Label>
                <p className="text-sm text-muted-foreground">
                If enabled, users must click 'Acknowledge'. If disabled, memos are acknowledged automatically when read.
                </p>
            </div>
            <Switch
                id="ack-mode"
                checked={localSettings.acknowledgementMode === 'manual'}
                onCheckedChange={handleAcknowledgementModeChange}
            />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>
            Configure security-related features and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="critical-alerts" className="text-base">
                        Enable Critical Security Alerts
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        When enabled, an email will be sent to the administrator for critical events like account lockouts.
                    </p>
                </div>
                <Switch
                    id="critical-alerts"
                    checked={localSettings.enableCriticalAlerts}
                    onCheckedChange={handleCriticalAlertsChange}
                />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onboarding Settings</CardTitle>
          <CardDescription>
            Manage the initial user experience.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="onboarding-tour" className="text-base">
                        Show Onboarding Tour
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        Enable or disable the guided tour for new users upon their first login.
                    </p>
                </div>
                <Switch
                    id="onboarding-tour"
                    checked={localSettings.showOnboardingTour}
                    onCheckedChange={handleOnboardingTourChange}
                />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Memo Reference Number</CardTitle>
          <CardDescription>
              Configure the format for automatically generated memo reference numbers. The prefix always starts with the user's Office code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="ref-separator" className="text-base">
                        Separator Character
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        The character used to separate parts of the reference number.
                    </p>
                </div>
                <Select
                    value={localSettings.referenceFormat.separator || '-'}
                    onValueChange={(value) => handleReferenceFormatChange('separator', value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a separator" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="-">- (Hyphen)</SelectItem>
                        <SelectItem value="/">/ (Slash)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="ref-length" className="text-base">
                        Sequence Number Length
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        The length of the auto-incrementing number (e.g., 4 means 0001).
                    </p>
                </div>
                <Input
                    id="ref-length"
                    type="number"
                    min="2"
                    max="8"
                    value={localSettings.referenceFormat.numberLength || 4}
                    onChange={(e) => handleReferenceFormatChange('numberLength', parseInt(e.target.value, 10) || 4)}
                    className="w-[180px]"
                />
            </div>
             <div className="text-center p-4 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground mb-2">Example Previews</p>
                <div className="font-mono text-base md:text-lg font-bold space-y-1">
                    <p>{exampleRefDiv}</p>
                    <p>{exampleRefBranch}</p>
                </div>
            </div>
        </CardContent>
      </Card>
      <div className="flex justify-end mt-4">
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All General Settings
        </Button>
      </div>
    </div>
  );
}

    
