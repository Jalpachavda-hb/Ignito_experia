import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2, AlertCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { getApiOrigin } from '@/config/env'
import { getTenantSlug } from '@/lib/tenant-slug'
import { fetchAuthMe } from '@/Utils/GetApiHandler'
import { loadStudentPortalData, mergeStudentPortalUser } from '@/Utils/lmsApi_paths'

export function SsoCallback() {
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/(auth)/sso-callback' }) as Record<string, string | undefined>
  const { auth } = useAuthStore()

  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const token =
      searchParams?.token ||
      searchParams?.accessToken ||
      searchParams?.access_token ||
      searchParams?.id_token ||
      searchParams?.idToken ||
      urlParams.get('token') ||
      urlParams.get('accessToken') ||
      urlParams.get('access_token') ||
      urlParams.get('id_token') ||
      urlParams.get('idToken');

    if (!token) {
      setStatus('error')
      setErrorMessage('Missing SSO token parameter in URL. Please launch Experia directly from your University LMS.')
      return
    }

    const processSso = async () => {
      try {
        const studentDegreeAdmissionId =
          searchParams?.studentDegreeAdmissionId ||
          searchParams?.admissionId ||
          searchParams?.student_degree_admission_id ||
          urlParams.get('studentDegreeAdmissionId') ||
          urlParams.get('admissionId') ||
          urlParams.get('student_degree_admission_id');

        const studentId =
          searchParams?.studentId ||
          searchParams?.student_id ||
          searchParams?.studentID ||
          urlParams.get('studentId') ||
          urlParams.get('student_id') ||
          urlParams.get('studentID');

        const slug =
          searchParams?.slug ||
          urlParams.get('slug') ||
          getTenantSlug() ||
          'gtu';

        const apiOrigin = getApiOrigin()

        const res = await fetch(`${apiOrigin}/api/auth/sso-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-domain': window.location.host,
          },
          body: JSON.stringify({
            token,
            studentDegreeAdmissionId,
            studentId,
            slug,
          })
        })

        const data = await res.json()

        if (res.ok && data.success && data.accessToken) {
          auth.setAccessToken(data.accessToken)
          auth.setLmsToken?.(token)
          if (data.refreshToken) {
            auth.setRefreshToken?.(data.refreshToken)
          }
          if (data.student) auth.setUser(data.student)
          try {
            const portal = await loadStudentPortalData(studentId || data.student?.studentId)
            const merged = mergeStudentPortalUser(
              useAuthStore.getState().auth.user || data.student,
              portal,
            )
            auth.setUser(merged)
          } catch {
            try {
              const meData: any = await fetchAuthMe()
              if (meData?.user) {
                auth.setUser({
                  ...data.student,
                  ...meData.user,
                  userId: meData.user.id || meData.user.userId,
                  fullName: meData.user.fullName || meData.user.name,
                  exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
                })
              }
            } catch {
              if (data.student) auth.setUser(data.student)
            }
          }

          // Instantly replace window location to student dashboard to skip /sso-callback in browser history.
          // Clicking browser BACK will now go directly back to LMS portal.
          window.location.replace('/student/dashboard')
        } else {
          setStatus('error')
          setErrorMessage(data.message || 'LMS SSO authentication failed. Please try again.')
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
