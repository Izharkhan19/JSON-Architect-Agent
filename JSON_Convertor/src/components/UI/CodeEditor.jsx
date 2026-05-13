import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import useConverterStore from '../../store/useConverterStore';

const CodeEditor = ({ value, onChange, placeholder, readOnly = false }) => {
  const { theme } = useConverterStore();

  const editorTheme = theme === 'dark' ? 'dark' : 'light';

  return (
    <div className="flex-1 overflow-hidden bg-[var(--bg-editor)] transition-colors duration-200 h-full border-t border-[var(--border-subtle)] lg:border-t-0">
      <CodeMirror
        value={value}
        height="100%"
        theme={editorTheme}
        extensions={[json()]}
        onChange={(val) => onChange ? onChange(val) : null}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          tabSize: 2,
        }}
        style={{
          fontSize: '13px',
          fontFamily: 'var(--font-mono)',
          height: '100%',
        }}
      />
    </div>
  );
};

export default CodeEditor;
