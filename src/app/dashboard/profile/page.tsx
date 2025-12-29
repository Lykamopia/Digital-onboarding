
'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getLoggedInUser, updateUserProfile } from '@/app/actions/memo';
import type { User, Office } from '@/lib/types';
import { Camera, Briefcase, Building, Globe, Loader2, Image as ImageIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { cn } from '@/lib/utils';


type UserWithFullOffice = User & { 
    office: Office & {
        departments?: { id: string, name: string, divisions: { id: string, name: string }[] }[];
        districts?: { id: string, name: string, branches: { id: string, name: string }[] }[];
    } 
};

const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

export default function ProfilePage() {
  const [user, setUser] = useState<UserWithFullOffice | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [signature, setSignature] = useState('');
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadUser() {
        const initialUser = await getLoggedInUser();
        setUser(initialUser as any);
        if (initialUser) {
            setName(initialUser.name);
            setEmail(initialUser.email);
            setAvatar(initialUser.avatar || '');
            setSignature(initialUser.signature || '');
        }
    }
    loadUser();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    const result = await updateUserProfile(user.id, { name, email, avatar, signature });
    if (result.success) {
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
      // Force a refresh to update user-nav, which might not be reactive to this change without a page reload.
      window.location.reload();
    } else {
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not update your profile.',
        });
    }
    setIsSaving(false);
  };
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ variant: 'destructive', title: 'File too large', description: 'Profile picture must be less than 5MB.' });
        return;
    }
    await handleFileUpload(file, setIsUploadingAvatar, setAvatar, "Avatar");
  };

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_SIGNATURE_TYPES.includes(file.type)) {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload a PNG, JPG, or SVG file for your signature.' });
        return;
    }
    if (file.size > MAX_SIGNATURE_SIZE) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Signature image must be less than 2MB.' });
        return;
    }
    await handleFileUpload(file, setIsUploadingSignature, setSignature, "Signature");
  };

  const handleFileUpload = async (file: File, setLoading: (loading: boolean) => void, setUrl: (url: string) => void, fieldName: string) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json()).error || `${fieldName} upload failed`);
      const result = await response.json();
      setUrl(result.path);
      toast({ title: `${fieldName} Updated`, description: `Click 'Save All Changes' to apply your new ${fieldName.toLowerCase()}.` });
    } catch (error: any) {
       toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Account Settings</h1>
                <p className="text-muted-foreground">Manage your profile and account settings.</p>
            </div>
            <Skeleton className="h-[500px] w-full" />
        </div>
    );
  }
  
  const isChanged = name !== user.name || email !== user.email || avatar !== (user.avatar || '') || signature !== (user.signature || '');

  const getUserOrgPath = () => {
    if (!user.office) return { division: null, department: null, branch: null, district: null, office: null };
  
    // This logic relies on the includes in getLoggedInUser. Ensure they are correct.
    const officeData = user.office as any;
  
    if (officeData.type === 'division') {
      const department = officeData.department as { name: string };
      return { division: officeData.name, department: department?.name, branch: null, district: null, office: department?.office?.name };
    }
  
    if (officeData.type === 'branch') {
      const district = officeData.district as { name: string, office: { name: string } };
      return { division: null, department: null, branch: officeData.name, district: district?.name, office: district?.office?.name };
    }

    if(officeData.type === 'head_office' || officeData.type === 'division_office' || officeData.type === 'branch_office') {
        return { division: null, department: null, branch: null, district: null, office: officeData.name };
    }
    
    return { division: null, department: null, branch: null, district: null, office: null };
  };

  const { division, department, branch, district, office } = getUserOrgPath();


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
                                        <AvatarImage src={avatar} alt={user.name} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div 
                                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                                    >
                                        {isUploadingAvatar ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                                    </div>
                                    <Input
                                        type="file"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/gif"
                                        disabled={isUploadingAvatar}
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
                                        <Label htmlFor="signature-upload">Digital Signature Image</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-48 h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                                                {signature ? (
                                                    <Image src={signature} alt="Signature preview" width={180} height={90} className="object-contain" />
                                                ) : (
                                                    <div className="text-center text-xs text-muted-foreground">
                                                        <ImageIcon className="mx-auto h-6 w-6" />
                                                        <p>No Signature</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <Button 
                                                    type="button" 
                                                    variant="outline"
                                                    onClick={() => signatureInputRef.current?.click()}
                                                    disabled={isUploadingSignature}
                                                >
                                                    {isUploadingSignature ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                                                    {isUploadingSignature ? 'Uploading...' : 'Upload Signature'}
                                                </Button>
                                                <Input
                                                    id="signature-upload"
                                                    type="file"
                                                    ref={signatureInputRef}
                                                    onChange={handleSignatureChange}
                                                    className="hidden"
                                                    accept={ALLOWED_SIGNATURE_TYPES.join(',')}
                                                    disabled={isUploadingSignature}
                                                />
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    PNG, JPG, or SVG. Max file size: 2MB.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Separator className="my-8" />
                                
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">Organizational Info</h3>
                                    <ul className="space-y-4 text-sm">
                                        {office && (
                                            <li className="flex items-center gap-3">
                                                <Briefcase className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground">Office</p>
                                                    <p className="font-medium">{office}</p>
                                                </div>
                                            </li>
                                        )}
                                        {district && (
                                            <li className="flex items-center gap-3">
                                                <Building className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground">District</p>
                                                    <p className="font-medium">{district}</p>
                                                </div>
                                            </li>
                                        )}
                                        {branch && (
                                            <li className="flex items-center gap-3">
                                                <Globe className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground">Branch</p>
                                                    <p className="font-medium">{branch}</p>
                                                </div>
                                            </li>
                                        )}
                                        {department && (
                                            <li className="flex items-center gap-3">
                                                <Building className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground">Department</p>
                                                    <p className="font-medium">{department}</p>
                                                </div>
                                            </li>
                                        )}
                                        {division && (
                                            <li className="flex items-center gap-3">
                                                <Globe className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="text-muted-foreground">Division</p>
                                                    <p className="font-medium">{division}</p>
                                                </div>
                                            </li>
                                        )}
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
            <Button type="button" onClick={handleSave} disabled={!isChanged || isSaving || isUploadingAvatar || isUploadingSignature}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Changes
            </Button>
        </div>
    </div>
  );
}
