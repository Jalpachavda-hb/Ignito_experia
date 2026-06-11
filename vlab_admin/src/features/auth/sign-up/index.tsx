import { Link, useSearch } from '@tanstack/react-router'
import { Terminal, Cpu, Network, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SignUpForm } from './components/sign-up-form'

const TerminalLog = () => {
  const [lines, setLines] = useState<string[]>([])
  
  useEffect(() => {
    const logs = [
      "system@ignitolearn:~",
      "",
      "Initializing account setup...",
      "Creating workspace...",
      "Assigning permissions...",
      "SUCCESS: Ready to begin."
    ]
    
    let currentLine = 0
    const interval = setInterval(() => {
      if (currentLine < logs.length) {
        setLines(prev => [...prev, logs[currentLine]])
        currentLine++
      } else {
        clearInterval(interval)
      }
    }, 800)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="font-mono text-sm text-emerald-400 bg-black/80 p-6 rounded-xl border border-emerald-500/20 backdrop-blur-md h-52 overflow-y-auto w-[105%] -ml-[2.5%] shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:shadow-[0_0_40px_rgba(16,185,129,0.25)] transition-all duration-500 animate-[pulse_4s_ease-in-out_infinite]">
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="opacity-90 animate-in fade-in slide-in-from-bottom-1 whitespace-pre-wrap">{line}</div>
        ))}
        <div className="mt-2 animate-[pulse_1s_ease-in-out_infinite] w-2 h-4 bg-emerald-400"></div>
      </div>
    </div>
  )
}

export function SignUp() {
  const { redirect } = useSearch({ from: '/(auth)/sign-up' } as any)

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-slate-50 text-slate-900 selection:bg-red-600/30 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(https://i.pinimg.com/originals/96/d1/cc/96d1cc416bfc7a2a0a16feb235f1defa.jpg?nii=t)' }}
    >
      {/* Light Overlay to ensure text readability and maintain white theme */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-sm" />

      {/* Background Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-red-600/10 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full mix-blend-multiply filter blur-[100px]" />

      <div className="relative z-10 w-full max-w-[1200px] bg-white/80 backdrop-blur-2xl border border-slate-200/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left side - Tech Display */}
        <div className="lg:w-[48%] flex flex-col p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/40 justify-center">
          <div className="space-y-8 max-w-md mx-auto">
            
            <div className="flex items-center">
              <img src="/images/logo.png" alt="IgnitoLearn" className="h-10 sm:h-12 w-auto object-contain" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-slate-900">
                Start Your <br />
                <span className="text-[#dc2626]">Virtual Lab Journey</span>
              </h1>
              <p className="text-sm text-slate-600 font-medium">
                Create your account to access cloud-based virtual labs, programming environments, and hands-on technical learning.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Access Virtual Labs",
                "Complete Practical Assignments",
                "Track Academic Progress",
                "Earn Certificates",
                "Manage Lab Credits",
                "Monitor Semester Progress"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3 text-slate-800">
                  <div className="p-1 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-[#dc2626]" />
                  </div>
                  <span className="text-xs font-semibold">{feature}</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <TerminalLog />
            </div>

          </div>
        </div>

        {/* Right side - Create Account Form */}
        <div className="lg:w-[52%] flex flex-col justify-center bg-slate-50/50 relative overflow-y-auto max-h-[90vh]">
          <div className="mx-auto w-full max-w-[500px] p-8 md:p-10">
            
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center mb-6">
              <img src="/images/logo.png" alt="IgnitoLearn" className="h-10 w-auto object-contain" />
            </div>

            <div className="flex flex-col space-y-1.5 text-center lg:text-left mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Your Student Account</h2>
              <p className="text-sm text-slate-500 font-medium">
                Join Ignito Experia Virtual Labs Platform
              </p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <SignUpForm redirectTo={redirect} />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
