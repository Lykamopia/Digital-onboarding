"use client"

import { useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { FilePlus, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { RecipientSelector } from "./recipient-selector"
import type { User } from "@/lib/types"

const memoSchema = z.object({
  to: z.array(z.any()).min(1, "Please select at least one recipient."),
  cc: z.array(z.any()).optional(),
  subject: z.string().min(1, "Subject is required."),
  body: z.string().min(1, "Body is required."),
  attachments: z.any().optional(),
})

export function NewMemoDialog() {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState<User[]>([])
  const [cc, setCc] = useState<User[]>([])
  const { toast } = useToast()

  const form = useForm<z.infer<typeof memoSchema>>({
    resolver: zodResolver(memoSchema),
    defaultValues: {
      to: [],
      cc: [],
      subject: "",
      body: "",
    },
  })
  
  // Sync local state with react-hook-form state
  form.watch((value, { name }) => {
    if (name === "to") setTo(value.to || [])
    if (name === "cc") setCc(value.cc || [])
  })


  function onSubmit(values: z.infer<typeof memoSchema>) {
    console.log("New Memo Submitted:", values)
    toast({
      title: "Memo Sent!",
      description: "Your memo has been successfully sent.",
    })
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus className="mr-2 h-4 w-4" />
          New Memo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Compose New Memo</DialogTitle>
          <DialogDescription>
            Fill out the details below to send a new internal memo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <RecipientSelector selected={to} setSelected={(users) => field.onChange(users)} placeholder="Select recipients..."/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CC</FormLabel>
                  <FormControl>
                    <RecipientSelector selected={cc} setSelected={(users) => field.onChange(users)} placeholder="Select CC recipients..."/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter memo subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Type your memo content here."
                      className="min-h-[150px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="attachments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Attachments</FormLabel>
                  <FormControl>
                     <Input type="file" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">
                <Send className="mr-2 h-4 w-4" />
                Send Memo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
