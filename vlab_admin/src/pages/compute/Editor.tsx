import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useLocation } from '@tanstack/react-router';
import { toast } from 'sonner';
import { fetchFileContent, fetchFiles, runFile, saveFile, deleteFile, renamePath, startAndroidBuild, fetchAndroidBuildStatus } from '../../services/ideService';
import {
  File, Code2, Plus, Upload, Play, Save,
  Trash2, X, FileJson, FileText, ChevronRight, Menu, Download, ArrowLeft, Power, MonitorPlay, Database, Terminal as TerminalIcon,
  Folder, FolderOpen, RotateCw, Globe, Pencil, Copy, Check
} from 'lucide-react';
import { useLabStore } from '@/stores/labStore';
import { useAuthStore } from '@/stores/auth-store';
import { resolveApiRelativeUrl } from '@/config/env';
import { TestingWorkspace } from './TestingWorkspace';
import { SeleniumExecutionDialog } from '@/components/SeleniumExecutionDialog';

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

  const labType = propSession?.labType || '';
  const isAndroid = labType === 'android' || labId === 'android' || labId === 'mobile-app-lab';
  const isDotnet = labType === 'dotnet' || labId === 'dotnet-lab' || labId.includes('dotnet');
  const isSelenium = labType === 'testing';

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

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>('/workspace');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Automatically close chrome-preview tab and return to the code file after successful run / disconnect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (
      seleniumRunState.status === 'PASSED' ||
      seleniumRunState.status === 'FAILED' ||
      seleniumRunState.status === 'ERROR' ||
      seleniumRunState.status === 'DISCONNECTED'
    ) {
      timeoutId = setTimeout(() => {
        handleCloseFile({ stopPropagation: () => {} } as any, 'chrome-preview');
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
      await renamePath(renamingPath, newPath, sessionId);

      setOpenFilePaths(prev => prev.map(p => {
        if (p === renamingPath) return newPath;
        if (p.startsWith(renamingPath + '/')) return newPath + p.slice(renamingPath.length);
        return p;
      }));
      setExpandedFolders(prev => {
        const next = new Set<string>();
        prev.forEach(p => {
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

      cancelRename();
      await handleSync();
      toast.success(`Renamed to ${trimmed}`);
    } catch (err: any) {
      console.error('Rename error:', err);
      toast.error(`Failed to rename: ${err.message || 'Unknown error'}`);
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
      className="flex-1 min-w-0 bg-[#1e1e1e] border border-amber-500/50 rounded px-1.5 py-0.5 text-[12px] text-white outline-none"
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
            className={`group relative flex items-center gap-1.5 py-1 pr-2 hover:bg-[#2a2d2e] cursor-pointer transition-colors border-l-2 ${isFolderSelected ? 'bg-[#37373d] border-red-500 text-white' : 'border-transparent text-slate-300'
              }`}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <ChevronRight
              size={14}
              className={`text-slate-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            />
            {isExpanded ? (
              <FolderOpen size={14} className="text-amber-400 shrink-0" />
            ) : (
              <Folder size={14} className="text-amber-500 shrink-0" />
            )}
            {isEditing ? (
              renderRenameInput()
            ) : (
              <>
                <span
                  className="text-slate-300 text-[12px] font-medium truncate min-w-0 flex-1 pr-1"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(node.path, node.name);
                  }}
                  title={node.name}
                >
                  {node.name}
                </span>
                <div className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 items-center gap-0.5 bg-[#2a2d2e] pl-1 rounded">
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
                    className="text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-white/10"
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
                      className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded hover:bg-white/10"
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
          className={`group relative flex items-center gap-2 py-1 pr-2 cursor-pointer border-l-2 transition-all ${isActive ? 'bg-[#37373d] border-red-500' : 'border-transparent hover:bg-[#2a2d2e]'
            }`}
          style={{ paddingLeft: `${depth * 12 + 26}px` }}
        >
          {getFileIcon(file.name)}
          {isEditing ? (
            renderRenameInput()
          ) : (
            <>
              <span
                className={`text-[12px] truncate min-w-0 flex-1 pr-1 ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(file.path, file.name);
                }}
                title={file.name}
              >
                {file.name}
              </span>
              <div className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 items-center gap-0.5 bg-[#2a2d2e] pl-1 rounded">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(file.path, file.name);
                  }}
                  className="text-slate-400 hover:text-amber-400 transition-colors p-1 rounded hover:bg-white/10"
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
                      await deleteFile(file.path, sessionId);
                      await handleSync();
                    } catch (err: any) {
                      console.error('Delete error:', err);
                      toast.error(`Failed to delete file: ${err.message || 'Unknown error'}`);
                    }
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-white/10"
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
  const [runningAction, setRunningAction] = useState<'build' | 'run' | null>(null);
  const [dotnetBuildReady, setDotnetBuildReady] = useState(false);
  const isRunning = runningAction !== null;
  const [webPreviewCode, setWebPreviewCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('vlab.ide.sidebarWidth'));
    return Number.isFinite(saved) && saved >= 180 ? saved : 320;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem('vlab.ide.rightPanelWidth'));
    return Number.isFinite(saved) && saved >= 240 ? saved : 420;
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  const rightPanelWidthRef = useRef(rightPanelWidth);
  sidebarWidthRef.current = sidebarWidth;
  rightPanelWidthRef.current = rightPanelWidth;

  const startPanelResize = (
    event: React.MouseEvent<HTMLDivElement>,
    panel: 'sidebar' | 'right'
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // Size from container edges so left/right panels never invert drag direction
    const panelEl = event.currentTarget.parentElement;
    const rowEl = panelEl?.parentElement;
    const rowRect = () => rowEl?.getBoundingClientRect() ?? {
      left: 0,
      right: window.innerWidth,
    };

    const onMove = (ev: MouseEvent) => {
      const { left, right } = rowRect();
      if (panel === 'sidebar') {
        // Left explorer: width = distance from row left → mouse
        const next = Math.min(560, Math.max(200, Math.round(ev.clientX - left)));
        sidebarWidthRef.current = next;
        setSidebarWidth(next);
      } else {
        // Right build/preview: width = distance from mouse → row right
        // Drag handle left → wider; drag right → narrower
        const next = Math.min(900, Math.max(280, Math.round(right - ev.clientX)));
        rightPanelWidthRef.current = next;
        setRightPanelWidth(next);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('vlab.ide.sidebarWidth', String(sidebarWidthRef.current));
      localStorage.setItem('vlab.ide.rightPanelWidth', String(rightPanelWidthRef.current));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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

  const refreshFiles = async (showLoading = false) => {
    if (!sessionId) return;
    if (showLoading) setIsLoading(true);
    else setIsRefreshingFiles(true);
    try {
      const response = await fetchFiles(sessionId);
      if (response.success) {
        const activePath =
          activeFileIndexRef.current >= 0 && filesRef.current[activeFileIndexRef.current]
            ? filesRef.current[activeFileIndexRef.current].path
            : null;

        // Always merge against the latest in-memory files so refreshes never wipe typing
        setFiles((prev) => {
          const mergedFiles = response.files.map((newFile: any) => {
            const existing = prev.find((f) => f.path === newFile.path);
            if (existing && existing.content !== undefined) {
              return { ...newFile, content: existing.content, language: existing.language || newFile.language };
            }
            return newFile;
          });
          return mergedFiles;
        });

        setOpenFilePaths((prev) => {
          const validPaths = response.files.map((f: any) => f.path);
          return prev.filter((p) => validPaths.includes(p));
        });

        setLoadedPaths((prev) => {
          const next = new Set(prev);
          const newPaths = new Set(response.files.map((f: any) => f.path));
          prev.forEach((p) => {
            if (!newPaths.has(p)) next.delete(p);
          });
          return next;
        });

        if (activePath) {
          const newIdx = response.files.findIndex((f: any) => f.path === activePath);
          if (newIdx >= 0) setActiveFileIndex(newIdx);
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



  const loadFileContent = async (targetPath: string) => {
    if (!sessionId || !targetPath) return;
    if (dirtyPathsRef.current.has(targetPath)) {
      markPathLoaded(targetPath);
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    setContentLoadingPath(targetPath);
    try {
      const response = await fetchFileContent(targetPath, sessionId);
      if (!mountedRef.current || requestId !== loadRequestIdRef.current) return;
      if (dirtyPathsRef.current.has(targetPath)) {
        markPathLoaded(targetPath);
        return;
      }
      if (response.success) {
        const content = response.content ?? '';
        markPathLoaded(targetPath);
        lastSavedContentRef.current.set(targetPath, content);
        setFiles((prev) => {
          const updated = [...prev];
          const currentIdx = updated.findIndex((f) => f.path === targetPath);
          if (currentIdx === -1) return prev;
          // Never clobber local edits that landed while the request was in flight
          if (dirtyPathsRef.current.has(targetPath)) return prev;
          updated[currentIdx] = { ...updated[currentIdx], content };
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Content load error:', err);
      toast.error(err.message || 'Unable to load file content. Please refresh or restart the session.');
    } finally {
      if (mountedRef.current && requestId === loadRequestIdRef.current) {
        setContentLoadingPath((prev) => (prev === targetPath ? null : prev));
      }
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

    // Already loaded in memory
    if (loadedPaths.has(targetPath) || typeof targetFile.content === 'string') {
      markPathLoaded(targetPath);
      if (typeof targetFile.content !== 'string') {
        await loadFileContent(targetPath);
      }
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

  const handleSync = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const response = await fetchFiles(sessionId);
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

        setFiles(() =>
          newFilesList.map((newFile: any) => {
            const existing = filesRef.current.find((f) => f.path === newFile.path);
            if (existing && existing.content !== undefined) {
              return {
                ...newFile,
                content: existing.content,
                language: existing.language || newFile.language,
              };
            }
            return newFile;
          })
        );

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
    if (typeof file.content !== 'string') {
      if (showFeedback) toast.error('File is still loading — wait before saving.');
      return;
    }
    const lastSaved = lastSavedContentRef.current.get(file.path);
    if (!showFeedback && lastSaved === file.content) return;
    setIsSaving(true);
    try {
      const payload = {
        ...file,
        content: file.content,
      };
      await saveFile(payload, sessionId);
      lastSavedContentRef.current.set(file.path, payload.content);
      dirtyPathsRef.current.delete(file.path);
      if (showFeedback) {
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
        }
        await refreshFiles(false);
        return response;
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

  const handleRun = () => {
    if (isSelenium) {
      let initialUrl = 'http://localhost:5173/login';
      if (activeFile && activeFile.content) {
        // Try direct get/navigate matches first
        const directMatch = activeFile.content.match(/driver\.(?:get|navigate\(\)\.to)\s*\(\s*['"](https?:\/\/[^'"]+)['"]\s*\)/i);
        if (directMatch) {
          initialUrl = directMatch[1];
        } else {
          // Fallback: extract the first URL literal starting with http anywhere in the code
          const fallbackMatch = activeFile.content.match(/https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9._]*\.[a-zA-Z]{2,}(?:\/[^'"\s]*)?/);
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
    if (rules.extensions.includes('py')) {
      defaultExt = 'py';
    } else if (rules.extensions.includes('java')) {
      defaultExt = 'java';
    } else if (rules.extensions.includes('cs')) {
      defaultExt = 'cs';
    } else if (rules.extensions.length > 0) {
      defaultExt = rules.extensions[0];
    }
    const defaultName = isDotnet ? 'Program.cs' : isAndroid ? 'MainActivity.java' : `script.${defaultExt}`;

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

    const newFile = {
      name: fileName,
      path: `${createIn}/${fileName}`,
      type: 'file',
      language: detectLanguage(fileName),
      content: isDotnet && fileName === 'Program.cs' ? DOTNET_CONSOLE_STARTER : '',
    };
    if (sessionId) {
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
        toast.success(`Created ${fileName} in ${folderLabel}`);
      } catch (err) {
        console.error('Failed to save newly added file on backend:', err);
        toast.error('Failed to create file');
      }
      selectFile(files.length, [...files, newFile]).catch(() => { });

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

    setFiles((prev) => {
      const currentIdx = prev[idx]?.path === path ? idx : prev.findIndex((f) => f.path === path);
      if (currentIdx < 0) return prev;
      if (prev[currentIdx].content === value) return prev;
      const updated = [...prev];
      updated[currentIdx] = { ...updated[currentIdx], content: value };
      return updated;
    });
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
          className="bg-[#252526] border-r border-[#1f1f1f] flex flex-col shrink-0 relative"
          style={{ width: sidebarWidth }}
        >
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f1f1f]">
            <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">Explorer</span>
            <div className="flex items-center gap-2">
              <button onClick={handleSync} className="text-white/70 hover:text-white transition-colors mr-1" title="Sync Workspace">
                <RotateCw size={14} className={isLoading ? 'animate-spin text-red-500' : ''} />
              </button>
              <button onClick={() => handleAddFile()} className="text-white/70 hover:text-white transition-colors" title="Add File">
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

          <div className="flex-1 overflow-y-auto overflow-x-auto py-2">
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

          <div
            onMouseDown={(e) => startPanelResize(e, 'sidebar')}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize z-20 hover:bg-white/10 active:bg-amber-500/50"
            title="Drag to resize explorer"
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">

        {/* Top Header Bar */}
        <div className="h-12 bg-[#252526] border-b border-[#1f1f1f] flex items-center justify-between pl-2 pr-4 shrink-0 gap-4">
          <div className="flex-1 flex items-center min-w-0 h-full">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/60 hover:text-white rounded transition-colors shrink-0">
              <Menu size={18} />
            </button>

            {/* File Tabs with Horizontal Scroll */}
            <div className="flex-1 flex items-center ml-2 overflow-x-auto scrollbar-none h-full min-w-0">
              <div className="flex items-center space-x-1 h-full py-1">
                {openFilePaths.map((path) => {
                  if (path === 'chrome-preview') {
                    const isActive = isPreviewTabActive;
                    return (
                      <div
                        key={path}
                        onClick={() => setIsPreviewTabActive(true)}
                        className={`group flex items-center gap-2 px-3 py-1.5 border border-[#1f1f1f] rounded-t-lg cursor-pointer min-w-[120px] max-w-[180px] transition-colors shrink-0 ${isActive ? 'bg-[#1e1e1e] border-b-transparent text-white' : 'bg-[#2d2d2d] border-b-[#1f1f1f] text-slate-400 hover:bg-[#333]'
                          }`}
                      >
                        <Globe size={12} className="text-emerald-400 shrink-0" />
                        <span className="text-[11px] truncate flex-1 font-medium">{browserTitle}</span>
                        <button
                          onClick={(e) => handleCloseFile(e, 'chrome-preview')}
                          className={`p-0.5 rounded-full hover:bg-white/10 ${isActive ? 'text-white/60 hover:text-white' : 'text-transparent group-hover:text-white/40'}`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  }

                  const file = files.find(f => f.path === path);
                  if (!file) return null;
                  const idx = files.findIndex(f => f.path === path);
                  const isActive = activeFileIndex === idx && !isPreviewTabActive;
                  return (
                    <div
                      key={path}
                      onClick={() => selectFile(idx)}
                      className={`group flex items-center gap-2 px-3 py-1.5 border border-[#1f1f1f] rounded-t-lg cursor-pointer min-w-[100px] max-w-[180px] transition-colors shrink-0 ${isActive ? 'bg-[#1e1e1e] border-b-transparent text-white' : 'bg-[#2d2d2d] border-b-[#1f1f1f] text-slate-400 hover:bg-[#333]'
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
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleDownload}
              className="text-[#3b82f6] hover:text-blue-400 transition-colors p-1"
              title="Download File"
            >
              <Download size={18} />
            </button>
            {isAndroid ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAndroidBuild}
                  disabled={isAndroidBuilding}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors ${isAndroidBuilding ? 'bg-amber-900/50 text-white/50 cursor-not-allowed' : 'bg-[#f59e0b] hover:bg-amber-600 shadow-lg shadow-amber-600/20'
                    }`}
                >
                  <Play size={12} className="fill-current" />
                  {isAndroidBuilding ? 'BUILDING...' : 'BUILD'}
                </button>
                {androidApkUrl && (
                  <button
                    onClick={handleDownloadApk}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 animate-pulse"
                  >
                    <Download size={12} />
                    DOWNLOAD APK
                  </button>
                )}
              </div>
            ) : isDotnetBuildMode ? (
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
            {remainingTime && (
              <div className="text-red-500 font-mono text-[10px] font-black bg-red-950/40 border border-red-500/20 px-2.5 py-1 rounded animate-pulse shrink-0 ml-2">
                TIME REMAINING: {remainingTime}
              </div>
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
            {isPreviewTabActive ? (
              <div className="flex-1 flex flex-col relative bg-[#0c0c0c] min-h-0">
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
              </div>
            ) : activeFileIndex !== -1 && activeFile ? (
              <div className="flex-1 flex flex-col relative border-r border-[#1f1f1f] select-text">
                <div className="absolute top-4 right-6 z-10 flex gap-2">
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving || !isContentReady}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white/80 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded border border-white/10 shadow-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={12} /> {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save')}
                  </button>
                </div>

                {isContentLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#1e1e1e] text-white/50">
                    <div className="w-8 h-8 border-2 border-white/10 border-t-amber-500 rounded-full animate-spin" />
                    <p className="text-[11px] uppercase tracking-widest font-bold">Loading {activeFile.name}...</p>
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
                    onMount={(editor) => {
                      editorRef.current = editor;
                      editor.focus();
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
                      automaticLayout: true,
                      readOnly: !isContentReady,
                    }}
                  />
                )}
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
                  onClick={() => handleAddFile()}
                  className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 hover:border-white/30 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-white/5"
                >
                  <Plus size={14} /> Create New File
                </button>
              </div>
            )}

            {/* Right Preview Panel */}
            {isAndroid ? (
              <div
                className="bg-[#0c0c0c] border-l border-[#1f1f1f] flex flex-col shrink-0 min-w-0 relative"
                style={{ width: rightPanelWidth, minWidth: 280, maxWidth: 900 }}
              >
                <div
                  onMouseDown={(e) => startPanelResize(e, 'right')}
                  className="absolute top-0 -left-1 h-full w-3 cursor-col-resize z-30 hover:bg-amber-500/40 active:bg-amber-500/60"
                  title="Drag left to widen build logs"
                />
                <div className="h-10 bg-[#1e1e1e] flex justify-between items-center px-4 border-b border-amber-500/20 relative">
                  <span className="text-[#f59e0b] text-[10px] font-black uppercase tracking-widest">Build Logs</span>
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    title="Copy Build Logs"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a2d2e] hover:bg-[#37373d] text-slate-300 hover:text-white text-[11px] font-medium transition-all cursor-pointer"
                  >
                    {copiedLogs ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedLogs ? 'Copied!' : 'Copy'}</span>
                  </button>
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#f59e0b]" />
                </div>
                <div className="flex-1 w-full min-w-0 p-4 bg-[#111] font-mono text-[12px] text-slate-300 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words select-text selection:bg-amber-500/30">
                  {androidBuildLogs}
                </div>
              </div>
            ) : isSelenium ? (
              null // Selenium preview is now opened in the Editor Tab bar instead of a split layout
            ) : (
              <div
                className="bg-white flex flex-col shrink-0 relative"
                style={{ width: rightPanelWidth, minWidth: 280, maxWidth: 900 }}
              >
                <div
                  onMouseDown={(e) => startPanelResize(e, 'right')}
                  className="absolute top-0 -left-1 h-full w-3 cursor-col-resize z-30 hover:bg-red-500/40 active:bg-red-500/60"
                  title="Drag left to widen preview"
                />
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
