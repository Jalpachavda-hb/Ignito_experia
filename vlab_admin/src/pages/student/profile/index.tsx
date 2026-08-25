import React, { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, ShieldCheck, Lock, KeyRound } from 'lucide-react';
import { dashboardData } from '@/pages/student/dashboard/data';
import { refreshStudentProfile } from '@/Utils/lmsApi_paths';
import { fetchAuthMe } from '@/Utils/GetApiHandler';
import { useAuthStore } from '@/stores/auth-store';

import { ProfileSummaryCard } from './components/profile-summary-card';
import { PersonalInfoCard } from './components/personal-info-card';
import { AcademicInfoCard } from './components/academic-info-card';
import { AccountInfoCard } from './components/account-info-card';
import { SecurityInfoCard } from './components/security-info-card';
import { ChangePasswordModal } from './components/change-password-modal';

export default function Profile() {
  const { student } = dashboardData;
  const { auth } = useAuthStore();
  const u: any = auth.user || {};
  const isDirectUser = Boolean(
    u.createdFrom === 'DIRECT' || 
    (u.authType === 'DIRECT' && !u.studentDegreeAdmissionId && !u.externalStudentId && u.createdFrom !== 'LMS')
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  React.useEffect(() => {
    fetchAuthMe()
      .then((data: any) => {
        if (data?.user) {
          useAuthStore.getState().auth.setUser({
            ...data.user,
            userId: data.user.id || data.user.userId,
            fullName: data.user.fullName || data.user.name,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
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
        
        {!isDirectUser && (
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
        )}
      </Header>
      
      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full px-4 md:px-6 xl:px-10 py-6 space-y-6 max-w-[1600px] mx-auto">
          
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">My Profile</h1>
              <p className="text-slate-500 mt-1.5 max-w-2xl">
                {isDirectUser 
                  ? 'View and manage your personal student profile information.'
                  : 'View your personal, academic, and account information synced live with University LMS.'
                }
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
              
              {isDirectUser ? (
                <Card className="border border-border/70 shadow-xs rounded-xl overflow-hidden bg-card flex flex-col justify-between">
                  <CardHeader className="py-4 px-6 border-b border-border/60">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Security & Account Password
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border border-border/50">
                      <div className="flex items-center gap-3">
                        <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Experia Direct Login Password</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Manage your direct portal credentials.</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Password Set
                      </Badge>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button 
                        onClick={() => setShowChangePasswordModal(true)} 
                        variant="default" 
                        size="sm" 
                        className="gap-2 text-xs"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Change Password
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <AcademicInfoCard student={student} />
                  <AccountInfoCard student={student} />
                  <SecurityInfoCard student={student} />
                </>
              )}
            </div>

          </div>

        </div>
      </Main>

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
      />
    </>
  );
}
