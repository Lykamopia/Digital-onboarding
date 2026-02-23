'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getLoggedInUser, updateUserProfile, getUsers } from '@/app/actions/memo';
import type { User, Office, Department, Division, District, Branch, Delegation, LoggedInUser } from '@/lib/types';
import { Camera, Briefcase, Building, Globe, Loader2, Image as ImageIcon, Edit, UploadCloud, Users, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/signature-pad';
import { SignaturePreview } from '@/components/signature-preview';
import { UserProfileLoader } from '@/components/user-profile-loader';
import { DelegationSettings } from '@/components/delegation-settings';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type UserWithRelations = LoggedInUser & {
    office: Office;
    department?: Department;
    division?: Division;
    district?: District;
    branch?: Branch;
    delegations?: Delegation[];
    delegatedTo?: Delegation[];
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const getImageUrl = (path: string | null | undefined): string => {
    if (!path) return '';
    const trimmed = path.trim();
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http')) {
        return trimmed;
    }
    // All internal assets should be absolute paths from the root
    if (trimmed.startsWith('/')) {
        return trimmed;
    }
    // If the DB stored a relative path like "uploads/..", convert to absolute root path
    return `/${trimmed}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserWithRelations | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingSignature, setPendingSignature] = useState<File | null>(null);
  const [signatureCleared, setSignatureCleared] = useState(false);
  
  const [signatureModified, setSignatureModified] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureUploadInputRef = useRef<HTMLInputElement>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);

  const isChanged = 
    name !== (user?.name || '') || 
    email !== (user?.email || '') || 
    pendingAvatar !== null ||
    signatureModified;

  const loadUserAndData = useCallback(async () => {
    const initialUser = await getLoggedInUser();
    
    if (initialUser?.actingUser) {
        router.replace('/dashboard/access-denied');
        return;
    }
    
    const users = await getUsers();
    
    setUser(initialUser as any);
    setAllUsers(users);

    if (initialUser) {
        setName(initialUser.name);
        setEmail(initialUser.email);
        setAvatarPreview(null);
        setSignaturePreview(null);
        setPendingAvatar(null);
        setPendingSignature(null);
        setSignatureCleared(false);
        setSignatureModified(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserAndData();
  }, [loadUserAndData]);

  const uploadFile = async (file: File, type: 'profile' | 'signatures'): Promise<string> => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        throw new Error((await response.json()).error || `${type} upload failed`);
      }
      const result = await response.json();
      return result.path;
    } catch (error: any) {
       toast.error('Upload Failed', { description: error.message });
       throw error; // Re-throw to be caught by handleSave
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const oldAvatar = user.avatar;
      const oldSignature = user.signature;

      let finalAvatarUrl = oldAvatar || '';
      let finalSignatureUrl = oldSignature || '';

      if (pendingAvatar) {
        finalAvatarUrl = await uploadFile(pendingAvatar, 'profile');
      }

      if (signatureCleared) {
        finalSignatureUrl = '';
      } else if (pendingSignature) {
        finalSignatureUrl = await uploadFile(pendingSignature, 'signatures');
      }

      const result = await updateUserProfile(user.id, {
        name,
        email,
        avatar: finalAvatarUrl,
        signature: finalSignatureUrl,
      });

      if (result.success) {
        toast.success(result.message ? "Request Submitted" : 'Profile Updated', {
          description: result.message || 'Your profile has been successfully updated.',
        });

        // Only delete files and reload data if it wasn't an email change request
        if (!result.message) {
            if (pendingAvatar && oldAvatar) {
                await fetch('/api/upload', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: oldAvatar }),
                });
            }
            if ((signatureCleared || pendingSignature) && oldSignature) {
                await fetch('/api/upload', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: oldSignature }),
                });
            }
            await loadUserAndData(); // Reload all data
            // Notify other parts of the app
            const fresh = await getLoggedInUser();
            if (fresh) {
                const detail: any = { ...fresh };
                if (detail.avatar) detail.avatar = `${detail.avatar.split('?')[0]}?t=${Date.now()}`;
                if (detail.signature) detail.signature = `${detail.signature.split('?')[0]}?t=${Date.now()}`;
                window.dispatchEvent(new CustomEvent('profile-updated', { detail }));
            }
        }
      } else {
        toast.error('Update Failed', {
          description: result.error || 'Could not update your profile.',
        });
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
        toast.error('File too large', { description: 'Profile picture must be less than 5MB.' });
        return;
    }

    setPendingAvatar(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setIsSignatureDialogOpen(false);
    setSignatureModified(true);

    if (!dataUrl) { // Handle clearing
      setSignatureCleared(true);
      setPendingSignature(null);
      setSignaturePreview(null);
      toast.info("Signature Cleared", { description: "Click 'Save All Changes' to apply." });
      return;
    }
    
    setSignaturePreview(dataUrl);
    setSignatureCleared(false);
    
    // Convert data URL to File
    const parts = dataUrl.split(',');
    if (parts.length < 2) {
      toast.error('Invalid signature data');
      return;
    }

    try {
        const byteString = atob(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const file = new File([blob], 'signature.webp', { type: 'image/webp' });
        setPendingSignature(file);
        toast.info("Signature Updated", { description: "Click 'Save All Changes' to apply." });
    } catch (e) {
      console.error("Error converting signature dataURL to blob:", e);
      toast.error("Could not process signature", { description: "There was an error converting the drawn signature. Please try again." });
    }
  };

  const handleSignatureUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid File Type', { description: 'Please upload a PNG, JPG, or WEBP file.' });
        return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
        toast.error('File too large', { description: 'Signature image must be less than 5MB.' });
        return;
    }
    
    setSignatureModified(true);
    setSignatureCleared(false);
    setPendingSignature(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setSignaturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    toast.info("Signature Image Selected", { description: "Click 'Save All Changes' to apply." });
  };
  
  const handleSignatureDialogOpenChange = (open: boolean) => {
    setIsSignatureDialogOpen(open);
    window.dispatchEvent(new CustomEvent('onboarding-dialog-state', { detail: { open } }));
  };

  if (!user) {
    return (
        <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
            <UserProfileLoader />
        </div>
    );
  }
  
  const getUserOrgPath = () => {
    if (!user) return [];
    const path = [];
    if(user.office) path.push({ label: 'Office', name: user.office.name, icon: <Briefcase/> });
    if(user.department) path.push({ label: 'Department', name: user.department.name, icon: <Building/> });
    if(user.district) path.push({ label: 'District', name: user.district.name, icon: <Building/> });
    if(user.division) path.push({ label: 'Division', name: user.division.name, icon: <Globe/> });
    if(user.branch) path.push({ label: 'Branch', name: user.branch.name, icon: <Globe/> });
    return path;
  };
  const orgPath = getUserOrgPath();

  const signatureToDisplay = signaturePreview ?? (!signatureCleared ? user?.signature : null);
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">Manage your profile and account settings.</p>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Profile</TabsTrigger>
                <TabsTrigger value="delegation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Delegation</TabsTrigger>
                <TabsTrigger value="security" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Security</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Update your personal and organizational information here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="md:flex md:gap-8">
                            <div className="flex flex-col items-center md:w-1/3 md:border-r md:pr-8">
                                <div className="relative group mb-4">
                                    <Avatar className="h-32 w-32">
                                        <AvatarImage src={getImageUrl(avatarPreview || user?.avatar)} alt={name} />
                                        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div 
                                        id="profile-avatar-upload-trigger"
                                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => !isUploading && avatarInputRef.current?.click()}
                                    >
                                        {isUploading ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                                    </div>
                                    <Input
                                        type="file"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/gif"
                                        disabled={isUploading}
                                    />
                                </div>
                                <h2 className="text-2xl font-bold text-center">{name}</h2>
                                <p className="text-muted-foreground text-center">{email}</p>
                                
                                <Separator className="my-6 md:hidden" />
                            </div>

                            <div className="md:w-2/3 md:pl-8">
                                <div className="space-y-6">
                                     <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Full Name</Label>
                                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email Address</Label>
                                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <Label>Digital Signature</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-48 h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-slate-50 p-2 overflow-hidden">
                                                <SignaturePreview src={getImageUrl(signatureToDisplay)} alt="Signature preview" width={160} height={80} className="max-w-full max-h-full" />
                                            </div>
                                            <div className="flex-1">
                                                <Dialog open={isSignatureDialogOpen} onOpenChange={handleSignatureDialogOpenChange}>
                                                    <DialogTrigger asChild>
                                                         <Button id="signature-edit-trigger" type="button" variant="outline">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            {user?.signature ? 'Edit Signature' : 'Create Signature'}
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl">
                                                        <DialogHeader>
                                                        <DialogTitle>Create Your Digital Signature</DialogTitle>
                                                        </DialogHeader>
                                                        <Tabs defaultValue="draw">
                                                            <TabsList className="grid w-full grid-cols-2">
                                                                <TabsTrigger value="draw" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Draw</TabsTrigger>
                                                                <TabsTrigger value="upload" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Upload</TabsTrigger>
                                                            </TabsList>
                                                            <TabsContent value="draw" className="p-4">
                                                                <SignaturePad onSave={handleSignatureSave} initialSignature={user?.signature || undefined} />
                                                            </TabsContent>
                                                            <TabsContent value="upload" className="p-4">
                                                                <div className="flex flex-col items-center gap-4">
                                                                    <div 
                                                                        className="w-full h-48 border-2 border-dashed rounded-md flex items-center justify-center bg-white border-slate-200 cursor-pointer hover:border-primary"
                                                                        onClick={() => signatureUploadInputRef.current?.click()}
                                                                    >
                                                                        <input
                                                                            type="file"
                                                                            ref={signatureUploadInputRef}
                                                                            onChange={handleSignatureUploadChange}
                                                                            className="hidden"
                                                                            accept="image/png, image/jpeg, image/webp"
                                                                            disabled={isUploading}
                                                                        />
                                                                        {signaturePreview && !isUploading ? (
                                                                            <Image src={signaturePreview} alt="Signature preview" width={200} height={100} className="max-w-full max-h-full object-contain" />
                                                                        ) : isUploading ? (
                                                                            <Loader2 className="h-8 w-8 animate-spin" />
                                                                        ) : (
                                                                            <div className="text-center text-muted-foreground">
                                                                                <UploadCloud className="mx-auto h-8 w-8 text-slate-300" />
                                                                                <p className="mt-2 text-sm">Click to upload an image</p>
                                                                                <p className="text-xs">(PNG, JPG, WEBP up to 5MB)</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <Button onClick={() => handleSignatureDialogOpenChange(false)} disabled={isUploading}>
                                                                        {isUploading ? 'Uploading...' : 'Done'}
                                                                    </Button>
                                                                </div>
                                                            </TabsContent>
                                                        </Tabs>
                                                    </DialogContent>
                                                </Dialog>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Draw your signature or upload an image. This will be used for acknowledgements if enabled by an admin.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-8" />
                                
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Organizational Info</h3>
                                    <ul className="space-y-4 text-sm">
                                        {orgPath.map(item => item && (
                                            <li key={item.label} className="flex items-center gap-3">
                                                <div className="flex-shrink-0 w-5 h-5">{item.icon}</div>
                                                <div>
                                                    <p className="text-muted-foreground">{item.label}</p>
                                                    <p className="font-medium">{item.name}</p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="delegation">
                <DelegationSettings user={user} allUsers={allUsers} onUpdate={loadUserAndData} />
            </TabsContent>
            <TabsContent value="security">
                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>Change your password here. It's a good practice to use a strong password that you're not using elsewhere.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChangePasswordForm onPasswordChanged={async () => {
                            // After password change, re-fetch user data to get updated onboarding status
                            await loadUserAndData();
                        }} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        <div className="flex justify-end mt-6">
            <Button id="profile-save-button" type="button" onClick={handleSave} disabled={!isChanged || isSaving || isUploading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Changes
            </Button>
        </div>
    </div>
  );
}