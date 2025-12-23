
'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { loggedInUser as initialLoggedInUser, updateUser } from '@/lib/data';
import type { User } from '@/lib/types';
import { Camera } from 'lucide-react';

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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>My Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-6">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatar} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-0 right-0 rounded-full h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              <span className="sr-only">Change avatar</span>
            </Button>
            <Input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
              accept="image/*"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">{user.name}</h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Role</Label>
                <Input value={initialLoggedInUser.role.name} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label>Division</Label>
                <Input value={user.division} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label>Department</Label>
                <Input value={user.department} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label>Office</Label>
                <Input value={user.office} readOnly disabled />
            </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isChanged}>
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
