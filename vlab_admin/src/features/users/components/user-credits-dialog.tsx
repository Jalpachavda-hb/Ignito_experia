import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { type User } from '../data/schema'
import { toast } from 'sonner'
import { Database } from 'lucide-react'

const formSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be at least 1 credit.'),
})

type UserCreditsDialogProps = {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserCreditsDialog({ user, open, onOpenChange }: UserCreditsDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 500 },
  })

  if (!user) return null

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    toast.success(`${values.amount} credits successfully allocated to ${user.firstName} ${user.lastName}.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='text-start'>
          <DialogTitle className='flex items-center'>
            <Database className="h-5 w-5 mr-2 text-primary" />
            Assign Credits
          </DialogTitle>
          <DialogDescription>
            Allocate compute credits to <strong>{user.firstName} {user.lastName}</strong>.
            Current balance: {Intl.NumberFormat('en-US').format(user.credits)}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id='credits-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-4 pt-2'>
            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Allocate</FormLabel>
                  <FormControl>
                    <Input type='number' min={1} placeholder='500' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type='submit' form='credits-form'>Confirm Allocation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
