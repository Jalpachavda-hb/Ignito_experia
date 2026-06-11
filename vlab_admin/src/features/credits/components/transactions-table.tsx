import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mockTransactions } from '../data/mock-data'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function TransactionsTable() {
  const [search, setSearch] = useState('')

  const filtered = mockTransactions.filter(tx => 
    tx.userName.toLowerCase().includes(search.toLowerCase()) || 
    tx.reason.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search by user or reason..." 
            className="pl-8 bg-background"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reason / Details</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 15).map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </TableCell>
                <TableCell className="font-medium">{tx.userName}</TableCell>
                <TableCell>
                  <Badge variant={tx.type === 'allocation' ? 'default' : 'secondary'} className="capitalize">
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{tx.reason}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{tx.admin || 'System'}</TableCell>
                <TableCell className={`text-right font-bold ${tx.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {tx.amount > 0 ? '+' : ''}{Intl.NumberFormat('en-US').format(tx.amount)}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No transactions found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
