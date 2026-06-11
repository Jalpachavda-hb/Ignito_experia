import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, ArrowRight } from 'lucide-react'
import { CreditWallet, StudentProfile } from '../types'
import { Button } from '@/components/ui/button'

export function WelcomeBanner({
  student,
  wallet,
}: {
  student: StudentProfile,
  wallet: CreditWallet,
}) {
  return (
    <Card className="bg-white dark:bg-card overflow-hidden shadow-sm border-0 border-l-[6px] border-l-red-600 relative rounded-xl h-full min-h-[220px]">
      
      {/* Background image cropped to the right side using CSS */}
      <div className="absolute right-0 top-0 bottom-0 w-[60%] md:w-[50%] hidden sm:block z-0">
        {/* Mask to fade the left edge of the image smoothly into the white background */}
        <div className="absolute  from-white via-white/50 to-transparent z-10 pointer-events-none" />
        <img 
          src="/images/vlabdashbord_student.png" 
          alt="Illustration" 
          className="w-full h-full object-cover object-right pointer-events-none"
        />
      </div>
      
      <CardContent className="p-6 md:p-8 relative z-20 flex h-full">
        <div className="flex flex-col justify-center space-y-5 flex-1 max-w-[60%]">
          
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-1">
              Good Morning <span>👋</span>
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-2">
              {student.name}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {student.program.name} <span className="mx-1">•</span> Semester {student.program.currentSemester}
            </p>
            <p className="text-sm text-muted-foreground">
              {student.collegeName}
            </p>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <Button className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6">
              View My Labs <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-lg px-6 border-border/60 hover:bg-white hover:text-foreground bg-white/80 backdrop-blur-sm">
              <Wallet className="mr-2 h-4 w-4 text-muted-foreground" />
              Credit Wallet
            </Button>
          </div>
            
        </div>
      </CardContent>
    </Card>
  )
}
