
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getLoggedInUser, updateUserProfile } from '@/app/actions/memo';
import type { User, Office, Department, Division, District, Branch } from '@/lib/types';
import { Camera, Briefcase, Building, Globe, Loader2, Image as ImageIcon, Edit, UploadCloud } from 'lucide-react';
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


type UserWithRelations = User & {
    office: Office;
    department?: Department;
    division?: Division;
    district?: District;
    branch?: Branch;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

export default function ProfilePage() {
  const [user, setUser] = useState<UserWithRelations | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [avatarUrl, setAvatarUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureUploadInputRef = useRef<HTMLInputElement>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);

  const isChanged = 
    name !== user?.name || 
    email !== user?.email || 
    avatarUrl !== (user?.avatar || '') || 
    signatureUrl !== (user?.signature || '');

  const loadUser = useCallback(async () => {
    const initialUser = await getLoggedInUser();
    setUser(initialUser as any);
    if (initialUser) {
        setName(initialUser.name);
        setEmail(initialUser.email);
        setAvatarUrl(initialUser.avatar || '');
        setSignatureUrl(initialUser.signature || '');
        setAvatarPreview(null);
        setSignaturePreview(null);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const result = await updateUserProfile(user.id, { 
        name, 
        email, 
        avatar: avatarUrl, 
        signature: signatureUrl 
    });
    if (result.success) {
      toast.success('Profile Updated', {
        description: 'Your profile has been successfully updated.',
      });
            // Reload local user data
            await loadUser();

            // Notify other parts of the app (header, memo views) about the update so they can refresh immediately.
            // Append a cache-busting query param to avatar/signature URLs so browsers refetch the new images.
            try {
                const fresh = await getLoggedInUser();
                if (fresh) {
                    const detail: any = { ...fresh };
                    if (detail.avatar) detail.avatar = `${detail.avatar}${detail.avatar.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    if (detail.signature) detail.signature = `${detail.signature}${detail.signature.includes('?') ? '&' : '?'}t=${Date.now()}`;
                    window.dispatchEvent(new CustomEvent('profile-updated', { detail }));
                }
            } catch (e) {
                // no-op
            }
    } else {
        toast.error('Update Failed', {
            description: result.error || 'Could not update your profile.',
        });
    }
    setIsSaving(false);
  };
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SIZE) {
        toast.error('File too large', { description: 'Profile picture must be less than 5MB.' });
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    await handleFileUpload(file, setAvatarUrl, "profile", "Avatar");
  };

  const handleSignatureSave = async (dataUrl: string) => {
    setIsSignatureDialogOpen(false);
    
    if (!dataUrl) {
      setSignaturePreview('');
      setSignatureUrl('');
      toast.info("Signature Cleared", { description: "Click 'Save All Changes' to apply." });
      return;
    }
    
    setSignaturePreview(dataUrl);
    
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'signature.webp', { type: 'image/webp' });
    await handleFileUpload(file, setSignatureUrl, "signatures", "Signature");
  };

  const handleSignatureUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid File Type', { description: 'Please upload a PNG, JPG, or WEBP file.' });
        return;
    }

    if (file.size > MAX_AVATAR_SIZE) { // Reuse avatar size limit for now
        toast.error('File too large', { description: 'Signature image must be less than 5MB.' });
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSignaturePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    await handleFileUpload(file, setSignatureUrl, "signatures", "Signature");
  };

  const handleFileUpload = async (file: File, setUrl: (url: string) => void, type: 'profile' | 'signatures' | 'attachments', fieldName: string) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json()).error || `${fieldName} upload failed`);
      const result = await response.json();
      setUrl(result.path);
      toast.success(`${fieldName} Updated`, { description: `Click 'Save All Changes' to apply your new ${fieldName.toLowerCase()}.` });
    } catch (error: any) {
       toast.error('Upload Failed', { description: error.message });
       if(fieldName === 'Avatar') setAvatarPreview(user?.avatar || null);
       if(fieldName === 'Signature') setSignaturePreview(user?.signature || null);
    } finally {
      setIsUploading(false);
    }
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


  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">Manage your profile and account settings.</p>
        </div>
        
        <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Profile</TabsTrigger>
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
                                        <AvatarImage src={avatarPreview || avatarUrl} alt={name} />
                                        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div 
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
                                            <div className="w-48 h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50 p-2 overflow-hidden">
                                                {signaturePreview ? (
                                                    <SignaturePreview src={signaturePreview} alt="Signature preview" width={160} height={80} className="max-w-full max-h-full" priority />
                                                ) : (
                                                    signatureUrl ? (
                                                        <SignaturePreview src={signatureUrl} alt="Signature preview" width={160} height={80} className="max-w-full max-h-full" />
                                                    ) : (
                                                        <div className="text-center text-xs text-muted-foreground">
                                                            <ImageIcon className="mx-auto h-6 w-6" />
                                                            <p>No Signature Set</p>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                                                    <DialogTrigger asChild>
                                                         <Button type="button" variant="outline">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            {signatureUrl ? 'Edit Signature' : 'Create Signature'}
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
                                                                <SignaturePad onSave={handleSignatureSave} initialSignature={signatureUrl} />
                                                            </TabsContent>
                                                            <TabsContent value="upload" className="p-4">
                                                                <div className="flex flex-col items-center gap-4">
                                                                    <div 
                                                                        className="w-full h-48 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50 cursor-pointer hover:border-primary"
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
                                                                                <UploadCloud className="mx-auto h-8 w-8" />
                                                                                <p className="mt-2 text-sm">Click to upload an image</p>
                                                                                <p className="text-xs">(PNG, JPG, WEBP up to 5MB)</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <Button onClick={() => setIsSignatureDialogOpen(false)} disabled={isUploading}>
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
            <TabsContent value="security">
                <Card>
                    <CardHeader>
                        <CardTitle>Security</CardTitle>
                        <CardDescription>Change your password here. It's a good practice to use a strong password that you're not using elsewhere.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChangePasswordForm onPasswordChanged={() => {}} />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
        <div className="flex justify-end mt-6">
            <Button type="button" onClick={handleSave} disabled={!isChanged || isSaving || isUploading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Changes
            </Button>
        </div>
    </div>
  );
}
