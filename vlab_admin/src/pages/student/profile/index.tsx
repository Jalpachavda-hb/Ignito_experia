import React from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { Edit3 } from 'lucide-react';
import { dashboardData } from '@/pages/student/dashboard/data';

import { ProfileSummaryCard } from './components/profile-summary-card';
import { PersonalInfoCard } from './components/personal-info-card';
import { AcademicInfoCard } from './components/academic-info-card';
import { AccountInfoCard } from './components/account-info-card';
import { SecurityInfoCard } from './components/security-info-card';

export default function Profile() {
  const { student } = dashboardData;

  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">My Profile</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Edit3 className="h-4 w-4" /> Edit Profile
          </Button>
        </div>
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto">
          
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">My Profile</h1>
            <p className="text-slate-500 mt-1.5 max-w-2xl">
              View your personal, academic, and account information.
            </p>
          </div>
          
          <div className="space-y-6">
            
            {/* Top Header - Summary */}
            <div className="w-full">
              <ProfileSummaryCard student={student} />
            </div>

            {/* Bottom Grid - Detailed Information */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              <PersonalInfoCard student={student} />
              <AcademicInfoCard student={student} />
              <AccountInfoCard student={student} />
              <SecurityInfoCard student={student} />
            </div>

          </div>

        </div>
      </Main>
    </>
  );
}
