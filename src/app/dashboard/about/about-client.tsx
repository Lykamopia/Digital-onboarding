
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Logo from "@/components/logo";
import { AnimatedContent } from "@/components/animated-content";

export default function AboutClientPage({ appVersion }: { appVersion: string }) {
    return (
        <AnimatedContent>
            <div className="max-w-2xl mx-auto">
                <Card>
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4">
                            <Logo layout="vertical" />
                        </div>
                        <CardTitle>About Nib Memo</CardTitle>
                        <CardDescription>Version {appVersion}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground space-y-4">
                        <p>
                            The Memo Management System is a self-contained, secure web application designed to replace traditional paper-based or email-based internal communication systems within an organization.
                        </p>
                        <p>
                            It provides a centralized platform for creating, sending, tracking, and archiving official memorandums, ensuring data integrity, security, and a clear audit trail for all communications.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </AnimatedContent>
    );
}
