import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, ArrowRight } from 'lucide-react'
import { CreditWallet, StudentProfile } from '../types'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { useNavigate } from '@tanstack/react-router'

export function WelcomeBanner({
  student,
  wallet,
}: {
  student: StudentProfile,
  wallet: CreditWallet,
}) {
  const { auth } = useAuthStore()
  const navigate = useNavigate()

  return (
    <Card className="bg-white dark:bg-card overflow-hidden shadow-sm border-0 border-l-[6px] border-l-red-600 relative rounded-xl h-full min-h-[200px] sm:min-h-[220px]">
      
      {/* Background illustration: completely removed on small screens (< lg), visible on large screens */}
      <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[42%] xl:w-[38%] pointer-events-none overflow-hidden select-none z-0">
        {/* Mask to smoothly fade the left edge into the card background */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/70 to-transparent dark:from-card dark:via-card/70 z-10 pointer-events-none" />
        <img 
          src="/images/vlabdashbord_student.png" 
          alt="Ignito Experia" 
          className="w-full h-full object-cover object-left pointer-events-none"
        />
      </div>
      
      <CardContent className="p-5 sm:p-6 md:p-8 relative z-20 flex h-full items-center">
        <div className="flex flex-col justify-center space-y-4 sm:space-y-5 flex-1 w-full lg:max-w-[58%] xl:max-w-[62%]">
          
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2 break-words">
              {auth.user?.fullName || auth.user?.name || student.name}
            </h1>
            {auth.user?.programmesList && auth.user.programmesList.length > 0 ? (
              <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 space-y-1">
                {auth.user.programmesList.map((prog, idx) => (
                  <p key={idx} className="break-words">
                    {prog.programmeName || prog.programName}
                    {prog.currentSemester != null && prog.currentSemester !== '' ? (
                      <span> • Semester {prog.currentSemester}</span>
                    ) : null}
                  </p>
                ))}
              </div>
            ) : auth.user?.programName ? (
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 break-words">
                {auth.user.programName} {auth.user.currentSemester ? `• Semester ${auth.user.currentSemester}` : ''}
              </p>
            ) : null}

            {auth.user?.collegeName || auth.user?.tenantName || auth.user?.organization ? (
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                {auth.user?.collegeName || auth.user?.tenantName || auth.user?.organization}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
            <Button 
              onClick={() => navigate({ to: '/student/my-labs' })}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 sm:px-6 h-10 font-semibold shadow-sm transition-all flex items-center justify-center"
            >
              View My Labs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: '/student/credit-wallet' })}
              className="rounded-lg px-5 sm:px-6 h-10 font-semibold border-border/70 hover:bg-slate-100 dark:hover:bg-slate-800 bg-white/90 dark:bg-card/90 backdrop-blur-sm transition-all flex items-center justify-center text-foreground"
            >
              <Wallet className="mr-2 h-4 w-4 text-muted-foreground" />
              Token Wallet
            </Button>
          </div>
            
        </div>
      </CardContent>
    </Card>
  )
}
