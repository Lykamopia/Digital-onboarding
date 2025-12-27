
'use client';
import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Table } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function Editor({ value, onChange, readOnly = false }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);
  const [tableGridHighlight, setTableGridHighlight] = useState({ rows: 0, cols: 0 });

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

  const handleInsertTable = (rows: number, cols: number) => {
    if (editorRef.current) {
      editorRef.current.focus();
      let tableHTML = '<table style="border-collapse: collapse; width: 100%;">';
      for (let r = 0; r < rows; r++) {
        tableHTML += '<tr>';
        for (let c = 0; c < cols; c++) {
          tableHTML += '<td style="border: 1px solid #ccc; padding: 8px;">&nbsp;</td>';
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</table><p><br></p>';
      document.execCommand('insertHTML', false, tableHTML);
      onChange(editorRef.current.innerHTML);
      setIsTablePopoverOpen(false);
    }
  };

  return (
    <div className={cn("rounded-md border border-input", readOnly && "bg-muted/50")}>
      {!readOnly && (
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
            <Popover open={isTablePopoverOpen} onOpenChange={setIsTablePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="p-2 h-auto w-auto rounded hover:bg-muted">
                  <Table className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div 
                  className="grid grid-cols-5 gap-1"
                  onMouseLeave={() => setTableGridHighlight({ rows: 0, cols: 0 })}
                >
                  {Array.from({ length: 25 }).map((_, i) => {
                    const row = Math.floor(i / 5) + 1;
                    const col = (i % 5) + 1;
                    const isHighlighted = row <= tableGridHighlight.rows && col <= tableGridHighlight.cols;
                    return (
                      <div
                        key={i}
                        onClick={() => handleInsertTable(row, col)}
                        onMouseEnter={() => setTableGridHighlight({ rows: row, cols: col })}
                        className={cn(
                          "w-6 h-6 border border-gray-300 cursor-pointer",
                          isHighlighted ? "bg-blue-200" : "hover:bg-blue-100"
                        )}
                        title={`${row}x${col} table`}
                      />
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        className={cn(
            "prose dark:prose-invert max-w-none min-h-[250px] p-4 font-serif text-sm focus:outline-none",
            readOnly && "min-h-fit"
        )}
      />
    </div>
  );
}
