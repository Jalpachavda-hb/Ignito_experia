import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { type Session } from '../data/schema'
import { Terminal } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'

type SessionActionDialogsProps = {
  type: 'logs' | 'extend' | 'terminate' | null
  session?: Session
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionActionDialogs({ type, session, open, onOpenChange }: SessionActionDialogsProps) {
  const [extendTime, setExtendTime] = useState('60')

  if (!session || !type) return null

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    
    toast.promise(sleep(1000), {
      loading: 'Executing command...',
      success: () => {
        if (type === 'terminate') return `Session for ${session.userName} forcibly terminated.`
        if (type === 'extend') return `Session extended by ${extendTime} minutes.`
        return 'Success'
      },
      error: 'Command failed',
    })
  }

  // LOGS MODAL (Terminal UI)
  if (type === 'logs') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-4xl bg-zinc-950 text-zinc-50 border-zinc-800 p-0 overflow-hidden'>
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono">
              <Terminal className="h-4 w-4" />
              <span>root@{session.labName.toLowerCase().replace(/\s+/g, '-')}-{session.id.split('-')[0]} ~ /logs/system.log</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
            </div>
          </div>
          <div className="p-4 font-mono text-sm h-[60vh] overflow-y-auto text-zinc-300">
            <div className="text-emerald-400">[{session.startTime.toISOString()}] SYSTEM: Initializing container...</div>
            <div>[{new Date(session.startTime.getTime() + 1000).toISOString()}] DOCKER: Pulling image layers...</div>
            <div>[{new Date(session.startTime.getTime() + 5000).toISOString()}] DOCKER: Container started successfully.</div>
            <div className="text-sky-400">[{new Date(session.startTime.getTime() + 6000).toISOString()}] NETWORK: Assigned IP 10.42.0.{Math.floor(Math.random() * 255)}</div>
            <div>[{new Date(session.startTime.getTime() + 8000).toISOString()}] SYSTEM: Executing entrypoint.sh...</div>
            <br />
            {session.status === 'failed' && (
              <>
                <div className="text-yellow-400">[{new Date().toISOString()}] WARN: Memory usage exceeding limit (OOM Risk)</div>
                <div className="text-red-400">[{new Date().toISOString()}] FATAL: Container exited with code 137 (OOMKilled)</div>
              </>
            )}
            {session.status === 'running' && (
              <>
                <div className="text-zinc-500">[{new Date().toISOString()}] SYSTEM: Listening on port 8080...</div>
                <div className="animate-pulse mt-2">_</div>
              </>
            )}
            {session.status === 'stopped' && (
              <div className="text-zinc-500">[{session.endTime?.toISOString()}] SYSTEM: Shutdown signal received. Graceful termination complete.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // EXTEND OR TERMINATE DIALOG
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>
            {type === 'extend' && 'Extend Session Time'}
            {type === 'terminate' && <span className="text-destructive">Force Terminate Session</span>}
          </DialogTitle>
          <DialogDescription>
            {type === 'extend' && `Grant additional time to ${session.userName}'s active lab session.`}
            {type === 'terminate' && `Immediately kill the container for ${session.userName}. This will cause loss of unsaved work.`}
          </DialogDescription>
        </DialogHeader>

        <form id="session-action-form" onSubmit={handleAction} className="space-y-4 pt-4">
          {type === 'extend' && (
            <div className="space-y-2">
              <Label>Additional Duration</Label>
              <Select value={extendTime} onValueChange={setExtendTime} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes</SelectItem>
                  <SelectItem value="60">1 Hour</SelectItem>
                  <SelectItem value="120">2 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {type === 'terminate' && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 font-medium">
              Warning: Terminating a session directly bypasses the graceful shutdown sequence. Use only for unresponsive containers.
            </div>
          )}
        </form>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            type="submit" 
            form="session-action-form"
            variant={type === 'terminate' ? 'destructive' : 'default'}
          >
            {type === 'terminate' ? 'Kill Session' : 'Extend Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
