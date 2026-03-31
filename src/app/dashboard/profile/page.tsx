'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getLoggedInUser, updateUserProfile, getUsers } from '@/app/actions/memo';
import type { User, Office, Department, Division, District, Branch, LoggedInUser } from '@/lib/types';
import { Camera, Briefcase, Building, Globe, Loader2, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordForm } from '@/components/change-password-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { UserProfileLoader } from '@/components/user-profile-loader';


type UserWithRelations = LoggedInUser & {
    office: Office;
    department?: Department;
    division?: Division;
    district?: District;
    branch?: Branch;
};

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const getImageUrl = (path: string | null | undefined): string => {
    if (!path) return '';
    const trimmed = path.trim();
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http')) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return `/${trimmed}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserWithRelations | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isChanged = 
    name !== (user?.name || '') || 
    email !== (user?.email || '') || 
    pendingAvatar !== null;

  const loadUserAndData = useCallback(async () => {
    const initialUser = await getLoggedInUser();
    
    if (initialUser?.actingUser) {
        router.replace('/dashboard/access-denied');
        return;
    }
    
    setUser(initialUser as any);

    if (initialUser) {
        setName(initialUser.name);
        setEmail(initialUser.email);
        setAvatarPreview(null);
        setPendingAvatar(null);
    }
  }, [router]);

  useEffect(() => {
    loadUserAndData();
  }, [loadUserAndData]);

  const uploadFile = async (file: File, type: 'profile'): Promise<string> => {
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
       throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const oldAvatar = user.avatar;
      let finalAvatarUrl = oldAvatar || '';

      if (pendingAvatar) {
        finalAvatarUrl = await uploadFile(pendingAvatar, 'profile');
      }

      const result = await updateUserProfile(user.id, {
        name,
        email,
        avatar: finalAvatarUrl,
        signature: user.signature || '', // Keep existing if any, but feature is hidden
      });

      if (result.success) {
        toast.success(result.message ? "Request Submitted" : 'Profile Updated', {
          description: result.message || 'Your profile has been successfully updated.',
        });

        if (!result.message) {
            if (pendingAvatar && oldAvatar) {
                await fetch('/api/upload', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: oldAvatar }),
                });
            }
            await loadUserAndData();
            const fresh = await getLoggedInUser();
            if (fresh) {
                const detail: any = { ...fresh };
                if (detail.avatar) detail.avatar = `${detail.avatar.split('?')[0]}?t=${Date.now()}`;
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
  
  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">Manage your personal information and security.</p>
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
                                        <AvatarImage src={getImageUrl(avatarPreview || user?.avatar)} alt={name} />
                                        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div 
                                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => !isUploading && avatarInputRef.current?.click()}
                                    >
                                        {isUploading ? <Loader2 className="h-8 w-8 text-white animate-spin" /> : <Camera className="h-8 w-8 text-white" />}
                                    </div>
                                    <input
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

                                    <Separator className="my-8" />
                                    
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Organizational Info</h3>
                                        <ul className="space-y-4 text-sm">
                                            {getUserOrgPath().map(item => item && (
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
                        <ChangePasswordForm onPasswordChanged={async () => {
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