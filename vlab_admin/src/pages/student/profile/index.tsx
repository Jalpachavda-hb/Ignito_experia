import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { dashboardData } from '@/pages/student/dashboard/data';
import { refreshStudentProfile } from '@/Utils/lmsApi_paths';
import { fetchAuthMe } from '@/Utils/GetApiHandler';
import { useAuthStore } from '@/stores/auth-store';

import { ProfileSummaryCard } from './components/profile-summary-card';
import { PersonalInfoCard } from './components/personal-info-card';
import { AcademicInfoCard } from './components/academic-info-card';
import { AccountInfoCard } from './components/account-info-card';
import { SecurityInfoCard } from './components/security-info-card';

export default function Profile() {
  const { student } = dashboardData;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  React.useEffect(() => {
    fetchAuthMe()
      .then((data: any) => {
        if (data?.user) {
          useAuthStore.getState().auth.setUser({
            ...data.user,
            userId: data.user.id || data.user.userId,
            fullName: data.user.fullName || data.user.name,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleRefreshProfile = async () => {
    try {
      setIsRefreshing(true);
      setRefreshSuccess(false);
      
      // 1. Invalidate Redis cache and fetch latest from LMS API
      await refreshStudentProfile();

      // 2. Fetch fresh user state and update AuthStore
      const data: any = await fetchAuthMe();
      if (data?.user) {
        useAuthStore.getState().auth.setUser({
          ...data.user,
          userId: data.user.id || data.user.userId,
          fullName: data.user.fullName || data.user.name,
          exp: Date.now() + 24 * 60 * 60 * 1000,
        });
      }

      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 4000);
    } catch (err: any) {
      console.error("Profile refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

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
          {refreshSuccess && (
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> LMS Profile Updated!
            </span>
          )}
          <Button 
            size="sm" 
            variant="outline"
            disabled={isRefreshing}
            onClick={handleRefreshProfile}
            className="gap-2 border-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground"
          >
            <RefreshCw className={`h-4 w-4 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing LMS Data...' : 'Refresh Profile from LMS'}
          </Button>
        </div>
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto">
          
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">My Profile</h1>
              <p className="text-slate-500 mt-1.5 max-w-2xl">
                View your personal, academic, and account information synced live with University LMS.
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            
            {/* Top Header - Summary */}
            <div className="w-full">
              <ProfileSummaryCard student={student} />
            </div>

            {/* Bottom Grid - Detailed Information */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
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
