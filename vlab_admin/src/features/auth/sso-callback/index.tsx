import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { ssoLogin } from '@/Utils/PostApiHandler'

export function SsoCallback() {
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/(auth)/sso-callback' }) as Record<string, string | undefined>
  const { auth } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const token = searchParams?.token || searchParams?.accessToken || searchParams?.access_token || searchParams?.id_token || searchParams?.idToken

    if (!token) {
      setStatus('error')
      setErrorMessage('Missing SSO token parameter in URL. Please launch Experia directly from your University LMS.')
      return
    }

    const processSso = async () => {
      try {
        const studentDegreeAdmissionId = searchParams?.studentDegreeAdmissionId
        const studentId = searchParams?.studentId
        const data: any = await ssoLogin({ token, studentDegreeAdmissionId, studentId }, token)

        if (data && data.success && data.accessToken) {
          auth.setAccessToken(data.accessToken)
          if (data.student) {
            auth.setUser(data.student)
          }

          // Instantly replace window location to student dashboard to skip /sso-callback in browser history.
          // Clicking browser BACK will now go directly back to LMS portal.
          window.location.replace('/student/dashboard')
        } else {
          setStatus('error')
          setErrorMessage(data?.message || 'LMS SSO authentication failed. Please try again.')
        }
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Network error during LMS SSO authentication.')
      }
    }

    processSso()
  }, [searchParams?.token])

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-8 text-center relative z-10">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h2 className="text-xl font-bold text-slate-800">Authenticating via LMS SSO...</h2>
            <p className="text-sm text-slate-500">Establishing student session and launching Virtual Lab...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">SSO Authentication Failed</h2>
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3 w-full font-medium">
              {errorMessage}
            </p>
            <Button
              className="mt-2 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => navigate({ to: '/sign-in' })}
            >
              Go to Sign In <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
