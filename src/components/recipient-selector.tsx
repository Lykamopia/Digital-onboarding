
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { User } from "@/lib/types"

type RecipientSelectorProps = {
  allUsers: User[];
  selected: User[];
  setSelected: (users: User[]) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
};

export function RecipientSelector({ allUsers, selected, setSelected, placeholder = "Select recipients...", className, popoverClassName }: RecipientSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (userToUnselect: User) => {
    setSelected(selected.filter((user) => user.id !== userToUnselect.id))
  }

  const handleSelect = (user: User) => {
    if (!selected.some((s) => s.id === user.id)) {
      setSelected([...selected, user])
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
        <div className={cn("flex w-full min-h-10 flex-wrap items-center gap-1 rounded-md border border-input p-1 text-sm", className)}>
          {selected.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="rounded-sm pr-1"
            >
              {user.name}
              <button
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(user)
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleUnselect(user)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <span className="flex-1 text-muted-foreground ml-1 text-sm">{selected.length === 0 && placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)}>
        <Command>
          <CommandInput placeholder="Search by name or email..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {allUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  onSelect={() => handleSelect(user)}
                  value={`${user.name} ${user.email}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.some((s) => s.id === user.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span>{user.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{`(${user.email})`}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
