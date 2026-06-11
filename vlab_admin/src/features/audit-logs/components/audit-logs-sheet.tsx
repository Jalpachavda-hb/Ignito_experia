import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useAuditLogs } from '../context/audit-logs-context'
import { Badge } from '@/components/ui/badge'

export function AuditLogsSheet() {
  const { sheetOpen, setSheetOpen, currentRow } = useAuditLogs()

  if (!currentRow) return null

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetContent className="w-[400px] sm:w-[540px] border-l-border/50 bg-background/95 backdrop-blur overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider uppercase">
              {currentRow.action}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px] tracking-wider uppercase">
              {currentRow.module}
            </Badge>
          </div>
          <SheetTitle>Audit Event Details</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            ID: {currentRow.id}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold tracking-tight">Event Context</h4>
            <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded-md border border-border/50">
              <div className="text-muted-foreground">Timestamp:</div>
              <div className="font-mono text-xs">{currentRow.timestamp.toISOString()}</div>
              
              <div className="text-muted-foreground">Actor:</div>
              <div>{currentRow.user.name} <br/><span className="text-xs text-muted-foreground">{currentRow.user.email}</span></div>
              
              <div className="text-muted-foreground">IP Address:</div>
              <div className="font-mono text-xs">{currentRow.ipAddress}</div>
              
              <div className="text-muted-foreground">User Agent:</div>
              <div className="font-mono text-xs truncate" title={currentRow.userAgent}>{currentRow.userAgent}</div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold tracking-tight">Event Description</h4>
            <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md border border-border/50">
              {currentRow.description}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold tracking-tight flex items-center justify-between">
              Raw Payload
              <Badge variant="outline" className="font-mono text-[9px]">JSON</Badge>
            </h4>
            <div className="bg-[#0d1117] text-[#c9d1d9] p-4 rounded-md overflow-x-auto text-xs font-mono border border-border/50 shadow-inner">
              <pre>
                {JSON.stringify(currentRow.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
