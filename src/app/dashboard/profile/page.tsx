
'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { loggedInUser as initialLoggedInUser, updateUser } from '@/lib/data';
import type { User } from '@/lib/types';
import { Camera, Briefcase, Building, Globe } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const [user, setUser] = useState<User>(initialLoggedInUser);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatar, setAvatar] = useState(user.avatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSave = () => {
    const updatedUser = {
      ...user,
      name,
      email,
      avatar,
    };
    
    if (updateUser(updatedUser)) {
      setUser(updatedUser); // Update local state
       toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
       // Force a reload to update user-nav and other components
       window.location.reload();
    } else {
        toast({
            variant: 'destructive',
            title: 'Update Failed',
            description: 'Could not update your profile.',
        });
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (readEvent) => {
        if (readEvent.target?.result) {
            setAvatar(readEvent.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  const isChanged = name !== user.name || email !== user.email || avatar !== user.avatar;

  return (
    <div className="max-w-4xl mx-auto">
        <div className="mb-6">
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">Manage your profile and account settings.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Update your personal information here.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="md:flex md:gap-8">
                    {/* Left Column: Avatar and Details */}
                    <div className="flex flex-col items-center md:w-1/3 md:border-r md:pr-8">
                        <div className="relative group mb-4">
                            <Avatar className="h-32 w-32">
                                <AvatarImage src={avatar} alt={user.name} />
                                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div 
                                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Camera className="h-8 w-8 text-white" />
                            </div>
                            <Input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                        <h2 className="text-2xl font-bold text-center">{user.name}</h2>
                        <p className="text-muted-foreground text-center">{user.email}</p>
                        <p className="text-sm font-medium text-primary mt-2 text-center">{initialLoggedInUser.role.name}</p>

                        <Separator className="my-6 md:hidden" />
                    </div>

                    {/* Right Column: Form and Org Info */}
                    <div className="md:w-2/3 md:pl-8">
                        <form className="space-y-6">
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
                            
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={!isChanged}>
                                    Save Changes
                                </Button>
                            </div>
                        </form>

                        <Separator className="my-8" />
                        
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Organizational Info</h3>
                            <ul className="space-y-4 text-sm">
                                <li className="flex items-center gap-3">
                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-muted-foreground">Division</p>
                                        <p className="font-medium">{user.division}</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Building className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-muted-foreground">Department</p>
                                        <p className="font-medium">{user.department}</p>
                                    </div>
                               - </li>
                                <li className="flex items-center gap-3">
                                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-muted-foreground">Office</p>
                                        <p className="font-medium">{user.office}</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
