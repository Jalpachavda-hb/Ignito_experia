import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { mockTransactions } from '../data/mock-data'
import { Input } from '@/components/ui/input'
import { Search, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { toast } from 'sonner'

export function CreditLedgerTable() {
  const [search, setSearch] = useState('')

  // Map transactions into a ledger format
  const ledgerEntries = mockTransactions
    .filter(tx => 
      tx.userName.toLowerCase().includes(search.toLowerCase()) || 
      tx.id.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 50) // Limit for demo

  const handleExport = () => {
    toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
      loading: 'Generating ledger report...',
      success: 'Ledger exported as Excel successfully!',
      error: 'Failed to export.',
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
              placeholder="Search by Transaction ID or User..." 
              className="pl-8 bg-background"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30 whitespace-nowrap">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Debit (-)</TableHead>
              <TableHead className="text-right">Credit (+)</TableHead>
              <TableHead className="text-right border-l">Running Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerEntries.map((entry) => (
              <TableRow key={entry.id} className="hover:bg-muted/50 whitespace-nowrap">
                <TableCell className="text-sm text-muted-foreground">
                  {format(entry.date, 'MMM d, yyyy')}
                  <span className="block text-xs">{format(entry.date, 'HH:mm')}</span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{entry.referenceNumber}</TableCell>
                <TableCell className="font-medium">{entry.userName}</TableCell>
                <TableCell className="text-sm">
                  {entry.type}
                  {entry.reason && <span className="block text-xs text-muted-foreground truncate max-w-[200px]">{entry.reason}</span>}
                </TableCell>
                <TableCell className="text-right text-rose-600 font-medium">
                  {entry.amount < 0 ? Intl.NumberFormat('en-US').format(Math.abs(entry.amount)) : '-'}
                </TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">
                  {entry.amount > 0 ? Intl.NumberFormat('en-US').format(entry.amount) : '-'}
                </TableCell>
                <TableCell className="text-right font-bold border-l bg-muted/10">
                  {/* Mocking running balance for demo since transactions-table reverted */}
                  {Intl.NumberFormat('en-US').format(1000 + entry.amount)}
                </TableCell>
              </TableRow>
            ))}
            {ledgerEntries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No ledger entries found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" disabled>Previous</Button>
        <Button variant="outline" size="sm" disabled>Next</Button>
      </div>
    </div>
  )
}
