import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'

type AllocationDialogsProps = {
  type: 'add' | 'deduct' | 'bulk' | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AllocationDialogs({ type, open, onOpenChange }: AllocationDialogsProps) {
  const [amount, setAmount] = useState('')
  const [user, setUser] = useState('')
  const [course, setCourse] = useState('')
  const [semester, setSemester] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return

    onOpenChange(false)
    
    toast.promise(sleep(1500), {
      loading: 'Processing transaction...',
      success: () => {
        setAmount('')
        setUser('')
        if (type === 'add') return `Successfully allocated ${amount} credits to ${user}.`
        if (type === 'deduct') return `Successfully deducted ${amount} credits from ${user}.`
        if (type === 'bulk') return `Successfully bulk allocated ${amount} credits to ${course} students in ${semester}.`
        return 'Success'
      },
      error: 'Transaction failed',
    })
  }

  if (!type) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {type === 'add' && 'Add Credits to Wallet'}
            {type === 'deduct' && 'Deduct Credits from Wallet'}
            {type === 'bulk' && 'Bulk Credit Allocation'}
          </DialogTitle>
          <DialogDescription>
            {type === 'add' && 'Grant additional compute credits to a specific user.'}
            {type === 'deduct' && 'Remove available credits from a user\'s wallet.'}
            {type === 'bulk' && 'Distribute credits to a large cohort based on their program context.'}
          </DialogDescription>
        </DialogHeader>

        <form id="allocation-form" onSubmit={handleSubmit} className="space-y-4 pt-4">
          {type !== 'bulk' && (
            <div className="space-y-2">
              <Label htmlFor="user">Target User ID or Email</Label>
              <Input 
                id="user" 
                placeholder="e.g. user@vlab.edu" 
                value={user}
                onChange={e => setUser(e.target.value)}
                required
              />
            </div>
          )}

          {type === 'bulk' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Course / Program</Label>
                <Select value={course} onValueChange={setCourse} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CS">Computer Science</SelectItem>
                    <SelectItem value="CYB">Cyber Security</SelectItem>
                    <SelectItem value="DS">Data Science</SelectItem>
                    <SelectItem value="CC">Cloud Computing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select value={semester} onValueChange={setSemester} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F24">Fall 2024</SelectItem>
                    <SelectItem value="S25">Spring 2025</SelectItem>
                    <SelectItem value="SU25">Summer 2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Credit Amount</Label>
            <div className="relative">
              <Input 
                id="amount" 
                type="number" 
                min={1}
                placeholder="5000" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="pl-8"
              />
              <div className="absolute left-3 top-2.5 font-bold text-muted-foreground text-sm">
                {type === 'deduct' ? '-' : '+'}
              </div>
            </div>
          </div>
          
          {type === 'bulk' && (
            <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md mt-4 border border-border/50">
              <strong>Note:</strong> This action will append the requested amount to the existing balance of all matching students. This action generates individual transaction records for audit purposes.
            </div>
          )}
        </form>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            type="submit" 
            form="allocation-form"
            variant={type === 'deduct' ? 'destructive' : 'default'}
          >
            Confirm {type === 'bulk' ? 'Bulk Transfer' : 'Transaction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
