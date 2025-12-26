
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getEmailSettings, saveEmailSettings } from "@/app/actions/memo";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";

function EmailSettingsSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-96 w-full" />
        </div>
    );
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState({ notificationsEnabled: true, headerText: '', bodyText: '', footerText: '' });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true);
      const data = await getEmailSettings();
      setSettings(data);
      setLoading(false);
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveEmailSettings(settings);
    if (result.success) {
      toast({ title: "Settings Saved", description: "Email settings have been updated." });
    } else {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  if (loading) {
    return <EmailSettingsSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Notification Settings</CardTitle>
        <CardDescription>
          Manage email notifications and customize their content and appearance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled" className="text-base">
              Email Notifications
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable or disable all outgoing email notifications for new memos.
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={settings.notificationsEnabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificationsEnabled: checked }))}
          />
        </div>
        
        <div className="space-y-2">
            <Label htmlFor="header-text">Email Header Text</Label>
            <Input 
                id="header-text"
                value={settings.headerText}
                onChange={(e) => setSettings(prev => ({ ...prev, headerText: e.target.value }))}
                placeholder="e.g., New Memo Notification"
                disabled={!settings.notificationsEnabled}
            />
        </div>
        
        <div className="space-y-2">
            <Label htmlFor="body-text">Email Body Template</Label>
            <Textarea
                id="body-text"
                value={settings.bodyText}
                onChange={(e) => setSettings(prev => ({ ...prev, bodyText: e.target.value }))}
                placeholder="e.g., Hello, {{notificationType}}"
                rows={5}
                disabled={!settings.notificationsEnabled}
            />
             <p className="text-xs text-muted-foreground">
              Use placeholders like `{{'{'}}{{'{'}}notificationType{{'}'}}{{'}'}}`, `{{'{'}}{{'{'}}senderName{{'}'}}{{'}'}}`, `{{'{'}}{{'{'}}subject{{'}'}}{{'}'}}`, `{{'{'}}{{'{'}}reference{{'}'}}{{'}'}}`, and `{{'{'}}{{'{'}}memoUrl{{'}'}}{{'}'}}`.
            </p>
        </div>


        <div className="space-y-2">
            <Label htmlFor="footer-text">Email Footer Text</Label>
            <Textarea
                id="footer-text"
                value={settings.footerText}
                onChange={(e) => setSettings(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="e.g., This is an automated message. Please do not reply."
                rows={3}
                disabled={!settings.notificationsEnabled}
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
  );
}
