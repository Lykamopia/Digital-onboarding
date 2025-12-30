'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getLoggedInUser, updateUserProfile } from '@/app/actions/memo';
import type { User, Office, Department, Division, District, Branch } from '@/lib/types';
import { Camera, Briefcase, Building, Globe, Loader2, Image as ImageIcon, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/signature-pad';


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
  const [avatar, setAvatar] = useState('');
  const [signature, setSignature] = useState('');
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false);
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

    if (file.size > MAX_AVATAR_SIZE) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Profile picture must be less than 5MB.' });
        return;
    }
    await handleFileUpload(file, setIsUploadingAvatar, setAvatar, "Avatar");
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

  const handleSignatureSave = async (dataUrl: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'signature.png', { type: 'image/png' });
    await handleFileUpload(file, () => {}, setSignature, "Signature");
    setIsSignatureDialogOpen(false);
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
                                        <AvatarImage src={avatar} alt={name} />
                                        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
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
                                        <Label>Digital Signature</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-48 h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50 p-2">
                                                {signature ? (
                                                    <Image src={signature} alt="Signature preview" width={180} height={90} className="object-contain" />
                                                ) : (
                                                    <div className="text-center text-xs text-muted-foreground">
                                                        <ImageIcon className="mx-auto h-6 w-6" />
                                                        <p>No Signature Set</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <Dialog open={isSignatureDialogOpen} onOpenChange={setIsSignatureDialogOpen}>
                                                    <DialogTrigger asChild>
                                                         <Button type="button" variant="outline">
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            {signature ? 'Edit Signature' : 'Create Signature'}
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-2xl">
                                                        <DialogHeader>
                                                        <DialogTitle>Create Your Digital Signature</DialogTitle>
                                                        </DialogHeader>
                                                        <SignaturePad onSave={handleSignatureSave} />
                                                    </DialogContent>
                                                </Dialog>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Draw your signature. This will be used for memo acknowledgements if enabled by an admin.
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
            <Button type="button" onClick={handleSave} disabled={!isChanged || isSaving || isUploadingAvatar}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save All Changes
            </Button>
        </div>
    </div>
  );
}
