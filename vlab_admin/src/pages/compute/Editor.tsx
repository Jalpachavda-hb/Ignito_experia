import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import { fetchFileContent, fetchFiles, runFile, saveFile, deleteFile, renamePath, startAndroidBuild, fetchAndroidBuildStatus } from '../../services/ideService';
import {
  File, Code2, Plus, Upload, Play, Save,
  Trash2, X, FileJson, FileText, ChevronRight, ChevronDown, ChevronUp, Download, ArrowLeft, Power, MonitorPlay, Database, Terminal as TerminalIcon,
  Folder, FolderOpen, RotateCw, RotateCcw, Globe, Pencil, Copy, Check, CheckCircle2, XCircle, Coins, Clock, Sparkles, ExternalLink, MoreVertical, LineChart, Maximize2, Minimize2
} from 'lucide-react';
import { useLabStore } from '@/stores/labStore';
import { useAuthStore } from '@/stores/auth-store';
import { useLabTokenStore } from '@/stores/labTokenStore';
import { useLabSessionStore } from '@/stores/labSessionStore';
import { resolveApiRelativeUrl } from '@/config/env';
import { TestingWorkspace } from './TestingWorkspace';
import { SeleniumExecutionDialog } from '@/components/SeleniumExecutionDialog';

export const PythonIcon = ({ className = "w-4 h-4 shrink-0" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 110 110" fill="none">
    <path d="M54.5 5C27.2 5 28.9 16.8 28.9 16.8L28.9 29.1L55.5 29.1L55.5 32.8L18.3 32.8C18.3 32.8 5 31.3 5 58.6C5 85.9 16.7 84.4 16.7 84.4L23.7 84.4L23.7 74.2C23.7 74.2 23.3 62 35.8 62L62.4 62C62.4 62 74.2 62.4 74.2 50.8L74.2 16.8C74.2 16.8 75.4 5 54.5 5ZM40.1 13.9C43.2 13.9 45.7 16.4 45.7 19.5C45.7 22.6 43.2 25.1 40.1 25.1C37 25.1 34.5 22.6 34.5 19.5C34.5 16.4 37 13.9 40.1 13.9Z" fill="#387EB8"/>
    <path d="M55.5 105C82.8 105 81.1 93.2 81.1 93.2L81.1 80.9L54.5 80.9L54.5 77.2L91.7 77.2C91.7 77.2 105 78.7 105 51.4C105 24.1 93.3 25.6 93.3 25.6L86.3 25.6L86.3 35.8C86.3 35.8 86.7 48 74.2 48L47.6 48C47.6 48 35.8 47.6 35.8 59.2L35.8 93.2C35.8 93.2 34.6 105 55.5 105ZM69.9 96.1C66.8 96.1 64.3 93.6 64.3 90.5C64.3 87.4 66.8 84.9 69.9 84.9C73 84.9 75.5 87.4 75.5 90.5C75.5 93.6 73 96.1 69.9 96.1Z" fill="#FFE052"/>
  </svg>
);

export const CsvIcon = ({ className = "w-4 h-4 shrink-0" }: { className?: string }) => (
  <div className={`${className} rounded bg-emerald-600 flex items-center justify-center text-[10px] font-black text-white`}>
    #
  </div>
);

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': case 'ipynb': return <PythonIcon className="w-4 h-4 shrink-0" />;
    case 'csv': return <CsvIcon className="w-4 h-4 shrink-0" />;
    case 'txt': case 'md': case 'log': return <FileText className="text-slate-400 w-4 h-4 shrink-0" />;
    case 'js': case 'jsx': return <Code2 className="text-[#F7DF1E] w-4 h-4 shrink-0" />;
    case 'html': return <Code2 className="text-orange-500 w-4 h-4 shrink-0" />;
    case 'css': return <Code2 className="text-blue-400 w-4 h-4 shrink-0" />;
    case 'java': return <Code2 className="text-[#007396] w-4 h-4 shrink-0" />;
    case 'cs': return <Code2 className="text-[#68217A] w-4 h-4 shrink-0" />;
    case 'cshtml': return <Code2 className="text-[#512BD4] w-4 h-4 shrink-0" />;
    case 'json': return <FileJson className="text-amber-500 w-4 h-4 shrink-0" />;
    case 'xml': return <Code2 className="text-orange-400 w-4 h-4 shrink-0" />;
    case 'gradle': return <Code2 className="text-[#8F56E3] w-4 h-4 shrink-0" />;
    case 'properties': return <FileText className="text-sky-500 w-4 h-4 shrink-0" />;
    case 'sh': return <TerminalIcon className="text-emerald-500 w-4 h-4 shrink-0" />;
    case 'parquet': case 'avro': case 'orc': return <Database className="text-emerald-700 w-4 h-4 shrink-0" />;
    default: return <File className="text-slate-400 w-4 h-4 shrink-0" />;
  }
};

const detectLanguage = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'py') return 'python';
  if (ext === 'java') return 'java';
  if (ext === 'cs') return 'csharp';
  if (ext === 'cshtml') return 'razor';
  if (ext === 'razor') return 'razor';
  if (ext === 'html') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'csproj') return 'xml';
  if (ext === 'html') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (ext === 'ipynb') return 'python';
  if (ext === 'gradle') return 'groovy';
  if (ext === 'properties') return 'properties';
  if (ext === 'sh') return 'shell';
  if (ext === 'xml') return 'xml';
  return 'text';
};

const getLabExtensionRules = (labName: string, labId: string) => {
  const name = (labName || '').toLowerCase();
  const id = (labId || '').toLowerCase();

  if (name.includes('agile') || id.includes('agile')) {
    return {
      courseName: 'Agile Methodology',
      extensions: ['java']
    };
  }
  if (
    name.includes('big data') ||
    id.includes('big-data') ||
    name.includes('analytics') ||
    id.includes('analytics') ||
    name.includes('hadoop') ||
    id.includes('hadoop')
  ) {
    return {
      courseName: 'Big Data Analytics-I',
      extensions: ['py', 'java', 'csv', 'txt', 'jar', 'xml', 'sh', 'json', 'log', 'parquet', 'avro', 'orc']
    };
  }
  if (name.includes('mobile') || id.includes('mobile') || id.includes('android')) {
    return {
      courseName: 'Fundamental of Mobile',
      extensions: ['java', 'kt', 'xml', 'gradle', 'properties', "sh", "json", "png", "jpg", "jpeg", "pro"]
    };
  }
  if (name.includes('java') || id.includes('java')) {
    return {
      courseName: 'Java Development Lab',
      extensions: ['java']
    };
  }
  if (name.includes('python') || id.includes('python')) {
    return {
      courseName: 'Python Programming Lab',
      extensions: ['py']
    };
  }
  if (name.includes('.net') || id.includes('dotnet') || name.includes('csharp') || id.includes('csharp')) {
    return {
      courseName: 'Web Technology Using .NET',
      extensions: ['cs', 'cshtml', 'razor', 'json', 'xml', 'csproj', 'sln', 'css', 'js', 'html', 'txt', 'config', 'props']
    };
  }
  return {
    courseName: labName || 'this Lab',
    extensions: ['py', 'java', 'js', 'jsx', 'html', 'css', 'json', 'md', 'csv', 'txt', 'log', 'xml', 'parquet', 'avro', 'orc', 'sh', 'jar']
  };
};

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  fileIndex?: number;
}

const buildFileTree = (filesList: any[]) => {
  const root: TreeNode = { name: 'Root', path: '', type: 'folder', children: [] };

  filesList.forEach((file, index) => {
    const cleanPath = file.path.replace(/^\/+/, '');
    const parts = cleanPath.split('/');

    let current = root;
    parts.forEach((part: string, partIdx: number) => {
      const isLast = partIdx === parts.length - 1;
      let child = current.children?.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: '/' + parts.slice(0, partIdx + 1).join('/'),
          type: isLast ? 'file' : 'folder',
          children: isLast ? undefined : [],
          fileIndex: isLast ? index : undefined
        };
        current.children?.push(child);
      }
      if (!isLast) {
        current = child;
      }
    });
  });

  const sortTree = (node: TreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    }
  };
  sortTree(root);
  return root.children || [];
};

const PYTHON_STARTER = `# Welcome to Python Lab
# Write your Python code here

def greet(name):
    print(f"Hello, {name}!")

# Take user input
name = input("Enter your name: ")
greet(name)

print("Program completed!")
`;

const DOTNET_CONSOLE_STARTER = `using System;

class Program
{
    static void Main()
    {
        // Write your code here
    }
}
`;

const needsConsoleInput = (code: string) =>
  /Console\.ReadLine\s*\(/.test(code) ||
  /Console\.Read\s*\(/.test(code) ||
  /input\s*\(/.test(code) ||
  /Scanner\b/.test(code) ||
  /\.next(Int|Line|Double|Float|Long|Short|Byte|Boolean)?\s*\(/.test(code) ||
  /System\.in/.test(code) ||
  /BufferedReader\b/.test(code);

const countConsoleReads = (code: string) => {
  const readLine = (code.match(/Console\.ReadLine\s*\(/g) || []).length;
  const readChar = (code.match(/Console\.Read\s*\(/g) || []).length;
  const pyInput = (code.match(/input\s*\(/g) || []).length;
  const javaScanner = (code.match(/\.next(Int|Line|Double|Float|Long|Short|Byte|Boolean)?\s*\(/g) || []).length;
  return readLine + readChar + pyInput + javaScanner;
};

const extractConsoleOutput = (raw: string) => {
  const marker = '--- PROGRAM OUTPUT ---';
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    return raw.replace(/\r?\nRUN_EXIT:\d+\s*$/i, '').replace(/^[\r\n]+/, '').trimEnd();
  }
  const body = raw.slice(idx + marker.length);
  const end = body.search(/\r?\nRUN_EXIT:/i);
  return (end === -1 ? body : body.slice(0, end)).replace(/^[\r\n]+/, '').trimEnd();
};

const isDotnetMvcPath = (filePath: string, content?: string) => {
  const normalized = (filePath || '').replace(/^\/workspace\//, '').toLowerCase();
  const name = normalized.split('/').pop() || '';
  const code = content || '';
  if (name === 'program.cs') {
    return (
      code.includes('WebApplication.CreateBuilder') ||
      code.includes('AddControllersWithViews') ||
      code.includes('MapControllerRoute') ||
      code.includes('MapControllers')
    );
  }
  return (
    normalized.endsWith('.cshtml') ||
    normalized.endsWith('.html') ||
    name === 'homecontroller.cs' ||
    name === 'apicontroller.cs' ||
    normalized.includes('/controllers/') ||
    normalized.includes('/views/')
  );
};

const normalizeDotnetUploadName = (fileName: string) => {
  const lower = fileName.toLowerCase();
  if (lower === 'index.html') return 'Index.cshtml';
  if (lower.endsWith('.html')) return fileName.replace(/\.html$/i, '.cshtml');
  return fileName;
};

type ConsoleSessionState = {
  active: boolean;
  code: string;
  output: string;
  stdinLines: string[];
  isRunning: boolean;
  success: boolean;
  error: string | null;
};

const ConsoleInteractivePreview = ({
  session,
  onSubmit,
}: {
  session: ConsoleSessionState;
  onSubmit: (value: string) => void;
}) => {
  const [inputValue, setInputValue] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const hasLoop = /(?:while|for|do)\s*[\s\S]*?(?:Scanner|next|ReadLine|input|hasNext|System\.in|BufferedReader)/.test(session.code || '');
  const readCount = Math.max(countConsoleReads(session.code), needsConsoleInput(session.code) ? 1 : 0);
  const needsInput = !session.isRunning && !session.success && !session.error && (
    session.stdinLines.length === 0 ||
    session.stdinLines.length < readCount ||
    hasLoop
  );

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  }, [session.output, session.isRunning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (session.isRunning) return;
    onSubmit(inputValue);
    setInputValue('');
  };

  const statusLabel = session.isRunning
    ? 'Running...'
    : needsInput
      ? 'Waiting for input...'
      : session.success
        ? 'Execution Succeeded'
        : session.error
          ? 'Execution Failed'
          : 'Console';

  const statusClass = session.isRunning
    ? 'text-white/60'
    : needsInput
      ? 'text-[#f1fa8c]'
      : session.success
        ? 'text-[#50fa7b]'
        : session.error
          ? 'text-[#ff5555]'
          : 'text-white/60';

  return (
    <div className="absolute inset-0 flex flex-col bg-[#1e1e1e]">
      <div className="px-4 py-2 border-b border-[#44475a] shrink-0">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div
        ref={outputRef}
        className="flex-1 overflow-auto p-4 font-mono text-[13px] text-[#f8f8f2] whitespace-pre-wrap leading-relaxed"
      >
        {session.output}
        {session.error && (
          <div className="text-[#ff5555] mt-2">{session.error}</div>
        )}
        {session.isRunning && (
          <span className="block mt-2 text-white/40 animate-pulse">Running...</span>
        )}
        {!session.output && !session.error && !session.isRunning && (
          <span className="text-white/40">(No output)</span>
        )}
      </div>
      {needsInput && (
        <form onSubmit={handleSubmit} className="border-t border-[#44475a] p-3 flex gap-2 shrink-0 bg-[#252526]">
          <span className="text-[#f8f8f2] font-mono text-sm self-center">&gt;</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-[#282a36] border border-[#44475a] rounded px-3 py-2 text-[#f8f8f2] font-mono text-sm focus:outline-none focus:border-[#dc2626]"
            placeholder="Type input and press Enter"
            autoFocus
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#dc2626] hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded transition-colors"
          >
            Send
          </button>
        </form>
      )}
      {!needsInput && session.stdinLines.length > 0 && session.success && (
        <div className="border-t border-[#44475a] px-4 py-2 text-[10px] text-white/40 uppercase tracking-wider shrink-0">
          Program finished — click RUN to execute again
        </div>
      )}
    </div>
  );
};

const CloudEditor = ({ session: propSession, onStopLab, onBack, remainingTime }: any) => {
  const location = useLocation();
  const editorRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadRequestIdRef = useRef(0);
  const activeFileIndexRef = useRef(-1);
  const filesRef = useRef<any[]>([]);
  const lastSavedContentRef = useRef<Map<string, string>>(new Map());
  const dirtyPathsRef = useRef<Set<string>>(new Set());
  const [files, setFiles] = useState<any[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    activeFileIndexRef.current = activeFileIndex;
  }, [activeFileIndex]);
  const [labId, setLabId] = useState('');

  const { labWallets, fetchStudentLabTokens } = useLabTokenStore();
  useEffect(() => {
    fetchStudentLabTokens();
    const tokenSyncInterval = setInterval(() => {
      fetchStudentLabTokens();
    }, 20000);
    return () => clearInterval(tokenSyncInterval);
  }, [fetchStudentLabTokens]);

  const { remainingSeconds, activeSession } = useLabSessionStore();

  const cleanEditorLabId = (labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
  const activeLabWallet = (labWallets || []).find(w => {
    const wClean = String(w.labId || '').toLowerCase().replace(/^lab-/, '').replace(/-lab$/, '');
    return wClean === cleanEditorLabId || String(w.labId || '').toLowerCase() === String(labId || '').toLowerCase();
  });

  const isSessionRunning = Boolean(
    activeSession && ['running', 'RUNNING', 'expiring_soon', 'EXPIRING_SOON'].includes(activeSession.status)
  );

  let displayTokens = activeLabWallet ? Number(activeLabWallet.remainingTokens || 0) : 0;
  if (isSessionRunning && typeof remainingSeconds === 'number' && remainingSeconds > 0) {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    // 30-Second Rule:
    // If >= 30s remain in the minute (up to 0.5m left, e.g. at 77:50), do NOT cut token for this minute (mins + 1).
    // If < 30s remain (down to 0.5m left, e.g. 77:15), cut token for this minute (mins).
    displayTokens = secs >= 30 ? mins + 1 : mins;
  }

  const labType = propSession?.labType || '';
  const isAndroid = labType === 'android' || labId === 'android' || labId === 'mobile-app-lab';
  const isDotnet = labType === 'dotnet' || labId === 'dotnet-lab' || labId.includes('dotnet');
  const isSelenium = labType === 'testing';
  const isJava = labType === 'java' || labId === 'java-lab' || labId.includes('java') || (propSession?.labId || '').toLowerCase().includes('java');

  const [seleniumRunState, setSeleniumRunState] = useState<{
    status: 'IDLE' | 'STARTING' | 'CONNECTING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'DISCONNECTED';
    browserUrl: string | null;
    logStreamUrl: string | null;
    runId: string | null;
    errorMsg: string | null;
  }>({
    status: 'IDLE',
    browserUrl: null,
    logStreamUrl: null,
    runId: null,
    errorMsg: null
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isPreviewTabActive, setIsPreviewTabActive] = useState(false);
  const [browserTitle, setBrowserTitle] = useState('Ignito VLab Dashboard');
  const [extractedUrl, setExtractedUrl] = useState('http://localhost:5173/login');
  const testingWorkspaceRef = useRef<any>(null);
  const [isSeleniumDialogOpen, setIsSeleniumDialogOpen] = useState(false);
  const [seleniumResolve, setSeleniumResolve] = useState<((mode: 'gui' | 'headless') => void) | null>(null);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/workspace', 'workspace', '/workspace/data', 'data']));
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('/workspace');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  const [terminalOutput, setTerminalOutput] = useState<{
    command: string;
    output: string;
    plotHtml?: string | null;
    error?: string | null;
    status: 'idle' | 'running' | 'success' | 'error';
  }>({
    command: '',
    output: '',
    plotHtml: null,
    status: 'idle'
  });
  const [outputTab, setOutputTab] = useState<'output' | 'plot' | 'preview' | 'logs'>('output');
  const [consoleInputValue, setConsoleInputValue] = useState('');
  const [outputHeight, setOutputHeight] = useState<number>(270);
  const [isOutputCollapsed, setIsOutputCollapsed] = useState<boolean>(false);
  const [isOutputMaximized, setIsOutputMaximized] = useState<boolean>(false);
  const isDraggingOutputRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(270);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingOutputRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = isOutputCollapsed ? 42 : outputHeight;
    setIsOutputCollapsed(false);
    setIsOutputMaximized(false);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingOutputRef.current) return;
      const deltaY = dragStartYRef.current - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 160, dragStartHeightRef.current + deltaY));
      setOutputHeight(newHeight);
    };

    const onMouseUp = () => {
      isDraggingOutputRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSplitterTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingOutputRef.current = true;
    dragStartYRef.current = touch.clientY;
    dragStartHeightRef.current = isOutputCollapsed ? 42 : outputHeight;
    setIsOutputCollapsed(false);
    setIsOutputMaximized(false);

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingOutputRef.current) return;
      const t = moveEvent.touches[0];
      if (!t) return;
      const deltaY = dragStartYRef.current - t.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight - 160, dragStartHeightRef.current + deltaY));
      setOutputHeight(newHeight);
    };

    const onTouchEnd = () => {
      isDraggingOutputRef.current = false;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Automatically close chrome-preview tab and return to the code file after successful run / disconnect
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    if (
      seleniumRunState.status === 'PASSED' ||
      seleniumRunState.status === 'FAILED' ||
      seleniumRunState.status === 'ERROR' ||
      seleniumRunState.status === 'DISCONNECTED'
    ) {
      timeoutId = setTimeout(() => {
        handleCloseFile({ stopPropagation: () => { } } as any, 'chrome-preview');
        setSeleniumRunState({
          status: 'IDLE',
          browserUrl: null,
          logStreamUrl: null,
          runId: null,
          errorMsg: null
        });
      }, 5000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [seleniumRunState.status]);

  // Auto-expand all folders when files load for Android
  useEffect(() => {
    if (isAndroid && files.length > 0) {
      const folders = new Set<string>();
      files.forEach(f => {
        const parts = f.path.split('/');
        let currentPath = '';
        for (let i = 1; i < parts.length - 1; i++) {
          currentPath += '/' + parts[i];
          folders.add(currentPath);
        }
      });
      setExpandedFolders(folders);
    }
  }, [files, isAndroid]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const startRename = (path: string, currentName: string) => {
    setRenamingPath(path);
    setRenameValue(currentName);
  };

  const cancelRename = () => {
    setRenamingPath(null);
    setRenameValue('');
  };

  const commitRename = async () => {
    if (!sessionId || !renamingPath) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty');
      return;
    }
    if (/[\\/]/.test(trimmed) || trimmed === '.' || trimmed === '..') {
      toast.error('Invalid name');
      return;
    }
    const parent = renamingPath.substring(0, renamingPath.lastIndexOf('/')) || '/workspace';
    const newPath = `${parent}/${trimmed}`;
    if (newPath === renamingPath) {
      cancelRename();
      return;
    }

    setIsRenaming(true);
    try {
      // 1. Optimistically update local files state immediately
      setFiles((prev) => {
        const next = prev.map((f) => {
          if (f.path === renamingPath) {
            return {
              ...f,
              path: newPath,
              name: trimmed,
              language: detectLanguage(trimmed),
            };
          }
          if (f.path.startsWith(renamingPath + '/')) {
            const nextSub = newPath + f.path.slice(renamingPath.length);
            return {
              ...f,
              path: nextSub,
              name: nextSub.split('/').pop() || f.name,
              language: detectLanguage(nextSub.split('/').pop() || f.name),
            };
          }
          return f;
        });
        filesRef.current = next;
        return next;
      });

      setOpenFilePaths((prev) =>
        prev.map((p) => {
          if (p === renamingPath) return newPath;
          if (p.startsWith(renamingPath + '/')) return newPath + p.slice(renamingPath.length);
          return p;
        })
      );
      setLoadedPaths((prev) => {
        const next = new Set<string>();
        prev.forEach((p) => {
          if (p === renamingPath) next.add(newPath);
          else if (p.startsWith(renamingPath + '/')) next.add(newPath + p.slice(renamingPath.length));
          else next.add(p);
        });
        return next;
      });
      setExpandedFolders((prev) => {
        const next = new Set<string>();
        prev.forEach((p) => {
          if (p === renamingPath) next.add(newPath);
          else if (p.startsWith(renamingPath + '/')) next.add(newPath + p.slice(renamingPath.length));
          else next.add(p);
        });
        return next;
      });
      if (selectedFolderPath === renamingPath || selectedFolderPath.startsWith(renamingPath + '/')) {
        setSelectedFolderPath(
          selectedFolderPath === renamingPath
            ? newPath
            : newPath + selectedFolderPath.slice(renamingPath.length)
        );
      }

      if (dirtyPathsRef.current.has(renamingPath)) {
        dirtyPathsRef.current.delete(renamingPath);
        dirtyPathsRef.current.add(newPath);
      }
      if (lastSavedContentRef.current.has(renamingPath)) {
        const c = lastSavedContentRef.current.get(renamingPath);
        lastSavedContentRef.current.delete(renamingPath);
        lastSavedContentRef.current.set(newPath, c ?? '');
      }

      cancelRename();
      await renamePath(renamingPath, newPath, sessionId);
      await handleSync();
      toast.success(`Renamed to ${trimmed}`);
    } catch (err: any) {
      console.error('Rename error:', err);
      toast.error(`Failed to rename: ${err.message || 'Unknown error'}`);
      await handleSync();
    } finally {
      setIsRenaming(false);
    }
  };

  const renderRenameInput = () => (
    <input
      autoFocus
      value={renameValue}
      disabled={isRenaming}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={() => { if (!isRenaming) commitRename(); }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitRename();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelRename();
        }
      }}
      className="flex-1 min-w-0 bg-white border border-rose-300 rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none shadow-xs"
    />
  );

  const renderTreeNode = (node: any, depth: number) => {
    const isExpanded = expandedFolders.has(node.path);
    const isFolderSelected = selectedFolderPath === node.path;
    const isEditing = renamingPath === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            onClick={() => {
              if (isEditing) return;
              toggleFolder(node.path);
              setSelectedFolderPath(node.path);
            }}
            className={`group relative flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100/80 cursor-pointer transition-colors ${
              isFolderSelected ? 'bg-slate-100 font-semibold' : ''
            }`}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
          >
            {isExpanded ? (
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            ) : (
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen size={16} className="text-amber-500 fill-amber-400 shrink-0" />
            ) : (
              <Folder size={16} className="text-amber-500 fill-amber-400 shrink-0" />
            )}
            {isEditing ? (
              renderRenameInput()
            ) : (
              <>
                <span
                  className="text-slate-700 text-xs font-semibold truncate min-w-0 flex-1 pr-1"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(node.path, node.name);
                  }}
                  title={node.name}
                >
                  {node.name}
                </span>
                <div className="hidden group-hover:flex absolute right-1.5 top-1/2 -translate-y-1/2 items-center gap-1 bg-white shadow-xs px-1 py-0.5 rounded border border-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFolderPath(node.path);
                      setExpandedFolders(prev => {
                        const next = new Set(prev);
                        next.add(node.path);
                        return next;
                      });
                      handleAddFile(node.path);
                    }}
                    className="text-slate-500 hover:text-emerald-600 transition-colors p-0.5 rounded"
                    title={`New file in ${node.name}`}
                  >
                    <Plus size={12} />
                  </button>
                  {node.path !== '/workspace' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(node.path, node.name);
                      }}
                      className="text-slate-500 hover:text-amber-600 transition-colors p-0.5 rounded"
                      title="Rename folder"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {isExpanded && node.children?.map((child: any) => renderTreeNode(child, depth + 1))}
        </div>
      );
    } else {
      const i = node.fileIndex;
      const file = files[i];
      if (!file) return null;
      const isActive = activeFileIndex === i;
      return (
        <div
          key={node.path}
          onClick={() => {
            if (isEditing) return;
            if (!openFilePaths.includes(file.path)) {
              if (openFilePaths.length >= 8) {
                toast.error('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
                return;
              }
              setOpenFilePaths(prev => [...prev, file.path]);
            }
            selectFile(i);
            const parentDir = file.path.substring(0, file.path.lastIndexOf('/'));
            setSelectedFolderPath(parentDir);
          }}
          className={`group relative flex items-center gap-2 py-1.5 px-2.5 my-0.5 rounded-lg cursor-pointer transition-all ${
            isActive
              ? 'bg-[#fee2e2]/80 text-[#e11d48] font-semibold'
              : 'text-slate-700 hover:bg-slate-100/80 font-normal'
          }`}
          style={{ paddingLeft: `${depth * 14 + 18}px` }}
        >
          {getFileIcon(file.name)}
          {isEditing ? (
            renderRenameInput()
          ) : (
            <>
              <span
                className={`text-xs truncate min-w-0 flex-1 pr-1 ${isActive ? 'text-[#e11d48] font-semibold' : 'text-slate-700'}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(file.path, file.name);
                }}
                title={file.name}
              >
                {file.name}
              </span>
              <div className="hidden group-hover:flex absolute right-1.5 top-1/2 -translate-y-1/2 items-center gap-1 bg-white shadow-xs px-1 py-0.5 rounded border border-slate-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(file.path, file.name);
                  }}
                  className="text-slate-400 hover:text-amber-600 transition-colors p-0.5 rounded"
                  title="Rename file"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) return;
                    if (!sessionId) return;
                    try {
                      setFiles((prev) => {
                        const next = prev.filter((f) => f.path !== file.path && !f.path.startsWith(file.path + '/'));
                        filesRef.current = next;
                        return next;
                      });
                      setOpenFilePaths((prev) => prev.filter((p) => p !== file.path && !p.startsWith(file.path + '/')));
                      await deleteFile(file.path, sessionId);
                      await handleSync();
                    } catch (err: any) {
                      console.error('Delete error:', err);
                      toast.error(`Failed to delete file: ${err.message || 'Unknown error'}`);
                    }
                  }}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded"
                  title="Delete file"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
  };

  const { labs, loadLabs } = useLabStore();

  useEffect(() => {
    if (labs.length === 0) {
      loadLabs();
    }
  }, [labs, loadLabs]);



  const [loadedPaths, setLoadedPaths] = useState(new Set<string>());
  const [contentLoadingPath, setContentLoadingPath] = useState<string | null>(null);

  const markPathLoaded = (path: string) => {
    if (!path) return;
    setLoadedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  };
  const [isSaving, setIsSaving] = useState(false);
  const typingDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [runningAction, setRunningAction] = useState<'build' | 'run' | null>(null);
  const [dotnetBuildReady, setDotnetBuildReady] = useState(false);
  const isRunning = runningAction !== null;
  const [webPreviewCode, setWebPreviewCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('vlab.ide.sidebarWidth'));
    return Number.isFinite(saved) && saved >= 140 ? saved : 250;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem('vlab.ide.rightPanelWidth'));
    return Number.isFinite(saved) && saved >= 180 ? saved : 420;
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  const rightPanelWidthRef = useRef(rightPanelWidth);
  sidebarWidthRef.current = sidebarWidth;
  rightPanelWidthRef.current = rightPanelWidth;

  const [isResizing, setIsResizing] = useState<'sidebar' | 'right' | null>(null);

  const startPanelResize = (
    e: React.PointerEvent<HTMLDivElement>,
    panel: 'sidebar' | 'right'
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const handleEl = e.currentTarget;
    const pointerId = e.pointerId;

    try {
      handleEl.setPointerCapture(pointerId);
    } catch (_) {}

    setIsResizing(panel);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    // Measure the closest workspace container row for 1:1 pixel coordinate precision
    const container =
      handleEl.closest<HTMLElement>('.ide-workspace-row') ||
      handleEl.closest<HTMLElement>('.ide-root-container') ||
      handleEl.parentElement?.parentElement ||
      document.body;

    const getRect = () => container.getBoundingClientRect();
    const initialRect = getRect();
    const containerWidth = initialRect.width || window.innerWidth;
    const containerRight = initialRect.right || window.innerWidth;
    const containerLeft = initialRect.left || 0;

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const rect = getRect();
      const currentContainerW = rect.width || containerWidth;
      const currentContainerRight = rect.right || containerRight;
      const currentContainerLeft = rect.left || containerLeft;

      if (panel === 'sidebar') {
        const minW = 120;
        const maxW = Math.min(650, Math.max(200, currentContainerW - 280));
        const rawW = Math.round(ev.clientX - currentContainerLeft);

        if (rawW < 75) {
          setIsSidebarOpen(false);
        } else {
          setIsSidebarOpen(true);
          const clamped = Math.min(maxW, Math.max(minW, rawW));
          sidebarWidthRef.current = clamped;
          setSidebarWidth(clamped);
        }
      } else {
        // Right preview / build panel: direct width from mouse X to right edge of container
        const currentSidebarW = isSidebarOpen ? sidebarWidthRef.current : 0;
        const maxW = Math.max(280, currentContainerW - currentSidebarW - 220);
        const minW = 180;
        const rawW = Math.round(currentContainerRight - ev.clientX);
        const clamped = Math.min(maxW, Math.max(minW, rawW));
        rightPanelWidthRef.current = clamped;
        setRightPanelWidth(clamped);
      }
    };

    const cleanup = () => {
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      try {
        if (handleEl.hasPointerCapture(pointerId)) {
          handleEl.releasePointerCapture(pointerId);
        }
      } catch (_) {}

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);

      localStorage.setItem('vlab.ide.sidebarWidth', String(sidebarWidthRef.current));
      localStorage.setItem('vlab.ide.rightPanelWidth', String(rightPanelWidthRef.current));
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('blur', cleanup);
  };
  const [openFilePaths, setOpenFilePaths] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [consoleSession, setConsoleSession] = useState<ConsoleSessionState | null>(null);
  const [isAndroidBuilding, setIsAndroidBuilding] = useState(false);
  const [androidBuildLogs, setAndroidBuildLogs] = useState<string>('No build logs yet. Click BUILD to start compiling your Android application.');
  const [androidApkUrl, setAndroidApkUrl] = useState<string | null>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const handleCopyLogs = () => {
    if (!androidBuildLogs) return;
    navigator.clipboard.writeText(androidBuildLogs).then(() => {
      setCopiedLogs(true);
      toast.success('Build logs copied to clipboard!');
      setTimeout(() => setCopiedLogs(false), 2000);
    }).catch(err => {
      console.error('Failed to copy logs:', err);
      toast.error('Failed to copy build logs');
    });
  };

  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false);

  const prevSessionIdRef = useRef<string>('');

  const resetEditorState = () => {
    setFiles([]);
    filesRef.current = [];
    setActiveFileIndex(-1);
    activeFileIndexRef.current = -1;
    setOpenFilePaths([]);
    setLoadedPaths(new Set());
    lastSavedContentRef.current.clear();
    dirtyPathsRef.current.clear();
    setConsoleSession(null);
    setWebPreviewCode('');
    setRunningAction(null);
    setDotnetBuildReady(false);
  };

  const refreshFiles = async (showLoading = false, forceFresh = false) => {
    if (!sessionId) return;
    if (showLoading) setIsLoading(true);
    else setIsRefreshingFiles(true);
    try {
      const response = await fetchFiles(sessionId, true);
      if (response.success) {
        const activePath =
          activeFileIndexRef.current >= 0 && filesRef.current[activeFileIndexRef.current]
            ? filesRef.current[activeFileIndexRef.current].path
            : null;

        if (forceFresh) {
          // Fresh session / explicit reload: completely discard previous in-memory caches
          setFiles(response.files);
          filesRef.current = response.files;
          setLoadedPaths(new Set());
          lastSavedContentRef.current.clear();
          dirtyPathsRef.current.clear();
        } else {
          // Normal background polling: merge against latest in-memory files so active typing is preserved
          setFiles((prev) => {
            const mergedFiles = response.files.map((newFile: any) => {
              const existing = prev.find((f) => f.path === newFile.path);
              if (existing && existing.content !== undefined) {
                return { ...newFile, content: existing.content, language: existing.language || newFile.language };
              }
              return newFile;
            });
            // CRUCIAL: Preserve any newly created files in prev that may still be syncing to backend
            prev.forEach((prevFile) => {
              if (!mergedFiles.some((m: any) => m.path === prevFile.path)) {
                mergedFiles.push(prevFile);
              }
            });
            return mergedFiles;
          });
        }

        setOpenFilePaths((prev) => {
          const validPaths = new Set(response.files.map((f: any) => f.path));
          filesRef.current.forEach((f) => validPaths.add(f.path));
          return forceFresh
            ? (response.files.length > 0 ? [response.files[0].path] : [])
            : prev.filter((p) => p === 'chrome-preview' || validPaths.has(p));
        });

        setLoadedPaths((prev) => {
          if (forceFresh) return new Set();
          const next = new Set(prev);
          const newPaths = new Set(response.files.map((f: any) => f.path));
          prev.forEach((p) => {
            if (!newPaths.has(p)) next.delete(p);
          });
          return next;
        });

        if (activePath && !forceFresh) {
          const newIdx = response.files.findIndex((f: any) => f.path === activePath);
          if (newIdx >= 0) setActiveFileIndex(newIdx);
        } else if (response.files.length > 0) {
          // Auto-select starter file or first file so the editor and run button are immediately ready
          const preferredFileIdx = response.files.findIndex((f: any) =>
            /program\.cs|main\.(py|java|cs|js)|index\.html|app\.(py|js)|script\.(py|sh)/i.test(f.name)
          );
          const targetIdx = preferredFileIdx >= 0 ? preferredFileIdx : 0;
          const targetFile = response.files[targetIdx];
          if (targetFile) {
            setOpenFilePaths([targetFile.path]);
            selectFile(targetIdx, response.files);
          }
        }
        return response.files;
      }
    } catch (err) {
      console.error('Refresh files error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshingFiles(false);
    }
  };

  const refreshFilesRef = useRef(refreshFiles);
  useEffect(() => {
    refreshFilesRef.current = refreshFiles;
  });

  useEffect(() => {
    // @ts-ignore
    const searchParams = new URLSearchParams(location.search);
    const finalSessionId = propSession?.sessionId || searchParams.get('sessionId') || '';
    const lid = (searchParams.get('labId') || propSession?.labId || '').toLowerCase();

    if (finalSessionId) {
      if (prevSessionIdRef.current && prevSessionIdRef.current !== finalSessionId) {
        // Session changed: reset all in-memory editor and console cache
        resetEditorState();
      }
      prevSessionIdRef.current = finalSessionId;
      setSessionId(finalSessionId);
      setLabId(lid);
    }
  }, [propSession, location.search]);

  useEffect(() => {
    if (sessionId) {
      refreshFiles(true, true);
    }
  }, [sessionId, labId]);

  // Auto-refresh file explorer every 3 minutes
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      refreshFilesRef.current(false, false);
    }, 180000);
    return () => clearInterval(interval);
  }, [sessionId]);



  const pendingFetchRef = useRef<Set<string>>(new Set());

  const loadFileContent = async (targetPath: string) => {
    if (!sessionId || !targetPath || pendingFetchRef.current.has(targetPath)) return;
    pendingFetchRef.current.add(targetPath);
    setContentLoadingPath(targetPath);
    try {
      const res = await fetchFileContent(targetPath, sessionId, true);
      if (res && res.success) {
        setFiles((prev) =>
          prev.map((f) =>
            f.path === targetPath ? { ...f, content: res.content } : f
          )
        );
        markPathLoaded(targetPath);
        lastSavedContentRef.current.set(targetPath, res.content ?? '');
      }
    } catch (err) {
      console.error('Failed to load file content:', err);
    } finally {
      pendingFetchRef.current.delete(targetPath);
      setContentLoadingPath(null);
    }
  };

  const selectFile = async (newIdx: number, newFilesList?: any[]) => {
    if (newIdx === activeFileIndexRef.current && !isPreviewTabActive) return;

    const currentFiles = newFilesList || filesRef.current;

    // Save only if we have real loaded content and local edits — never write "" over a file still loading
    const prevIdx = activeFileIndexRef.current;
    if (prevIdx >= 0 && filesRef.current[prevIdx] && sessionId) {
      const prevFile = filesRef.current[prevIdx];
      const hasBody = typeof prevFile.content === 'string';
      const isDirty = dirtyPathsRef.current.has(prevFile.path);
      if (hasBody && isDirty) {
        saveFile(prevFile, sessionId)
          .then(() => {
            lastSavedContentRef.current.set(prevFile.path, prevFile.content ?? '');
            dirtyPathsRef.current.delete(prevFile.path);
          })
          .catch((err) => {
            console.error('Failed to save file before switching:', err);
          });
      }
    }

    setActiveFileIndex(newIdx);
    setIsPreviewTabActive(false);

    if (newIdx < 0 || !currentFiles[newIdx]) return;
    const targetFile = currentFiles[newIdx];
    const targetPath = targetFile.path;

    // Already loaded in memory with valid string content
    if (loadedPaths.has(targetPath) && typeof targetFile.content === 'string') {
      markPathLoaded(targetPath);
      return;
    }

    await loadFileContent(targetPath);
  };

  useEffect(() => {
    if (activeFileIndex < 0 || !sessionId) return;
    const file = files[activeFileIndex];
    if (!file?.path) return;
    if (loadedPaths.has(file.path) || typeof file.content === 'string') {
      markPathLoaded(file.path);
      return;
    }
    loadFileContent(file.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileIndex, sessionId]);

  const latestSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    latestSaveRef.current = () => handleSave(false);
  });

  const activeFile = files[activeFileIndex];
  const activeFilePath = activeFile?.path;
  const activeFileContent = activeFile?.content;
  const isContentReady = !!activeFilePath && (loadedPaths.has(activeFilePath) || typeof activeFileContent === 'string');
  const isContentLoading = !!activeFilePath && contentLoadingPath === activeFilePath && !isContentReady;

  useEffect(() => {
    if (activeFileIndex === -1 || !activeFilePath) return;
    if (!loadedPaths.has(activeFilePath) || isSaving) return;
    if (!dirtyPathsRef.current.has(activeFilePath)) return;

    const lastSaved = lastSavedContentRef.current.get(activeFilePath);
    if (lastSaved === activeFileContent) {
      dirtyPathsRef.current.delete(activeFilePath);
      return;
    }

    const timeout = setTimeout(() => handleSave(false), 1200);
    return () => clearTimeout(timeout);
  }, [activeFilePath, activeFileContent, activeFileIndex, loadedPaths, isSaving]);

  const isDotnetBuildMode = isDotnet && activeFile && isDotnetMvcPath(activeFile.path, activeFile.content);

  useEffect(() => {
    setDotnetBuildReady(false);
  }, [activeFile?.path, activeFile?.content]);

  useEffect(() => {
    setConsoleSession(null);
  }, [activeFilePath]);

  const isHtmlPreviewOutput = (text: string) =>
    /^\s*</.test(text) && (/<html[\s>]/i.test(text) || /<!doctype\s+html/i.test(text));

  const renderExecutionPreview = (
    runSuccess: boolean,
    rawOutput: string,
    rawError: string,
    mode: 'build' | 'run' | 'execute',
  ) => {
    if (runSuccess && mode === 'run' && isHtmlPreviewOutput(rawOutput)) {
      return rawOutput;
    }

    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const cleanAnsi = (text: string) =>
      (text || '')
        .replace(/\x1b\[[0-9;?]*[a-zA-Z=]/g, '')
        .replace(/\x1b[=>]/g, '')
        .replace(/\+\[[0-9;?]*[a-zA-Z=]/g, '');

    const formattedOutput = escapeHtml(cleanAnsi(rawOutput));
    const formattedError = escapeHtml(cleanAnsi(rawError));
    const successTitle =
      mode === 'build' ? 'Build Succeeded' : mode === 'run' ? 'Run Succeeded' : 'Execution Succeeded';
    const failureTitle =
      mode === 'build' ? 'Build Failed' : mode === 'run' ? 'Run Failed' : 'Execution Failed';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              background-color: #1e1e1e;
              color: #f8f8f2;
              font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
              padding: 16px;
              margin: 0;
              white-space: pre-wrap;
              word-break: break-all;
              font-size: 13px;
              line-height: 1.6;
            }
            .error { color: #ff5555; font-weight: bold; }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
              margin: 0;
              font-family: inherit;
            }
            .header-success {
              color: #50fa7b;
              border-bottom: 1px solid #44475a;
              padding-bottom: 6px;
              margin-bottom: 12px;
              font-weight: bold;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .header-error {
              color: #ff5555;
              border-bottom: 1px solid #44475a;
              padding-bottom: 6px;
              margin-bottom: 12px;
              font-weight: bold;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          ${runSuccess
        ? `<div class="header-success">${successTitle}</div><pre>${formattedOutput || '(No output)'}</pre>`
        : `<div class="header-error">${failureTitle}</div><pre class="error">${formattedError && formattedError !== 'Program exited with an error' ? formattedError : formattedOutput || formattedError || 'Unknown error'}</pre>`
      }
        </body>
      </html>
    `;
  };

  const getRunningPreviewMessage = (mode: 'build' | 'run' | 'execute') => {
    if (isAndroid) return 'Building Android Project...';
    if (isDotnet && mode === 'build') return 'Validating ASP.NET project build (first build may take a few minutes)...';
    if (isDotnet && mode === 'run') return 'Starting ASP.NET web app and loading preview...';
    if (isDotnet) return 'Compiling and running C# program...';
    return 'Executing program...';
  };

  const showRunningPreview = (mode: 'build' | 'run' | 'execute') => {
    setWebPreviewCode(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              background-color: #1e1e1e;
              color: rgba(255,255,255,0.6);
              font-family: monospace;
              padding: 16px;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 80vh;
            }
            .spinner {
              width: 24px;
              height: 24px;
              border: 3px solid rgba(255,255,255,0.1);
              border-top: 3px solid #dc2626;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 12px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .text {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 1px;
              text-align: center;
              max-width: 320px;
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <div class="text">${getRunningPreviewMessage(mode)}</div>
        </body>
      </html>
    `);
  };

  const handleSync = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetchFiles(sessionId, true);
      if (response.success) {
        const newFilesList = response.files || [];
        const activePathBefore =
          activeFileIndexRef.current >= 0
            ? filesRef.current[activeFileIndexRef.current]?.path
            : null;
        const newPaths = new Set(newFilesList.map((f: any) => f.path));

        let newActiveIdx = -1;
        if (activePathBefore && newPaths.has(activePathBefore)) {
          newActiveIdx = newFilesList.findIndex((f: any) => f.path === activePathBefore);
        } else {
          const remainingOpen = openFilePaths.filter((p) => newPaths.has(p));
          if (remainingOpen.length > 0) {
            const newActivePath = remainingOpen[remainingOpen.length - 1];
            newActiveIdx = newFilesList.findIndex((f: any) => f.path === newActivePath);
          }
        }

        const mergedFiles = newFilesList.map((newFile: any) => {
          const existing = filesRef.current.find((f) => f.path === newFile.path);
          if (existing && existing.content !== undefined) {
            return {
              ...newFile,
              content: existing.content,
              language: existing.language || newFile.language,
            };
          }
          return newFile;
        });

        filesRef.current = mergedFiles;
        setFiles(mergedFiles);

        setActiveFileIndex(newActiveIdx);
        setOpenFilePaths((prev) => prev.filter((p) => newPaths.has(p)));
        setLoadedPaths((prev) => {
          const next = new Set(prev);
          for (const p of next) {
            if (!newPaths.has(p)) next.delete(p);
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (showFeedback = true) => {
    const idx = activeFileIndexRef.current;
    const file = filesRef.current[idx];
    if (!file || !sessionId) return;
    const currentCode = editorRef.current ? editorRef.current.getValue() : file.content;
    if (typeof currentCode !== 'string') {
      if (showFeedback) toast.error('File is still loading — wait before saving.');
      return;
    }
    const lastSaved = lastSavedContentRef.current.get(file.path);
    if (!showFeedback && lastSaved === currentCode) return;

    if (showFeedback) {
      setIsSaving(true);
    }
    try {
      const payload = {
        ...file,
        content: currentCode,
      };
      await saveFile(payload, sessionId);
      lastSavedContentRef.current.set(file.path, currentCode);
      dirtyPathsRef.current.delete(file.path);

      try {
        localStorage.setItem(`vlab_backup_${labId}_${file.path}`, currentCode);
      } catch (_) {}

      if (showFeedback) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      if (showFeedback) {
        toast.error(err.message || 'Unable to access container workspace. Please refresh or restart the session.');
      }
    } finally {
      if (showFeedback) {
        setIsSaving(false);
      }
    }
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runConsoleInteractive = async (code: string, stdinLines: string[]) => {
    const stdin = stdinLines.length > 0 ? `${stdinLines.join('\n')}\n` : '';
    setConsoleSession((prev) => (prev ? { ...prev, isRunning: true, error: null } : prev));

    try {
      const resolvedLabType = isDotnet
        ? 'dotnet'
        : isAndroid
          ? 'android'
          : isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')
            ? 'java'
            : (labType || (labId?.includes('python') ? 'python' : labId || 'python'));

      const response = await runFile(
        {
          path: activeFile!.path,
          language: activeFile!.language || (isDotnet ? 'csharp' : isJava ? 'java' : 'python'),
          content: code,
          labType: resolvedLabType,
          stdin,
        },
        sessionId,
      );

      const rawOutput = response?.output != null ? String(response.output) : '';
      const rawError = response?.error || response?.runtimeError || response?.syntaxError || '';
      const runSuccess = response?.success || response?.status === 'COMPLETED';

      let plotHtml: string | null = response?.plotHtml || null;
      let textOnly = rawOutput;
      if (!plotHtml && rawOutput.includes('<!-- VLAB_PLOT_START -->')) {
        const plotMatch = rawOutput.match(/<!-- VLAB_PLOT_START -->([\s\S]*?)<!-- VLAB_PLOT_END -->/);
        if (plotMatch) {
          plotHtml = plotMatch[1].trim();
        }
      }
      textOnly = textOnly.replace(/<!-- VLAB_PLOT_START -->[\s\S]*?<!-- VLAB_PLOT_END -->/g, '').replace(/^[\r\n]+/, '').trimEnd();

      const output = extractConsoleOutput(textOnly);
      const cmdName = isDotnet
        ? 'dotnet run'
        : isAndroid
          ? './build.sh'
          : isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')
            ? `java ${activeFile?.name || 'Main.java'}`
            : `python ${activeFile?.name || 'main.py'}`;

      const isInitialProbe = stdinLines.length === 0;
      const isCompileError = /error:|syntax error|SyntaxError|cannot find symbol|class, interface, or enum expected|package .* does not exist/i.test(rawError || rawOutput);

      const isMissingInputError = !runSuccess && !isCompileError && (
        /NoSuchElementException|EOFError|End of stream|EndOfStreamException|No line found|NullReferenceException/i.test(rawError || rawOutput) ||
        (isInitialProbe && needsConsoleInput(code))
      );

      let cleanConsoleOutput = output;
      if (isMissingInputError) {
        cleanConsoleOutput = cleanConsoleOutput
          .replace(/Exception in thread "main" java\.util\.NoSuchElementException[\s\S]*/, '')
          .replace(/Traceback \(most recent call last\):[\s\S]*EOFError[\s\S]*/, '')
          .trimEnd();
      }

      const sessionError = runSuccess
        ? null
        : isMissingInputError
          ? null
          : (rawError || rawOutput || 'Program exited with an error');

      setConsoleSession((prev) =>
        prev
          ? {
            ...prev,
            isRunning: false,
            output: cleanConsoleOutput,
            stdinLines,
            success: runSuccess,
            error: sessionError,
          }
          : prev,
      );

      setTerminalOutput({
        command: cmdName,
        output: cleanConsoleOutput || textOnly,
        plotHtml,
        error: sessionError,
        status: runSuccess ? 'success' : isMissingInputError ? 'idle' : 'error',
      });

      if (plotHtml) {
        setOutputTab('plot');
      }
    } catch (err: any) {
      const cmdName = isDotnet
        ? 'dotnet run'
        : isAndroid
          ? './build.sh'
          : isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')
            ? `java ${activeFile?.name || 'Main.java'}`
            : `python ${activeFile?.name || 'main.py'}`;
      setConsoleSession((prev) =>
        prev
          ? {
            ...prev,
            isRunning: false,
            success: false,
            error: err.message || 'Failed to run program',
          }
          : prev,
      );
      setTerminalOutput({
        command: cmdName,
        output: '',
        error: err.message || 'Failed to run program',
        status: 'error',
      });
    }
  };

  const handleConsoleInputSubmit = (value: string) => {
    if (!consoleSession) return;
    const newLines = [...consoleSession.stdinLines, value];
    runConsoleInteractive(consoleSession.code, newLines);
  };

  const getExecutionMode = () => new Promise<'gui' | 'headless'>((resolve) => {
    setSeleniumResolve(() => resolve);
    setIsSeleniumDialogOpen(true);
  });

  const executeCode = async (dotnetAction?: 'build' | 'run') => {
    if (!sessionId || (!isAndroid && !activeFile)) return;

    if (isSelenium) {
      setRunningAction('run');
      try {
        const mode = await getExecutionMode();
        if (!mode) return;

        if (!openFilePaths.includes('chrome-preview')) {
          setOpenFilePaths(prev => [...prev, 'chrome-preview']);
        }
        setIsPreviewTabActive(true);

        // Immediately set state to STARTING so the preview panel shows the loader
        setSeleniumRunState({
          status: 'STARTING',
          browserUrl: null,
          logStreamUrl: null,
          runId: null,
          errorMsg: null
        });

        const runPayload = {
          path: activeFile.path,
          language: activeFile.language,
          content: activeFile.content,
          labType: 'testing',
          executionMode: mode
        };

        const response = await runFile(runPayload, sessionId);
        if (response && response.success) {
          if (response.browser?.title) {
            setBrowserTitle(response.browser.title);
          }
          // Dynamically pass the browserUrl to the TestingWorkspace component
          const browserUrl = response.viewerUrl || response.browser?.url || null;
          setSeleniumRunState(prev => ({
            ...prev,
            browserUrl,
            logStreamUrl: response.logs?.streamUrl || prev.logStreamUrl,
            runId: response.runId || prev.runId,
            status: browserUrl ? 'RUNNING' : prev.status
          }));
        } else {
          const errorMsg = response?.error || 'Failed to start Selenium environment';
          setSeleniumRunState(prev => ({
            ...prev,
            status: 'ERROR',
            errorMsg
          }));
          toast.error(errorMsg);
        }
        await refreshFiles(false);
        return response;
      } catch (err: any) {
        setSeleniumRunState(prev => ({
          ...prev,
          status: 'ERROR',
          errorMsg: err.message || 'Error executing test script'
        }));
        toast.error(err.message || 'Error executing test script');
      } finally {
        setRunningAction(null);
      }
    }

    const previewMode: 'build' | 'run' | 'execute' =
      isDotnet && dotnetAction === 'build' ? 'build' : isDotnet && dotnetAction === 'run' ? 'run' : 'execute';

    setRunningAction(dotnetAction || 'run');

    if (!isAndroid && activeFile && activeFile.language === 'html') {
      setConsoleSession(null);
      setWebPreviewCode(activeFile.content || '');
      setRunningAction(null);
      return;
    }

    const code = editorRef.current ? editorRef.current.getValue() : (activeFile?.content || '');
    const isConsoleInteractive =
      !isDotnetBuildMode && !dotnetAction && needsConsoleInput(code);

    if (isConsoleInteractive) {
      setConsoleSession({
        active: true,
        code,
        output: '',
        stdinLines: [],
        isRunning: true,
        success: false,
        error: null,
      });
      try {
        await runConsoleInteractive(code, []);
      } finally {
        setRunningAction(null);
      }
      return;
    }

    setConsoleSession(null);

    const fileName = activeFile?.name || (isJava ? 'Main.java' : 'main.py');
    const commandText = isAndroid
      ? './build.sh'
      : isDotnet
        ? (dotnetAction === 'build' ? 'dotnet build' : 'dotnet run')
        : isJava || activeFile?.language === 'java' || fileName.endsWith('.java')
          ? `java ${fileName}`
          : `python ${fileName}`;

    setTerminalOutput({
      command: commandText,
      output: '',
      error: null,
      status: 'running',
    });
    setOutputTab('output');

    try {
      showRunningPreview(previewMode);

      const editorCode = editorRef.current ? editorRef.current.getValue() : (activeFile?.content || '');
      // If dirty, immediately save to backend so container has latest code
      if (activeFile?.path && dirtyPathsRef.current.has(activeFile.path)) {
        saveFile({ ...activeFile, content: editorCode }, sessionId).catch(() => {});
        lastSavedContentRef.current.set(activeFile.path, editorCode);
        dirtyPathsRef.current.delete(activeFile.path);
      }

      const resolvedLabType = isAndroid
        ? 'android'
        : isDotnet
          ? 'dotnet'
          : isSelenium
            ? 'testing'
            : isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')
              ? 'java'
              : (labType || (labId?.includes('python') ? 'python' : labId || 'python'));

      const runPayload = isAndroid
        ? { path: '/workspace/build.sh', language: 'shell', content: '', labType: 'android' }
        : isDotnet
          ? {
            path: activeFile.path,
            language: 'csharp',
            content: editorCode,
            labType: 'dotnet',
            ...(dotnetAction ? { action: dotnetAction } : {}),
          }
          : {
            path: activeFile.path,
            language: activeFile.language || (isJava ? 'java' : 'python'),
            content: editorCode,
            labType: resolvedLabType,
          };

      const response = await runFile(runPayload, sessionId);

      if (response) {
        const runSuccess = Boolean(response.success || response.status === 'COMPLETED');
        const rawOutput = response.output != null ? String(response.output) : '';
        const rawError = response.error || response.runtimeError || response.syntaxError || '';

        // Extract plot HTML if present in response or output
        let plotHtml: string | null = response.plotHtml || null;
        let textOnly = rawOutput;
        if (!plotHtml && rawOutput.includes('<!-- VLAB_PLOT_START -->')) {
          const plotMatch = rawOutput.match(/<!-- VLAB_PLOT_START -->([\s\S]*?)<!-- VLAB_PLOT_END -->/);
          if (plotMatch) {
            plotHtml = plotMatch[1].trim();
          }
        }
        textOnly = textOnly.replace(/<!-- VLAB_PLOT_START -->[\s\S]*?<!-- VLAB_PLOT_END -->/g, '').replace(/^[\r\n]+/, '').trimEnd();

        const cleanOutput = extractConsoleOutput(textOnly);
        const finalOutput = cleanOutput !== undefined && cleanOutput !== '' ? cleanOutput : textOnly;

        setTerminalOutput({
          command: commandText,
          output: finalOutput,
          plotHtml: plotHtml,
          error: runSuccess ? null : (rawError || 'Execution failed'),
          status: runSuccess ? 'success' : 'error',
        });

        // Automatically switch to the Graph / Plot tab when an interactive plot is generated
        if (plotHtml) {
          setOutputTab('plot');
        }

        if (runSuccess && previewMode === 'build' && isDotnetBuildMode) {
          setDotnetBuildReady(true);
        }
        if (/build succeeded/i.test(rawOutput)) {
          setDotnetBuildReady(true);
        }

        setWebPreviewCode(renderExecutionPreview(runSuccess, textOnly, rawError, previewMode));
      } else {
        setTerminalOutput({
          command: commandText,
          output: '',
          error: 'No output received from the runtime engine.',
          status: 'error',
        });
        setWebPreviewCode(`
          <html>
            <body style="background-color: #1e1e1e; color: #ff5555; font-family: monospace; padding: 16px;">
              <h3 style="color: #ff5555;">Execution Error</h3>
              <p>No output received from the runtime engine.</p>
            </body>
          </html>
        `);
      }

      // Background file sync non-blockingly so terminal output is displayed immediately
      refreshFiles(false).catch((err) => console.warn('Background file refresh error:', err));
    } catch (err: any) {
      setTerminalOutput({
        command: commandText,
        output: '',
        error: err.message || 'Failed to call the code execution service.',
        status: 'error',
      });
      setWebPreviewCode(`
        <html>
          <body style="background-color: #1e1e1e; color: #ff5555; font-family: monospace; padding: 16px;">
            <h3 style="color: #ff5555;">Execution Error</h3>
            <p>${err.message || 'Failed to call the code execution service.'}</p>
          </body>
        </html>
      `);
    } finally {
      setRunningAction(null);
    }
  };

  const handleRun = async () => {
    let currentActive = activeFile;
    if (!currentActive) {
      if (files.length > 0) {
        await selectFile(0);
        currentActive = files[0];
      } else {
        toast.info('No files in workspace. Creating a new file...');
        await handleAddFile();
        return;
      }
    }

    if (isSelenium) {
      let initialUrl = 'http://localhost:5173/login';
      if (currentActive && currentActive.content) {
        // Try direct get/navigate matches first
        const directMatch = currentActive.content.match(/driver\.(?:get|navigate\(\)\.to)\s*\(\s*['"](https?:\/\/[^'"]+)['"]\s*\)/i);
        if (directMatch) {
          initialUrl = directMatch[1];
        } else {
          // Fallback: extract the first URL literal starting with http anywhere in the code
          const fallbackMatch = currentActive.content.match(/https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9._]*\.[a-zA-Z]{2,}(?:\/[^'"\s]*)?/);
          if (fallbackMatch) {
            initialUrl = fallbackMatch[0];
          }
        }
      }
      setExtractedUrl(initialUrl);
      executeCode();
    } else {
      executeCode();
    }
  };
  const handleBuild = () => executeCode('build');
  const handleDotnetRun = () => executeCode('run');

  const handleOpenPreviewNewTab = () => {
    if (!webPreviewCode) {
      toast.info('No output available yet. Click RUN first.');
      return;
    }
    const blob = new Blob([webPreviewCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleAndroidBuild = async () => {
    if (!sessionId) return;
    if (isAndroidBuilding) {
      toast.info('A build is already running.');
      return;
    }
    setIsAndroidBuilding(true);
    setAndroidBuildLogs(
      'Starting Android build...\n' +
      'First build in a new session downloads Gradle + dependencies (often 3–8 min).\n' +
      'Later builds reuse the cache and are much faster.\n' +
      'Live logs stream below...\n'
    );
    setAndroidApkUrl(null);

    try {
      const response = await startAndroidBuild(sessionId);
      if (response && response.success) {
        toast.info('Android build started. First build can take several minutes.');

        let offset = 0;
        let isDone = false;
        const startedAt = Date.now();
        const MAX_BUILD_MS = 20 * 60 * 1000; // 20 minutes hard stop

        const pollInterval = setInterval(async () => {
          if (isDone) {
            clearInterval(pollInterval);
            return;
          }

          if (Date.now() - startedAt > MAX_BUILD_MS) {
            isDone = true;
            clearInterval(pollInterval);
            setIsAndroidBuilding(false);
            setAndroidBuildLogs(prev => prev + '\n\nBuild timed out after 20 minutes. Click BUILD to retry.');
            toast.error('Android build timed out.');
            return;
          }

          try {
            const statusRes = await fetchAndroidBuildStatus(sessionId, offset);
            if (statusRes) {
              if (statusRes.logs) {
                setAndroidBuildLogs(prev => prev + statusRes.logs);
              }
              offset = statusRes.offset;

              if (statusRes.status === 'SUCCESS') {
                isDone = true;
                clearInterval(pollInterval);
                setIsAndroidBuilding(false);
                toast.success('Android build completed successfully!');
                const token = useAuthStore.getState().auth.accessToken;
                const downloadUrl = `${resolveApiRelativeUrl('/api/android/download')}?sessionId=${sessionId}&token=${encodeURIComponent(token || '')}`;
                setAndroidApkUrl(downloadUrl);
              } else if (statusRes.status === 'FAILED') {
                isDone = true;
                clearInterval(pollInterval);
                setIsAndroidBuilding(false);
                toast.error('Android build failed. Check logs.');
              }
            }
          } catch (pollErr: any) {
            console.error('Error polling android build status:', pollErr);
          }
        }, window.location.hostname === 'localhost' ? 5000 : 2000);
      } else {
        setAndroidBuildLogs(prev => prev + '\nError: No response received or build failed to trigger.');
        toast.error('Android build failed to start.');
        setIsAndroidBuilding(false);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Failed to start build.';
      const isConflict = /already running|409/i.test(errMsg);
      setAndroidBuildLogs(prev => prev + `\nError: ${errMsg}`);
      toast.error(isConflict ? 'A build is already running. Wait for it to finish.' : `Android build failed: ${errMsg}`);
      setIsAndroidBuilding(false);
    }
  };

  const handleDownloadApk = () => {
    if (!androidApkUrl) return;
    const link = document.createElement('a');
    link.href = androidApkUrl;
    link.setAttribute('download', 'app-debug.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resolveCreateFolderPath = (explicitPath?: string) => {
    const folderPaths = new Set<string>();
    files.forEach((f) => {
      const parts = String(f.path || '').split('/').filter(Boolean);
      // /workspace/a/b/c.java → folders: /workspace, /workspace/a, /workspace/a/b
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc += `/${parts[i]}`;
        folderPaths.add(acc);
      }
    });
    folderPaths.add('/workspace');

    const candidates = [
      explicitPath,
      selectedFolderPath,
      activeFile?.path ? activeFile.path.substring(0, activeFile.path.lastIndexOf('/')) : '',
      '/workspace',
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (folderPaths.has(candidate)) return candidate;
    }
    return '/workspace';
  };

  const handleAddFile = async (targetFolderPath?: string) => {
    if (openFilePaths.length >= 8) {
      toast.error('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
      return;
    }

    const currentLab = labs.find(l => l.id === labId || l.name?.toLowerCase() === labId || l.title?.toLowerCase() === labId);
    const labName = currentLab?.name || currentLab?.title || '';
    const rules = getLabExtensionRules(labName, labId);

    let defaultExt = 'txt';
    if (isJava) {
      defaultExt = 'java';
    } else if (rules.extensions.includes('py')) {
      defaultExt = 'py';
    } else if (rules.extensions.includes('java')) {
      defaultExt = 'java';
    } else if (rules.extensions.includes('cs')) {
      defaultExt = 'cs';
    } else if (rules.extensions.length > 0) {
      defaultExt = rules.extensions[0];
    }
    const defaultName = isDotnet
      ? 'Program.cs'
      : isAndroid
        ? 'MainActivity.java'
        : (isJava || defaultExt === 'java')
          ? 'Main.java'
          : `script.${defaultExt}`;

    const createIn = resolveCreateFolderPath(targetFolderPath);
    setSelectedFolderPath(createIn);

    const folderLabel = createIn.replace(/^\/workspace\/?/, '') || 'workspace root';
    const fileName = window.prompt(`Create file in:\n${folderLabel}\n\nEnter file name:`, defaultName);
    if (!fileName) return;

    const hasExtension = fileName.includes('.') && fileName.split('.').pop() !== '';
    const ext = hasExtension ? fileName.split('.').pop()?.toLowerCase() || '' : '';
    if (!hasExtension || !rules.extensions.includes(ext)) {
      toast.error(
        `Workspace Restriction: Invalid file extension. Only the following extensions are allowed for ${rules.courseName}: ${rules.extensions.map(e => `.${e}`).join(', ')}`
      );
      return;
    }

    const javaClassName = fileName.replace(/\.java$/, '') || 'Main';
    const javaStarter = `public class ${javaClassName} {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n`;

    const newFile = {
      name: fileName,
      path: `${createIn}/${fileName}`,
      type: 'file',
      language: detectLanguage(fileName),
      content: isDotnet && fileName === 'Program.cs'
        ? DOTNET_CONSOLE_STARTER
        : (isJava || fileName.endsWith('.java'))
          ? javaStarter
          : '',
    };
    if (sessionId) {
      const existingIdx = files.findIndex(f => f.path === newFile.path);
      const targetIdx = existingIdx !== -1 ? existingIdx : files.length;

      setFiles(prev => {
        const next = [...prev];
        if (existingIdx !== -1) {
          next[existingIdx] = newFile;
        } else {
          next.push(newFile);
        }
        filesRef.current = next;
        return next;
      });
      setOpenFilePaths(prev => {
        if (!prev.includes(newFile.path)) return [...prev, newFile.path];
        return prev;
      });
      setLoadedPaths(prev => {
        const next = new Set(prev);
        next.add(newFile.path);
        return next;
      });
      lastSavedContentRef.current.set(newFile.path, newFile.content);
      dirtyPathsRef.current.delete(newFile.path);
      setActiveFileIndex(targetIdx);
      try {
        await saveFile(newFile, sessionId);
        toast.success(`Created ${fileName} in ${folderLabel}`);
        await refreshFiles(false);
      } catch (err) {
        console.error('Failed to save newly added file on backend:', err);
        toast.error('Failed to create file');
      }
      const updatedList = existingIdx !== -1
        ? files.map((f, i) => i === existingIdx ? newFile : f)
        : [...files, newFile];
      selectFile(targetIdx, updatedList).catch(() => { });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadName = isDotnet ? normalizeDotnetUploadName(file.name) : file.name;
    const filePath = `/workspace/${uploadName}`;
    const exists = files.some(f => f.path === filePath);

    if (!exists && files.length >= 5) {
      toast.error('Workspace Limit Reached: You can have a maximum of 5 files in the workspace.');
      return;
    }

    if (!openFilePaths.includes(filePath) && openFilePaths.length >= 8) {
      toast.error('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
      return;
    }

    const currentLab = labs.find(l => l.id === labId || l.name?.toLowerCase() === labId || l.title?.toLowerCase() === labId);
    const labName = currentLab?.name || currentLab?.title || '';
    const rules = getLabExtensionRules(labName, labId);

    const hasExtension = uploadName.includes('.') && uploadName.split('.').pop() !== '';
    const fileExt = hasExtension ? uploadName.split('.').pop()?.toLowerCase() || '' : '';
    if (!hasExtension || !rules.extensions.includes(fileExt)) {
      toast.error(
        `Workspace Restriction: Invalid file extension. Only the following extensions are allowed for ${rules.courseName}: ${rules.extensions.map(e => `.${e}`).join(', ')}`
      );
      return;
    }

    if (isDotnet && uploadName !== file.name) {
      toast.info(`Renamed upload to ${uploadName} for .NET MVC compatibility`);
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileContent = e.target?.result as string;
      const newFile = { name: uploadName, path: filePath, type: 'file', language: detectLanguage(uploadName), content: fileContent };
      if (sessionId) {
        // Optimistically add to files, open tab, and select it
        setFiles(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(f => f.path === newFile.path);
          if (idx !== -1) {
            updated[idx] = newFile;
          } else {
            updated.push(newFile);
          }
          return updated;
        });
        setOpenFilePaths(prev => {
          if (prev.includes(newFile.path)) return prev;
          return [...prev, newFile.path];
        });

        const newFilesList = [...files];
        const existingIdx = newFilesList.findIndex(f => f.path === newFile.path);
        if (existingIdx !== -1) {
          newFilesList[existingIdx] = newFile;
        } else {
          newFilesList.push(newFile);
        }
        const targetIdx = newFilesList.findIndex(f => f.path === newFile.path);
        if (targetIdx !== -1) {
          selectFile(targetIdx, newFilesList);
        }

        // Save to backend and refresh in background
        (async () => {
          try {
            await saveFile(newFile, sessionId);
            await refreshFiles(false);
          } catch (err) {
            console.error('Failed to save uploaded file on backend:', err);
          }
        })();
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloseFile = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (path === 'chrome-preview') {
      setOpenFilePaths(prev => {
        const next = prev.filter(p => p !== 'chrome-preview');
        setIsPreviewTabActive(false);
        if (next.length > 0) {
          const newActivePath = next[next.length - 1];
          const newActiveIdx = files.findIndex(f => f.path === newActivePath);
          setActiveFileIndex(newActiveIdx);
        } else {
          setActiveFileIndex(-1);
        }
        return next;
      });
      return;
    }

    setOpenFilePaths(prev => {
      const next = prev.filter(p => p !== path);
      const closedFileIdx = files.findIndex(f => f.path === path);
      if (activeFileIndex === closedFileIdx) {
        if (next.length > 0) {
          const newActivePath = next[next.length - 1];
          if (newActivePath === 'chrome-preview') {
            setIsPreviewTabActive(true);
          } else {
            const newActiveIdx = files.findIndex(f => f.path === newActivePath);
            setActiveFileIndex(newActiveIdx);
            setIsPreviewTabActive(false);
          }
        } else {
          setActiveFileIndex(-1);
          setIsPreviewTabActive(false);
        }
      }
      return next;
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    const idx = activeFileIndexRef.current;
    const path = filesRef.current[idx]?.path;
    if (idx < 0 || !path) return;

    markPathLoaded(path);
    dirtyPathsRef.current.add(path);

    // Immediately update ref so Run, Save, and tab switching always have the latest content with 0 latency
    if (filesRef.current[idx]) {
      filesRef.current[idx].content = value;
    }

    // Debounce the heavy React component tree re-render so Monaco typing stays 60fps smooth
    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
    }
    typingDebounceTimerRef.current = setTimeout(() => {
      setFiles((prev) => {
        const currentIdx = prev[idx]?.path === path ? idx : prev.findIndex((f) => f.path === path);
        if (currentIdx < 0) return prev;
        if (prev[currentIdx].content === value) return prev;
        const updated = [...prev];
        updated[currentIdx] = { ...updated[currentIdx], content: value };
        return updated;
      });
    }, 200);
  };

  if (isLoading && !sessionId) {
    return (
      <div className="h-full w-full bg-[#f4f6f8] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Connecting to Lab Environment...</p>
      </div>
    );
  }

  const currentLab = labs.find(l => l.id === labId || l.name?.toLowerCase() === labId || l.title?.toLowerCase() === labId);
  const currentLabName = currentLab?.name || currentLab?.title || propSession?.labName || '';
  const labRules = getLabExtensionRules(currentLabName, labId);
  const isPythonLab = (labRules.courseName || '').toLowerCase().includes('python') || labId.toLowerCase().includes('python') || labType === 'python';
  const labTitle = isPythonLab ? 'Python Lab' : (labRules.courseName || 'Virtual Lab');
  const labSubtitle = isPythonLab ? 'Write, Run and Explore Python Programs' : `Write, Run and Explore ${labTitle} Programs`;

  const needsInput = !!consoleSession && !consoleSession.isRunning && !consoleSession.success && !consoleSession.error;

  const handleTerminalConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInputValue.trim() || !consoleSession || consoleSession.isRunning) return;
    const val = consoleInputValue;
    setConsoleInputValue('');
    const newLines = [...consoleSession.stdinLines, val];
    runConsoleInteractive(consoleSession.code, newLines);
  };

  return (
    <div className="h-full w-full bg-[#f4f6f8] flex flex-col p-3 sm:p-4 gap-3.5 select-none font-sans overflow-hidden relative">
      {/* Soft ambient corner accents matching the reference design */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-red-200/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 px-4 py-3 flex items-center justify-between shrink-0 gap-3 z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm shadow-red-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3 min-w-0">
            {isPythonLab ? (
              <PythonIcon className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Code2 size={20} />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                {labTitle}
              </h1>
              <span className="text-[11px] text-slate-500 font-normal truncate">
                {labSubtitle}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {remainingTime && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-mono font-bold shadow-xs">
              <Clock size={14} className="text-red-500 shrink-0" />
              <span>{remainingTime}</span>
            </div>
          )}

          {activeLabWallet && (
            <div className="hidden lg:flex items-center gap-1.5 text-emerald-700 font-mono text-xs font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-xs">
              <Coins size={14} className="text-emerald-600 shrink-0" />
              <span>{displayTokens} TOKENS</span>
            </div>
          )}

          {isAndroid && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAndroidBuild}
                disabled={isAndroidBuilding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Play size={13} className="fill-white" />
                <span>{isAndroidBuilding ? 'Building...' : 'Build'}</span>
              </button>
              {androidApkUrl && (
                <button
                  onClick={handleDownloadApk}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
                >
                  <Download size={13} />
                  <span>APK</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm shadow-red-500/20 active:scale-95 transition-all cursor-pointer"
            title="Run Code (Ctrl+Enter)"
          >
            {isRunning ? (
              <RotateCw size={14} className="animate-spin text-white" />
            ) : (
              <Play size={14} className="fill-white text-white" />
            )}
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>

          <button
            onClick={() => {
              resetEditorState();
              onStopLab?.();
            }}
            className="flex items-center gap-2 px-5 py-2 bg-[#fff1f2] hover:bg-[#ffe4e6] text-rose-600 border border-rose-200 font-semibold text-xs sm:text-sm rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Stop Lab Session"
          >
            <div className="w-3 h-3 bg-rose-600 rounded-xs" />
            <span>Stop</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Files on Left, Editor + Output on Right */}
      <div className="flex-1 flex gap-3.5 min-h-0 min-w-0 z-10">
        {/* Left Files Sidebar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 flex flex-col justify-between shrink-0 w-60 sm:w-64 md:w-72 h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <span className="text-sm font-bold text-slate-800 tracking-tight">Files</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSync}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Sync Workspace"
              >
                <RotateCw size={15} className={isLoading || isRefreshingFiles ? 'animate-spin text-red-500' : ''} />
              </button>
              <button
                onClick={() => handleAddFile()}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Options"
              >
                <MoreVertical size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-0.5">
            {buildFileTree(files).map((node) => renderTreeNode(node, 0))}
            {files.length === 0 && !isLoading && (
              <div className="py-8 text-center text-xs text-slate-400">
                No files in workspace
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 shrink-0">
            <button
              onClick={() => handleAddFile()}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-red-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>New File</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 bg-white hover:bg-rose-50/50 text-rose-600 border border-rose-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <Upload size={14} />
              <span>Upload File</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
          </div>
        </div>

        {/* Right Area: Top Editor Card & Bottom Output Card */}
        <div className="flex-1 flex flex-col gap-3.5 min-w-0 h-full overflow-hidden">
          {/* Top: Code Editor Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 flex flex-col overflow-hidden flex-1 min-h-[220px]">
            {/* Tab Bar */}
            <div className="bg-slate-50/70 border-b border-slate-200/80 px-3 pt-2.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
                {openFilePaths.map((path) => {
                  if (path === 'chrome-preview') {
                    const isActive = isPreviewTabActive;
                    return (
                      <div
                        key={path}
                        onClick={() => setIsPreviewTabActive(true)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer transition-colors shrink-0 text-xs font-semibold ${
                          isActive
                            ? 'bg-white border-t-2 border-t-rose-600 border-x border-slate-200/90 text-slate-900 shadow-xs -mb-[1px]'
                            : 'bg-slate-100/70 hover:bg-slate-200/60 text-slate-600'
                        }`}
                      >
                        <Globe size={13} className="text-emerald-500" />
                        <span className="truncate max-w-[120px]">{browserTitle}</span>
                        <button
                          onClick={(e) => handleCloseFile(e, 'chrome-preview')}
                          className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  const file = files.find((f) => f.path === path);
                  if (!file) return null;
                  const idx = files.findIndex((f) => f.path === path);
                  const isActive = activeFileIndex === idx && !isPreviewTabActive;
                  return (
                    <div
                      key={path}
                      onClick={() => selectFile(idx)}
                      className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-t-lg cursor-pointer transition-colors shrink-0 text-xs font-semibold ${
                        isActive
                          ? 'bg-white border-t-2 border-t-rose-600 border-x border-slate-200/90 text-slate-900 shadow-xs -mb-[1px]'
                          : 'bg-slate-100/70 hover:bg-slate-200/60 text-slate-600'
                      }`}
                    >
                      {getFileIcon(file.name)}
                      <span className="truncate max-w-[130px]">{file.name}</span>
                      <button
                        onClick={(e) => handleCloseFile(e, path)}
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}

                <button
                  onClick={() => handleAddFile()}
                  className="p-1 hover:bg-slate-200/70 rounded-md text-slate-500 hover:text-slate-800 transition-colors ml-1"
                  title="New File"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0 pb-1">
                <button
                  onClick={() => handleSave(true)}
                  disabled={isSaving || !isContentReady}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
                  title="Save File (Ctrl+S)"
                >
                  <Save size={13} />
                  <span>{isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
                  title="Download File"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            {/* Monaco Editor Canvas */}
            <div className="bg-[#131722] flex-1 overflow-hidden relative rounded-b-2xl">
              {isPreviewTabActive ? (
                <TestingWorkspace
                  ref={testingWorkspaceRef}
                  session={propSession}
                  sessionId={sessionId}
                  runState={seleniumRunState}
                  setRunState={setSeleniumRunState}
                  onRun={executeCode}
                  onClose={() => handleCloseFile(new MouseEvent('click') as any, 'chrome-preview')}
                  initialAddressUrl={extractedUrl}
                />
              ) : activeFileIndex !== -1 && activeFile ? (
                isContentLoading ? (
                  <div className="flex-1 h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-rose-500 rounded-full animate-spin" />
                    <p className="text-xs uppercase tracking-widest font-semibold">Loading {activeFile.name}...</p>
                  </div>
                ) : (
                  <Editor
                    height="100%"
                    language={activeFile.language}
                    path={activeFile.path}
                    value={activeFile.content ?? ''}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    keepCurrentModel
                    onMount={(editor, monaco) => {
                      editorRef.current = editor;
                      try {
                        monaco.editor.defineTheme('lab-dark-theme', {
                          base: 'vs-dark',
                          inherit: true,
                          rules: [],
                          colors: {
                            'editor.background': '#131722',
                            'editorGutter.background': '#131722',
                            'editorLineNumber.foreground': '#4b5563',
                            'editorLineNumber.activeForeground': '#9ca3af',
                          }
                        });
                        monaco.editor.setTheme('lab-dark-theme');
                      } catch (_) {}
                      editor.focus();
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 16, bottom: 16 },
                      automaticLayout: true,
                      readOnly: !isContentReady,
                      fontFamily: "'Fira Code', 'Cascadia Code', Consolas, Monaco, monospace",
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                    }}
                  />
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Code2 className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-300">No file open</p>
                  <p className="text-xs text-slate-500 mt-1">Select a file from the left sidebar or create a new file to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Draggable Vertical Splitter Bar */}
          <div
            onMouseDown={handleSplitterMouseDown}
            onTouchStart={handleSplitterTouchStart}
            onDoubleClick={() => {
              setIsOutputCollapsed(false);
              setIsOutputMaximized(false);
              setOutputHeight(270);
            }}
            className="group relative flex items-center justify-center h-3 -my-1 cursor-row-resize z-20 select-none transition-colors"
            title="Drag up or down to stretch/resize Output panel (Double-click to reset)"
          >
            <div className="w-full h-[2px] rounded-full bg-slate-200/90 group-hover:bg-rose-400 group-active:bg-rose-600 transition-colors flex items-center justify-center">
              <div className="px-3 py-0.5 bg-white group-hover:bg-rose-50 border border-slate-300 group-hover:border-rose-400 rounded-full shadow-xs flex items-center gap-1 transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-rose-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-rose-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-rose-500" />
              </div>
            </div>
          </div>

          {/* Bottom: Output Card */}
          <div
            style={{
              height: isOutputCollapsed
                ? '42px'
                : isOutputMaximized
                  ? '75vh'
                  : `${outputTab === 'plot' && outputHeight === 270 ? 420 : outputHeight}px`
            }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/90 flex flex-col overflow-hidden transition-[height] duration-150 shrink-0"
          >
            {/* Output Header */}
            <div className="bg-slate-50/70 border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 h-10">
              <div className="flex items-center gap-4 h-full">
                <button
                  onClick={() => {
                    setOutputTab('output');
                    if (isOutputCollapsed) setIsOutputCollapsed(false);
                  }}
                  className={`border-b-2 h-full px-2 flex items-center gap-2 text-xs font-bold transition-colors -mb-[1px] cursor-pointer ${
                    outputTab === 'output' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText size={14} className={outputTab === 'output' ? 'text-rose-600' : 'text-slate-400'} />
                  <span>Output</span>
                </button>

                {terminalOutput.plotHtml && (
                  <button
                    onClick={() => {
                      setOutputTab('plot');
                      if (isOutputCollapsed) setIsOutputCollapsed(false);
                    }}
                    className={`border-b-2 h-full px-2 flex items-center gap-2 text-xs font-bold transition-colors -mb-[1px] cursor-pointer ${
                      outputTab === 'plot' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LineChart size={14} className={outputTab === 'plot' ? 'text-rose-600' : 'text-slate-400'} />
                    <span>Graph / Plot</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </button>
                )}

                {(webPreviewCode || activeFile?.language === 'html') && (
                  <button
                    onClick={() => {
                      setOutputTab('preview');
                      if (isOutputCollapsed) setIsOutputCollapsed(false);
                    }}
                    className={`border-b-2 h-full px-2 flex items-center gap-2 text-xs font-bold transition-colors -mb-[1px] cursor-pointer ${
                      outputTab === 'preview' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Globe size={14} className={outputTab === 'preview' ? 'text-rose-600' : 'text-slate-400'} />
                    <span>Web Preview</span>
                  </button>
                )}

                {isAndroid && (
                  <button
                    onClick={() => {
                      setOutputTab('logs');
                      if (isOutputCollapsed) setIsOutputCollapsed(false);
                    }}
                    className={`border-b-2 h-full px-2 flex items-center gap-2 text-xs font-bold transition-colors -mb-[1px] cursor-pointer ${
                      outputTab === 'logs' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <TerminalIcon size={14} className={outputTab === 'logs' ? 'text-rose-600' : 'text-slate-400'} />
                    <span>Build Logs</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {outputTab === 'plot' && terminalOutput.plotHtml && (
                  <button
                    onClick={() => {
                      const blob = new Blob([terminalOutput.plotHtml!], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }}
                    className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Open graph in full new window"
                  >
                    <ExternalLink size={12} />
                    <span>Full Window</span>
                  </button>
                )}
                {outputTab === 'logs' && (
                  <button
                    onClick={handleCopyLogs}
                    className="text-slate-500 hover:text-slate-800 text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors"
                  >
                    {copiedLogs ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setTerminalOutput({
                      command: isAndroid
                        ? './build.sh'
                        : isDotnet
                          ? 'dotnet run'
                          : isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')
                            ? `java ${activeFile?.name || 'Main.java'}`
                            : `python ${activeFile?.name || 'main.py'}`,
                      output: '',
                      plotHtml: null,
                      status: 'idle'
                    });
                    setOutputTab('output');
                    setConsoleSession(null);
                  }}
                  className="text-slate-400 hover:text-slate-700 text-xs flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Clear Terminal Output"
                >
                  <RotateCcw size={12} />
                  <span>Clear</span>
                </button>

                <div className="h-4 w-[1px] bg-slate-300 mx-0.5" />

                {/* Stretch Maximize / Restore Toggle */}
                <button
                  onClick={() => {
                    setIsOutputCollapsed(false);
                    setIsOutputMaximized((prev) => !prev);
                  }}
                  className="text-slate-500 hover:text-slate-800 text-xs p-1.5 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title={isOutputMaximized ? "Restore height (Stretch down)" : "Maximize height (Stretch up)"}
                >
                  {isOutputMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>

                {/* Collapse / Expand Toggle */}
                <button
                  onClick={() => {
                    setIsOutputMaximized(false);
                    setIsOutputCollapsed((prev) => !prev);
                  }}
                  className="text-slate-500 hover:text-slate-800 text-xs p-1.5 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title={isOutputCollapsed ? "Expand output" : "Collapse output"}
                >
                  {isOutputCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Output Screen */}
            {!isOutputCollapsed && (
              <div className={`bg-[#131722] flex-1 ${outputTab === 'plot' ? 'p-2' : 'p-4'} font-mono text-xs sm:text-sm text-slate-100 overflow-y-auto flex flex-col justify-between rounded-b-2xl select-text`}>
                {outputTab === 'plot' && terminalOutput.plotHtml ? (
                  <div className="relative w-full h-full min-h-[300px] flex flex-col bg-white rounded-xl overflow-hidden shadow-inner">
                    <iframe
                      srcDoc={terminalOutput.plotHtml}
                      className="w-full h-full border-0 bg-white"
                      title="Interactive Plot"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    />
                  </div>
                ) : outputTab === 'preview' && webPreviewCode ? (
                  <iframe
                    srcDoc={webPreviewCode}
                    className="w-full h-full border-0 bg-white rounded-lg"
                    title="Web Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : outputTab === 'logs' ? (
                  <pre className="font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text text-slate-300 m-0 font-normal">
                    {androidBuildLogs}
                  </pre>
                ) : (
                  <div className="flex flex-col h-full justify-between">
                    <div className="flex-1 overflow-y-auto">
                      {/* Command Prompt line */}
                      <div className="text-sky-400 font-semibold mb-2 select-text font-mono">
                        $ {terminalOutput.command || (isAndroid ? './build.sh' : isDotnet ? 'dotnet run' : (isJava || activeFile?.language === 'java' || activeFile?.name?.endsWith('.java')) ? `java ${activeFile?.name || 'Main.java'}` : `python ${activeFile?.name || 'main.py'}`)}
                      </div>

                      {/* Interactive graph notification banner */}
                      {terminalOutput.plotHtml && (
                        <div className="my-2.5 p-2.5 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-3 shadow-xs font-sans">
                          <div className="flex items-center gap-2.5 text-xs text-slate-200">
                            <LineChart size={16} className="text-emerald-400 shrink-0" />
                            <span>Interactive graph generated successfully</span>
                          </div>
                          <button
                            onClick={() => setOutputTab('plot')}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                          >
                            <span>View Graph</span>
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      )}

                      {/* Console / Terminal output content */}
                      {consoleSession?.active ? (
                        <div>
                          {consoleSession.stdinLines.length > 0 && (
                            <div className="mb-2 space-y-0.5 select-text">
                              {consoleSession.stdinLines.map((inp, idx) => (
                                <div key={idx} className="font-mono text-xs sm:text-sm text-yellow-300">
                                  &gt; {inp}
                                </div>
                              ))}
                            </div>
                          )}

                          {consoleSession.output && (
                            <pre className="font-mono text-xs sm:text-sm whitespace-pre overflow-x-auto leading-relaxed select-text text-slate-100 m-0 font-normal">
                              {consoleSession.output}
                            </pre>
                          )}

                          {consoleSession.error && (
                            <pre className="font-mono text-xs sm:text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed select-text text-rose-400 mt-2 m-0 font-normal">
                              {consoleSession.error}
                            </pre>
                          )}

                          {needsInput && (
                            <form onSubmit={handleTerminalConsoleSubmit} className="flex items-center gap-2 mt-2">
                              <span className="text-yellow-400 font-mono text-sm">&gt;</span>
                              <input
                                type="text"
                                value={consoleInputValue}
                                onChange={(e) => setConsoleInputValue(e.target.value)}
                                className="flex-1 bg-transparent border-b border-rose-500/60 focus:border-rose-500 outline-none text-yellow-300 font-mono text-xs sm:text-sm py-0.5"
                                placeholder="Type input and press Enter"
                                autoFocus
                              />
                              <button
                                type="submit"
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                              >
                                Send
                              </button>
                            </form>
                          )}

                          {!needsInput && !consoleSession.isRunning && consoleSession.success && !consoleSession.output && (
                            <div className="text-slate-500 text-xs italic mt-1">
                              (Program finished with no output)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {terminalOutput.output ? (
                            <pre className="font-mono text-xs sm:text-sm whitespace-pre overflow-x-auto leading-relaxed select-text text-slate-100 m-0 font-normal">
                              {terminalOutput.output}
                            </pre>
                          ) : terminalOutput.status === 'success' ? (
                            <div className="text-slate-500 text-xs italic select-text">
                              (Program finished with no output)
                            </div>
                          ) : null}
                          {terminalOutput.error && (
                            <pre className="font-mono text-xs sm:text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed select-text text-rose-400 mt-2 m-0 font-normal">
                              {terminalOutput.error}
                            </pre>
                          )}
                          {terminalOutput.status === 'idle' && !terminalOutput.output && !terminalOutput.error && !isRunning && (
                            <div className="text-slate-500 text-xs italic mt-1">
                              Click &quot;Run&quot; to execute your program.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Completion Badges at the bottom */}
                    <div className="shrink-0 pt-2 border-t border-slate-800/80 mt-2">
                      {isRunning || (consoleSession?.active && consoleSession.isRunning) ? (
                        <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                          <RotateCw size={13} className="animate-spin text-amber-400" />
                          <span>Running program...</span>
                        </div>
                      ) : consoleSession?.active && needsInput ? (
                        <div className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>Waiting for input...</span>
                        </div>
                      ) : (consoleSession?.active && consoleSession.success) || (!consoleSession?.active && terminalOutput.status === 'success') ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Check size={11} className="stroke-[3]" />
                          </div>
                          <span>Process completed successfully</span>
                        </div>
                      ) : (consoleSession?.active && consoleSession.error) || (!consoleSession?.active && terminalOutput.status === 'error') ? (
                        <div className="flex items-center gap-2 text-rose-400 font-medium text-xs">
                          <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                            <X size={11} className="stroke-[3]" />
                          </div>
                          <span>Process exited with error</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <SeleniumExecutionDialog
        open={isSeleniumDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsSeleniumDialogOpen(false);
            if (seleniumResolve) {
              seleniumResolve(null as any);
              setSeleniumResolve(null);
            }
          }
        }}
        onConfirm={(mode) => {
          setIsSeleniumDialogOpen(false);
          if (seleniumResolve) {
            seleniumResolve(mode);
            setSeleniumResolve(null);
          }
        }}
      />
    </div>
  );
};

export default CloudEditor;
