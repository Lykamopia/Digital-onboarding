
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
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
import type { Label } from "@/lib/types"

type LabelSelectorProps = {
  id?: string;
  allLabels: Label[];
  selected: Label[];
  setSelected: (labels: Label[]) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
};

function hexToRgba(hex: string, alpha: number) {
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        return `rgba(200, 200, 200, ${alpha})`; // fallback color
    }
    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const i = parseInt(c.join(''), 16);
    return `rgba(${(i >> 16) & 255}, ${(i >> 8) & 255}, ${i & 255}, ${alpha})`;
}

const LabelBadge = ({ label, onRemove, readOnly = false }: { label: Label; onRemove?: (label: Label) => void; readOnly?: boolean }) => (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: hexToRgba(label.color, 0.2),
        color: label.color,
        borderColor: hexToRgba(label.color, 0.4)
      }}
    >
      {label.name}
      {!readOnly && onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${label.name}`}
          className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRemove(label)
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(label)
          }}
        >
          <X className="h-3 w-3" style={{ color: label.color }} />
        </span>
      )}
    </span>
);


export function LabelSelector({ id, allLabels, selected, setSelected, placeholder = "Select labels...", className, popoverClassName }: LabelSelectorProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (labelToUnselect: Label) => {
    setSelected(selected.filter((label) => label.id !== labelToUnselect.id))
  }

  const handleSelect = (label: Label) => {
    if (selected.some((s) => s.id === label.id)) {
      handleUnselect(label)
    } else {
      setSelected([...selected, label])
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
            "flex w-full min-h-10 flex-wrap items-center gap-1 rounded-md border border-input p-1 text-sm text-left cursor-pointer",
            className
          )}
          aria-haspopup="listbox"
        >
          {selected.map((label) => (
            <LabelBadge key={label.id} label={label} onRemove={handleUnselect} />
          ))}
          <span className="flex-1 text-muted-foreground ml-1 text-sm">{selected.length === 0 && placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", popoverClassName)}>
        <Command>
          <CommandInput placeholder="Search labels..." />
          <CommandList>
            <CommandEmpty>No labels found.</CommandEmpty>
            <CommandGroup>
              {allLabels.map((label) => (
                <CommandItem
                  key={label.id}
                  onSelect={() => handleSelect(label)}
                  value={label.name}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.some((s) => s.id === label.id)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                    <span>{label.name}</span>
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
