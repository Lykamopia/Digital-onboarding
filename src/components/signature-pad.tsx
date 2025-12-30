
'use client';

import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Undo, Trash2, Save } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
}

export function SignaturePad({ onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getContext = () => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d');
  };

  const saveHistory = () => {
    const context = getContext();
    if (context) {
        setHistory(prev => [...prev, context.getImageData(0, 0, context.canvas.width, context.canvas.height)]);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const context = getContext();
    if (!context) return;
    saveHistory();
    context.beginPath();
    const { x, y } = getCoordinates(e);
    context.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const context = getContext();
    if (!context) return;
    const { x, y } = getCoordinates(e);
    context.lineTo(x, y);
    context.strokeStyle = strokeColor;
    context.lineWidth = strokeWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  };

  const stopDrawing = () => {
    const context = getContext();
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const clearCanvas = () => {
    const context = getContext();
    if (context) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        setHistory([]);
    }
  };

  const undoLast = () => {
    const context = getContext();
    if (context && history.length > 0) {
        const lastState = history[history.length - 1];
        context.putImageData(lastState, 0, 0);
        setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Create a temporary canvas to trim whitespace
      const context = getContext();
      if (!context) return;

      const { width, height } = canvas;
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      let minX = width, minY = height, maxX = 0, maxY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] > 0) { // Check alpha channel
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (minX > maxX) { // Canvas is empty
        onSave('');
        return;
      }
      
      const padding = 20;
      const trimmedWidth = maxX - minX + 2 * padding;
      const trimmedHeight = maxY - minY + 2 * padding;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = trimmedWidth;
      tempCanvas.height = trimmedHeight;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.fillStyle = 'white';
      tempCtx.fillRect(0, 0, trimmedWidth, trimmedHeight);
      tempCtx.drawImage(canvas, minX, minY, maxX - minX, maxY - minY, padding, padding, maxX - minX, maxY - minY);

      onSave(tempCanvas.toDataURL('image/png'));
    }
  };

  if (!isClient) return null;

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        width={500}
        height={300}
        className="rounded-md border-2 border-dashed bg-muted/50 cursor-crosshair"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
            <Label>Color:</Label>
            <Input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-12 h-10 p-1"
            />
        </div>
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
            <Label>Weight:</Label>
            <Slider
                min={1}
                max={10}
                step={0.5}
                value={[strokeWidth]}
                onValueChange={(value) => setStrokeWidth(value[0])}
                className="w-full"
            />
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={undoLast} disabled={history.length === 0} title="Undo">
                <Undo className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={clearCanvas} title="Clear">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </div>
       <div className="flex justify-end pt-4">
            <Button onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Signature
            </Button>
        </div>
    </div>
  );
}
