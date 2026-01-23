'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from './ui/checkbox';
import { RecipientSelector } from './recipient-selector';
import { UserPlus, Trash2, Key, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { delegationPermissions } from '@/lib/permissions';
import { addOrUpdateDelegate, removeDelegate } from '@/app/actions/memo';
import type { Delegation, User, DelegationPermission } from '@/lib/types';

interface DelegationSettingsProps {
  user: User & { delegations?: Delegation[], delegatedTo?: Delegation[] };
  allUsers: User[];
  onUpdate: () => void;
}

export function DelegationSettings({ user, allUsers, onUpdate }: DelegationSettingsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingDelegate, setEditingDelegate] = useState<User | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<DelegationPermission[]>([]);
    const [delegationToDelete, setDelegationToDelete] = useState<Delegation | null>(null);
    
    const myDelegates = useMemo(() => user.delegations || [], [user.delegations]);
    const accountsICanAccess = useMemo(() => user.delegatedTo || [], [user.delegatedTo]);

    const availableUsersToDelegate = useMemo(() => {
        const delegatedIds = new Set(myDelegates.map(d => d.delegateId));
        return allUsers.filter(u => u.id !== user.id && !delegatedIds.has(u.id));
    }, [allUsers, user.id, myDelegates]);
    
    const handleAddNew = () => {
        setEditingDelegate(null);
        setSelectedPermissions([]);
        setIsDialogOpen(true);
    };
    
    const handleSave = async () => {
        if (!editingDelegate) {
            toast.error('No delegate selected.');
            return;
        }
        setIsSaving(true);
        try {
            await addOrUpdateDelegate({
                delegateId: editingDelegate.id,
                permissions: selectedPermissions,
            });
            toast.success(`Delegation for ${editingDelegate.name} has been saved.`);
            onUpdate();
            setIsDialogOpen(false);
        } catch (error: any) {
            toast.error('Failed to save delegation', { description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!delegationToDelete) return;
        setIsSaving(true);
        try {
            await removeDelegate(delegationToDelete.id);
            toast.success(`Delegation for ${delegationToDelete.delegate.name} has been revoked.`);
            onUpdate();
            setDelegationToDelete(null);
        } catch (error: any) {
            toast.error('Failed to revoke delegation', { description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
  
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2"><Key /> My Delegates</CardTitle>
                                <CardDescription>Users you have given access to your account.</CardDescription>
                            </div>
                            <Button onClick={handleAddNew} size="sm">
                                <UserPlus className="mr-2 h-4 w-4" /> Add Delegate
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {myDelegates.length > 0 ? myDelegates.map(delegation => (
                                <div key={delegation.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={delegation.delegate.avatar ?? undefined} alt={delegation.delegate.name} />
                                            <AvatarFallback>{delegation.delegate.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{delegation.delegate.name}</p>
                                            <p className="text-xs text-muted-foreground">{delegation.delegate.email}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setDelegationToDelete(delegation)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">You have not delegated your account to anyone.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users /> Accounts I Can Access</CardTitle>
                        <CardDescription>Accounts that have been delegated to you.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            {accountsICanAccess.length > 0 ? accountsICanAccess.map(delegation => (
                                <div key={delegation.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={delegation.delegator.avatar ?? undefined} alt={delegation.delegator.name} />
                                            <AvatarFallback>{delegation.delegator.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold">{delegation.delegator.name}</p>
                                            <p className="text-xs text-muted-foreground">{delegation.delegator.email}</p>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No accounts have been delegated to you.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add a New Delegate</DialogTitle>
                        <DialogDescription>Select a user and grant them specific permissions to act on your behalf.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label>Select User</Label>
                            <RecipientSelector 
                                allUsers={availableUsersToDelegate}
                                selected={editingDelegate ? [editingDelegate] : []}
                                setSelected={(users) => setEditingDelegate(users[0] || null)}
                                placeholder="Search for a user to delegate..."
                            />
                        </div>
                        {editingDelegate && (
                            <div className="space-y-4">
                                <Label>Permissions</Label>
                                <div className="space-y-3 rounded-md border p-4">
                                    {delegationPermissions.map(permission => (
                                        <div key={permission.id} className="flex items-start gap-3">
                                            <Checkbox
                                                id={`perm-${permission.id}`}
                                                checked={selectedPermissions.includes(permission.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedPermissions(prev => 
                                                        checked
                                                        ? [...prev, permission.id]
                                                        : prev.filter(p => p !== permission.id)
                                                    );
                                                }}
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <label htmlFor={`perm-${permission.id}`} className="text-sm font-medium">{permission.label}</label>
                                                <p className="text-xs text-muted-foreground">{permission.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!editingDelegate || isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Delegation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!delegationToDelete} onOpenChange={(open) => !open && setDelegationToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will immediately revoke all delegated access for <strong>{delegationToDelete?.delegate.name}</strong>. They will no longer be able to act on your behalf.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Revoke Access'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
