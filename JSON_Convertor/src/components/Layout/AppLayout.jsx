import React, { useEffect } from 'react';
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
  Eye,
  HelpCircle
} from 'lucide-react';
import { Modal, Button } from 'react-bootstrap';
import useConverterStore from '../../store/useConverterStore';
import CodeEditor from '../UI/CodeEditor';
import SyntaxGuidePanel from '../UI/SyntaxGuidePanel';

const JsonTree = ({ data, level = 0 }) => {
  const [isOpen, setIsOpen] = React.useState(level < 2);
  const isArray = Array.isArray(data);
  const isObject = data !== null && typeof data === 'object';

  if (!isObject) {
    return <JsonPrimitive value={data} />;
  }

  const entries = isArray ? data.map((value, index) => [index, value]) : Object.entries(data);
  const openLabel = isArray ? '[' : '{';
  const closeLabel = isArray ? ']' : '}';

  return (
    <div className="font-mono text-[13px] leading-6 text-[var(--text-primary)]">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--accent-teal)]"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{openLabel}</span>
        {!isOpen && (
          <span className="text-[var(--text-muted)]">
            {entries.length} {isArray ? 'items' : 'keys'} {closeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="pl-5 border-l border-[var(--border-subtle)]">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-sky-500 shrink-0">
                  {isArray ? key : `"${key}"`}:
                </span>
                <JsonTree data={value} level={level + 1} />
              </div>
            ))}
          </div>
          <span className="text-[var(--text-secondary)]">{closeLabel}</span>
        </>
      )}
    </div>
  );
};

const JsonPrimitive = ({ value }) => {
  if (value === null) {
    return <span className="font-mono text-[13px] text-purple-500">null</span>;
  }

  if (typeof value === 'string') {
    return <span className="font-mono text-[13px] text-emerald-600">{JSON.stringify(value)}</span>;
  }

  if (typeof value === 'number') {
    return <span className="font-mono text-[13px] text-amber-600">{value}</span>;
  }

  if (typeof value === 'boolean') {
    return <span className="font-mono text-[13px] text-indigo-500">{String(value)}</span>;
  }

  return <span className="font-mono text-[13px] text-[var(--text-muted)]">{String(value)}</span>;
};

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
  const textareaRef = React.useRef(null);
  const [outputCopied, setOutputCopied] = React.useState(false);
  const [itemCopiedId, setItemCopiedId] = React.useState(null);
  const [isTreeView, setIsTreeView] = React.useState(true);
  const [expandedIds, setExpandedIds] = React.useState(new Set());
  const [loadingMsgIdx, setLoadingMsgIdx] = React.useState(0);
  const [showMentions, setShowMentions] = React.useState(false);
  const [mentionFilter, setMentionFilter] = React.useState('');
  const [leftWidth, setLeftWidth] = React.useState(50); // percentage
  const [isResizing, setIsResizing] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(window.innerWidth >= 1024);

  // Track window resize for responsive layout
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Modal state
  const [showViewModal, setShowViewModal] = React.useState(false);
  const [viewData, setViewData] = React.useState({ title: '', content: '' });
  const [showSyntaxGuide, setShowSyntaxGuide] = React.useState(false);

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

  // Auto-resize textarea height as user types (ChatGPT style)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    el.style.height = Math.min(scrollH, 240) + 'px';
  }, [prompt]);

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
            <span className="text-[25px] font-bold text-[var(--text-primary)] tracking-tight  leading-none">
              JSON <span className="text-[var(--accent-teal)]">Architect</span>
            </span>
          </div>
        </div>

        {/* <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400  tracking-tight">Strict Mode V2</span>
          </div>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-teal)] transition-all shadow-sm"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div> */}
      </header>

      {/* Main Split View */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Side: Input & Prompt */}
        <section
          className="flex flex-col border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)] relative min-h-[40vh] lg:min-h-0"
          style={{ width: isDesktop ? `${leftWidth}%` : '100%' }}
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
                  <p className="text-[10px] font-black text-red-600 dark:text-red-400  tracking-widest mb-0.5">Validation Alert</p>
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
                            <p className="text-[9px] font-black text-[var(--text-muted)]  tracking-widest leading-none mb-1">Attached</p>
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

                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                          className="p-1.5 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        {item.type === 'file' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenViewModal(item.name, item.content);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '7px 14px',
                              border: '1px solid #f5c26b',
                              borderRadius: '8px',
                              background: '#fff7e6',
                              color: '#b45309',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#ffefcc';
                              e.currentTarget.style.borderColor = '#f59e0b';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.2)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fff7e6';
                              e.currentTarget.style.borderColor = '#f5c26b';
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            onMouseDown={(e) => {
                              e.currentTarget.style.transform = 'scale(0.97)';
                            }}
                            onMouseUp={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                          >
                            <Eye size={13} />
                            <span>View Source</span>
                          </button>
                        )}

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
                              <p className="text-[10px] font-black text-red-600 dark:text-red-400  tracking-widest">Syntax Error</p>
                              <p className="text-xs text-red-700 dark:text-red-300 font-medium">{item.jsonError}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-8 bg-[var(--bg-tertiary)]/50 flex flex-col items-center justify-center text-center">
                          <FileText size={40} className="text-amber-500 mb-2 opacity-50" />
                          <p className="text-sm font-bold text-[var(--text-primary)]">{item.name}</p>
                          {/* <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px] mt-1">{item.name}</p> */}
                          {/* <p className="text-[10px] text-amber-600 font-black  tracking-[0.2em] mt-3 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">Ready for Architecting</p> */}
                          {item.jsonError && (
                            <div className="mt-4 w-full max-w-[520px] px-4 py-3 border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 rounded-xl text-left">
                              <p className="text-[10px] font-black text-red-600 dark:text-red-400  tracking-widest">Syntax Error</p>
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
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)] shadow-[0_0_8px_var(--accent-teal)]" />
                  <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Send Command</span>
                </div>
                <button
                  onClick={() => setShowSyntaxGuide(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--accent-teal)]/10 border border-[var(--accent-teal)]/20 text-[var(--accent-teal)] hover:bg-[var(--accent-teal)]/20 hover:border-[var(--accent-teal)]/40 transition-all group"
                  title="View Syntax Guide"
                >
                  <HelpCircle size={14} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Syntax Guide</span>
                </button>
              </div>
              <div className="relative flex-1 min-h-[80px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-primary)]/50 focus-within:border-[var(--accent-teal)] focus-within:ring-4 ring-[var(--accent-teal)]/5 transition-all duration-300">
                {/* Mention Suggestions */}
                {showMentions && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
                      <p className="text-[10px] font-black text-[var(--text-muted)]  tracking-widest">Select Reference</p>
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
                  ref={textareaRef}
                  id="prompt-textarea"
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., 'Merge @Source 1 into @Source 2'..."
                  rows={1}
                  style={{ minHeight: '56px', maxHeight: '240px', overflowY: 'auto' }}
                  className="w-full p-4 pr-16 bg-transparent text-sm font-medium resize-none placeholder:text-[var(--text-muted)]/40 focus:outline-none block"
                />
                <button
                  onClick={generateJson}
                  disabled={isGenerating}
                  title={isGenerating ? 'Sending…' : 'Send'}
                  aria-label={isGenerating ? 'Sending' : 'Send'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '12px',
                    width: '44px',
                    height: '38px',
                    border: 'none',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    background: isGenerating ? '#f1f5f9' : 'var(--accent-teal)',
                    color: isGenerating ? '#94a3b8' : '#ffffff',
                    boxShadow: isGenerating
                      ? 'none'
                      : '0 4px 12px rgba(0, 170, 170, 0.25)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = '#009d9d';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow =
                        '0 6px 16px rgba(0, 170, 170, 0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.background = 'var(--accent-teal)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow =
                        '0 4px 12px rgba(0, 170, 170, 0.25)';
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.transform = 'scale(0.96)';
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!isGenerating) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                >
                  {isGenerating ? (
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  ) : (
                    <Send size={15} />
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
          style={{ width: isDesktop ? `${100 - leftWidth}%` : '100%', flex: isDesktop ? 'none' : '1' }}
        >
          {/* <div className="panel-header">
            <div className="flex items-center gap-3">
              <FileJson size={14} className="text-[var(--accent-teal)]" />
              <span>Architectural Result</span>
              {lastUsedPrompt && (
                <span className="hidden sm:inline-block text-[9px] font-medium text-[var(--text-muted)] italic truncate max-w-[300px]">
                  &mdash; {lastUsedPrompt}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '4px',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <button
                onClick={() => setIsTreeView(false)}
                style={{
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: !isTreeView ? '#0f172a' : 'transparent',
                  color: !isTreeView ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: !isTreeView
                    ? '0 2px 8px rgba(15,23,42,0.18)'
                    : 'none',
                }}
                onMouseEnter={(e) => {
                  if (isTreeView) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isTreeView) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                RAW
              </button>

              <button
                onClick={() => setIsTreeView(true)}
                style={{
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isTreeView ? '#0f172a' : 'transparent',
                  color: isTreeView ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: isTreeView
                    ? '0 2px 8px rgba(15,23,42,0.18)'
                    : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isTreeView) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isTreeView) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                TREE
              </button>
            </div>
          </div> */}

          <div className="panel-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flex: 1,
                minWidth: 0,
              }}
            >
              <FileJson size={14} className="text-[var(--accent-teal)]" />

              <span
                style={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Architectural Result
              </span>

              {lastUsedPrompt && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '500',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    flex: 1,
                    minWidth: 0,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    lineHeight: '1.4',
                  }}
                >
                  — {lastUsedPrompt}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '4px',
                borderRadius: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <button
                onClick={() => setIsTreeView(false)}
                style={{
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: !isTreeView ? '#0f172a' : 'transparent',
                  color: !isTreeView ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: !isTreeView
                    ? '0 2px 8px rgba(15,23,42,0.18)'
                    : 'none',
                }}
                onMouseEnter={(e) => {
                  if (isTreeView) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isTreeView) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                RAW
              </button>

              <button
                onClick={() => setIsTreeView(true)}
                style={{
                  padding: '7px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isTreeView ? '#0f172a' : 'transparent',
                  color: isTreeView ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: isTreeView
                    ? '0 2px 8px rgba(15,23,42,0.18)'
                    : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isTreeView) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#0f172a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isTreeView) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }
                }}
              >
                TREE
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative group">
            {isGenerating && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(248,250,252,0.88)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  zIndex: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* ── Card ── */}
                <div
                  className="ai-loader-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '28px',
                    padding: '40px 48px',
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(13,148,136,0.18)',
                    borderRadius: '24px',
                    boxShadow: '0 20px 60px rgba(13,148,136,0.12), 0 4px 24px rgba(0,0,0,0.08)',
                    minWidth: '300px',
                    textAlign: 'center',
                  }}
                >

                  {/* ── Orbital Ring Spinner ── */}
                  <div style={{ position: 'relative', width: '80px', height: '80px' }}>

                    {/* Outer ring */}
                    <div
                      className="orbit-outer"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        border: '2.5px solid transparent',
                        borderTopColor: '#0d9488',
                        borderRightColor: 'rgba(13,148,136,0.25)',
                      }}
                    />

                    {/* Inner counter ring */}
                    <div
                      className="orbit-inner"
                      style={{
                        position: 'absolute',
                        inset: '12px',
                        borderRadius: '50%',
                        border: '2px solid transparent',
                        borderTopColor: 'rgba(13,148,136,0.5)',
                        borderBottomColor: 'rgba(13,148,136,0.2)',
                      }}
                    />

                    {/* Glow core dot */}
                    <div
                      className="glow-core"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #0d9488 0%, rgba(13,148,136,0.3) 100%)',
                          boxShadow: '0 0 16px rgba(13,148,136,0.7)',
                        }}
                      />
                    </div>
                  </div>

                  {/* ── Labels ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>

                    {/* Title */}
                    <p style={{
                      margin: 0,
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: '#0f172a',
                    }}>
                      AI Processing
                    </p>

                    {/* Cycling status message */}
                    <div style={{ height: '18px', overflow: 'hidden', position: 'relative' }}>
                      <p
                        key={loadingMsgIdx}
                        className="loader-msg"
                        style={{
                          margin: 0,
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#0d9488',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {loadingMessages[loadingMsgIdx]}
                      </p>
                    </div>

                    {/* Three bouncing dots */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                      <div className="dot1" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0d9488' }} />
                      <div className="dot2" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0d9488' }} />
                      <div className="dot3" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0d9488' }} />
                    </div>
                  </div>

                  {/* ── Progress bar ── */}
                  <div style={{
                    width: '220px',
                    height: '3px',
                    background: 'rgba(13,148,136,0.12)',
                    borderRadius: '99px',
                    overflow: 'hidden',
                  }}>
                    <div
                      key={isGenerating}
                      className="progress-bar-fill"
                      style={{
                        height: '100%',
                        borderRadius: '99px',
                        background: 'linear-gradient(90deg, #0d9488, #2dd4bf)',
                        boxShadow: '0 0 8px rgba(13,148,136,0.6)',
                      }}
                    />
                  </div>

                </div>
              </div>
            )}


            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 20,
              }}
            >
              {/* Copy Button */}
              <button
                onClick={handleCopyOutput}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: outputCopied ? '#10b981' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow =
                    '0 6px 16px rgba(0,0,0,0.12)';
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.color = '#14b8a6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = outputCopied
                    ? '#10b981'
                    : '#475569';
                }}
              >
                {outputCopied ? (
                  <Check size={13} color="#10b981" />
                ) : (
                  <Copy size={13} />
                )}

                {outputCopied ? 'Copied' : 'Copy'}
              </button>

              {/* Export Button */}
              <button
                onClick={handleExport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.92)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow =
                    '0 6px 16px rgba(0,0,0,0.12)';
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 4px 12px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <Download size={13} />
                Export
              </button>
            </div>

            {isTreeView ? (
              <div className="h-full overflow-auto p-4 custom-json-view bg-[var(--bg-editor)]">
                <JsonTree key={outputJson} data={getParsedJson()} />
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

      {/* Syntax Guide Panel */}
      <SyntaxGuidePanel 
        isOpen={showSyntaxGuide} 
        onClose={() => setShowSyntaxGuide(false)} 
      />

      {/* View Content Modal */}
      <Modal
        show={showViewModal}
        onHide={() => setShowViewModal(false)}
        size="lg"
        centered
        contentClassName="border-0 rounded-2xl shadow-2xl bg-[var(--bg-secondary)]"
      >
        <Modal.Header closeButton className="border-b border-[var(--border-subtle)] px-6 py-4">
          <Modal.Title className="text-sm font-black text-[var(--text-primary)] tracking-tighter flex items-center gap-2">
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
        {/* <Modal.Footer className="border-t border-[var(--border-subtle)] px-6 py-4">
          <Button
            variant="secondary"
            onClick={() => setShowViewModal(false)}
            className="px-6 py-2 rounded-xl text-xs font-bold  tracking-widest bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] transition-all"
          >
            Close
          </Button>
        </Modal.Footer> */}
      </Modal>
    </div>
  );
};

export default AppLayout;
