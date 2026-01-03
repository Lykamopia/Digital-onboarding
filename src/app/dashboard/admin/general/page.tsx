
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getGeneralSettings, saveGeneralSettings } from "@/app/actions/memo";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";
import type { AcknowledgementType } from "@/lib/types";

function GeneralSettingsSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

export default function GeneralSettingsPage() {
  const [settings, setSettings] = useState({ acknowledgementType: 'SIGNATURE' as AcknowledgementType });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const data = await getGeneralSettings();
      setSettings(data);
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveGeneralSettings(settings);
    if(result.success) {
      toast.success("Settings Saved", { description: "General settings have been updated." });
    } else {
      toast.error("Error", { description: "Could not save settings." });
    }
    setIsSaving(false);
  };

  const handleAcknowledgementChange = (checked: boolean) => {
    setSettings(prev => ({ ...prev, acknowledgementType: checked ? 'SIGNATURE' : 'BADGE' }));
  }

  if (loading) {
    return <GeneralSettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Application Settings</CardTitle>
          <CardDescription>
            Manage global settings that affect all users.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                checked={settings.acknowledgementType === 'SIGNATURE'}
                onCheckedChange={handleAcknowledgementChange}
            />
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
