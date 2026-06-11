import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, CheckCircle2, XCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { toast } from 'sonner'

// Temporary mock data since mock-data.ts might have been reverted too
const mockRefunds = [
  { id: 'REF-001', requestedAt: new Date(), userName: 'Alice Johnson', amount: 50, reason: 'Accidental lab launch', status: 'Pending', resolvedAt: null, approvedBy: null },
  { id: 'REF-002', requestedAt: new Date(Date.now() - 86400000), userName: 'Bob Smith', amount: 150, reason: 'Lab crashed during exam', status: 'Approved', resolvedAt: new Date(), approvedBy: 'System Admin' },
]

export function RefundManagement() {
  const [search, setSearch] = useState('')
  const [refunds, setRefunds] = useState(mockRefunds)

  const filtered = refunds.filter(r => 
    r.userName.toLowerCase().includes(search.toLowerCase()) || 
    r.id.toLowerCase().includes(search.toLowerCase())
  )

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRefunds(prev => prev.map(r => 
      r.id === id 
        ? { ...r, status: action, resolvedAt: new Date(), approvedBy: 'System Admin' } 
        : r
    ))
    toast.success(`Refund ${id} has been ${action.toLowerCase()}.`)
  }

  const handleCreate = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1000)), {
      loading: 'Opening refund form...',
      success: 'This would open a modal to create a manual refund in a full implementation.',
      error: 'Error',
    })
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      
      {/* Sticky Filters & Actions */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 -mx-2 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between border-b pb-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search by Refund ID or User..." 
              className="pl-8 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> Create Refund
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30 whitespace-nowrap">
            <TableRow>
              <TableHead>Refund ID</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resolved / By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((refund) => (
              <TableRow key={refund.id} className="hover:bg-muted/50 whitespace-nowrap">
                <TableCell className="font-mono text-xs">{refund.id}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(refund.requestedAt, 'MMM d, yyyy HH:mm')}
                </TableCell>
                <TableCell className="font-medium">{refund.userName}</TableCell>
                <TableCell className="text-right font-bold text-foreground">
                  {Intl.NumberFormat('en-US').format(refund.amount)}
                </TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">{refund.reason}</TableCell>
                <TableCell>
                  {refund.status === 'Pending' && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">Pending</Badge>}
                  {refund.status === 'Approved' && <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Approved</Badge>}
                  {refund.status === 'Rejected' && <Badge variant="outline" className="text-rose-500 border-rose-500/20 bg-rose-500/10">Rejected</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {refund.resolvedAt ? (
                    <>
                      {format(refund.resolvedAt, 'MMM d')} <span className="text-xs ml-1">by {refund.approvedBy}</span>
                    </>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {refund.status === 'Pending' ? (
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleAction(refund.id, 'Approved')}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleAction(refund.id, 'Rejected')}>
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Processed</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No refund requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
