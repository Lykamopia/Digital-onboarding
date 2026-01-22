
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
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function GeneralSettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Ensure local settings has a default for referenceFormat if it's missing
    if (settings) {
      setLocalSettings({
        acknowledgementType: settings.acknowledgementType || 'SIGNATURE',
        acknowledgementMode: settings.acknowledgementMode || 'manual',
        referenceFormat: settings.referenceFormat || {
          prefix: 'department',
          separator: '-',
          numberLength: 4
        }
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

  const handleReferenceFormatChange = (field: string, value: string | number) => {
    setLocalSettings(prev => ({
        ...prev,
        referenceFormat: {
            ...(prev.referenceFormat || { prefix: 'department', separator: '-', numberLength: 4 }), // Default structure
            [field]: value
        }
    }));
  };

  if (loading || !localSettings.referenceFormat) {
    return <GeneralSettingsSkeleton />;
  }
  
  const examplePrefix = localSettings.referenceFormat.prefix === 'department' ? 'DEPT' : 'OFFICE';
  const exampleSeparator = localSettings.referenceFormat.separator || '-';
  const exampleYear = new Date().getFullYear();
  const exampleSequence = '1'.padStart(localSettings.referenceFormat.numberLength || 4, '0');
  const exampleReference = `${examplePrefix}${exampleSeparator}${exampleYear}${exampleSeparator}${exampleSequence}`;


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
          <CardTitle>Memo Reference Number</CardTitle>
          <CardDescription>
              Configure the format for automatically generated memo reference numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                    <Label htmlFor="ref-prefix" className="text-base">
                        Prefix Source
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        Choose what code to use as the prefix for the reference number.
                    </p>
                </div>
                <Select
                    value={localSettings.referenceFormat.prefix || 'department'}
                    onValueChange={(value) => handleReferenceFormatChange('prefix', value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a prefix" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="department">Department Code</SelectItem>
                        <SelectItem value="office">Office Code</SelectItem>
                    </SelectContent>
                </Select>
            </div>

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
                <p className="text-sm text-muted-foreground">Example Preview</p>
                <p className="font-mono text-lg font-bold">
                    {exampleReference}
                </p>
            </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
