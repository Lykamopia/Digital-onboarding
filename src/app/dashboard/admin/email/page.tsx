
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
import Image from "next/image";

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

  const processTextForPreview = (text: string) => {
    const memoUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/inbox?id=...`;
    
    const notificationType = `You have received a new memo from <strong>Sender Name</strong>.`;

    return text
        .replace(/{{notificationType}}/g, notificationType)
        .replace(/{{senderName}}/g, 'Sender Name')
        .replace(/{{subject}}/g, 'Sample Memo Subject')
        .replace(/{{reference}}/g, 'MEMO-2024-XXX')
        .replace(/{{memoUrl}}/g, memoUrl)
        .replace(/\n/g, '<br>');
  }

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
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
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
                Use placeholders like `{"{{notificationType}}"}`, `{"{{senderName}}"}`, `{"{{subject}}"}`, `{"{{reference}}"}`, and `{"{{memoUrl}}"}`.
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
        </div>

        <div>
            <Label className="text-base font-semibold">Live Preview</Label>
            <div className="mt-2 rounded-lg border bg-muted/30 p-4">
                <div className="mx-auto max-w-xl rounded-md border bg-card shadow-lg">
                    {/* Email Header */}
                    <div className="bg-primary p-4 text-center rounded-t-md">
                        <Image src="/Wide - LOGO.png" alt="Logo" width={120} height={40} className="mx-auto" />
                    </div>
                    {/* Email Body */}
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-4">{settings.headerText}</h2>
                        
                        <div className="prose prose-sm max-w-none dark:prose-invert"
                            dangerouslySetInnerHTML={{ __html: processTextForPreview(settings.bodyText) }}
                        />

                        <div className="my-6 rounded-md border-l-4 border-accent bg-muted/50 p-4 text-sm">
                            <p><strong>From:</strong> Sender Name</p>
                            <p><strong>Subject:</strong> Sample Memo Subject</p>
                            <p><strong>Reference:</strong> MEMO-2024-XXX</p>
                        </div>
                        
                        <div className="text-center">
                            <Button size="sm" disabled={!settings.notificationsEnabled}>View Full Memo</Button>
                        </div>
                    </div>
                    {/* Email Footer */}
                    <div className="bg-muted p-4 text-center text-xs text-muted-foreground rounded-b-md">
                        <p>{settings.footerText}</p>
                    </div>
                </div>
            </div>
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
