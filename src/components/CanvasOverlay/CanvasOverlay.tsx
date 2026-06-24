import { useRef } from 'react';
import type { Stroke } from '../../types';

interface CanvasOverlayProps {
  strokes: Stroke[];
  width: number;
  height: number;
  interactive?: boolean;
  onStartStroke?: (point: { x: number; y: number }) => void;
  onContinueStroke?: (point: { x: number; y: number }) => void;
  onEndStroke?: () => void;
}

export function CanvasOverlay({
  strokes,
  width,
  height,
  interactive = true,
  onStartStroke,
  onContinueStroke,
  onEndStroke,
}: CanvasOverlayProps) {
  const isDrawing = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    isDrawing.current = true;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    onStartStroke?.({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !isDrawing.current) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    onContinueStroke?.({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerUp = () => {
    if (!interactive || !isDrawing.current) return;
    isDrawing.current = false;
    onEndStroke?.();
  };

  return (
    <canvas
      ref={(canvas) => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        for (const stroke of strokes) {
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (stroke.type === 'point' && stroke.points[0]) {
            ctx.beginPath();
            ctx.arc(stroke.points[0].x, stroke.points[0].y, 5, 0, Math.PI * 2);
            ctx.fill();
          } else if (stroke.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
          }
        }
      }}
      width={width}
      height={height}
      className={`canvas-overlay ${!interactive ? 'pointer-events-none' : ''}`}
      style={{ width, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
}
