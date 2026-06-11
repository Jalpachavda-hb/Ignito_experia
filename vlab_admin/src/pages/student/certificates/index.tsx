
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { dashboardData } from '@/pages/student/dashboard/data';

import { CertificationOverview } from './components/certification-overview';
import { FeaturedCertificate } from './components/featured-certificate';
import { CertificateGallery } from './components/certificate-gallery';
import { AcademicMilestones } from './components/academic-milestones';
import { LabAchievements } from './components/lab-achievements';
import { DegreeProgress } from './components/degree-progress';
import { UpcomingCertificates } from './components/upcoming-certificates';
import { CertificateVerification } from './components/certificate-verification';
import { AchievementShowcase } from './components/achievement-showcase';

export default function Certificates() {
  return (
    <>
      <Header className="justify-between bg-white dark:bg-card border-b border-border/40 px-6 h-16 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dashboard</span>
            <span className="text-border">/</span>
            <span className="text-slate-900 dark:text-white font-semibold">Certificates</span>
          </div>
        </div>
      </Header>

      <Main className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-4rem)] pb-12">
        <div className="w-full p-4 sm:p-6 md:p-8 max-w-[1600px] mx-auto space-y-6">

          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Certificates & Achievements</h1>
            <p className="text-slate-500 mt-1.5 max-w-2xl">
              View, download, verify, and track all earned certificates, academic achievements, and program milestones.
            </p>
          </div>

          {/* Top Row: Overview Cards */}
          <CertificationOverview data={dashboardData} />

          {/* Second Row: Hero Section */}
          <FeaturedCertificate data={dashboardData} />

          {/* Third Row: Main Layout (3 columns) */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

            {/* Left Column (2 spans): Gallery & Progress */}
            <div className="xl:col-span-2 space-y-6">
              <DegreeProgress data={dashboardData} />
              <div className="bg-white dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <CertificateGallery data={dashboardData} />
              </div>
              <AchievementShowcase data={dashboardData} />
            </div>

            {/* Right Column (1 span): Sidebars */}
            <div className="space-y-6">
              <CertificateVerification />
              <UpcomingCertificates data={dashboardData} />
              <LabAchievements data={dashboardData} />
              <AcademicMilestones data={dashboardData} />
            
            </div>

          </div>

        </div>
      </Main>
    </>
  );
}
