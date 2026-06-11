import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mockWallets } from '../data/mock-data'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, Minus, Users } from 'lucide-react'
import { AllocationDialogs } from './allocation-dialogs'

export function WalletsTable() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState<'add' | 'deduct' | 'bulk' | null>(null)

  const filtered = mockWallets.filter(w => w.userName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search wallets by user name..." 
            className="pl-8 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDialogOpen('deduct')} className="border-border/50">
            <Minus className="h-4 w-4 mr-2 text-rose-500" />
            Deduct Credits
          </Button>
          <Button variant="outline" onClick={() => setDialogOpen('add')} className="border-border/50">
            <Plus className="h-4 w-4 mr-2 text-emerald-500" />
            Add Credits
          </Button>
          <Button onClick={() => setDialogOpen('bulk')} className="shadow-sm">
            <Users className="h-4 w-4 mr-2" />
            Bulk Allocate
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>User / Student</TableHead>
              <TableHead>Program Context</TableHead>
              <TableHead className="text-right">Available Balance</TableHead>
              <TableHead className="text-right">Lifetime Used</TableHead>
              <TableHead className="text-right">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 10).map((wallet) => (
              <TableRow key={wallet.userId}>
                <TableCell className="font-medium">
                  {wallet.userName}
                  <div className="text-xs text-muted-foreground capitalize">{wallet.role}</div>
                </TableCell>
                <TableCell>
                  {wallet.course ? (
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-xs">{wallet.course}</Badge>
                      <Badge variant="secondary" className="text-xs">{wallet.semester}</Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                  {Intl.NumberFormat('en-US').format(wallet.balance)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {Intl.NumberFormat('en-US').format(wallet.usedCredits)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {wallet.lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No wallets found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="text-xs text-muted-foreground text-center">
        Showing top 10 results. Use the user management module for full pagination.
      </div>

      <AllocationDialogs 
        type={dialogOpen} 
        open={dialogOpen !== null} 
        onOpenChange={(v) => !v && setDialogOpen(null)} 
      />
    </div>
  )
}
