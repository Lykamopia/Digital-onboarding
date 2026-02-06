
'use client';
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { Table, Undo2, Redo2 } from 'lucide-react';
import { Separator } from './ui/separator';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function Editor({ value, onChange, readOnly = false }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isTablePopoverOpen, setIsTablePopoverOpen] = useState(false);
  const [tableGridHighlight, setTableGridHighlight] = useState({ rows: 0, cols: 0 });
  const [activeCommands, setActiveCommands] = useState({
      bold: false,
      italic: false,
      underline: false,
      insertUnorderedList: false,
      insertOrderedList: false,
  });

  const updateActiveCommands = useCallback(() => {
    setActiveCommands({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
    });
  }, []);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  useEffect(() => {
    if (readOnly) return;
    
    const editor = editorRef.current;
    if (!editor) return;

    const handleSelectionChange = () => {
        updateActiveCommands();
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    editor.addEventListener('focus', updateActiveCommands);
    editor.addEventListener('click', updateActiveCommands);
    editor.addEventListener('keyup', updateActiveCommands);
    
    return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        if (editor) {
            editor.removeEventListener('focus', updateActiveCommands);
            editor.removeEventListener('click', updateActiveCommands);
            editor.removeEventListener('keyup', updateActiveCommands);
        }
    };
  }, [readOnly, updateActiveCommands]);


  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (e.currentTarget) {
        onChange(e.currentTarget.innerHTML);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    if (readOnly || !editorRef.current) return;
    
    e.preventDefault();
    
    // Get pasted HTML or fallback to plain text
    let pastedHtml = e.clipboardData.getData('text/html');
    const pastedText = e.clipboardData.getData('text/plain');

    if (pastedHtml && pastedHtml.trim() !== '') {
      // Create a temporary element to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = pastedHtml;

      // Remove script, style, and meta tags
      tempDiv.querySelectorAll('script, style, meta, link').forEach(el => el.remove());

      // Remove unwanted attributes like class, style, id, etc. from all elements
      const elements = tempDiv.querySelectorAll('*');
      elements.forEach(el => {
        // Keep href for links and src/alt for images
        const allowedAttrs = ['href', 'src', 'alt'];
        for (let i = el.attributes.length - 1; i >= 0; i--) {
          const attr = el.attributes[i];
          if (!allowedAttrs.includes(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
        }
      });
      
      // Unwrap meaningless spans
      tempDiv.querySelectorAll('span').forEach(el => {
        if (el.attributes.length === 0) {
          el.replaceWith(...Array.from(el.childNodes));
        }
      });

      pastedHtml = tempDiv.innerHTML;
    } else if (pastedText) {
      // If only plain text is available, convert newlines to paragraphs
      pastedHtml = pastedText.split(/\r\n|\r|\n/g)
        .map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>')
        .join('');
    } else {
      return; // Nothing to paste
    }
    
    // Insert the cleaned HTML
    document.execCommand('insertHTML', false, pastedHtml);
    onChange(editorRef.current.innerHTML);
  }, [readOnly, onChange]);

  
  const handleCommand = (command: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand(command, false);
        onChange(editorRef.current.innerHTML);
        updateActiveCommands();
      }
  }

  const handleInsertTable = (rows: number, cols: number) => {
    if (editorRef.current) {
      editorRef.current.focus();
      let tableHTML = '<table>';
      for (let r = 0; r < rows; r++) {
        tableHTML += '<tr>';
        for (let c = 0; c < cols; c++) {
          tableHTML += '<td>&nbsp;</td>';
        }
        tableHTML += '</tr>';
      }
      tableHTML += '</table><p><br></p>';
      document.execCommand('insertHTML', false, tableHTML);
      onChange(editorRef.current.innerHTML);
      setIsTablePopoverOpen(false);
    }
  };
  
  const toolbarButtonClass = "p-2 rounded hover:bg-muted text-sm";
  const activeToolbarButtonClass = "bg-primary/20";


  return (
    <div className={cn("rounded-md border border-input", readOnly && "bg-muted/50")}>
      {!readOnly && (
        <div className="flex items-center gap-1 border-b p-2">
            <button onClick={handleCommand('undo')} className={cn(toolbarButtonClass)} title="Undo (Ctrl+Z)">
                <Undo2 className="h-4 w-4" />
            </button>
            <button onClick={handleCommand('redo')} className={cn(toolbarButtonClass)} title="Redo (Ctrl+Y)">
                <Redo2 className="h-4 w-4" />
            </button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <button onClick={handleCommand('bold')} className={cn(toolbarButtonClass, "font-bold", { [activeToolbarButtonClass]: activeCommands.bold })}>B</button>
            <button onClick={handleCommand('italic')} className={cn(toolbarButtonClass, "italic", { [activeToolbarButtonClass]: activeCommands.italic })}>I</button>
            <button onClick={handleCommand('underline')} className={cn(toolbarButtonClass, "underline", { [activeToolbarButtonClass]: activeCommands.underline })}>U</button>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <button onClick={handleCommand('insertUnorderedList')} className={cn(toolbarButtonClass, { [activeToolbarButtonClass]: activeCommands.insertUnorderedList })}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 4H3V5H2V4ZM5 4H14V5H5V4ZM2 7.5H3V8.5H2V7.5ZM5 7.5H14V8.5H5V7.5ZM2 11H3V12H2V11ZM5 11H14V12H5V11Z" fill="currentColor"></path></svg>
            </button>
            <button onClick={handleCommand('insertOrderedList')} className={cn(toolbarButtonClass, { [activeToolbarButtonClass]: activeCommands.insertOrderedList })}>
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
        onPaste={handlePaste}
        className={cn(
            "prose dark:prose-invert max-w-none min-h-[250px] p-4 font-serif text-sm focus:outline-none",
            readOnly && "min-h-fit"
        )}
      />
    </div>
  );
}
