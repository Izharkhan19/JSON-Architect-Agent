import React, { useState, useEffect } from 'react';
import { HelpCircle, X, Code, Braces, List, ChevronRight, Lightbulb, Copy, Check } from 'lucide-react';

const SyntaxGuidePanel = ({ isOpen, onClose }) => {
  const [guide, setGuide] = useState(null);
  const [activeSection, setActiveSection] = useState('sources');
  const [copiedSyntax, setCopiedSyntax] = useState(null);

  useEffect(() => {
    if (isOpen && !guide) {
      fetch('http://localhost:5000/api/syntax-guide')
        .then(res => res.json())
        .then(data => setGuide(data))
        .catch(err => console.error('Failed to load syntax guide:', err));
    }
  }, [isOpen, guide]);

  const handleCopySyntax = async (syntax) => {
    try {
      await navigator.clipboard.writeText(syntax);
      setCopiedSyntax(syntax);
      setTimeout(() => setCopiedSyntax(null), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  if (!isOpen) return null;

  const currentSection = guide?.sections?.find(s => s.id === activeSection);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className={`
        fixed right-0 top-16 bottom-0 w-full sm:w-[420px] lg:w-[380px]
        bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)]
        shadow-2xl z-[70] flex flex-col
        transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-teal)]/10 flex items-center justify-center">
              <Code size={16} className="text-[var(--accent-teal)]" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">Syntax Guide</h2>
              <p className="text-[10px] text-[var(--text-muted)]">Standard format for accessing data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        {guide && (
          <div className="flex-shrink-0 flex gap-1 p-2 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] overflow-x-auto custom-scrollbar">
            {guide.sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all
                  ${activeSection === section.id 
                    ? 'bg-[var(--accent-teal)] text-white shadow-md' 
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'}
                `}
              >
                {section.title.replace('Creating ', '').replace('Accessing ', '')}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {!guide ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentSection ? (
            <>
              {/* Section Description */}
              {currentSection.description && (
                <div className="p-3 rounded-xl bg-[var(--accent-teal)]/5 border border-[var(--accent-teal)]/20">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {currentSection.description}
                  </p>
                </div>
              )}

              {/* Examples */}
              {currentSection.examples && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                    <ChevronRight size={12} className="text-[var(--accent-teal)]" />
                    Examples
                  </h3>
                  {currentSection.examples.map((example, idx) => (
                    <div 
                      key={idx}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] overflow-hidden group hover:border-[var(--accent-teal)]/30 transition-all"
                    >
                      <div className="flex items-start justify-between px-3 py-2 bg-[var(--bg-tertiary)]/50">
                        <code className="text-xs font-mono text-[var(--accent-teal)] break-all leading-relaxed">
                          {example.syntax}
                        </code>
                        <button
                          onClick={() => handleCopySyntax(example.syntax)}
                          className="flex-shrink-0 ml-2 p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent-teal)] transition-all"
                          title="Copy syntax"
                        >
                          {copiedSyntax === example.syntax ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                      <div className="px-3 py-2 border-t border-[var(--border-subtle)]/50">
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          {example.description}
                        </p>
                        {example.output && (
                          <div className="mt-2 px-2 py-1 rounded-md bg-slate-900 dark:bg-slate-800">
                            <code className="text-[10px] text-emerald-400 font-mono">
                              → {example.output}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Operators (for path-operators section) */}
              {currentSection.operators && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                    <Braces size={12} className="text-[var(--accent-teal)]" />
                    Operators
                  </h3>
                  <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[var(--bg-tertiary)]">
                          <th className="px-3 py-2 text-left text-[10px] font-black text-[var(--text-muted)] uppercase">Op</th>
                          <th className="px-3 py-2 text-left text-[10px] font-black text-[var(--text-muted)] uppercase">Example</th>
                          <th className="px-3 py-2 text-left text-[10px] font-black text-[var(--text-muted)] uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentSection.operators.map((op, idx) => (
                          <tr key={idx} className="border-t border-[var(--border-subtle)]/50">
                            <td className="px-3 py-2">
                              <code className="px-1.5 py-0.5 rounded bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] font-mono font-bold">
                                {op.operator}
                              </code>
                            </td>
                            <td className="px-3 py-2 font-mono text-[var(--text-secondary)]">{op.example}</td>
                            <td className="px-3 py-2 text-[var(--text-muted)]">{op.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {/* Quick Examples */}
          {guide?.quickExamples && activeSection === 'sources' && (
            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                <List size={12} className="text-amber-500" />
                Quick Examples
              </h3>
              {guide.quickExamples.map((ex, idx) => (
                <div 
                  key={idx}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] space-y-2"
                >
                  <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{ex.title}</p>
                  <pre className="text-[10px] font-mono text-[var(--accent-teal)] bg-[var(--bg-tertiary)] p-2 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {ex.prompt}
                  </pre>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[var(--text-muted)]">Result:</span>
                    <code className="text-[10px] text-emerald-500 font-mono">{ex.result}</code>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {guide?.tips && (
            <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                <Lightbulb size={12} className="text-amber-500" />
                Pro Tips
              </h3>
              <ul className="space-y-2">
                {guide.tips.map((tip, idx) => (
                  <li 
                    key={idx}
                    className="flex items-start gap-2 text-[11px] text-[var(--text-secondary)] leading-relaxed"
                  >
                    <span className="w-4 h-4 flex-shrink-0 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SyntaxGuidePanel;
