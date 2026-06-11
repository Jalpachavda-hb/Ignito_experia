import React, { useEffect, useRef, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { useLocation } from '@tanstack/react-router';
import { fetchFileContent, fetchFiles, runFile, saveFile, deleteFile } from '../../services/ideService';
import { 
  File, Code2, Plus, Upload, Play, Save, AlignLeft, 
  Trash2, X, FileJson, FileText, ChevronRight, Menu, Download, ArrowLeft, Power, MonitorPlay, Database
} from 'lucide-react';

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': case 'ipynb': return <Code2 className="text-[#3776AB] w-4 h-4 shrink-0" />;
    case 'js': case 'jsx': return <Code2 className="text-[#F7DF1E] w-4 h-4 shrink-0" />;
    case 'html': return <Code2 className="text-orange-500 w-4 h-4 shrink-0" />;
    case 'css': return <Code2 className="text-blue-300 w-4 h-4 shrink-0" />;
    case 'java': return <Code2 className="text-[#007396] w-4 h-4 shrink-0" />;
    case 'json': return <FileJson className="text-amber-500 w-4 h-4 shrink-0" />;
    case 'md': case 'csv': case 'txt': case 'log': return <FileText className="text-emerald-500 w-4 h-4 shrink-0" />;
    case 'xml': return <Code2 className="text-orange-400 w-4 h-4 shrink-0" />;
    case 'parquet': case 'avro': case 'orc': return <Database className="text-emerald-700 w-4 h-4 shrink-0" />;
    default: return <File className="text-slate-400 w-4 h-4 shrink-0" />;
  }
};

const detectLanguage = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'py') return 'python';
  if (ext === 'java') return 'java';
  if (ext === 'html') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  if (ext === 'ipynb') return 'python';
  return 'text';
};

const CloudEditor = ({ session: propSession, hideHeader, onStopLab, onBack }: any) => {
  const location = useLocation();
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const [labId, setLabId] = useState('');

  const isPythonLab = () => labId.includes('python');
  const isJavaLab = () => labId.includes('java');
  const isAgileLab = () => labId.includes('agile');
  const isBigDataLab = () => labId.includes('big-data') || labId.includes('bigdata') || labId.includes('analytics');
  const isNoAutoSaveLab = () => isPythonLab() || isJavaLab() || isBigDataLab();

  const [loadedPaths, setLoadedPaths] = useState(new Set<string>());
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [webPreviewCode, setWebPreviewCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
    let isMounted = true;
    const loadFiles = async () => {
      if (!sessionId) return;
      setIsLoading(true);
      try {
        const response = await fetchFiles(sessionId);
        if (isMounted && response.success) {
          const filteredFiles = response.files.filter((f: any) => {
            const ext = f.name.split('.').pop()?.toLowerCase();
            if (isPythonLab()) return ext === 'py';
            if (isJavaLab()) return ext === 'java';
            if (isAgileLab()) return ['txt', 'md', 'doc', 'docx', 'pdf', 'js', 'jsx', 'html', 'css', 'json'].includes(ext);
            if (isBigDataLab()) return ['py', 'ipynb', 'csv', 'json', 'txt'].includes(ext);
            return true;
          });
          setFiles(filteredFiles);
          setOpenFilePaths(filteredFiles.map((f: any) => f.path));
          // Don't auto open the first file, so we see the empty state
        }
      } catch (err) {
        console.error('Load files error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadFiles();
    return () => { isMounted = false; };
  }, [sessionId, labId]);

  useEffect(() => {
    let isMounted = true;
    const loadActiveFile = async () => {
      if (activeFileIndex < 0 || !files[activeFileIndex] || !sessionId) return;
      const file = files[activeFileIndex];
      if (!file || loadedPaths.has(file.path)) return;

      try {
        const response = await fetchFileContent(file.path, sessionId);
        if (isMounted && response.success) {
          const newFiles = [...files];
          newFiles[activeFileIndex].content = response.content || '';
          setFiles(newFiles);
          setLoadedPaths(prev => new Set(prev).add(file.path));
        }
      } catch (err) {
        console.error('Content load error:', err);
      }
    };
    loadActiveFile();
  }, [activeFileIndex, sessionId, loadedPaths]);

  useEffect(() => {
    if (activeFileIndex === -1 || !files[activeFileIndex] || isNoAutoSaveLab()) return;
    const timeout = setTimeout(() => handleSave(false), 1500);
    return () => clearTimeout(timeout);
  }, [files, activeFileIndex, labId]);

  // Hadoop Verification
  useEffect(() => {
    let isMounted = true;
    if (isBigDataLab() && sessionId) {
      const verifyHadoop = async () => {
        try {
          const payload = {
            path: '/workspace/.verify_hadoop.py',
            language: 'python',
            content: "import os, subprocess\ntry:\n    subprocess.check_output(['hadoop', 'version'], stderr=subprocess.STDOUT)\n    subprocess.check_output(['hdfs', 'dfs', '-ls', '/'], stderr=subprocess.STDOUT)\nexcept Exception as e:\n    print('HADOOP_ERROR: ' + str(e))"
          };
          const res = await runFile(payload, sessionId);
          if (isMounted && res && res.output && res.output.includes("HADOOP_ERROR")) {
            setRestrictionMsg("Hadoop Environment Verification Failed: " + res.output);
            setShowRestrictionModal(true);
          }
        } catch (err) {
          console.error("Hadoop verification error:", err);
        }
      };
      setTimeout(verifyHadoop, 2000);
    }
    return () => { isMounted = false; };
  }, [sessionId, labId]);

  const activeFile = files[activeFileIndex];

  const handleFormat = () => {
    if (!editorRef.current) return;
    const action = editorRef.current.getAction('editor.action.formatDocument');
    if (action) action.run();
  };

  const handleSave = async (showFeedback = true) => {
    if (!activeFile || !sessionId) return;
    setIsSaving(true);
    try {
      await saveFile(activeFile, sessionId);
      if (showFeedback) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Save error:', err);
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

  const handleRun = async () => {
    if (!activeFile || !sessionId) return;
    setIsRunning(true);
    setWebPreviewCode(`
      <html>
        <body style="background:#fff;color:#333;font-family:monospace;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
          <div style="width:30px;height:30px;border:3px solid #f3f3f3;border-top:3px solid #ef4444;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:15px;"></div>
          <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>
          <div style="text-transform:uppercase;letter-spacing:1px;font-size:12px;font-weight:bold;">Executing Code...</div>
        </body>
      </html>
    `);

    if (!isNoAutoSaveLab()) {
      await handleSave(false);
    }

    try {
      const payload = isNoAutoSaveLab()
        ? { path: activeFile.path, language: activeFile.language, content: activeFile.content }
        : { path: activeFile.path, language: activeFile.language };

      const response = await runFile(payload, sessionId);
      if (response.success) {
        const isHtmlFile = activeFile.name.endsWith('.html') || activeFile.name.endsWith('.htm');
        if (isHtmlFile) {
          setWebPreviewCode(activeFile.content);
        } else {
          setWebPreviewCode(`
            <div style="font-family:monospace; background:#fff; padding:20px; height:100%;">
              <h3 style="color:#d32f2f; font-size:11px; text-transform:uppercase; border-bottom: 1px solid #eee; padding-bottom: 8px;">Terminal Output</h3>
              <pre style="background:#f9f9f9; padding:16px; border-radius:8px; margin-top: 10px; white-space: pre-wrap; word-wrap: break-word;">${response.output || '(No output)'}</pre>
              ${response.error ? `<h3 style="color:#ef4444; font-size:11px; margin-top:20px; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">Errors Detected</h3><pre style="background:#fff5f5; color:#b91c1c; padding:16px; border:1px solid #fecaca; border-radius:8px; margin-top: 10px;">${response.error}</pre>` : ''}
            </div>
          `);
        }
      } else {
        setWebPreviewCode(`
          <div style="font-family:monospace; background:#fff; padding:20px; height:100%;">
            <h3 style="color:#ef4444; font-size:11px; text-transform:uppercase; border-bottom: 1px solid #fee2e2; padding-bottom: 8px;">Execution Failed</h3>
            <pre style="background:#fff5f5; color:#b91c1c; padding:16px; border:1px solid #fecaca; border-radius:8px; margin-top: 10px; white-space: pre-wrap;">${response.error}</pre>
          </div>
        `);
      }
    } catch (err) {
      console.error('Run error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleAddFile = async () => {
    if (openFilePaths.length >= 8) {
      setRestrictionMsg('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
      setShowRestrictionModal(true);
      return;
    }

    const defaultName = isJavaLab() ? 'Main.java' : (isPythonLab() ? 'script.py' : (isBigDataLab() ? 'script.py' : (isAgileLab() ? 'File.java' : 'script.txt')));
    const fileName = window.prompt(`Enter file name (e.g. ${defaultName}):`, defaultName);
    if (!fileName) return;

    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (isPythonLab() && ext !== 'py') {
      setRestrictionMsg('This is a Python lab environment. You can only create or add .py files.');
      setShowRestrictionModal(true);
      return;
    }
    if (isJavaLab() && ext !== 'java') {
      setRestrictionMsg('This is a Java lab environment. You can only create or add .java files.');
      setShowRestrictionModal(true);
      return;
    }
    if (isAgileLab()) {
      const allowed = ['java'];
      if (!allowed.includes(ext as string)) {
        setRestrictionMsg(`This is an Agile Methodology lab. You can only create or add these extensions: ${allowed.join(', ')}`);
        setShowRestrictionModal(true);
        return;
      }
    }
    if (isBigDataLab()) {
      const allowed = ['java','py','csv','json','xml','log','txt','parquet','avro','orc'];
      if (!allowed.includes(ext as string)) {
        setRestrictionMsg(`This is a Big Data Analytics lab. You can only create or add these extensions: ${allowed.join(', ')}`);
        setShowRestrictionModal(true);
        return;
      }
    }

    const newFile = { name: fileName, path: `/workspace/${fileName}`, type: 'file', language: detectLanguage(fileName), content: '' };
    if (sessionId) {
      setFiles(prev => [...prev, newFile]);
      setOpenFilePaths(prev => {
        if (!prev.includes(newFile.path)) return [...prev, newFile.path];
        return prev;
      });
      setActiveFileIndex(files.length);
      try {
        await saveFile(newFile, sessionId);
      } catch (err) {
        console.error('Failed to save newly added file on backend:', err);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const filePath = `/workspace/${file.name}`;
    const exists = files.some(f => f.path === filePath);
    
    if (!exists && files.length >= 5) {
      setRestrictionMsg('Workspace Limit Reached: You can have a maximum of 5 files in the workspace.');
      setShowRestrictionModal(true);
      return;
    }

    if (!openFilePaths.includes(filePath) && openFilePaths.length >= 8) {
      setRestrictionMsg('Maximum of 8 files can be open in the tabs at the same time. Please close some tabs first.');
      setShowRestrictionModal(true);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (isPythonLab() && ext !== 'py') {
      setRestrictionMsg('Strict Restriction: Only .py files are permitted in the Python workspace.');
      setShowRestrictionModal(true);
      return;
    }
    if (isJavaLab() && ext !== 'java') {
      setRestrictionMsg('Strict Restriction: Only .java files are permitted in the Java workspace.');
      setShowRestrictionModal(true);
      return;
    }
    if (isAgileLab()) {
      const allowed = ['txt', 'md', 'doc', 'docx', 'pdf', 'js', 'jsx', 'html', 'css', 'json'];
      if (!allowed.includes(ext as string)) {
        setRestrictionMsg(`This is an Agile Methodology lab. You can only upload these extensions: ${allowed.join(', ')}`);
        setShowRestrictionModal(true);
        return;
      }
    }
    if (isBigDataLab()) {
      const allowed = ['py', 'java', 'ipynb', 'csv', 'json', 'txt', 'xml', 'log', 'parquet', 'avro', 'orc'];
      if (!allowed.includes(ext as string)) {
        setRestrictionMsg(`This is a Big Data Analytics lab. You can only upload these extensions: ${allowed.join(', ')}`);
        setShowRestrictionModal(true);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileContent = e.target?.result as string;
      const newFile = { name: file.name, path: `/workspace/${file.name}`, type: 'file', language: detectLanguage(file.name), content: fileContent };
      if (sessionId) {
        setFiles(prev => {
          const existingIdx = prev.findIndex(f => f.path === newFile.path);
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = newFile;
            setActiveFileIndex(existingIdx);
            return updated;
          }
          const updated = [...prev, newFile];
          setActiveFileIndex(updated.length - 1);
          return updated;
        });

        setOpenFilePaths(prev => {
          if (prev.includes(newFile.path)) return prev;
          return [...prev, newFile.path];
        });

        setLoadedPaths(prev => {
          const next = new Set(prev);
          next.add(newFile.path);
          return next;
        });

        try {
          await saveFile(newFile, sessionId);
        } catch (err) {
          console.error('Failed to save uploaded file on backend:', err);
        }
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
        <div className="w-[260px] bg-[#252526] border-r border-[#1f1f1f] flex flex-col shrink-0">
          <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f1f1f]">
            <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">Explorer</span>
            <div className="flex items-center gap-2">
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
            {files.map((file, i) => (
              <div
                key={file.path}
                onClick={() => {
                  if (!openFilePaths.includes(file.path)) {
                    if (openFilePaths.length >= 8) {
                      setRestrictionMsg('Maximum of 8 files can be open in the tabs at the same time.');
                      setShowRestrictionModal(true);
                      return;
                    }
                    setOpenFilePaths(prev => [...prev, file.path]);
                  }
                  setActiveFileIndex(i);
                }}
                className={`group flex items-center gap-2 px-4 py-1.5 cursor-pointer border-l-2 transition-all ${
                  activeFileIndex === i ? 'bg-[#37373d] border-red-500' : 'border-transparent hover:bg-[#2a2d2e]'
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
                      
                      const newFiles = [...files];
                      newFiles.splice(i, 1);
                      setFiles(newFiles);
                      
                      setOpenFilePaths(prev => {
                        const next = prev.filter(p => p !== file.path);
                        if (activeFileIndex === i) {
                          if (next.length > 0) {
                            const newActivePath = next[next.length - 1];
                            const newActiveIdx = newFiles.findIndex(f => f.path === newActivePath);
                            setActiveFileIndex(newActiveIdx);
                          } else {
                            setActiveFileIndex(-1);
                          }
                        } else if (activeFileIndex > i) {
                          setActiveFileIndex(activeFileIndex - 1);
                        }
                        return next;
                      });
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
            ))}
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
                    onClick={() => setActiveFileIndex(idx)}
                    className={`group flex items-center gap-2 px-3 py-1.5 border border-[#1f1f1f] rounded-t-lg cursor-pointer min-w-[100px] max-w-[180px] transition-colors ${
                      isActive ? 'bg-[#1e1e1e] border-b-transparent text-white' : 'bg-[#2d2d2d] border-b-[#1f1f1f] text-slate-400 hover:bg-[#333]'
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
              onClick={handleRun}
              disabled={isRunning || !activeFile}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-[11px] font-black uppercase tracking-wider transition-colors ${
                isRunning || !activeFile ? 'bg-red-900/50 text-white/50 cursor-not-allowed' : 'bg-[#dc2626] hover:bg-red-600 shadow-lg shadow-red-600/20'
              }`}
            >
              <Play size={12} className="fill-current" />
              {isRunning ? 'RUNNING...' : 'RUN'}
            </button>
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
                  disabled={isSaving} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white/80 hover:text-white text-[10px] uppercase tracking-wider font-bold rounded border border-white/10 shadow-xl transition-colors"
                >
                  <Save size={12} /> {isSaving ? 'Saving...' : (saveSuccess ? 'Saved!' : 'Save')}
                </button>
              </div>

              <Editor
                height="100%"
                language={activeFile.language}
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
              <iframe 
                srcDoc={webPreviewCode}
                className="absolute inset-0 w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        </div>
      </div>
      
      {showRestrictionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#252526] p-6 rounded-2xl max-w-sm w-full border border-white/10 text-center shadow-2xl">
            <h2 className="text-red-500 font-bold mb-4 flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
              <X className="w-5 h-5" /> Workspace Restriction
            </h2>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">{restrictionMsg}</p>
            <button 
              onClick={() => setShowRestrictionModal(false)} 
              className="w-full bg-[#dc2626] hover:bg-red-700 text-white py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CloudEditor;
