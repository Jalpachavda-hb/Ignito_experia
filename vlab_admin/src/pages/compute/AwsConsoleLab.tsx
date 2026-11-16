import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Circle, Clock, ExternalLink, Loader2, Plus, Power, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  type AwsApiError,
  type AwsLabSession,
  type AwsLabValidation,
  createAwsConsoleUrl,
  endAwsLab,
  extendAwsLab,
  getAwsLab,
  startAwsLab,
  validateAwsLab,
} from '@/services/awsLabService'

const REGION_NAMES: Record<string, string> = { 'ap-south-1': 'Asia Pacific (Mumbai)' }
const POLL_MS = 30_000

const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

type Phase = 'starting' | 'no-capacity' | 'ready' | 'error'

/**
 * AWS console lab page (docs/aws-console-labs.md §6). The real AWS console always opens in a new
 * tab (AWS blocks iframes). The sign-in URL is fetched on every click and never stored.
 */
export function AwsConsoleLab() {
  const navigate = useNavigate()
  const location = useLocation()
  const search = location.search as Record<string, string>
  const labType = search.labType || ''
  const sessionIdParam = search.sessionId || ''

  const [phase, setPhase] = useState<Phase>('starting')
  const [session, setSession] = useState<AwsLabSession | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [retryIn, setRetryIn] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [validation, setValidation] = useState<AwsLabValidation | null>(null)
  const [busy, setBusy] = useState<'console' | 'validate' | 'extend' | 'end' | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const clockOffsetRef = useRef(0) // server time − local time, in seconds
  const warnedRef = useRef<{ ten: boolean; two: boolean }>({ ten: false, two: false })

  const applySession = useCallback((s: AwsLabSession) => {
    clockOffsetRef.current = s.serverTime - Date.now() / 1000
    setSession(s)
    if (s.lastValidation) setValidation(s.lastValidation)
    setPhase('ready')
  }, [])

  // Start or attach.
  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setInterval> | null = null

    const begin = async () => {
      setPhase('starting')
      try {
        const s = sessionIdParam ? await getAwsLab(sessionIdParam) : await startAwsLab(labType)
        if (cancelled) return
        applySession(s)
        if (!sessionIdParam) {
          navigate({ to: '/admin/compute/aws', search: { labType: s.labType, sessionId: s.sessionId }, replace: true })
        }
      } catch (e) {
        if (cancelled) return
        const err = e as AwsApiError
        const code = err.payload?.code
        if (err.status === 409 && code === 'ALREADY_ACTIVE' && err.payload?.sessionId) {
          navigate({ to: '/admin/compute/aws', search: { labType, sessionId: err.payload.sessionId }, replace: true })
          return
        }
        if (err.status === 503 && code === 'NO_CAPACITY') {
          let wait = err.payload?.retryAfterSeconds || 60
          setRetryIn(wait)
          setPhase('no-capacity')
          retryTimer = setInterval(() => {
            wait -= 1
            setRetryIn(wait)
            if (wait <= 0 && retryTimer) {
              clearInterval(retryTimer)
              begin()
            }
          }, 1000)
          return
        }
        setErrorMessage(err.message || 'Could not start the AWS lab.')
        setPhase('error')
      }
    }
    begin()
    return () => {
      cancelled = true
      if (retryTimer) clearInterval(retryTimer)
    }
  }, [labType, sessionIdParam, applySession, navigate])

  // Stay in sync with server-side expiry: poll every 30 s and on window focus.
  useEffect(() => {
    if (!session?.sessionId || session.status === 'ENDED' || session.status === 'ERROR') return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      getAwsLab(session.sessionId).then(applySession).catch(() => {})
    }
    const handle = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(handle)
      window.removeEventListener('focus', refresh)
    }
  }, [session?.sessionId, session?.status, applySession])

  // Countdown from the server's expiresAt (clock-skew corrected) + warnings at 10 and 2 minutes.
  useEffect(() => {
    if (!session || session.status !== 'READY') return
    const tick = () => {
      const left = session.expiresAt - (Date.now() / 1000 + clockOffsetRef.current)
      setRemaining(left)
      if (left <= 600 && left > 120 && !warnedRef.current.ten) {
        warnedRef.current.ten = true
        toast.warning('Your lab ends in 10 minutes. Click "Check my work" now.')
      }
      if (left <= 120 && left > 0 && !warnedRef.current.two) {
        warnedRef.current.two = true
        toast.warning('Your lab ends in 2 minutes. Click "Check my work" now.')
      }
    }
    tick()
    const handle = setInterval(tick, 1000)
    return () => clearInterval(handle)
  }, [session])

  const openConsole = async () => {
    if (!session) return
    // Open the tab synchronously in the click handler (pop-up blockers), then navigate it.
    const win = window.open('about:blank', '_blank')
    if (!win) {
      toast.error('Please allow pop-ups for this site to open the AWS console.')
      return
    }
    win.document.title = 'Opening AWS Console…'
    win.document.body.innerText = 'Opening AWS Console…'
    setBusy('console')
    try {
      const { url } = await createAwsConsoleUrl(session.sessionId)
      win.opener = null // cut the link back to our page
      win.location.href = url
    } catch (e) {
      win.close()
      toast.error((e as Error).message || 'Could not open the AWS console.')
    } finally {
      setBusy(null)
    }
  }

  const checkWork = async () => {
    if (!session) return
    setBusy('validate')
    try {
      setValidation(await validateAwsLab(session.sessionId))
    } catch (e) {
      toast.error((e as Error).message || 'Could not check your work.')
    } finally {
      setBusy(null)
    }
  }

  const extend = async () => {
    if (!session) return
    setBusy('extend')
    try {
      applySession(await extendAwsLab(session.sessionId))
      warnedRef.current = { ten: false, two: false }
      toast.success(`Added ${session.extensionMinutes} minutes.`)
    } catch (e) {
      toast.error((e as Error).message || 'Could not extend the lab.')
    } finally {
      setBusy(null)
    }
  }

  const endLab = async () => {
    if (!session) return
    setBusy('end')
    try {
      await endAwsLab(session.sessionId)
      setSession({ ...session, status: 'ENDING' })
    } catch (e) {
      toast.error((e as Error).message || 'Could not end the lab.')
    } finally {
      setBusy(null)
      setConfirmEnd(false)
    }
  }

  const back = () => navigate({ to: '/student/my-labs' })

  if (phase === 'starting' || phase === 'no-capacity' || phase === 'error') {
    return (
      <div className='flex h-screen w-screen flex-col items-center justify-center bg-[#0c0c0c] px-6 text-center text-white'>
        {phase !== 'error' && <Loader2 className='mb-4 h-10 w-10 animate-spin text-orange-500' />}
        <p className='text-lg font-bold'>
          {phase === 'starting' && 'Preparing your AWS account…'}
          {phase === 'no-capacity' && `All AWS lab slots are busy. Retrying in ${retryIn} s…`}
          {phase === 'error' && 'Unable to start the AWS lab'}
        </p>
        {phase === 'error' && (
          <>
            <p className='mt-2 max-w-md text-sm text-red-400'>{errorMessage}</p>
            <p className='mt-1 text-xs text-slate-400'>If this keeps happening, contact support.</p>
          </>
        )}
        <Button variant='secondary' className='mt-6' onClick={back}>
          Back to My Labs
        </Button>
      </div>
    )
  }

  if (!session) return null
  const regionLabel = REGION_NAMES[session.region] || session.region
  const isReady = session.status === 'READY'
  const shownValidation = validation || session.lastValidation
  const resultFor = (taskId: string) => shownValidation?.tasks.find((t) => t.id === taskId)

  return (
    <div className='flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950'>
      <header className='flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 dark:bg-slate-900'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='sm' onClick={back}>
            <ArrowLeft className='mr-1 h-4 w-4' /> My Labs
          </Button>
          <h1 className='text-lg font-bold'>{session.title} Lab</h1>
        </div>
        <div className='flex items-center gap-4 text-sm'>
          <span className='text-muted-foreground'>Region: {regionLabel}</span>
          {isReady && (
            <span className='flex items-center gap-1 font-mono font-bold'>
              <Clock className='h-4 w-4' /> {formatClock(remaining)} left
            </span>
          )}
        </div>
      </header>

      {session.status === 'ENDING' && (
        <div className='border-b bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'>
          Lab ended. Your AWS console is already signed out, so you can close the AWS console tab. The account is being
          cleaned up in the background.
        </div>
      )}
      {session.status === 'ERROR' && (
        <div className='border-b bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200'>
          Something went wrong with this lab. Please contact support.
        </div>
      )}

      <main className='grid flex-1 gap-6 p-4 md:grid-cols-[1fr_320px] md:p-6'>
        <section className='rounded-xl border bg-white p-5 dark:bg-slate-900'>
          {session.status === 'ENDED' ? (
            <div className='space-y-3'>
              <h2 className='text-lg font-bold'>{session.endReason === 'EXPIRED' ? 'Time is up' : 'Lab ended'}</h2>
              {shownValidation ? (
                <p>
                  Final score: <strong>{shownValidation.score}</strong> / {shownValidation.total}
                </p>
              ) : (
                <p className='text-muted-foreground'>No work check was recorded for this lab.</p>
              )}
              <Button onClick={() => navigate({ to: '/admin/compute/aws', search: { labType: session.labType } })}>
                Start again
              </Button>
            </div>
          ) : (
            <>
              <h2 className='mb-1 text-base font-bold'>Tasks</h2>
              {session.labType === 'aws-s3' && (
                <p className='mb-3 text-xs text-muted-foreground'>
                  Bucket names are global across AWS: use the prefix <code className='font-mono'>{session.bucketPrefix}</code>.
                </p>
              )}
              {session.instructions && <p className='mb-3 text-xs text-muted-foreground'>{session.instructions}</p>}
              <ol className='space-y-3'>
                {session.tasks.map((task, i) => {
                  const r = resultFor(task.id)
                  return (
                    <li key={task.id} className='flex items-start gap-2 text-sm'>
                      {r?.passed ? (
                        <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0 text-emerald-600' aria-label='Done' />
                      ) : r ? (
                        <XCircle className='mt-0.5 h-4 w-4 shrink-0 text-red-500' aria-label='Not done yet' />
                      ) : (
                        <Circle className='mt-0.5 h-4 w-4 shrink-0 text-slate-400' aria-label='Not checked' />
                      )}
                      <div>
                        <p>
                          {i + 1}. {task.title}
                        </p>
                        {r && <p className='text-xs text-muted-foreground'>{r.message}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
              <div className='mt-5 flex items-center gap-3'>
                <Button onClick={checkWork} disabled={!isReady || busy !== null}>
                  {busy === 'validate' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <RefreshCw className='mr-2 h-4 w-4' />}
                  Check my work
                </Button>
                {shownValidation && (
                  <span className='text-sm text-muted-foreground'>
                    {shownValidation.score} / {shownValidation.total} done
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        <aside className='space-y-4 rounded-xl border bg-white p-5 dark:bg-slate-900'>
          <Button className='w-full' onClick={openConsole} disabled={!isReady || busy !== null}>
            {busy === 'console' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <ExternalLink className='mr-2 h-4 w-4' />}
            Open AWS Console
          </Button>
          <p className='text-xs text-muted-foreground'>
            Opens the real AWS console in a new tab. Tip: use a private window if you are signed in to another AWS
            account. Console signed out? Click again to get a new sign-in.
          </p>
          <div className='flex gap-2'>
            {session.canExtend && (
              <Button variant='outline' className='flex-1' onClick={extend} disabled={busy !== null}>
                <Plus className='mr-1 h-4 w-4' /> {session.extensionMinutes} min
              </Button>
            )}
            <Button
              variant='outline'
              className='flex-1 border-red-200 text-red-600 hover:bg-red-50'
              onClick={() => setConfirmEnd(true)}
              disabled={!isReady || busy !== null}
            >
              <Power className='mr-1 h-4 w-4' /> End lab
            </Button>
          </div>
        </aside>
      </main>

      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        handleConfirm={endLab}
        title='End this lab?'
        desc='All resources in your AWS account will be deleted. Close the AWS console tab afterwards.'
        confirmText='End lab'
        cancelBtnText='Cancel'
        destructive
      />
    </div>
  )
}
