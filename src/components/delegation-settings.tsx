
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
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Checkbox } from './ui/checkbox';
import { RecipientSelector } from './recipient-selector';
import { UserPlus, Trash2, Key, Users, Loader2, Repeat, Edit, MoreHorizontal, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { delegationPermissions } from '@/lib/permissions';
import { addOrUpdateDelegate, removeDelegate } from '@/app/actions/memo';
import type { Delegation, User, DelegationPermission } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Badge } from './ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { DelegationEmptyIllustration } from './delegation-empty-illustration';
import { NoAccessIllustration } from './no-access-illustration';

interface DelegationSettingsProps {
  user: User & { delegations?: Delegation[], delegatedTo?: Delegation[] };
  allUsers: User[];
  onUpdate: () => void;
}

export function DelegationSettings({ user, allUsers, onUpdate }: DelegationSettingsProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [editingDelegation, setEditingDelegation] = useState<Delegation | null>(null);
    const [selectedDelegate, setSelectedDelegate] = useState<User | null>(null);
    
    const [selectedPermissions, setSelectedPermissions] = useState<DelegationPermission[]>([]);
    const [delegationToDelete, setDelegationToDelete] = useState<Delegation | null>(null);
    
    const myDelegates = useMemo(() => user.delegations || [], [user.delegations]);
    const accountsICanAccess = useMemo(() => user.delegatedTo || [], [user.delegatedTo]);

    const availableUsersToDelegate = useMemo(() => {
        const delegatedIds = new Set(myDelegates.map(d => d.delegateId));
        return allUsers.filter(u => u.id !== user.id && !delegatedIds.has(u.id));
    }, [allUsers, user.id, myDelegates]);

    const handleEdit = (delegation: Delegation) => {
        setEditingDelegation(delegation);
        setSelectedDelegate(delegation.delegate);
        setSelectedPermissions((delegation.permissions?.split(',') as DelegationPermission[]) || []);
        setIsDialogOpen(true);
    };
    
    const handleAddNew = () => {
        setEditingDelegation(null);
        setSelectedDelegate(null);
        setSelectedPermissions([]);
        setIsDialogOpen(true);
    };
    
    const handleSave = async () => {
        if (!selectedDelegate) {
            toast.error('No delegate selected.');
            return;
        }
        setIsSaving(true);
        try {
            await addOrUpdateDelegate({
                delegateId: selectedDelegate.id,
                permissions: selectedPermissions,
            });
            toast.success(`Delegation for ${selectedDelegate.name} has been ${editingDelegation ? 'updated' : 'saved'}.`);
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
    
    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 15,
            },
        },
    };

    return (
        <>
            <div className="space-y-8">
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl"><Key className="text-primary"/> My Delegates</CardTitle>
                            <CardDescription>Users you have given access to your account.</CardDescription>
                        </div>
                        <Button onClick={handleAddNew}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Delegate
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[300px]">User</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <motion.tbody
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {myDelegates.length > 0 ? myDelegates.map(delegation => {
                                        const permissions = delegation.permissions ? delegation.permissions.split(',') : [];
                                        return (
                                            <motion.tr key={delegation.id} variants={itemVariants} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="flex items-center gap-4">
                                                        <Avatar className="h-10 w-10">
                                                            <AvatarImage src={delegation.delegate.avatar ?? undefined} alt={delegation.delegate.name} />
                                                            <AvatarFallback>{delegation.delegate.name?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-semibold">{delegation.delegate.name}</p>
                                                            <p className="text-sm text-muted-foreground">{delegation.delegate.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {permissions.map(perm => {
                                                            const permInfo = delegationPermissions.find(p => p.id === perm);
                                                            return (
                                                                <TooltipProvider key={perm}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Badge variant="secondary" className="font-normal">{permInfo?.label || perm}</Badge>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{permInfo?.description}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onSelect={() => handleEdit(delegation)}><Edit className="mr-2"/>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => setDelegationToDelete(delegation)} className="text-destructive"><Trash2 className="mr-2"/>Revoke</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </motion.tr>
                                        );
                                    }) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center gap-4">
                                                    <DelegationEmptyIllustration />
                                                    <div className="text-center">
                                                        <p className="font-semibold">No Delegates Yet</p>
                                                        <p className="text-sm text-muted-foreground">Click "Add Delegate" to grant someone access to your account.</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </motion.tbody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl"><Users className="text-primary"/> Accounts I Can Access</CardTitle>
                        <CardDescription>Accounts that have been delegated to you by other users.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead className="text-right w-[150px]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <motion.tbody
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {accountsICanAccess.length > 0 ? accountsICanAccess.map(delegation => (
                                        <motion.tr key={delegation.id} variants={itemVariants} className="hover:bg-muted/50">
                                            <TableCell>
                                                 <div className="flex items-center gap-4">
                                                    <Avatar className="h-10 w-10">
                                                        <AvatarImage src={delegation.delegator.avatar ?? undefined} alt={delegation.delegator.name} />
                                                        <AvatarFallback>{delegation.delegator.name?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold">{delegation.delegator.name}</p>
                                                        <p className="text-sm text-muted-foreground">{delegation.delegator.email}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div>
                                                            <Button disabled>
                                                                <Repeat className="mr-2 h-4 w-4" /> Act as
                                                            </Button>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Account switching is coming soon!</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>
                                        </motion.tr>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center gap-4">
                                                    <NoAccessIllustration />
                                                    <div className="text-center">
                                                        <p className="font-semibold">No Delegated Accounts</p>
                                                        <p className="text-sm text-muted-foreground">When other users delegate access to you, their accounts will appear here.</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </motion.tbody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDelegation ? `Edit Delegation for ${editingDelegation.delegate.name}` : 'Add a New Delegate'}</DialogTitle>
                        <DialogDescription>Select a user and grant them specific permissions to act on your behalf.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label>Select User</Label>
                            <RecipientSelector 
                                allUsers={editingDelegation ? [editingDelegation.delegate] : availableUsersToDelegate}
                                selected={selectedDelegate ? [selectedDelegate] : []}
                                setSelected={(users) => setSelectedDelegate(users[0] || null)}
                                placeholder="Search for a user to delegate..."
                                className={editingDelegation ? "bg-muted pointer-events-none" : ""}
                            />
                        </div>
                        {selectedDelegate && (
                            <div className="space-y-4">
                                <Label>Permissions</Label>
                                <div className="space-y-3 rounded-md border p-4 max-h-64 overflow-y-auto">
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
                        <Button onClick={handleSave} disabled={!selectedDelegate || isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingDelegation ? 'Update Delegation' : 'Save Delegation'}
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
                        <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Revoke Access'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
