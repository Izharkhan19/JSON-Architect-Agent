import React, { useEffect } from 'react';
import ReactJson from 'react-json-view';
import {
  Braces,
  Copy,
  Download,
  Check,
  Trash2,
  Layout,
  Send,
  FileJson,
  ShieldCheck,
  Sun,
  Moon,
  Upload,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Eye
} from 'lucide-react';
import { Modal, Button } from 'react-bootstrap';
import useConverterStore from '../../store/useConverterStore';
import CodeEditor from '../UI/CodeEditor';

const AppLayout = () => {
  const {
    items,
    addItem,
    addFiles,
    removeItem,
    updateItemContent,
    prompt,
    setPrompt,
    outputJson,
    generateJson,
    isGenerating,
    clearAll,
    error,
    theme,
    toggleTheme,
    lastUsedPrompt
  } = useConverterStore();

  const fileInputRef = React.useRef(null);
  const [outputCopied, setOutputCopied] = React.useState(false);
  const [itemCopiedId, setItemCopiedId] = React.useState(null);
  const [isTreeView, setIsTreeView] = React.useState(true);
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [loadingMsgIdx, setLoadingMsgIdx] = React.useState(0);
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionFilter, setMentionFilter] = React.useState('');
  const [leftWidth, setLeftWidth] = React.useState(50); // percentage
  const [isResizing, setIsResizing] = React.useState(false);

  // Modal state
  const [showViewModal, setShowViewModal] = React.useState(false);
  const [viewData, setViewData] = React.useState({ title: '', content: '' });

  const handleOpenViewModal = (title, content) => {
    setViewData({ title, content });
    setShowViewModal(true);
  };

  const loadingMessages = [
    "Initializing generative core...",
    "Analyzing data patterns...",
    "Synthesizing architectural schema...",
    "Optimizing JSON hierarchy...",
    "Validating structural integrity...",
    "Finalizing deployment..."
  ];

  // Cycle through loading messages
  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
      }, 1500);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handlePromptChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes(' ')) {
        setMentionFilter(query);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    setPrompt(val);
  };

  const handleKeyDown = (e) => {
    if (showMentions) {
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        const filtered = items.filter(item => item.name.toLowerCase().includes(mentionFilter.toLowerCase()));
        if (filtered.length > 0) {
          insertMention(filtered[0].name);
        }
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateJson();
    }
  };

  const insertMention = (name) => {
    const textarea = document.getElementById('prompt-textarea');
    const cursorPos = textarea.selectionStart;
    const textBeforeAt = prompt.slice(0, prompt.lastIndexOf('@', cursorPos - 1));
    const textAfterCursor = prompt.slice(cursorPos);
    const newPrompt = textBeforeAt + '@' + name + ' ' + textAfterCursor;
    setPrompt(newPrompt);
    setShowMentions(false);

    // Set focus back and move cursor
    setTimeout(() => {
      textarea.focus();
      const newPos = textBeforeAt.length + name.length + 2; // +1 for @, +1 for space
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Set the first item as expanded initially
  useEffect(() => {
    if (items.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([items[0].id]));
    }
  }, [items]);

  const toggleExpand = (id) => {
    // Accordion behavior: Only one item can be expanded at a time
    const next = new Set();
    if (!expandedIds.has(id)) {
      next.add(id);
    }
    setExpandedIds(next);
  };

  // Resizing logic

  const handleMouseDown = (e) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(outputJson);
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 1200);
    } catch {
      // ignore clipboard errors (non-HTTPS or permissions)
    }
  };

  const handleExport = () => {
    if (!outputJson || outputJson === '{}') return;
    const blob = new Blob([outputJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `architected_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddItem = () => {
    const id = addItem('text');
    // Accordion behavior: only the new item remains expanded
    setExpandedIds(new Set([id]));
    // Scroll to new item
    setTimeout(() => {
      document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleFileChange = async (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles.length > 0) {
      const allTxt = Array.from(selectedFiles).every(f => f.name.endsWith('.txt'));
      if (!allTxt) {
        alert('Strict Mode: Only .txt files are accepted.');
        return;
      }

      const oversizeFile = Array.from(selectedFiles).find(f => f.size > 100 * 1024 * 1024);
      if (oversizeFile) {
        alert(`Strict Mode: File "${oversizeFile.name}" exceeds the 100MB limit. Please upload a smaller file.`);
        return;
      }

      const ids = await addFiles(selectedFiles);

      // Auto-expand only the first newly added file (Accordion mode)
      setExpandedIds(new Set([ids[0]]));

      // Scroll to the first new file
      setTimeout(() => {
        document.getElementById(`item-${ids[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      e.target.value = '';
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const getParsedJson = () => {
    try {
      return JSON.parse(outputJson);
    } catch {
      return { error: "Invalid JSON structure in output" };
    }
  };

  const handleCopyItem = async (itemId, text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setItemCopiedId(itemId);
      setTimeout(() => setItemCopiedId(null), 1200);
    } catch {
      // ignore clipboard errors (non-HTTPS or permissions)
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[var(--bg-primary)] transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-6 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 dark:bg-[var(--accent-teal)] rounded-lg flex items-center justify-center shadow-md border border-white/10">
            <Braces size={16} className="text-[var(--accent-teal)] dark:text-white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="text-[25px] font-bold text-[var(--text-primary)] tracking-tight uppercase leading-none">
              JSON <span className="text-[var(--accent-teal)]">Architect</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Strict Mode V2</span>
          </div>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-teal)] transition-all shadow-sm"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>

      {/* Main Split View */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Input & Prompt */}
        <section
          className="flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] relative min-h-[40vh] lg:min-h-0"
          style={{ width: window.innerWidth >= 1024 ? `${leftWidth}%` : '100%' }}
        >
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Layout size={14} className="text-[var(--accent-teal)]" />
              <span>Mixed Input & Architecture Instructions</span>
            </div>

          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-1 rounded-lg">
            <input
              type="file"
              ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt"
                multiple
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--accent-teal)]"
                title="Attach .txt Files"
              >
                <Upload size={14} />
              </button>
              <button
                onClick={handleAddItem}
                className="p-1.5 hover:bg-emerald-50 text-[var(--text-muted)] hover:text-emerald-500 rounded-md"
                title="Add Object"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={clearAll}
                className="p-1.5 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 rounded-md"
                title="Clear All"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-auto bg-[var(--bg-primary)]/30 custom-scrollbar relative">
            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl flex items-start gap-3 animate-shake z-30 shadow-sm sticky top-4">
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-0.5">Validation Alert</p>
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">{error}</p>
                </div>
                <button onClick={() => useConverterStore.setState({ error: null })} className="text-red-400 hover:text-red-600 p-1">
                  <Plus size={14} className="rotate-45" />
                </button>
              </div>
            )}

            <div className="p-3 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  id={`item-${item.id}`}
                  className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden shadow-sm hover:shadow-md transition-all group"
                >
                  <div
                    onClick={() => toggleExpand(item.id)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-all ${expandedIds.has(item.id) ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]/50'}`}
                  >
                    <div className="flex items-center gap-3">
                      {expandedIds.has(item.id) ? <ChevronDown size={14} className="text-[var(--accent-teal)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${item.type === 'file' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {item.type === 'file' ? <FileText size={16} /> : <FileJson size={16} />}
                      </div>
                      <div>
                        {item.type === 'file' ? (
                          <>
                            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none mb-1">Attached</p>
                            <p className={`text-xs font-bold truncate max-w-[200px] ${expandedIds.has(item.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                              {item.name}
                            </p>
                          </>
                        ) : (
                          <p className={`text-xs font-bold ${expandedIds.has(item.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {item.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.jsonError && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 dark:text-red-400 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-full">
                          <AlertCircle size={12} />
                          Invalid JSON
                        </span>
                      )}
                      {item.type === 'text' && item.content.length > 0 && !expandedIds.has(item.id) && (
                        <span className="text-[9px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--bg-primary)] rounded">
                          {(item.content.length / 1024).toFixed(1)} KB
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopyItem(item.id, item.content); }}
                          className="p-1.5 hover:bg-emerald-50 text-[var(--text-muted)] hover:text-emerald-600 rounded-lg transition-all"
                          title="Copy content"
                        >
                          {itemCopiedId === item.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        </button>
                        {item.type === 'file' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenViewModal(item.name, item.content); }}
                            className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/5 border border-amber-500/20 rounded-md text-[10px] font-semibold text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all duration-200"
                          >
                            <Eye size={12} />
                            View Source
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="p-1.5 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedIds.has(item.id) && (
                    <div className="border-t border-[var(--border-subtle)]/50">
                      {item.type === 'text' ? (
                        <div className="h-[250px] lg:h-[350px]">
                          <CodeEditor
                            value={item.content}
                            onChange={(v) => updateItemContent(item.id, v)}
                            placeholder="Paste your JSON here..."
                          />
                          {item.jsonError && (
                            <div className="px-4 py-2 border-t border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10">
                              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Syntax Error</p>
                              <p className="text-xs text-red-700 dark:text-red-300 font-medium">{item.jsonError}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 bg-[var(--bg-tertiary)]/50 flex flex-col items-center justify-center text-center">
                          <FileText size={40} className="text-amber-500 mb-2 opacity-50" />
                          <p className="text-sm font-bold text-[var(--text-primary)]">{item.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px] mt-1">{item.name}</p>
                          <p className="text-[10px] text-amber-600 font-black uppercase tracking-[0.2em] mt-3 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">Ready for Architecting</p>
                          {item.jsonError && (
                            <div className="mt-4 w-full max-w-[520px] px-4 py-3 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 rounded-xl text-left">
                              <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Syntax Error</p>
                              <p className="text-xs text-red-700 dark:text-red-300 font-medium break-words">{item.jsonError}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* AI Prompt Command Center */}
          <div className="flex-shrink-0 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)] p-6 z-40 relative shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="max-w-4xl mx-auto flex flex-col gap-3 group">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] shadow-[0_0_8px_var(--accent-teal)]" />
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Send Command</span>
              </div>
              <div className="relative flex-1 min-h-[80px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/50 focus-within:border-[var(--accent-teal)] focus-within:ring-4 ring-[var(--accent-teal)]/5 transition-all duration-300">
                {/* Mention Suggestions */}
                {showMentions && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                      <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Select Reference</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      {items
                        .filter(item => item.name.toLowerCase().includes(mentionFilter.toLowerCase()))
                        .map(item => (
                          <button
                            key={item.id}
                            onClick={() => insertMention(item.name)}
                            className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-[var(--accent-teal)]/10 text-left transition-colors group"
                          >
                            <div className={`w-6 h-6 flex items-center justify-center rounded-md ${item.type === 'file' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                              {item.type === 'file' ? <FileText size={12} /> : <FileJson size={12} />}
                            </div>
                            <span className="text-xs font-bold text-[var(--text-secondary)] group-hover:text-[var(--accent-teal)]">{item.name}</span>
                          </button>
                        ))
                      }
                      {items.filter(item => item.name.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center">
                          <p className="text-[10px] font-medium text-[var(--text-muted)]">No sources found</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <textarea
                  id="prompt-textarea"
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., 'Merge @Source 1 into @Source 2'..."
                  className="w-full h-full min-h-[80px] p-4 pr-28 bg-transparent text-sm font-medium resize-none placeholder:text-[var(--text-muted)]/40 focus:outline-none"
                />
                <button
                  onClick={generateJson}
                  disabled={isGenerating}
                  title={isGenerating ? 'Sending…' : 'Send'}
                  aria-label={isGenerating ? 'Sending' : 'Send'}
                  className={`absolute right-3 bottom-3 w-11 h-9 rounded-lg font-semibold text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center justify-center ${isGenerating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[var(--accent-teal)] text-white hover:bg-[#009d9d] hover:shadow-lg hover:shadow-[var(--accent-teal)]/20 active:scale-95'}`}
                >
                  {isGenerating ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Draggable Divider (Desktop Only) */}
        <div
          onMouseDown={handleMouseDown}
          className={`hidden lg:flex absolute top-0 bottom-0 z-50 w-1.5 cursor-col-resize items-center justify-center group transition-all hover:bg-[var(--accent-teal)]/20 ${isResizing ? 'bg-[var(--accent-teal)]/40' : ''}`}
          style={{ left: `calc(${leftWidth}% - 3px)` }}
        >
          <div className="w-0.5 h-8 bg-[var(--border-subtle)] group-hover:bg-[var(--accent-teal)] rounded-full transition-all" />
        </div>

        {/* Right Side: Output */}
        <section
          className="flex flex-col bg-[var(--bg-primary)] overflow-hidden"
          style={{ width: window.innerWidth >= 1024 ? `${100 - leftWidth}%` : '100%', flex: window.innerWidth >= 1024 ? 'none' : '1' }}
        >
          <div className="panel-header">
            <div className="flex items-center gap-3">
              <FileJson size={14} className="text-[var(--accent-teal)]" />
              <span>Architectural Result</span>
              {lastUsedPrompt && (
                <span className="hidden sm:inline-block text-[9px] font-medium text-[var(--text-muted)] italic truncate max-w-[300px]">
                  &mdash; {lastUsedPrompt}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-1 rounded-lg">
              <button
                onClick={() => setIsTreeView(false)}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${!isTreeView ? 'bg-slate-900 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-slate-900'}`}
              >
                RAW
              </button>
              <button
                onClick={() => setIsTreeView(true)}
                className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${isTreeView ? 'bg-slate-900 text-white shadow-md' : 'text-[var(--text-muted)] hover:text-slate-900'}`}
              >
                TREE
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative group">
            {isGenerating && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-30 flex items-center justify-center animate-in fade-in duration-500">
                <div className="flex flex-col items-center max-w-sm w-full p-8 text-center">
                  {/* Professional AI Ring Loader */}
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-[var(--accent-teal)]/10 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-[var(--accent-teal)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    <div className="absolute inset-4 border-2 border-slate-200 dark:border-slate-800 rounded-full animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-[var(--accent-teal)] rounded-full animate-ping" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] animate-pulse">
                      Transforming Architecture
                    </h3>

                    <div className="h-4 flex items-center justify-center">
                      <p className="text-[10px] font-mono text-[var(--accent-teal)] font-bold tracking-tight">
                        {loadingMessages[loadingMsgIdx]}
                      </p>
                    </div>

                    <div className="pt-6 w-48 mx-auto">
                      <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-transparent via-[var(--accent-teal)] to-transparent w-24 animate-shimmer" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
              <button
                onClick={handleCopyOutput}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-[var(--text-secondary)] hover:text-[var(--accent-teal)] rounded-lg text-[10px] font-bold uppercase transition-all shadow-xl"
              >
                {outputCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                {outputCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-[var(--text-secondary)] hover:text-blue-500 rounded-lg text-[10px] font-bold uppercase transition-all shadow-xl"
              >
                <Download size={12} />
                Export
              </button>
            </div>

            {isTreeView ? (
              <div className="h-full overflow-auto p-4 custom-json-view bg-[var(--bg-editor)]">
                {(() => {
                  const JsonView = ReactJson.default || ReactJson;
                  return (
                    <JsonView
                      key={outputJson}
                      src={getParsedJson()}
                      theme={theme === 'dark' ? 'monokai' : 'rgh'}
                      iconStyle="triangle"
                      collapsed={2}
                      enableClipboard={false}
                      displayDataTypes={false}
                      displayObjectSize={true}
                      indentWidth={2}
                      style={{ backgroundColor: 'transparent', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                    />
                  );
                })()}
              </div>
            ) : (
              <div className="h-full">
                <CodeEditor
                  value={outputJson}
                  readOnly={true}
                  placeholder="Output will appear here..."
                />
              </div>
            )}
          </div>
        </section>
      </main>

      {/* View Content Modal */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="lg"
        centered
        contentClassName="border-0 rounded-2xl shadow-2xl bg-[var(--bg-secondary)]"
      >
        <Modal.Header closeButton className="border-b border-[var(--border-subtle)] px-6 py-4">
          <Modal.Title className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tighter flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            Viewing Content: <span className="text-[var(--accent-teal)]">{viewData.title}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="h-[500px] bg-[var(--bg-editor)] overflow-auto custom-scrollbar">
            <CodeEditor
              value={viewData.content}
              readOnly={true}
              placeholder="File content is empty"
            />
          </div>
        </Modal.Body>
        <Modal.Footer className="border-t border-[var(--border-subtle)] px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => setShowViewModal(false)}
            className="px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-all"
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AppLayout;
