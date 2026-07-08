import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import { fetchFileContent, fetchFiles, runFile, saveFile, deleteFile } from '../../services/ideService';
import {
  File, Code2, Plus, Upload, Play, Save, AlignLeft,
  Trash2, X, FileJson, FileText, ChevronRight, Menu, Download, ArrowLeft, Power, MonitorPlay, Database, Terminal as TerminalIcon,
  Folder, FolderOpen, RotateCw
} from 'lucide-react';
import Terminal from './Terminal';
import { useLabStore } from '@/stores/labStore';

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': case 'ipynb': return <Code2 className="text-[#3776AB] w-4 h-4 shrink-0" />;
    case 'js': case 'jsx': return <Code2 className="text-[#F7DF1E] w-4 h-4 shrink-0" />;
    case 'html': return <Code2 className="text-orange-500 w-4 h-4 shrink-0" />;
    case 'css': return <Code2 className="text-blue-300 w-4 h-4 shrink-0" />;
    case 'java': return <Code2 className="text-[#007396] w-4 h-4 shrink-0" />;
    case 'cs': return <Code2 className="text-[#68217A] w-4 h-4 shrink-0" />;
    case 'cshtml': return <Code2 className="text-[#512BD4] w-4 h-4 shrink-0" />;
    case 'json': return <FileJson className="text-amber-500 w-4 h-4 shrink-0" />;
    case 'md': case 'csv': case 'txt': case 'log': return <FileText className="text-emerald-500 w-4 h-4 shrink-0" />;
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
  if (name.includes('java development') || id.includes('java-development')) {
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
      if (partIdx === 0 && part === 'workspace') return;

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
  /Console\.ReadLine\s*\(/.test(code) || /Console\.Read\s*\(/.test(code);

const countConsoleReads = (code: string) => {
  const readLine = (code.match(/Console\.ReadLine\s*\(/g) || []).length;
  const readChar = (code.match(/Console\.Read\s*\(/g) || []).length;
  return readLine + readChar;
};

const extractConsoleOutput = (raw: string) => {
  const marker = '--- PROGRAM OUTPUT ---';
  const idx = raw.indexOf(marker);
  if (idx === -1) {
    return raw.replace(/\r?\nRUN_EXIT:\d+\s*$/i, '').trim();
  }
  const body = raw.slice(idx + marker.length);
  const end = body.search(/\r?\nRUN_EXIT:/i);
  return (end === -1 ? body : body.slice(0, end)).replace(/^\r?\n/, '').trimEnd();
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
  const readCount = Math.max(countConsoleReads(session.code), needsConsoleInput(session.code) ? 1 : 0);
  const needsInput = readCount > 0 && session.stdinLines.length < readCount && !session.isRunning;

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
    : session.success
      ? 'Execution Succeeded'
      : session.error
        ? 'Execution Failed'
        : 'Console';

  const statusClass = session.isRunning
    ? 'text-white/60'
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
        {session.isRunning && (
          <span className="block mt-2 text-white/40 animate-pulse">Running...</span>
        )}
        {!session.output && !session.isRunning && (
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

const CloudEditor = ({ session: propSession, onStopLab, onBack }: any) => {
  const location = useLocation();
  const editorRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const [labId, setLabId] = useState('');

  const labType = propSession?.labType || '';
  const isAndroid = labType === 'android' || labId === 'android' || labId === 'mobile-app-lab';
  const isDotnet = labType === 'dotnet' || labId === 'dotnet-lab' || labId.includes('dotnet');

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [restrictionMsg, setRestrictionMsg] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const renderTreeNode = (node: any, depth: number) => {
    const isExpanded = expandedFolders.has(node.path);
    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 px-4 py-1 hover:bg-[#2a2d2e] cursor-pointer transition-colors"
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
          >
            <ChevronRight
              size={14}
              className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
            {isExpanded ? (
              <FolderOpen size={14} className="text-amber-400 shrink-0" />
            ) : (
              <Folder size={14} className="text-amber-500 shrink-0" />
            )}
            <span className="text-slate-300 text-[12px] font-medium truncate">{node.name}</span>
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
            if (!openFilePaths.includes(file.path)) {
              if (openFilePaths.length >= 8) {
                toast.error('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
                return;
              }
              setOpenFilePaths(prev => [...prev, file.path]);
            }
            selectFile(i);
          }}
          className={`group flex items-center gap-2 py-1 cursor-pointer border-l-2 transition-all ${isActive ? 'bg-[#37373d] border-red-500' : 'border-transparent hover:bg-[#2a2d2e]'
            }`}
          style={{ paddingLeft: `${depth * 12 + 30}px`, paddingRight: '16px' }}
        >
          {getFileIcon(file.name)}
          <span className={`text-[12px] truncate flex-1 ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>
            {file.name}
          </span>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) return;
              if (!sessionId) return;
              try {
                await deleteFile(file.path, sessionId);
                await handleSync();
              } catch (err: any) {
                console.error('Delete error:', err);
                toast.error(`Failed to delete file: ${err.message || 'Unknown error'}`);
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/10"
            title="Delete file"
          >
            <Trash2 size={12} />
          </button>
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

  const markPathLoaded = (path: string) => {
    if (!path) return;
    setLoadedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  };
  const lastSavedContentRef = useRef<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [runningAction, setRunningAction] = useState<'build' | 'run' | null>(null);
  const [dotnetBuildReady, setDotnetBuildReady] = useState(false);
  const isRunning = runningAction !== null;
  const [webPreviewCode, setWebPreviewCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [consoleSession, setConsoleSession] = useState<ConsoleSessionState | null>(null);

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const terminalRef = useRef<any>(null);

  const handleTerminalResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.8, startHeight + deltaY));
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const [isRefreshingFiles, setIsRefreshingFiles] = useState(false);

  const refreshFiles = async (showLoading = false) => {
    if (!sessionId) return;
    if (showLoading) setIsLoading(true);
    else setIsRefreshingFiles(true);
    try {
      const response = await fetchFiles(sessionId);
      if (response.success) {
        // Track the current active file's path to restore index properly after reload
        const activePath = activeFileIndex >= 0 && files[activeFileIndex] ? files[activeFileIndex].path : null;

        // Merge existing loaded file contents into the refreshed file list to avoid clearing editor contents
        const mergedFiles = response.files.map((newFile: any) => {
          const existing = files.find(f => f.path === newFile.path);
          if (existing && existing.content !== undefined) {
            return { ...newFile, content: existing.content };
          }
          return newFile;
        });

        setFiles(mergedFiles);
        mergedFiles.forEach((file: any) => {
          if (file?.path && file.content !== undefined) {
            markPathLoaded(file.path);
            lastSavedContentRef.current.set(file.path, file.content ?? '');
          }
        });

        setOpenFilePaths(prev => {
          if (prev.length === 0 && response.files.length > 0) {
            return response.files.map((f: any) => f.path).slice(0, 8);
          }
          const validPaths = response.files.map((f: any) => f.path);
          return prev.filter(p => validPaths.includes(p));
        });

        // Clean up loaded paths for deleted files
        setLoadedPaths(prev => {
          const next = new Set(prev);
          const newPaths = response.files.map((f: any) => f.path);
          prev.forEach(p => {
            if (!newPaths.includes(p)) {
              next.delete(p);
            }
          });
          return next;
        });

        if (activePath) {
          const newIdx = mergedFiles.findIndex((f: any) => f.path === activePath);
          setActiveFileIndex(newIdx);
        }
        return mergedFiles;
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
      setSessionId(finalSessionId);
      setLabId(lid);
    }
  }, [propSession, location.search]);

  useEffect(() => {
    refreshFiles(true);
  }, [sessionId, labId]);

  // Auto-refresh file explorer every 3 minutes
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      refreshFilesRef.current(false);
    }, 180000);
    return () => clearInterval(interval);
  }, [sessionId]);



  const selectFile = async (newIdx: number, newFilesList?: any[]) => {
    if (newIdx === activeFileIndex) return;

    const currentFiles = newFilesList || files;

    // 1. Save current active file first in the background if it exists
    if (activeFileIndex >= 0 && files[activeFileIndex]) {
      saveFile(files[activeFileIndex], sessionId).catch(err => {
        console.error('Failed to save file before switching:', err);
      });
    }

    // 2. Set active file index
    setActiveFileIndex(newIdx);

    // 3. Fetch latest content for the newly selected file if not already loaded
    if (newIdx >= 0 && currentFiles[newIdx]) {
      const targetFile = currentFiles[newIdx];
      // Skip fetching if content is already populated to avoid overwriting edits or newly uploaded/created files
      if (targetFile.content !== undefined && targetFile.content !== '') {
        markPathLoaded(targetFile.path);
        return;
      }

      const targetPath = targetFile.path;
      try {
        const response = await fetchFileContent(targetPath, sessionId);
        if (response.success) {
          markPathLoaded(targetPath);
          const content = response.content || '';
          lastSavedContentRef.current.set(targetPath, content);
          setFiles(prev => {
            const updated = [...prev];
            const currentIdx = updated.findIndex(f => f.path === targetPath);
            if (currentIdx !== -1) {
              // Only update if it wasn't edited in the meantime
              if (updated[currentIdx].content === undefined || updated[currentIdx].content === '') {
                updated[currentIdx].content = response.content || '';
              }
            }
            return updated;
          });
        }
      } catch (err: any) {
        console.error('Load files error:', err);
        toast.error(err.message || 'Unable to access container workspace. Please refresh or restart the session.');
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    }
  };

  const handleTerminalCommand = async () => {
    // Small delay to allow filesystem operations inside container/host to settle
    setTimeout(async () => {
      // Also reload active file in editor in case the command modified it
      if (activeFileIndex >= 0 && files[activeFileIndex]) {
        try {
          const response = await fetchFileContent(files[activeFileIndex].path, sessionId);
          if (response.success) {
            setFiles(prev => {
              const updated = [...prev];
              if (updated[activeFileIndex]) {
                updated[activeFileIndex].content = response.content || '';
              }
              return updated;
            });
          }
        } catch (e) {
          console.error('Failed to reload active file after command:', e);
        }
      }
    }, 800);
  };

  useEffect(() => {
    let isMounted = true;
    const loadActiveFile = async () => {
      if (activeFileIndex < 0 || !files[activeFileIndex] || !sessionId) return;
      const file = files[activeFileIndex];
      if (!file) return;
      if (file.content !== undefined) {
        markPathLoaded(file.path);
        return;
      }

      try {
        const response = await fetchFileContent(file.path, sessionId);
        if (isMounted && response.success) {
          markPathLoaded(file.path);
          const content = response.content || '';
          lastSavedContentRef.current.set(file.path, content);
          setFiles(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(f => f.path === file.path);
            if (idx !== -1) {
              updated[idx].content = response.content || '';
            }
            return updated;
          });
        }
      } catch (err: any) {
        console.error('Content load error:', err);
        toast.error(err.message || 'Unable to access container workspace. Please refresh or restart the session.');
      }
    };
    loadActiveFile();
  }, [activeFileIndex, sessionId]);

  const latestSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    latestSaveRef.current = () => handleSave(false);
  });

  const activeFile = files[activeFileIndex];
  const activeFilePath = activeFile?.path;
  const activeFileContent = activeFile?.content;

  useEffect(() => {
    if (activeFileIndex === -1 || !activeFilePath) return;
    if (!loadedPaths.has(activeFilePath) || isSaving) return;

    const lastSaved = lastSavedContentRef.current.get(activeFilePath);
    if (lastSaved === activeFileContent) return;

    const timeout = setTimeout(() => handleSave(false), 1500);
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

    const formattedOutput = escapeHtml(rawOutput);
    const formattedError = escapeHtml(rawError);
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

  const handleFormat = () => {
    if (!editorRef.current) return;
    const action = editorRef.current.getAction('editor.action.formatDocument');
    if (action) action.run();
  };

  const handleSync = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetchFiles(sessionId);
      if (response.success) {
        const newFilesList = response.success ? response.files : [];
        const activeFileBefore = files[activeFileIndex];
        const activePathBefore = activeFileBefore ? activeFileBefore.path : null;

        // Merge with existing files to preserve in-memory content of loaded files
        const mergedFiles = newFilesList.map((newFile: any) => {
          const existing = files.find(f => f.path === newFile.path);
          if (existing) {
            return {
              ...newFile,
              content: existing.content !== undefined ? existing.content : newFile.content,
              language: existing.language || newFile.language,
            };
          }
          return newFile;
        });

        setFiles(mergedFiles);

        // Clean up openFilePaths and loadedPaths for deleted files
        const newPaths = new Set(newFilesList.map((f: any) => f.path));
        
        let newActiveIdx = -1;
        if (activePathBefore && newPaths.has(activePathBefore)) {
          newActiveIdx = mergedFiles.findIndex((f: any) => f.path === activePathBefore);
        } else {
          // If active file was deleted, try to activate the last remaining open tab
          const remainingOpen = openFilePaths.filter(p => newPaths.has(p));
          if (remainingOpen.length > 0) {
            const newActivePath = remainingOpen[remainingOpen.length - 1];
            newActiveIdx = mergedFiles.findIndex((f: any) => f.path === newActivePath);
          }
        }
        setActiveFileIndex(newActiveIdx);

        setOpenFilePaths(prev => prev.filter(p => newPaths.has(p)));
        setLoadedPaths(prev => {
          const next = new Set(prev);
          for (const p of next) {
            if (!newPaths.has(p)) {
              next.delete(p);
            }
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
    if (!activeFile || !sessionId) return;
    setIsSaving(true);
    try {
      await saveFile(activeFile, sessionId);
      lastSavedContentRef.current.set(activeFile.path, activeFile.content ?? '');
      if (showFeedback) {
        await refreshFiles(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Unable to access container workspace. Please refresh or restart the session.');
    } finally {
      setIsSaving(false);
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
      const response = await runFile(
        {
          path: activeFile!.path,
          language: 'csharp',
          content: code,
          labType: 'dotnet',
          stdin,
        },
        sessionId,
      );

      const rawOutput = response?.output || '';
      const rawError = response?.error || response?.runtimeError || response?.syntaxError || '';
      const runSuccess = response?.success || response?.status === 'COMPLETED';
      const output = extractConsoleOutput(rawOutput);

      setConsoleSession((prev) =>
        prev
          ? {
              ...prev,
              isRunning: false,
              output,
              stdinLines,
              success: runSuccess,
              error: runSuccess ? null : rawError || 'Program exited with an error',
            }
          : prev,
      );
    } catch (err: any) {
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
    }
  };

  const handleConsoleInputSubmit = (value: string) => {
    if (!consoleSession) return;
    const newLines = [...consoleSession.stdinLines, value];
    runConsoleInteractive(consoleSession.code, newLines);
  };

  const executeCode = async (dotnetAction?: 'build' | 'run') => {
    if (!sessionId || (!isAndroid && !activeFile)) return;

    const previewMode: 'build' | 'run' | 'execute' =
      isDotnet && dotnetAction === 'build' ? 'build' : isDotnet && dotnetAction === 'run' ? 'run' : 'execute';

    setRunningAction(dotnetAction || 'run');

    if (!isAndroid && activeFile && activeFile.language === 'html') {
      setConsoleSession(null);
      setWebPreviewCode(activeFile.content || '');
      setRunningAction(null);
      return;
    }

    const code = activeFile?.content || '';
    const isConsoleInteractive =
      isDotnet && !isDotnetBuildMode && !dotnetAction && needsConsoleInput(code);

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

    try {
      showRunningPreview(previewMode);

      const runPayload = isAndroid
        ? { path: '/workspace/build.sh', language: 'shell', content: '', labType: 'android' }
        : isDotnet
          ? {
            path: activeFile.path,
            language: 'csharp',
            content: activeFile.content,
            labType: 'dotnet',
            ...(dotnetAction ? { action: dotnetAction } : {}),
          }
          : { path: activeFile.path, language: activeFile.language, content: activeFile.content };

      const response = await runFile(runPayload, sessionId);
      await refreshFiles(false);

      if (response) {
        const runSuccess = response.success || response.status === 'COMPLETED';
        const rawOutput = response.output || '';
        const rawError = response.error || response.runtimeError || response.syntaxError || '';

        if (runSuccess && previewMode === 'build' && isDotnetBuildMode) {
          setDotnetBuildReady(true);
        }
        if (/build succeeded/i.test(rawOutput)) {
          setDotnetBuildReady(true);
        }

        setWebPreviewCode(renderExecutionPreview(runSuccess, rawOutput, rawError, previewMode));
      } else {
        setWebPreviewCode(`
          <html>
            <body style="background-color: #1e1e1e; color: #ff5555; font-family: monospace; padding: 16px;">
              <h3 style="color: #ff5555;">Execution Error</h3>
              <p>No output received from the runtime engine.</p>
            </body>
          </html>
        `);
      }
    } catch (err: any) {
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

  const handleRun = () => executeCode();
  const handleBuild = () => executeCode('build');
  const handleDotnetRun = () => executeCode('run');

  const handleAddFile = async () => {
    if (openFilePaths.length >= 8) {
      toast.error('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
      return;
    }

    const currentLab = labs.find(l => l.id === labId || l.name?.toLowerCase() === labId || l.title?.toLowerCase() === labId);
    const labName = currentLab?.name || currentLab?.title || '';
    const rules = getLabExtensionRules(labName, labId);

    let defaultExt = 'txt';
    if (rules.extensions.includes('py')) {
      defaultExt = 'py';
    } else if (rules.extensions.includes('java')) {
      defaultExt = 'java';
    } else if (rules.extensions.includes('cs')) {
      defaultExt = 'cs';
    } else if (rules.extensions.length > 0) {
      defaultExt = rules.extensions[0];
    }
    const defaultName = isDotnet ? 'Program.cs' : `script.${defaultExt}`;

    const fileName = window.prompt(`Enter file name:`, defaultName);
    if (!fileName) return;

    const hasExtension = fileName.includes('.') && fileName.split('.').pop() !== '';
    const ext = hasExtension ? fileName.split('.').pop()?.toLowerCase() || '' : '';
    if (!hasExtension || !rules.extensions.includes(ext)) {
      toast.error(
        `Workspace Restriction: Invalid file extension. Only the following extensions are allowed for ${rules.courseName}: ${rules.extensions.map(e => `.${e}`).join(', ')}`
      );
      return;
    }

      const newFile = {
        name: fileName,
        path: `/workspace/${fileName}`,
        type: 'file',
        language: detectLanguage(fileName),
        content: isDotnet && fileName === 'Program.cs' ? DOTNET_CONSOLE_STARTER : '',
      };
    if (sessionId) {
      // Optimistically add to files, open tab, and select it
      setFiles(prev => {
        if (prev.some(f => f.path === newFile.path)) return prev;
        return [...prev, newFile];
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
      setActiveFileIndex(files.length);
      try {
        await saveFile(newFile, sessionId);
      } catch (err) {
        console.error('Failed to save newly added file on backend:', err);
      }
      // Select the newly created file (best-effort; file list is async state)
      selectFile(files.length, [...files, newFile]).catch(() => {});

      // Save to backend and refresh in background
      (async () => {
        try {
          await saveFile(newFile, sessionId);
          await refreshFiles(false);
        } catch (err) {
          console.error('Failed to save newly added file on backend:', err);
        }
      })();
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
    setOpenFilePaths(prev => {
      const next = prev.filter(p => p !== path);
      const closedFileIdx = files.findIndex(f => f.path === path);
      if (activeFileIndex === closedFileIdx) {
        if (next.length > 0) {
          const newActivePath = next[next.length - 1];
          const newActiveIdx = files.findIndex(f => f.path === newActivePath);
          setActiveFileIndex(newActiveIdx);
        } else {
          setActiveFileIndex(-1);
        }
      }
      return next;
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFileIndex !== -1 && value !== undefined) {
      const path = files[activeFileIndex]?.path;
      if (path) markPathLoaded(path);
      const newFiles = [...files];
      newFiles[activeFileIndex].content = value;
      setFiles(newFiles);
    }
  };

  if (isLoading && !sessionId) {
    return (
      <div className="h-full w-full bg-[#1e1e1e] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-white/10 border-t-red-600 rounded-full animate-spin" />
        <p className="text-white/40 text-xs uppercase tracking-widest font-black">Connecting to IDE...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-[#1e1e1e] overflow-hidden select-none font-sans">

      {/* Sidebar Explorer */}
      {isSidebarOpen && (
        <div 
          className="w-[260px] bg-[#252526] border-r border-[#1f1f1f] flex flex-col shrink-0"
        >
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f1f1f]">
            <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">Explorer</span>
            <div className="flex items-center gap-2">
              <button onClick={handleSync} className="text-white/70 hover:text-white transition-colors mr-1" title="Sync Workspace">
                <RotateCw size={14} className={isLoading ? 'animate-spin text-red-500' : ''} />
              </button>
              <button onClick={handleAddFile} className="text-white/70 hover:text-white transition-colors" title="Add File">
                <Plus size={16} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="text-white/70 hover:text-white transition-colors" title="Upload File">
                <Upload size={14} />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          <div className="px-4 py-3 border-b border-[#1f1f1f]">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Workspace</span>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {isAndroid ? (
              buildFileTree(files).map(node => renderTreeNode(node, 0))
            ) : (
              files.map((file, i) => (
                <div
                  key={file.path}
                  onClick={() => {
                    if (!openFilePaths.includes(file.path)) {
                      if (openFilePaths.length >= 8) {
                        toast.error('Maximum of 8 files can be open in the tabs at the same time.');
                        return;
                      }
                      setOpenFilePaths(prev => [...prev, file.path]);
                    }
                    selectFile(i);
                  }}
                  className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer border-l-2 transition-all ${activeFileIndex === i ? 'bg-[#37373d] border-red-500' : 'border-transparent hover:bg-[#2a2d2e]'
                    }`}
                >
                  {getFileIcon(file.name)}
                  <span className={`text-[12px] truncate flex-1 ${activeFileIndex === i ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {file.name}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) return;
                      if (!sessionId) return;
                      try {
                        await deleteFile(file.path, sessionId);
                        await handleSync();
                      } catch (err: any) {
                        console.error('Delete error:', err);
                        setRestrictionMsg(`Failed to delete file: ${err.message || 'Unknown error'}`);
                        setShowRestrictionModal(true);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/10"
                    title="Delete file"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">

        {/* Top Header Bar */}
        <div className="h-12 bg-[#252526] border-b border-[#1f1f1f] flex items-center justify-between pl-2 pr-4 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/60 hover:text-white rounded transition-colors">
              <Menu size={18} />
            </button>

            {/* File Tabs */}
            <div className="flex bg-[#252526] h-full items-center ml-2 space-x-1">
              {openFilePaths.map((path) => {
                const file = files.find(f => f.path === path);
                if (!file) return null;
                const idx = files.findIndex(f => f.path === path);
                const isActive = activeFileIndex === idx;
                return (
                  <div
                    key={path}
                    onClick={() => selectFile(idx)}
                    className={`group flex items-center gap-2 px-3 py-1.5 border border-[#1f1f1f] rounded-t-lg cursor-pointer min-w-[100px] max-w-[180px] transition-colors ${isActive ? 'bg-[#1e1e1e] border-b-transparent text-white' : 'bg-[#2d2d2d] border-b-[#1f1f1f] text-slate-400 hover:bg-[#333]'
                      }`}
                  >
                    {getFileIcon(file.name)}
                    <span className="text-[11px] truncate flex-1 font-medium">{file.name}</span>
                    <button
                      onClick={(e) => handleCloseFile(e, path)}
                      className={`p-0.5 rounded-full hover:bg-white/10 ${isActive ? 'text-white/60 hover:text-white' : 'text-transparent group-hover:text-white/40'}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="text-[#3b82f6] hover:text-blue-400 transition-colors p-1"
              title="Download File"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => {
                setIsTerminalOpen(!isTerminalOpen);
                refreshFiles(false);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white text-[11px] font-black uppercase tracking-wider transition-colors border border-white/10 shadow-xl"
            >
              <TerminalIcon size={14} className="text-slate-300" />
              Terminal
            </button>
            {isDotnetBuildMode ? (
              <>
                <button
                  onClick={handleBuild}
                  disabled={isRunning || !activeFile}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors ${isRunning || !activeFile ? 'bg-red-900/50 text-white/50 cursor-not-allowed' : 'bg-[#dc2626] hover:bg-red-600 shadow-lg shadow-red-600/20'
                    }`}
                >
                  <Play size={12} className="fill-current" />
                  {runningAction === 'build' ? 'BUILDING...' : 'BUILD'}
                </button>
                <button
                  onClick={handleDotnetRun}
                  disabled={isRunning || !activeFile || !dotnetBuildReady}
                  title={dotnetBuildReady ? 'Run the web app and show preview' : 'Build the project first'}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors border border-white/10 ${isRunning || !activeFile || !dotnetBuildReady ? 'bg-[#2d2d2d] text-white/40 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                    }`}
                >
                  <Play size={12} className="fill-current" />
                  {runningAction === 'run' ? 'RUNNING...' : 'RUN'}
                </button>
              </>
            ) : (
              <button
                onClick={handleRun}
                disabled={isRunning || !activeFile}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors ${isRunning || !activeFile ? 'bg-red-900/50 text-white/50 cursor-not-allowed' : 'bg-[#dc2626] hover:bg-red-600 shadow-lg shadow-red-600/20'
                  }`}
              >
                <Play size={12} className="fill-current" />
                {isRunning ? 'RUNNING...' : 'RUN'}
              </button>
            )}
            <button
              onClick={onBack}
              className="text-red-500 hover:text-red-400 transition-colors p-1 ml-2"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={onStopLab}
              className="text-red-500 hover:text-red-400 transition-colors p-1"
              title="Stop Lab"
            >
              <Power size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {activeFileIndex !== -1 && activeFile ? (
              <div className="flex-1 flex flex-col relative border-r border-[#1f1f1f]">
                <div className="absolute top-4 right-6 z-10 flex gap-2">
                  <button
                    onClick={handleFormat}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white/80 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded border border-white/10 shadow-xl transition-colors"
                  >
                    <AlignLeft size={12} /> Format
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || !loadedPaths.has(activeFile.path)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white/80 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded border border-white/10 shadow-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={12} /> {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save')}
                  </button>
                </div>

                <Editor
                  height="100%"
                  language={activeFile.language}
                  path={activeFile.path}
                  value={activeFile.content}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  onMount={(editor) => { editorRef.current = editor; }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 16 }
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-[#1e1e1e]">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                  <FileText className="w-8 h-8 text-white/20" />
                </div>
                <h2 className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-4">
                  Select a file to begin coding
                </h2>
                <button
                  onClick={handleAddFile}
                  className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 hover:border-white/30 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5"
                >
                  <Plus size={14} /> Create New File
                </button>
              </div>
            )}

            {/* Right Preview Panel */}
            <div className="w-[40%] bg-white flex flex-col shrink-0">
              <div className="h-10 bg-white flex justify-center items-center border-b border-red-500/20 relative">
                <span className="text-[#dc2626] text-[10px] font-black uppercase tracking-widest">Preview</span>
                <div className="absolute bottom-0 w-full h-[2px] bg-red-600" />
              </div>
              <div className="flex-1 w-full bg-white relative">
                {consoleSession?.active ? (
                  <ConsoleInteractivePreview
                    session={consoleSession}
                    onSubmit={handleConsoleInputSubmit}
                  />
                ) : (
                  <iframe
                    srcDoc={webPreviewCode}
                    className="absolute inset-0 w-full h-full border-0"
                    title="Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Terminal Panel */}
          {isTerminalOpen && (
            <>
              {/* Resize Handle */}
              <div
                className="h-1.5 bg-[#1f1f1f] hover:bg-[#dc2626] cursor-row-resize transition-colors flex-shrink-0 z-10"
                onMouseDown={handleTerminalResizeStart}
              />
              <div
                style={{ height: terminalHeight }}
                className="w-full shrink-0 flex flex-col border-t border-[#1f1f1f] bg-[#0c0c0c] relative"
              >
                <Terminal
                  ref={terminalRef}
                  session={propSession || { sessionId, labId }}
                  hideHeader={false}
                  onClose={() => setIsTerminalOpen(false)}
                  onTerminalCommand={handleTerminalCommand}
                  isLabBusy={isRunning}
                />
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default CloudEditor;
