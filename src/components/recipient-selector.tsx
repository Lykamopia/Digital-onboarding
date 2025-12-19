"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { users } from "@/lib/data"
import type { User } from "@/lib/types"

type RecipientSelectorProps = {
  selected: User[];
  setSelected: React.Dispatch<React.SetStateAction<User[]>>;
  placeholder?: string;
};

export function RecipientSelector({ selected, setSelected, placeholder = "Select recipients..." }: RecipientSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (userToUnselect: User) => {
    setSelected(selected.filter((user) => user.id !== userToUnselect.id))
  }

  const handleSelect = (user: User) => {
    if (!selected.some((s) => s.id === user.id)) {
      setSelected([...selected, user])
    }
  }
  
  // Close the popover when the user presses Escape
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
        <div className="flex w-full flex-wrap items-center gap-1 rounded-md border border-input p-1 text-sm">
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
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search by name or email..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
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
