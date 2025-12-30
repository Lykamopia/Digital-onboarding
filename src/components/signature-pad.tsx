
'use client';

import { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Undo, Trash2, Save } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  initialSignature?: string;
}

interface Point {
  x: number;
  y: number;
  time: number;
}

export function SignaturePad({ onSave, initialSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isClient, setIsClient] = useState(false);

  const pointsRef = useRef<Point[]>([]);

  // We wait for the component to mount before rendering the canvas
  // to ensure window/document are available.
  useEffect(() => {
    setIsClient(true);
  }, []);

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    return canvas?.getContext('2d');
  }, []);

  // Effect to handle canvas DPI scaling
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context || !isClient) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    context.scale(dpr, dpr);

    // If there's an initial signature, draw it.
    if (initialSignature) {
        const image = new Image();
        image.onload = () => {
            context.drawImage(image, 0, 0, canvas.width / dpr, canvas.height / dpr);
            saveHistory();
        }
        image.src = initialSignature;
    }
  }, [isClient, initialSignature, getContext]);

  const saveHistory = useCallback(() => {
    const context = getContext();
    if (context) {
        const { canvas } = context;
        setHistory(prev => [...prev, context.getImageData(0, 0, canvas.width, canvas.height)]);
    }
  }, [getContext]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const context = getContext();
    if (!context) return;
    saveHistory();
    const { x, y } = getCoordinates(e);
    pointsRef.current = [{ x, y, time: Date.now() }];
    setIsDrawing(true);
  };
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const context = getContext();
    if (!context) return;
    const { x, y } = getCoordinates(e);
    const newPoint = { x, y, time: Date.now() };
    pointsRef.current.push(newPoint);

    if(pointsRef.current.length > 2) {
      const points = pointsRef.current;
      const lastTwo = points.slice(-2);
      const controlPoint = lastTwo[0];
      const endPoint = {
        x: (lastTwo[0].x + lastTwo[1].x) / 2,
        y: (lastTwo[0].y + lastTwo[1].y) / 2,
      };

      context.beginPath();
      context.moveTo(points[points.length-3].x, points[points.length-3].y);
      context.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
      
      context.strokeStyle = strokeColor;
      context.lineWidth = strokeWidth;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const context = getContext();
    if (!context) return;

    context.closePath();
    setIsDrawing(false);
    pointsRef.current = [];
  };

  const clearCanvas = () => {
    const context = getContext();
    if (context) {
        saveHistory();
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
  };
  
  const undoLast = () => {
    const context = getContext();
    if (context && history.length > 0) {
        const lastState = history[history.length - 1];
        context.putImageData(lastState, 0, 0);
        setHistory(prev => prev.slice(0, -1));
    } else if (context) {
        // if history is empty, clear the canvas
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = getContext();
    if (!context) return;
    
    // Create a copy of the canvas to avoid altering the original
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if(!tempCtx) return;

    const dpr = window.devicePixelRatio || 1;
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.drawImage(canvas, 0, 0);

    const { width, height } = tempCanvas;
    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width, minY = height, maxX = -1, maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX === -1) { // Canvas is empty
      onSave('');
      return;
    }

    const padding = 20 * dpr;
    const trimmedWidth = maxX - minX + 2 * padding;
    const trimmedHeight = maxY - minY + 2 * padding;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = trimmedWidth;
    finalCanvas.height = trimmedHeight;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;
    
    finalCtx.drawImage(tempCanvas, minX, minY, maxX - minX, maxY - minY, padding, padding, maxX - minX, maxY - minY);
    
    onSave(finalCanvas.toDataURL('image/webp', 0.95));
  };


  if (!isClient) return <div className="h-[300px] w-[500px] bg-muted/50 rounded-md animate-pulse"></div>;

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        className="w-[500px] h-[300px] rounded-md border-2 border-dashed bg-muted/50 cursor-crosshair touch-none"
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
