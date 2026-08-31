import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CanvasHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type SignatureValue = string | null;
type Point = { x: number; y: number };

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
    const keyboardPointRef = useRef<Point | null>(null);
    const pointsRef = useRef<Point[]>([]);
    const restoreVersionRef = useRef(0);

    function configureContext(context: CanvasRenderingContext2D, ratio: number) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = lineWidth;
      context.strokeStyle = penColor;
      context.fillStyle = penColor;
      context.globalCompositeOperation = "source-over";
      contextRef.current = context;
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
      restoreVersionRef.current += 1;
      clearCanvas();
      drawingRef.current = false;
      emptyRef.current = true;
      keyboardDrawingRef.current = false;
      keyboardPointRef.current = null;
      pointsRef.current = [];
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
        const restoreVersion = ++restoreVersionRef.current;
        const previousImage = toDataURL();
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));
        configureContext(canvas.getContext("2d")!, ratio);

        if (previousImage) {
          const image = new Image();
          image.onload = () => {
            if (restoreVersion !== restoreVersionRef.current || emptyRef.current) return;
            contextRef.current?.drawImage(image, 0, 0, rect.width, rect.height);
          };
          image.src = previousImage;
        }
      };

      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }, [lineWidth, penColor]);

    function pointerPosition(event: ReactPointerEvent<HTMLCanvasElement>): Point {
      const rect = event.currentTarget.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function startStroke(point: Point) {
      restoreVersionRef.current += 1;
      const context = contextRef.current;
      drawingRef.current = true;
      emptyRef.current = false;
      pointsRef.current = [point];
      context?.beginPath();
      context?.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
      context?.fill();
    }

    function drawToPoint(point: Point) {
      const context = contextRef.current;
      if (!context) return;

      const updated = [...pointsRef.current, point];
      if (updated.length === 2) {
        context.beginPath();
        context.moveTo(updated[0].x, updated[0].y);
        context.lineTo(updated[1].x, updated[1].y);
        context.stroke();
        pointsRef.current = updated;
        return;
      }

      const previous = updated.at(-3)!;
      const current = updated.at(-2)!;
      const next = updated.at(-1)!;
      context.beginPath();
      context.moveTo((previous.x + current.x) / 2, (previous.y + current.y) / 2);
      context.quadraticCurveTo(
        current.x,
        current.y,
        (current.x + next.x) / 2,
        (current.y + next.y) / 2,
      );
      context.stroke();
      pointsRef.current = updated.slice(-3);
    }

    function finishStroke() {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      pointsRef.current = [];
      onChange?.(toDataURL());
    }

    function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
      event.preventDefault();
      keyboardDrawingRef.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      startStroke(pointerPosition(event));
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
          startStroke(current);
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
      if (keyboardDrawingRef.current) drawToPoint(next);
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
