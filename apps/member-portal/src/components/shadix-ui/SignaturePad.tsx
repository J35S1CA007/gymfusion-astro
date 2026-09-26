import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CanvasHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import getStroke, { type StrokeOptions } from "perfect-freehand";

type SignatureValue = string | null;
type KeyboardPoint = { x: number; y: number };
type Point = KeyboardPoint & { pressure: number };
type Stroke = { points: Point[]; simulatePressure: boolean };

const FREEHAND_OPTIONS: Omit<StrokeOptions, "last" | "simulatePressure"> = {
  size: 4,
  thinning: 0.55,
  smoothing: 0.45,
  streamline: 0.5,
  start: { cap: true, taper: false },
  end: { cap: true, taper: false },
};

export interface SignaturePadHandle {
  clear: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  isEmpty: () => boolean;
  toDataURL: () => SignatureValue;
}

export interface SignaturePadProps
  extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "onChange"> {
  lineWidth?: number;
  onChange?: (signature: SignatureValue) => void;
  penColor?: string;
}

// Adapted from the MIT-licensed @shadix-ui/signature-pad registry component.
const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    {
      className = "",
      lineWidth = 4,
      onChange,
      penColor = "#000000",
      ...canvasProps
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const keyboardDrawingRef = useRef(false);
    const keyboardPointRef = useRef<KeyboardPoint | null>(null);
    const activeStrokeRef = useRef<Stroke | null>(null);
    const completedStrokesRef = useRef<Stroke[]>([]);
    const logicalSizeRef = useRef({ width: 0, height: 0 });

    function configureContext(context: CanvasRenderingContext2D, ratio: number) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = penColor;
      context.globalCompositeOperation = "source-over";
      contextRef.current = context;
    }

    function fillOutline(context: CanvasRenderingContext2D, outline: [number, number][]) {
      if (outline.length === 0) return;
      context.beginPath();
      context.moveTo(outline[0][0], outline[0][1]);
      for (let index = 1; index < outline.length; index += 1) {
        const current = outline[index];
        const next = outline[(index + 1) % outline.length];
        context.quadraticCurveTo(
          current[0],
          current[1],
          (current[0] + next[0]) / 2,
          (current[1] + next[1]) / 2,
        );
      }
      context.closePath();
      context.fill();
    }

    function renderStroke(context: CanvasRenderingContext2D, stroke: Stroke, last: boolean) {
      const options: StrokeOptions = {
        ...FREEHAND_OPTIONS,
        size: Math.max(1, lineWidth),
        last,
        simulatePressure: stroke.simulatePressure,
      };
      fillOutline(context, getStroke(stroke.points.map(({ x, y, pressure }) => [x, y, pressure]), options));
    }

    function renderCanvas() {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;

      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
      configureContext(context, Math.max(window.devicePixelRatio || 1, 1));

      completedStrokesRef.current.forEach((stroke) => renderStroke(context, stroke, true));
      const activeStroke = activeStrokeRef.current;
      if (activeStroke) renderStroke(context, activeStroke, false);
    }

    function clearCanvas() {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }

    function clear() {
      clearCanvas();
      drawingRef.current = false;
      emptyRef.current = true;
      keyboardDrawingRef.current = false;
      keyboardPointRef.current = null;
      activeStrokeRef.current = null;
      completedStrokesRef.current = [];
      onChange?.(null);
    }

    function toDataURL(): SignatureValue {
      const canvas = canvasRef.current;
      return canvas && !emptyRef.current ? canvas.toDataURL("image/png") : null;
    }

    useImperativeHandle(ref, () => ({
      clear,
      getCanvas: () => canvasRef.current,
      isEmpty: () => emptyRef.current,
      toDataURL,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = Math.max(1, Math.round(rect.width * ratio));
        const height = Math.max(1, Math.round(rect.height * ratio));
        const previousSize = logicalSizeRef.current;
        if (previousSize.width > 1 && previousSize.height > 1 &&
          (previousSize.width !== rect.width || previousSize.height !== rect.height)) {
          const scaleX = rect.width / previousSize.width;
          const scaleY = rect.height / previousSize.height;
          const scalePoint = (point: Point) => ({ ...point, x: point.x * scaleX, y: point.y * scaleY });
          completedStrokesRef.current = completedStrokesRef.current.map((stroke) => ({
            ...stroke,
            points: stroke.points.map(scalePoint),
          }));
          if (activeStrokeRef.current) {
            activeStrokeRef.current = {
              ...activeStrokeRef.current,
              points: activeStrokeRef.current.points.map(scalePoint),
            };
          }
        }
        logicalSizeRef.current = { width: rect.width, height: rect.height };
        if (canvas.width === width && canvas.height === height) {
          configureContext(canvas.getContext("2d")!, ratio);
          renderCanvas();
          return;
        }

        canvas.width = width;
        canvas.height = height;
        configureContext(canvas.getContext("2d")!, ratio);
        renderCanvas();
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      const resizeObserver = new ResizeObserver(resizeCanvas);
      resizeObserver.observe(canvas);
      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", resizeCanvas);
      };
    }, [lineWidth, penColor]);

    function pointerPosition(event: ReactPointerEvent<HTMLCanvasElement>): Point {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        pressure: event.pressure,
      };
    }

    function startStroke(point: Point, simulatePressure: boolean) {
      drawingRef.current = true;
      emptyRef.current = false;
      activeStrokeRef.current = { points: [point], simulatePressure };
      renderCanvas();
    }

    function drawToPoint(point: Point) {
      const activeStroke = activeStrokeRef.current;
      if (!activeStroke) return;
      activeStroke.points.push(point);
      renderCanvas();
    }

    function finishStroke() {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const activeStroke = activeStrokeRef.current;
      if (activeStroke) completedStrokesRef.current.push(activeStroke);
      activeStrokeRef.current = null;
      renderCanvas();
      onChange?.(toDataURL());
    }

    function pointerPressure(event: ReactPointerEvent<HTMLCanvasElement>) {
      const pressure = Number.isFinite(event.pressure) ? event.pressure : 0;
      const hasUsablePressure = pressure > 0 && pressure <= 1;
      const usesRealPressure = (event.pointerType === "pen" || event.pointerType === "touch") && hasUsablePressure && pressure !== 0.5;
      return { pressure: usesRealPressure ? pressure : 0.5, simulatePressure: !usesRealPressure };
    }

    function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      keyboardDrawingRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      const pressure = pointerPressure(event);
      startStroke({ ...pointerPosition(event), pressure: pressure.pressure }, pressure.simulatePressure);
    }

    function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current || keyboardDrawingRef.current) return;
      event.preventDefault();
      drawToPoint(pointerPosition(event));
    }

    function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
      if (!drawingRef.current || keyboardDrawingRef.current) return;
      event.preventDefault();
      finishStroke();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function handleKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const current = keyboardPointRef.current || { x: rect.width / 2, y: rect.height / 2 };

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (keyboardDrawingRef.current) {
          keyboardDrawingRef.current = false;
          finishStroke();
        } else {
          keyboardDrawingRef.current = true;
          keyboardPointRef.current = current;
          startStroke({ ...current, pressure: 0.5 }, true);
        }
        return;
      }

      const direction = {
        ArrowDown: { x: 0, y: 6 },
        ArrowLeft: { x: -6, y: 0 },
        ArrowRight: { x: 6, y: 0 },
        ArrowUp: { x: 0, y: -6 },
      }[event.key];
      if (!direction) return;

      event.preventDefault();
      const next = {
        x: Math.max(0, Math.min(rect.width, current.x + direction.x)),
        y: Math.max(0, Math.min(rect.height, current.y + direction.y)),
      };
      keyboardPointRef.current = next;
      if (keyboardDrawingRef.current) drawToPoint({ ...next, pressure: 0.5 });
    }

    function handleBlur() {
      if (!keyboardDrawingRef.current) return;
      keyboardDrawingRef.current = false;
      finishStroke();
    }

    return (
      <canvas
        {...canvasProps}
        ref={canvasRef}
        className={`shadix-signature-pad ${className}`.trim()}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPointerCancel={stopDrawing}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
      />
    );
  },
);

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
