import { Link, useSearch } from '@tanstack/react-router'
import { UserAuthForm } from './components/user-auth-form'
import { Terminal, Cpu, Network, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

const TerminalLog = () => {
  const [lines, setLines] = useState<string[]>([])
  
  useEffect(() => {
    const logs = [
      "Initializing IgnitoLearn Core v4.2.0...",
      "Connecting to master cluster [us-east-1]...",
      "SUCCESS: Cluster connection established.",
      "Loading virtual environment templates...",
      " - Kali Linux (Security)",
      " - Ubuntu 22.04 (Development)",
      " - Windows Server 2022 (Active Directory)",
      "Checking node availability... 42 nodes online.",
      "Awaiting administrator authentication..."
    ]
    
    let currentLine = 0
    const interval = setInterval(() => {
      if (currentLine < logs.length) {
        setLines(prev => [...prev, logs[currentLine]])
        currentLine++
      } else {
        clearInterval(interval)
      }
    }, 600)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="font-mono text-sm text-emerald-400 bg-black/80 p-6 rounded-xl border border-emerald-500/20 backdrop-blur-md h-64 overflow-y-auto w-full shadow-[0_0_30px_rgba(16,185,129,0.15)]">
      <div className="flex items-center gap-2 mb-4 text-emerald-500 border-b border-emerald-500/20 pb-3">
        <Terminal className="h-4 w-4" />
        <span className="font-semibold">system@ignito-master:~</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="opacity-90 animate-in fade-in slide-in-from-bottom-1">{line}</div>
        ))}
        <div className="mt-2 animate-pulse w-2 h-4 bg-emerald-400"></div>
      </div>
    </div>
  )
}

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-slate-50 text-slate-900 selection:bg-primary/30 relative overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: 'url(https://i.pinimg.com/originals/96/d1/cc/96d1cc416bfc7a2a0a16feb235f1defa.jpg?nii=t)' }}
    >
      {/* Light Overlay to ensure text readability and maintain white theme */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-sm" />

      {/* Background Tech Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      
      {/* Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/10 rounded-full mix-blend-multiply filter blur-[100px]" />

      <div className="relative z-10 w-full max-w-[1100px] bg-white/80 backdrop-blur-2xl border border-slate-200/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col lg:flex-row">
        
        {/* Left side - Tech Display */}
        <div className="lg:w-[55%] flex flex-col justify-center p-8 md:p-12 border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/40">
          <div className="space-y-10">
            
            <div className="flex items-center">
              <img src="/images/logo.png" alt="IgnitoLearn" className="h-10 sm:h-12 w-auto object-contain" />
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-slate-900">
                Virtual Labs for the <br />
                <span className="text-primary">Next Generation</span>
              </h1>
              <p className="text-base text-slate-600 font-medium">
                Deploy, monitor, and scale complex technical environments instantly. Secure sandboxes for cybersecurity, networking, and cloud computing.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <Network className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-semibold">Isolated VPC Networks</span>
              </div>
              <div className="flex items-center gap-3 text-slate-800">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-sm font-semibold">Zero-Trust Sandboxing</span>
              </div>
            </div>

            <div className="pt-2">
              <TerminalLog />
            </div>
            
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="lg:w-[45%] flex flex-col justify-center p-8 md:p-12 bg-slate-50/50 relative">
          <div className="mx-auto w-full max-w-[360px]">
            
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center mb-8">
              <img src="/images/logo.png" alt="IgnitoLearn" className="h-10 w-auto object-contain" />
            </div>

            <div className="flex flex-col space-y-2 text-center lg:text-left mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin Authentication</h2>
              <p className="text-sm text-slate-500 font-medium">
                Secure login to manage virtual environments.
              </p>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <UserAuthForm redirectTo={redirect} />
            </div>
            
            <div className="mt-8 text-center text-sm text-slate-500 font-medium">
              Don't have an account?{' '}
              <Link to="/sign-up" className="font-bold text-primary hover:text-primary/80 transition-colors">
                Request Access
              </Link>
            </div>
            
            <p className="text-center text-xs text-slate-400 font-medium mt-8">
              Secured by Ignito Enterprise &middot; <Link to="/privacy" className="hover:text-slate-600 transition-colors">Privacy Policy</Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  )
}
