
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X, Users, ShieldCheck } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { User, Role } from "@/lib/types"

type RecipientSelectorProps = {
  id?: string;
  allUsers: User[];
  allRoles?: Role[];
  selected: User[];
  setSelected: (users: User[]) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  hideBulkOptions?: boolean;
};

export function RecipientSelector({ 
  id, 
  allUsers, 
  allRoles = [], 
  selected, 
  setSelected, 
  placeholder = "Select recipients...", 
  className, 
  popoverClassName,
  hideBulkOptions = false
}: RecipientSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (userToUnselect: User) => {
    setSelected(selected.filter((user) => user.id !== userToUnselect.id))
  }

  const handleSelect = (user: User) => {
    if (selected.some((s) => s.id === user.id)) {
      handleUnselect(user);
    } else {
      setSelected([...selected, user])
    }
  }

  const isAllSelected = React.useMemo(() => {
    if (allUsers.length === 0) return false;
    return allUsers.every(u => selected.some(s => s.id === u.id));
  }, [allUsers, selected]);

  const getIsRoleSelected = (roleId: string) => {
    const roleUsers = allUsers.filter(u => u.roleId === roleId);
    if (roleUsers.length === 0) return false;
    return roleUsers.every(u => selected.some(s => s.id === u.id));
  };

  const handleBulkSelectAll = () => {
    if (isAllSelected) {
      // Remove all users that are in allUsers from selection
      const allUsersIds = new Set(allUsers.map(u => u.id));
      setSelected(selected.filter(s => !allUsersIds.has(s.id)));
    } else {
      // Add all missing users
      const newSelected = [...selected];
      allUsers.forEach(user => {
        if (!newSelected.find(s => s.id === user.id)) {
          newSelected.push(user);
        }
      });
      setSelected(newSelected);
    }
  }

  const handleBulkSelectRole = (roleId: string) => {
    const roleUsers = allUsers.filter(u => u.roleId === roleId);
    const isRoleSelected = getIsRoleSelected(roleId);

    if (isRoleSelected) {
      // Remove all users with this role from selection
      const roleUserIds = new Set(roleUsers.map(u => u.id));
      setSelected(selected.filter(s => !roleUserIds.has(s.id)));
    } else {
      // Add all missing users with this role
      const newSelected = [...selected];
      roleUsers.forEach(user => {
        if (!newSelected.find(s => s.id === user.id)) {
          newSelected.push(user);
        }
      });
      setSelected(newSelected);
    }
  }
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          id={id}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                setOpen(true);
            }
          }}
          className={cn(
            "flex w-full min-h-10 flex-wrap items-center gap-1 rounded-md border border-input p-1 text-sm text-left cursor-pointer transition-colors hover:border-primary/50",
            className
          )}
          aria-haspopup="listbox"
        >
          {selected.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="rounded-sm pr-1 bg-primary/10 text-primary border-primary/20"
            >
              {user.name}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${user.name}`}
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(user)
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnselect(user)
                }}
              >
                <X className="h-3 w-3 text-primary hover:text-primary-foreground hover:bg-primary rounded-full transition-colors" />
              </span>
            </Badge>
          ))}
          <span className="flex-1 text-muted-foreground ml-1 text-sm">{selected.length === 0 && placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)} align="start">
        <Command>
          <CommandInput placeholder="Search by name, email or groups..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            
            {!hideBulkOptions && (
                <>
                    <CommandGroup heading="Bulk Selection">
                    <CommandItem onSelect={handleBulkSelectAll} className="cursor-pointer">
                        <div className="flex items-center gap-2 flex-1">
                          <Check
                            className={cn(
                              "h-4 w-4 text-primary",
                              isAllSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-semibold">All Users</span>
                        </div>
                        <span className="ml-auto text-xs text-muted-foreground">({allUsers.length})</span>
                    </CommandItem>
                    {allRoles.map(role => {
                        const roleUserCount = allUsers.filter(u => u.roleId === role.id).length;
                        if (roleUserCount === 0) return null;
                        const isRoleSelected = getIsRoleSelected(role.id);
                        return (
                        <CommandItem key={role.id} onSelect={() => handleBulkSelectRole(role.id)} className="cursor-pointer">
                            <div className="flex items-center gap-2 flex-1">
                              <Check
                                className={cn(
                                  "h-4 w-4 text-primary",
                                  isRoleSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <ShieldCheck className="h-4 w-4 text-primary" />
                              <span>All {role.name}s</span>
                            </div>
                            <span className="ml-auto text-xs text-muted-foreground">({roleUserCount})</span>
                        </CommandItem>
                        );
                    })}
                    </CommandGroup>
                    <CommandSeparator />
                </>
            )}

            <CommandGroup heading="Individual Users">
              {allUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => handleSelect(user)}
                  value={`${user.name} ${user.email}`}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-primary",
                      selected.some((s) => s.id === user.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
