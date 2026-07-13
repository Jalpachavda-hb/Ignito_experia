import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Upload, Smartphone, Cpu, 
  RefreshCw, Power, ArrowLeft, 
  Terminal as TerminalIcon, FileText
} from 'lucide-react';

interface AndroidEmulatorProps {
  session: any;
  onStopLab: () => void;
  onBack: () => void;
  remainingTime?: string | null;
}

export default function AndroidEmulator({ session, onStopLab, onBack, remainingTime }: AndroidEmulatorProps) {
  const [booting, setBooting] = useState(true);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    'Device Selected: Pixel 8 Pro v14.0',
    'Connecting to real device cloud...',
  ]);
  const [bootPhase, setBootPhase] = useState(0);
  const [installedApk, setInstalledApk] = useState<string | null>(null);
  const [appState, setAppState] = useState<'home' | 'installing' | 'running'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Lifecycle Counter for mockup app
  const [lifecycleLogs, setLifecycleLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Todo app state
  const [todos, setTodos] = useState<{ id: number; text: string; done: boolean }[]>([
    { id: 1, text: 'Test user registration API', done: true },
    { id: 2, text: 'Validate database indexing', done: false },
    { id: 3, text: 'Verify memory leak on lifecycle change', done: false },
  ]);
  const [newTodo, setNewTodo] = useState('');

  // Calculator state
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcHistory, setCalcHistory] = useState('');

  // Booting Phase logs
  useEffect(() => {
    if (!booting) return;

    const bootSteps = [
      { delay: 1000, log: 'Initializing secure ADB tunnel over AWS Systems Manager (SSM)...' },
      { delay: 2200, log: 'Establishing link with Virtual AVD Instance (AVD_Pixel_8_Pro)...' },
      { delay: 3500, log: 'System boot signal received. Launching Android OS runtime...' },
      { delay: 4800, log: 'Mounting virtual file system (/data/app & /sdcard)...' },
      { delay: 5800, log: 'Starting system server & Zygote process...' },
      { delay: 6500, log: 'Android system successfully booted. Ready for ADB commands.' },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];

    bootSteps.forEach((step, idx) => {
      const t = setTimeout(() => {
        setLogs(prev => [...prev, step.log]);
        setBootPhase(idx + 1);
        if (idx === bootSteps.length - 1) {
          setTimeout(() => {
            setBooting(false);
            setLogs(prev => [...prev, 'Starting device Pixel 8 Pro v14.0']);
          }, 800);
        }
      }, step.delay);
      timers.push(t);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerApkInstallation(file.name);
    }
  };

  const triggerApkInstallation = (fileName: string) => {
    setAppState('installing');
    setInstalledApk(fileName);
    addLog(`Received local file: ${fileName}`);
    addLog(`Uploading APK to device storage...`);

    setTimeout(() => {
      addLog(`Installing package ${fileName}...`);
      setTimeout(() => {
        addLog(`Successfully installed app on Pixel 8 Pro v14.0`);
        addLog(`Starting app on Pixel 8 Pro v14.0`);
        setAppState('running');
        setLifecycleLogs([
          'onCreate() called',
          'onStart() called',
          'onResume() called - Activity is active'
        ]);
      }, 1500);
    }, 1200);
  };

  // Calculator button press simulation
  const handleCalcBtn = (val: string) => {
    addLog(`[ADB INPUT] Click event at coordinates (calc_btn_${val})`);
    if (val === 'C') {
      setCalcDisplay('0');
      setCalcHistory('');
    } else if (val === '=') {
      try {
        // Safe evaluation
        const clean = calcDisplay.replace(/x/g, '*').replace(/÷/g, '/');
        const res = Function(`"use strict"; return (${clean})`)();
        setCalcHistory(calcDisplay + ' =');
        setCalcDisplay(String(res));
        addLog(`[App Console] Calculation success: ${calcDisplay} = ${res}`);
      } catch (err) {
        setCalcDisplay('Error');
        addLog(`[App Console] Calculation error`);
      }
    } else {
      setCalcDisplay(prev => (prev === '0' || prev === 'Error' ? val : prev + val));
    }
  };

  // Todo events
  const handleAddTodo = () => {
    if (!newTodo.trim()) return;
    const item = { id: Date.now(), text: newTodo, done: false };
    setTodos(prev => [...prev, item]);
    setNewTodo('');
    addLog(`[ADB INPUT] Text input submitted: "${item.text}"`);
    addLog(`[App Console] Added new TODO item ID: ${item.id}`);
  };

  const handleToggleTodo = (id: number, text: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    addLog(`[ADB INPUT] Checkbox toggled for item: "${text}"`);
  };

  // App Lifecycle testers
  const triggerLifecycle = (action: 'pause' | 'resume' | 'destroy') => {
    if (action === 'pause') {
      setLifecycleLogs(prev => [...prev, 'onPause() called - App backgrounded', 'onStop() called']);
      addLog('[ADB COMMAND] am force-stop / background activity');
    } else if (action === 'resume') {
      setLifecycleLogs(prev => [...prev, 'onRestart() called', 'onStart() called', 'onResume() called']);
      addLog('[ADB COMMAND] am start -n activity');
    } else if (action === 'destroy') {
      setLifecycleLogs(prev => [...prev, 'onDestroy() called - process killed']);
      addLog('[ADB COMMAND] kill-server / destroy process');
      setAppState('home');
      setInstalledApk(null);
    }
  };

  // Render App Contents depending on filename
  const renderAppContent = () => {
    const fileLower = (installedApk || '').toLowerCase();

    if (fileLower.includes('calc')) {
      return (
        <div className="flex flex-col h-full bg-[#17171c] text-white p-4 font-sans select-none">
          <div className="flex-1 flex flex-col justify-end items-end pb-4 border-b border-white/5 min-h-0">
            <span className="text-white/40 text-sm font-medium tracking-wide mb-1 h-6">{calcHistory}</span>
            <span className="text-3xl font-bold truncate w-full text-right">{calcDisplay}</span>
          </div>
          <div className="grid grid-cols-4 gap-3 pt-4 select-none">
            {['C', '(', ')', '÷', '7', '8', '9', 'x', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '(', '='].map((btn) => (
              <button 
                key={btn}
                onClick={() => handleCalcBtn(btn)}
                className={`h-12 rounded-full font-bold text-base flex items-center justify-center transition-all ${
                  btn === '=' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : ['÷', 'x', '-', '+'].includes(btn)
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (fileLower.includes('todo') || fileLower.includes('task')) {
      return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 font-sans">
          <h4 className="text-lg font-black tracking-tight mb-3 text-red-600 dark:text-red-500">Tasks Checklist</h4>
          
          <div className="flex-1 overflow-y-auto mb-3 space-y-2 pr-1">
            {todos.map(todo => (
              <div 
                key={todo.id} 
                onClick={() => handleToggleTodo(todo.id, todo.text)}
                className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  checked={todo.done} 
                  readOnly 
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                />
                <span className={`text-sm font-medium ${todo.done ? 'line-through text-slate-400' : ''}`}>{todo.text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="New task description..." 
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-red-500 focus:border-red-500"
            />
            <Button onClick={handleAddTodo} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-9 px-3 shrink-0">Add</Button>
          </div>
        </div>
      );
    }

    // Default Lifecycle Example View (Matches User's Screenshots)
    return (
      <div className="flex flex-col h-full bg-white text-slate-800 p-4 font-sans select-none">
        <div className="h-10 bg-slate-900 text-white px-3 flex items-center justify-between shrink-0 rounded-lg mb-4">
          <span className="text-xs font-black tracking-wide">Lifecycle Example</span>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50 min-h-0 overflow-y-auto">
          <FileText className="h-8 w-8 text-red-500 mb-2 opacity-80" />
          <h4 className="text-sm font-bold text-slate-900 mb-1">{installedApk}</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mb-4">
            Android Lifecycle Lab - edit MainActivity.java, then Run build.sh to compile.
          </p>

          <div className="w-full space-y-1.5 text-left bg-slate-950 text-emerald-400 p-2.5 rounded-lg font-mono text-[9px] select-text">
            <p className="text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-1 mb-1">Lifecycle Callbacks</p>
            {lifecycleLogs.map((ll, i) => (
              <p key={i} className="truncate">{ll}</p>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4 shrink-0">
          <button 
            onClick={() => triggerLifecycle('pause')} 
            className="py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            Pause
          </button>
          <button 
            onClick={() => triggerLifecycle('resume')} 
            className="py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
          >
            Resume
          </button>
          <button 
            onClick={() => triggerLifecycle('destroy')} 
            className="py-2 text-[10px] uppercase font-bold tracking-wider rounded-lg bg-slate-800 hover:bg-slate-900 text-white transition-colors"
          >
            Uninstall
          </button>
        </div>
      </div>
    );
  };

  const filteredLogs = logs.filter(log => 
    log.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-[#0c0c0c] text-white overflow-hidden select-none h-full w-full">
      {/* Top Navbar */}
      <div className="absolute top-0 inset-x-0 h-14 bg-[#141414] border-b border-white/5 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-red-600/10 p-2 rounded-xl border border-red-500/20 text-red-500">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-100">Android Testing Lab</h1>
            <p className="text-[10px] text-slate-500 font-mono">Session ID: {session?.sessionId || 'N/A'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {remainingTime && (
            <div className="text-red-500 font-mono text-[10px] font-black bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded animate-pulse shrink-0">
              TIME REMAINING: {remainingTime}
            </div>
          )}
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#222] hover:bg-[#333] border border-white/10 text-white text-[11px] font-black uppercase tracking-wider transition-all"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
          <button 
            onClick={onStopLab}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all"
          >
            <Power size={14} /> Stop Device
          </button>
        </div>
      </div>

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col md:flex-row mt-14 overflow-hidden relative">
        
        {/* Left Side: Emulator Phone UI */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#181818] relative overflow-hidden">
          {/* Background grid pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />

          {booting ? (
            /* Interactive Booting Screen (Second Screenshot reference) */
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-[310px] h-[630px] rounded-[52px] bg-slate-950 p-[12px] border-[6px] border-zinc-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-8 flex justify-center items-center z-30">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-slate-900" />
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center bg-[#0c0c0c] relative">
                  {/* Google style boot dots */}
                  <div className="flex gap-3 items-center justify-center mb-6">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 animate-bounce" />
                    <div className="w-3.5 h-3.5 rounded-full bg-red-500 animate-bounce [animation-delay:0.15s]" />
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono select-none animate-pulse">
                    Booting virtual OS...
                  </span>
                </div>

                <div className="absolute bottom-6 inset-x-0 flex justify-center z-30">
                  <div className="w-32 h-1 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            /* Booted Device View */
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-[310px] h-[630px] rounded-[52px] bg-slate-950 p-[12px] border-[6px] border-[#222] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden">
                {/* Punch hole camera notch */}
                <div className="absolute top-0 inset-x-0 h-8 flex justify-center items-center z-30 pointer-events-none">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-zinc-900" />
                </div>

                {/* Status Bar */}
                <div className="h-6 bg-[#0c0c0c] text-white/90 text-[10px] font-bold flex justify-between items-center px-6 shrink-0 select-none z-30">
                  <span>11:36</span>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c3.9 3.51 9.9 3.21 13.41-.7l1.79 1.79c1.54-1.23 2.28-3.18 2.28-5.61-.01-4.97-4.04-9-9.01-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
                  </div>
                </div>

                {/* Device Screen Body */}
                <div className="flex-1 bg-[#0c0c0c] rounded-[40px] overflow-hidden relative border border-white/5 z-20">
                  {appState === 'home' && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-950">
                      <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 animate-pulse">
                        <Upload className="h-7 w-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-100 mb-1.5 uppercase tracking-wide">Install Application</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed max-w-[200px] mb-5">
                        Please upload or drop an APK package file here to run and test it on the mobile simulator.
                      </p>
                      <Button 
                        onClick={handleFileUploadClick}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs px-4 h-9 shadow-md shadow-red-600/10 font-semibold"
                      >
                        Choose APK
                      </Button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        accept=".apk" 
                        className="hidden" 
                      />
                    </div>
                  )}

                  {appState === 'installing' && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950">
                      <RefreshCw className="h-10 w-10 text-red-500 animate-spin mb-4" />
                      <h4 className="text-sm font-bold text-slate-200 mb-1 uppercase tracking-wide">Installing APK</h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                        {installedApk}
                      </p>
                    </div>
                  )}

                  {appState === 'running' && renderAppContent()}
                </div>

                {/* Home navigation bar */}
                <div className="absolute bottom-3 inset-x-0 flex justify-center z-30 pointer-events-none">
                  <div 
                    onClick={() => {
                      if (appState === 'running') {
                        addLog('[ADB INPUT] Home button pressed');
                        setAppState('home');
                        setInstalledApk(null);
                      }
                    }}
                    className="w-24 h-1 bg-white/40 rounded-full cursor-pointer hover:bg-white/80 transition-all pointer-events-auto" 
                  />
                </div>
              </div>
              
              {/* USB Cable Mock */}
              <div className="w-5 h-16 bg-zinc-800 border-x border-zinc-700 shadow-md relative mt-[-2px] flex items-center justify-center rounded-b-lg">
                <div className="w-1.5 h-full bg-zinc-950 border-x border-zinc-900" />
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Logs & Control Console */}
        <div className="w-full md:w-[420px] lg:w-[480px] border-t md:border-t-0 md:border-l border-white/5 bg-[#141414] flex flex-col shrink-0 overflow-hidden relative">
          

          {/* ADB Log Console */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="h-10 px-4 bg-[#1a1a1a] border-b border-white/5 flex items-center justify-between shrink-0 select-none">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TerminalIcon className="h-3.5 w-3.5 text-red-500" /> ADB Console Log
              </span>
              
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Filter logs..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-white/5 rounded-lg px-2 py-0.5 text-[9px] font-mono w-32 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <button 
                  onClick={() => setLogs(['Device Selected: Pixel 8 Pro v14.0', 'Connecting to real device cloud'])}
                  className="text-[9px] font-bold uppercase tracking-wider hover:text-white text-slate-500 border border-white/5 px-2 py-0.5 rounded"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-[10px] leading-relaxed text-slate-300 space-y-1.5 select-text">
              {booting && (
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider animate-pulse">STARTING SESSION...</span>
                  <button 
                    onClick={onBack}
                    className="text-[9px] font-black uppercase border border-red-500/20 hover:bg-red-500/10 text-red-500 px-2 py-0.5 rounded transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
              
              {filteredLogs.map((log, index) => {
                let colorClass = 'text-slate-300';
                if (log.includes('Successfully') || log.includes('success') || log.includes('READY')) {
                  colorClass = 'text-emerald-400 font-semibold';
                } else if (log.includes('Error') || log.includes('failed') || log.includes('W/')) {
                  colorClass = 'text-amber-400';
                } else if (log.includes('Device Selected') || log.includes('Connecting')) {
                  colorClass = 'text-sky-400 font-medium';
                } else if (log.includes('[ADB INPUT]') || log.includes('[ADB COMMAND]')) {
                  colorClass = 'text-red-400 font-semibold';
                }
                return (
                  <p key={index} className={`${colorClass} break-all`}>
                    {log}
                  </p>
                );
              })}
              <div ref={logEndRef} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
