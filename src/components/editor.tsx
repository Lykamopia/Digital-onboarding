'use client';
import React, { useRef, useEffect } from 'react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function Editor({ value, onChange }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (e.currentTarget) {
        onChange(e.currentTarget.innerHTML);
    }
  };
  
  const handleCommand = (command: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false);
        onChange(editorRef.current.innerHTML);
      }
  }

  return (
    <div className="rounded-md border border-input">
      <div className="flex items-center gap-1 border-b p-2">
        <button onClick={handleCommand('bold')} className="p-2 rounded hover:bg-muted font-bold text-sm">B</button>
        <button onClick={handleCommand('italic')} className="p-2 rounded hover:bg-muted italic text-sm">I</button>
        <button onClick={handleCommand('underline')} className="p-2 rounded hover:bg-muted underline text-sm">U</button>
        <button onClick={handleCommand('insertUnorderedList')} className="p-2 rounded hover:bg-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4H3V5H2V4ZM5 4H14V5H5V4ZM2 7.5H3V8.5H2V7.5ZM5 7.5H14V8.5H5V7.5ZM2 11H3V12H2V11ZM5 11H14V12H5V11Z" fill="currentColor"></path></svg>
        </button>
        <button onClick={handleCommand('insertOrderedList')} className="p-2 rounded hover:bg-muted">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.2 3.25L1.5 4L2.2 4.75H3.5V5.5H1.5V6.25H3.5V7H1.5V8.5H3.5V9.25H1.5L2.2 10L1.5 10.75V11.5H4V3.25H2.2ZM5 4H14V5H5V4ZM5 7.5H14V8.5H5V7.5ZM2.5 11V10H2V9.25H3.5L2.75 10.75L3.5 12.25H2V11.5H2.5V11ZM5 11H14V12H5V11Z" fill="currentColor"></path></svg>
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="prose dark:prose-invert max-w-none min-h-[250px] p-4 font-mono text-sm focus:outline-none"
      />
    </div>
  );
}
