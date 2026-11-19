import { useEffect, useRef, useState } from 'react'
import { sendLabHeartbeat } from '@/services/labService'

const HEARTBEAT_MS = 60_000
// A heartbeat is sent only if the student did something in this window.
const ACTIVE_WINDOW_MS = 2 * 60_000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

/**
 * Lab heartbeat (docs/lab-startup-optimization.md §4.3).
 * Sends POST /lab-sessions/:id/heartbeat every 60 s while the tab is visible and the student
 * has interacted recently, so the backend can stop labs nobody is using.
 * Returns `idleWarning` = minutes left before an idle stop (null when not close or not enabled).
 */
export function useLabHeartbeat(sessionId?: string | null, idleTimeoutMinutes?: number | null) {
  const lastActivityRef = useRef(0)
  const [idleWarning, setIdleWarning] = useState<number | null>(null)

  useEffect(() => {
    if (!sessionId) return
    lastActivityRef.current = Date.now()
    const markActive = () => {
      lastActivityRef.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    let lastBeatAt = Date.now()

    const beat = () => {
      if (document.visibilityState === 'hidden') return
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs <= ACTIVE_WINDOW_MS) {
        lastBeatAt = Date.now()
        sendLabHeartbeat(sessionId).catch(() => {
          /* best effort */
        })
      }
      if (idleTimeoutMinutes) {
        // The backend stops the lab idleTimeoutMinutes after the last heartbeat.
        const minutesLeft = Math.ceil((lastBeatAt + idleTimeoutMinutes * 60_000 - Date.now()) / 60_000)
        setIdleWarning(minutesLeft <= 2 ? Math.max(0, minutesLeft) : null)
      }
    }

    beat()
    const handle = setInterval(beat, HEARTBEAT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        markActive()
        beat()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(handle)
      document.removeEventListener('visibilitychange', onVisible)
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive))
    }
  }, [sessionId, idleTimeoutMinutes])

  const dismissIdleWarning = () => {
    lastActivityRef.current = Date.now()
    setIdleWarning(null)
    if (sessionId) sendLabHeartbeat(sessionId).catch(() => {})
  }

  return { idleWarning, dismissIdleWarning }
}
