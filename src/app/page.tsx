"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconImage,
  IconUpload,
  IconDownload,
  IconSelect,
  IconMove,
  IconAdjust,
  IconMagicWand,
  IconSparkles,
  IconUndo,
  IconRedo,
  IconZoomOut,
  IconZoomIn,
  IconFit,
  IconChevronDown,
  IconInfo,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconEraser,
  IconKey,
} from "./components/Icons";

const API_KEY_STORAGE = "imageforge_api_key";

type ToolId = "select" | "move" | "adjust" | "ai" | "aiPrompt" | "undo" | "redo";
type PendingAction = "background_remove" | "upscale" | "delete_last_layer" | null;

interface Layer {
  id: string;
  name: string;
  imageData: string;
  visible: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  rotationDeg?: number;
  panX?: number;
  panY?: number;
}

function getLayerBrightness(l: Layer) { return l.brightness ?? DEFAULT_BRIGHTNESS; }
function getLayerContrast(l: Layer) { return l.contrast ?? DEFAULT_CONTRAST; }
function getLayerSaturation(l: Layer) { return l.saturation ?? DEFAULT_SATURATION; }
function getLayerRotation(l: Layer) { return l.rotationDeg ?? 0; }
function getLayerPanX(l: Layer) { return l.panX ?? 0; }
function getLayerPanY(l: Layer) { return l.panY ?? 0; }

interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_BRIGHTNESS = 100;
const DEFAULT_CONTRAST = 100;
const DEFAULT_SATURATION = 100;

export default function ImageForgePage() {
  const [projectName, setProjectName] = useState("Untitled Project");
  const [selectedTool, setSelectedTool] = useState<ToolId>("select");
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction>(null);
  const [aiPromptOpen, setAiPromptOpen] = useState(false);
  const [aiPromptText, setAiPromptText] = useState("");
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [selectionDragging, setSelectionDragging] = useState<{ startX: number; startY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);
  const [panDragDelta, setPanDragDelta] = useState<{ x: number; y: number } | null>(null);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [textToImageOpen, setTextToImageOpen] = useState(false);
  const [textToImagePrompt, setTextToImagePrompt] = useState("");
  const [eraseMode, setEraseMode] = useState(false);
  const [eraseBrushSize, setEraseBrushSize] = useState(40);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasImgRef = useRef<HTMLImageElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const eraseMaskRef = useRef<HTMLCanvasElement | null>(null);
  const isEraseDrawingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(API_KEY_STORAGE);
      if (stored) setApiKey(stored);
    }
  }, []);

  const visibleLayers = layers.filter((l) => l.visible);
  const activeLayer = activeLayerId ? layers.find((l) => l.id === activeLayerId) ?? null : layers[0] ?? null;
  const currentImage = activeLayer?.imageData ?? null;
  const activeBrightness = activeLayer ? getLayerBrightness(activeLayer) : DEFAULT_BRIGHTNESS;
  const activeContrast = activeLayer ? getLayerContrast(activeLayer) : DEFAULT_CONTRAST;
  const activeSaturation = activeLayer ? getLayerSaturation(activeLayer) : DEFAULT_SATURATION;
  const activeRotation = activeLayer ? getLayerRotation(activeLayer) : 0;
  const activePanX = activeLayer ? getLayerPanX(activeLayer) : 0;
  const activePanY = activeLayer ? getLayerPanY(activeLayer) : 0;

  const updateActiveLayer = useCallback(
    (updater: (l: Layer) => Partial<Layer>) => {
      if (!activeLayerId) return;
      setLayers((prev) => {
        const next = prev.map((l) =>
          l.id === activeLayerId ? { ...l, ...updater(l) } : l
        );
        setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
        setHistoryIndex((i) => i + 1);
        return next;
      });
    },
    [activeLayerId, historyIndex]
  );

  const addLayer = useCallback((imageData: string, name?: string) => {
    const id = `layer-${Date.now()}`;
    const layer: Layer = {
      id,
      name: name ?? `Layer ${layers.length + 1}`,
      imageData,
      visible: true,
    };
    setLayers((prev) => {
      const next = [...prev, layer];
      setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
      setHistoryIndex((i) => i + 1);
      return next;
    });
    setActiveLayerId(id);
  }, [historyIndex]);

  const undo = useCallback(() => {
    const nextIndex = historyIndex - 1;
    if (nextIndex < 0) return;
    try {
      const restored = JSON.parse(history[nextIndex]) as Layer[];
      setLayers(restored);
      setHistoryIndex(nextIndex);
      setActiveLayerId(restored[restored.length - 1]?.id ?? restored[0]?.id ?? null);
    } catch {
      // ignore
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    const nextIndex = historyIndex + 1;
    if (nextIndex >= history.length) return;
    try {
      const restored = JSON.parse(history[nextIndex]) as Layer[];
      setLayers(restored);
      setHistoryIndex(nextIndex);
      setActiveLayerId(restored[restored.length - 1]?.id ?? restored[0]?.id ?? null);
    } catch {
      // ignore
    }
  }, [history, historyIndex]);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        addLayer(data, file.name.replace(/\.[^.]+$/, ""));
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [addLayer]
  );

  const runEdit = useCallback(
    async (
      action: "background_remove" | "upscale" | "custom" | "smart_select",
      customPrompt?: string,
      maskBase64?: string
    ) => {
      if (!currentImage) {
        setError("Upload an image first.");
        return;
      }
      if (!apiKey) {
        setError("Enter your API key first (key icon in header).");
        return;
      }
      setConfirmAction(null);
      setAiPromptOpen(false);
      setLoading(true);
      setError(null);
      try {
        const base64 = currentImage.split(",")[1];
        if (!base64) throw new Error("Invalid image data");
        const body: { imageBase64: string; action: string; prompt?: string; maskBase64?: string; apiKey?: string } = {
          imageBase64: base64,
          action,
          prompt: customPrompt || undefined,
          apiKey: apiKey || undefined,
        };
        if (maskBase64) body.maskBase64 = maskBase64;
        const res = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Edit failed");
        const newDataUrl = `data:image/png;base64,${data.imageBase64}`;
        const name =
          action === "background_remove"
            ? "Background removed"
            : action === "smart_select"
              ? "Smart selection"
              : action === "upscale"
                ? "Upscaled"
                : customPrompt
                  ? customPrompt.slice(0, 30) + (customPrompt.length > 30 ? "…" : "")
                  : "AI Edit";
        addLayer(newDataUrl, name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [currentImage, addLayer, apiKey]
  );

  const runTextToImage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      if (!apiKey) {
        setError("Enter your API key first (key icon in header).");
        return;
      }
      setTextToImageOpen(false);
      setTextToImagePrompt("");
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim(), apiKey }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        const newDataUrl = `data:image/png;base64,${data.imageBase64}`;
        addLayer(newDataUrl, prompt.slice(0, 25) + (prompt.length > 25 ? "…" : ""));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [addLayer, apiKey]
  );

  const runSmartSelect = useCallback(async () => {
    if (!currentImage || !selectionRect || selectionRect.w < 5 || selectionRect.h < 5) {
      setError("Draw a selection first (Select tool, then drag on the image).");
      return;
    }
    const img = canvasImgRef.current;
    const container = canvasContainerRef.current;
    if (!img || !img.complete || !container) {
      setError("Canvas not ready.");
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const imgLeft = imgRect.left - containerRect.left;
    const imgTop = imgRect.top - containerRect.top;
    const imgW = imgRect.width;
    const imgH = imgRect.height;
    const scaleX = nw / imgW;
    const scaleY = nh / imgH;
    let x = Math.floor((selectionRect.x - imgLeft) * scaleX);
    let y = Math.floor((selectionRect.y - imgTop) * scaleY);
    let w = Math.ceil(selectionRect.w * scaleX);
    let h = Math.ceil(selectionRect.h * scaleY);
    x = Math.max(0, Math.min(x, nw - 1));
    y = Math.max(0, Math.min(y, nh - 1));
    w = Math.max(1, Math.min(w, nw - x));
    h = Math.max(1, Math.min(h, nh - y));
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = nw;
    maskCanvas.height = nh;
    const mctx = maskCanvas.getContext("2d");
    if (!mctx) {
      setError("Could not create mask.");
      return;
    }
    mctx.fillStyle = "white";
    mctx.fillRect(0, 0, nw, nh);
    mctx.clearRect(x, y, w, h);
    const maskDataUrl = maskCanvas.toDataURL("image/png");
    const maskBase64 = maskDataUrl.split(",")[1];
    if (!maskBase64) {
      setError("Could not create mask.");
      return;
    }
    await runEdit("smart_select", undefined, maskBase64);
  }, [currentImage, selectionRect, runEdit]);

  const handleAiPromptGenerate = useCallback(() => {
    const text = aiPromptText.trim();
    if (!text) return;
    setAiPromptText("");
    runEdit("custom", text);
  }, [aiPromptText, runEdit]);

  const getLayerFilterStyle = useCallback((layer: Layer) => {
    const b = getLayerBrightness(layer);
    const c = getLayerContrast(layer);
    const s = getLayerSaturation(layer);
    if (b === DEFAULT_BRIGHTNESS && c === DEFAULT_CONTRAST && s === DEFAULT_SATURATION) return undefined;
    return { filter: `brightness(${b / 100}) contrast(${c / 100}) saturate(${s / 100})` };
  }, []);

  const getCanvasLocal = useCallback((clientX: number, clientY: number) => {
    const el = canvasContainerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  const getImageCoords = useCallback((clientX: number, clientY: number) => {
    const img = canvasImgRef.current;
    const container = canvasContainerRef.current;
    if (!img || !img.complete || !container || !activeLayer) return null;
    const cr = container.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const imgLeft = ir.left - cr.left;
    const imgTop = ir.top - cr.top;
    const localX = clientX - cr.left - imgLeft;
    const localY = clientY - cr.top - imgTop;
    if (localX < 0 || localY < 0 || localX > ir.width || localY > ir.height) return null;
    const scaleX = img.naturalWidth / ir.width;
    const scaleY = img.naturalHeight / ir.height;
    return { x: Math.floor(localX * scaleX), y: Math.floor(localY * scaleY) };
  }, [activeLayer]);

  const getOrCreateEraseMask = useCallback(() => {
    if (!activeLayer) return null;
    const img = new Image();
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (eraseMaskRef.current && eraseMaskRef.current.width === w && eraseMaskRef.current.height === h) {
          resolve(eraseMaskRef.current);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No 2d context"));
          return;
        }
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, w, h);
        eraseMaskRef.current = canvas;
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = activeLayer.imageData;
    });
  }, [activeLayer]);

  const applyEraseToLayer = useCallback(async () => {
    if (!activeLayerId || !activeLayer || !eraseMaskRef.current) return;
    const mask = eraseMaskRef.current;
    const img = new Image();
    img.src = activeLayer.imageData;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, 0, 0); // mask: white = keep, transparent = erase
    const newDataUrl = out.toDataURL("image/png");
    setLayers((prev) => {
      const next = prev.map((l) =>
        l.id === activeLayerId ? { ...l, imageData: newDataUrl } : l
      );
      setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
      setHistoryIndex((i) => i + 1);
      return next;
    });
    setEraseMode(false);
    mask.getContext("2d")?.clearRect(0, 0, mask.width, mask.height);
    const ctx2 = mask.getContext("2d");
    if (ctx2) {
      ctx2.fillStyle = "white";
      ctx2.fillRect(0, 0, mask.width, mask.height);
    }
  }, [activeLayerId, activeLayer, historyIndex]);

  useEffect(() => {
    const p = eraseMode && activeLayer ? getOrCreateEraseMask() : null;
    if (p) p.catch(() => {});
  }, [eraseMode, activeLayer?.id, getOrCreateEraseMask]);

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === "adjust" && eraseMode && activeLayer) {
        const coords = getImageCoords(e.clientX, e.clientY);
        if (coords && eraseMaskRef.current) {
          isEraseDrawingRef.current = true;
          const ctx = eraseMaskRef.current.getContext("2d");
          if (ctx) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,1)";
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, eraseBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
        return;
      }
      if (!currentImage) return;
      const { x, y } = getCanvasLocal(e.clientX, e.clientY);
      if (selectedTool === "select") {
        setSelectionRect(null);
        setSelectionDragging({ startX: x, startY: y });
      } else if (selectedTool === "move") {
        setIsPanning(true);
        setPanStart({ clientX: e.clientX, clientY: e.clientY, panX: activePanX, panY: activePanY });
        setPanDragDelta({ x: 0, y: 0 });
      }
    },
    [currentImage, selectedTool, getCanvasLocal, activePanX, activePanY, eraseMode, activeLayer, getImageCoords, eraseBrushSize]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (selectedTool === "adjust" && eraseMode && isEraseDrawingRef.current && eraseMaskRef.current) {
        const coords = getImageCoords(e.clientX, e.clientY);
        if (coords) {
          const ctx = eraseMaskRef.current.getContext("2d");
          if (ctx) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,1)";
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, eraseBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = "source-over";
          }
        }
        return;
      }
      if (!currentImage) return;
      const { x, y } = getCanvasLocal(e.clientX, e.clientY);
      if (selectionDragging) {
        const { startX, startY } = selectionDragging;
        setSelectionRect({
          x: Math.min(startX, x),
          y: Math.min(startY, y),
          w: Math.abs(x - startX),
          h: Math.abs(y - startY),
        });
      } else if (isPanning && panStart) {
        setPanDragDelta({
          x: e.clientX - panStart.clientX,
          y: e.clientY - panStart.clientY,
        });
      }
    },
    [currentImage, selectionDragging, isPanning, panStart, getCanvasLocal, selectedTool, eraseMode, getImageCoords, eraseBrushSize]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (selectedTool === "adjust" && eraseMode) {
      isEraseDrawingRef.current = false;
      return;
    }
    if (selectionDragging) setSelectionDragging(null);
    if (isPanning && panDragDelta !== null && activeLayerId) {
      const layer = layers.find((l) => l.id === activeLayerId);
      if (layer) {
        setLayers((prev) => {
          const next = prev.map((l) =>
            l.id === activeLayerId
              ? {
                  ...l,
                  panX: (l.panX ?? 0) + panDragDelta!.x,
                  panY: (l.panY ?? 0) + panDragDelta!.y,
                }
              : l
          );
          setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
          setHistoryIndex((i) => i + 1);
          return next;
        });
      }
      setPanDragDelta(null);
      setIsPanning(false);
      setPanStart(null);
    } else if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      setPanDragDelta(null);
    }
  }, [selectionDragging, isPanning, panDragDelta, activeLayerId, layers, historyIndex, selectedTool, eraseMode]);

  const handleCanvasMouseLeave = useCallback(() => {
    handleCanvasMouseUp();
  }, [handleCanvasMouseUp]);

  const clearSelection = useCallback(() => setSelectionRect(null), []);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers((prev) => {
      const next = prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l));
      setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
      setHistoryIndex((i) => i + 1);
      return next;
    });
  }, [historyIndex]);

  const fullReset = useCallback(() => {
    setLayers([]);
    setActiveLayerId(null);
    setHistory([]);
    setHistoryIndex(-1);
    setProjectName("Untitled Project");
    setSelectionRect(null);
    setConfirmAction(null);
    setEraseMode(false);
    setError(null);
    setFileMenuOpen(false);
  }, []);

  const deleteLayer = useCallback(
    (layerId: string) => {
      if (layers.length > 1) {
        setLayers((prev) => {
          const next = prev.filter((l) => l.id !== layerId);
          setHistory((h) => [...h.slice(0, historyIndex + 1), JSON.stringify(next)]);
          setHistoryIndex((i) => i + 1);
          return next;
        });
        if (activeLayerId === layerId) {
          const remaining = layers.filter((l) => l.id !== layerId);
          setActiveLayerId(remaining[0]?.id ?? null);
        }
      } else {
        setConfirmAction("delete_last_layer");
      }
    },
    [layers, activeLayerId, historyIndex]
  );

  const confirmDeleteLastLayer = useCallback(() => {
    setConfirmAction(null);
    fullReset();
  }, [fullReset]);

  const handleConfirmRun = useCallback(() => {
    if (confirmAction === "delete_last_layer") confirmDeleteLastLayer();
    else if (confirmAction) runEdit(confirmAction);
  }, [confirmAction, runEdit, confirmDeleteLastLayer]);

  const saveApiKey = useCallback(() => {
    const key = apiKeyInput.trim();
    if (key) {
      setApiKey(key);
      if (typeof window !== "undefined") sessionStorage.setItem(API_KEY_STORAGE, key);
    }
    setApiKeyModalOpen(false);
    setApiKeyInput("");
  }, [apiKeyInput]);

  const rotateLeft = useCallback(
    () => updateActiveLayer((l) => ({ rotationDeg: (getLayerRotation(l) - 90 + 360) % 360 })),
    [updateActiveLayer]
  );
  const rotateRight = useCallback(
    () => updateActiveLayer((l) => ({ rotationDeg: (getLayerRotation(l) + 90) % 360 })),
    [updateActiveLayer]
  );
  const rotate180 = useCallback(
    () => updateActiveLayer((l) => ({ rotationDeg: (getLayerRotation(l) + 180) % 360 })),
    [updateActiveLayer]
  );

  const exportImage = useCallback(() => {
    if (visibleLayers.length === 0) return;

    const layerHasAdjust = (l: Layer) =>
      getLayerBrightness(l) !== DEFAULT_BRIGHTNESS ||
      getLayerContrast(l) !== DEFAULT_CONTRAST ||
      getLayerSaturation(l) !== DEFAULT_SATURATION ||
      getLayerRotation(l) !== 0 ||
      getLayerPanX(l) !== 0 ||
      getLayerPanY(l) !== 0;

    const drawLayerToCtx = (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      layer: Layer,
      offsetX: number,
      offsetY: number
    ) => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rot = getLayerRotation(layer);
      const px = getLayerPanX(layer);
      const py = getLayerPanY(layer);
      const b = getLayerBrightness(layer);
      const c = getLayerContrast(layer);
      const s = getLayerSaturation(layer);
      const hasFilter = b !== DEFAULT_BRIGHTNESS || c !== DEFAULT_CONTRAST || s !== DEFAULT_SATURATION;
      ctx.save();
      ctx.translate(offsetX + px + w / 2, offsetY + py + h / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
      if (hasFilter) ctx.filter = `brightness(${b / 100}) contrast(${c / 100}) saturate(${s / 100})`;
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    };

    const downloadBlob = (canvas: HTMLCanvasElement) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${projectName.replace(/\s/g, "-")}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };

    if (visibleLayers.length === 1) {
      const layer = visibleLayers[0];
      if (!layerHasAdjust(layer)) {
        const a = document.createElement("a");
        a.href = layer.imageData;
        a.download = `${projectName.replace(/\s/g, "-")}.png`;
        a.click();
        return;
      }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const rot = getLayerRotation(layer);
        const is90or270 = rot === 90 || rot === 270;
        const outW = is90or270 ? h : w;
        const outH = is90or270 ? w : h;
        const px = getLayerPanX(layer);
        const py = getLayerPanY(layer);
        const pad =
          Math.ceil(
            Math.max(
              0,
              outW / 2 - px - w / 2,
              px + w / 2 - outW / 2,
              outH / 2 - py - h / 2,
              py + h / 2 - outH / 2
            )
          ) + 2;
        const canvas = document.createElement("canvas");
        canvas.width = outW + pad * 2;
        canvas.height = outH + pad * 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        drawLayerToCtx(ctx, img, layer, pad, pad);
        const srcX = pad + px + w / 2 - outW / 2;
        const srcY = pad + py + h / 2 - outH / 2;
        const crop = document.createElement("canvas");
        crop.width = outW;
        crop.height = outH;
        const cctx = crop.getContext("2d");
        if (!cctx) return;
        cctx.drawImage(canvas, srcX, srcY, outW, outH, 0, 0, outW, outH);
        downloadBlob(crop);
      };
      img.onerror = () => {
        const a = document.createElement("a");
        a.href = layer.imageData;
        a.download = `${projectName.replace(/\s/g, "-")}.png`;
        a.click();
      };
      img.src = layer.imageData;
      return;
    }

    const loadImages = (): Promise<HTMLImageElement[]> =>
      Promise.all(
        visibleLayers.map(
          (layer) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const im = new Image();
              im.onload = () => resolve(im);
              im.onerror = reject;
              im.src = layer.imageData;
            })
        )
      );
    loadImages()
      .then((imgs) => {
        let minX = 0,
          minY = 0,
          maxX = 0,
          maxY = 0;
        visibleLayers.forEach((layer, i) => {
          const im = imgs[i];
          const w = im.naturalWidth;
          const h = im.naturalHeight;
          const rot = (getLayerRotation(layer) * Math.PI) / 180;
          const px = getLayerPanX(layer);
          const py = getLayerPanY(layer);
          const cx = px + w / 2;
          const cy = py + h / 2;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const corners = [
            [cx + (-w / 2) * cos - (-h / 2) * sin, cy + (-w / 2) * sin + (-h / 2) * cos],
            [cx + (w / 2) * cos - (-h / 2) * sin, cy + (w / 2) * sin + (-h / 2) * cos],
            [cx + (w / 2) * cos - (h / 2) * sin, cy + (w / 2) * sin + (h / 2) * cos],
            [cx + (-w / 2) * cos - (h / 2) * sin, cy + (-w / 2) * sin + (h / 2) * cos],
          ];
          corners.forEach(([x, y]) => {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          });
        });
        const outW = Math.ceil(maxX - minX);
        const outH = Math.ceil(maxY - minY);
        const composite = document.createElement("canvas");
        composite.width = outW;
        composite.height = outH;
        const ctx = composite.getContext("2d");
        if (!ctx) return;
        visibleLayers.forEach((layer, i) => {
          drawLayerToCtx(ctx, imgs[i], layer, -minX, -minY);
        });
        downloadBlob(composite);
      })
      .catch(() => {
        const a = document.createElement("a");
        a.href = visibleLayers[0].imageData;
        a.download = `${projectName.replace(/\s/g, "-")}.png`;
        a.click();
      });
  }, [visibleLayers, projectName]);

  const resetAdjust = useCallback(() => {
    updateActiveLayer(() => ({
      brightness: DEFAULT_BRIGHTNESS,
      contrast: DEFAULT_CONTRAST,
      saturation: DEFAULT_SATURATION,
      rotationDeg: 0,
      panX: 0,
      panY: 0,
    }));
  }, [updateActiveLayer]);

  const tools: { id: ToolId; label: string }[] = [
    { id: "select", label: "Select" },
    { id: "move", label: "Move" },
    { id: "adjust", label: "Adjust" },
    { id: "ai", label: "Remove BG" },
    { id: "aiPrompt", label: "AI Edit" },
  ];

  const saveProjectName = useCallback(() => {
    setIsEditingProjectName(false);
    setFileMenuOpen(false);
  }, []);

  const projectNameBeforeEditRef = useRef(projectName);
  const handleProjectNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
        saveProjectName();
      }
      if (e.key === "Escape") {
        setProjectName(projectNameBeforeEditRef.current);
        setIsEditingProjectName(false);
        setFileMenuOpen(false);
        e.currentTarget.blur();
      }
    },
    [saveProjectName]
  );

  const confirmMessage =
    confirmAction === "background_remove"
      ? "Remove the background from this image using AI?"
      : confirmAction === "upscale"
        ? "Upscale and enhance this image using AI?"
        : confirmAction === "delete_last_layer"
          ? "This is the only layer. Delete it? The project will reset (all layers and history cleared)."
          : "";

  return (
    <div className="flex h-screen flex-col bg-[var(--background)]">
      {/* Confirm dialog */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmAction(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-base font-semibold text-[var(--foreground)]">
              Are you sure?
            </h2>
            <p className="mt-2 text-sm text-zinc-400">{confirmMessage}</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRun}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Edit (prompt) dialog */}
      {aiPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setAiPromptOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-prompt-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-prompt-title" className="text-base font-semibold text-[var(--foreground)]">
              Edit image with AI
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Describe how to change your image. Example: &ldquo;Put this car driving on the beach&rdquo;
            </p>
            <textarea
              value={aiPromptText}
              onChange={(e) => setAiPromptText(e.target.value)}
              placeholder="e.g. Put this car driving on the beach"
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              rows={3}
              autoFocus
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAiPromptOpen(false)}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiPromptGenerate}
                disabled={!aiPromptText.trim() || loading}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API key modal */}
      {apiKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setApiKeyModalOpen(false); setApiKeyInput(""); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="api-key-title" className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
              <IconKey sizeClass="w-5 h-5" />
              OpenAI API key
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Your key is stored only in this browser session (sessionStorage). It is never saved to the server. Enter it each time you open the site if you want to keep it private.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              autoFocus
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setApiKeyModalOpen(false); setApiKeyInput(""); }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveApiKey}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                Save for this session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text to image modal */}
      {textToImageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => { setTextToImageOpen(false); setTextToImagePrompt(""); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="text-to-image-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="text-to-image-title" className="text-base font-semibold text-[var(--foreground)]">
              Generate image from text
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              Describe the image you want. Example: &ldquo;A dog dancing with a cat on a sunny beach&rdquo;
            </p>
            <textarea
              value={textToImagePrompt}
              onChange={(e) => setTextToImagePrompt(e.target.value)}
              placeholder="e.g. A dog dancing with a cat on a sunny beach"
              className="mt-4 w-full rounded-xl border border-[var(--border)] bg-white/5 px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
              rows={3}
              autoFocus
            />
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setTextToImageOpen(false); setTextToImagePrompt(""); }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runTextToImage(textToImagePrompt)}
                disabled={!textToImagePrompt.trim() || loading}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--toolbar)] px-5 backdrop-blur-xl">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[10px] font-semibold text-white leading-tight">
              Edit
            </div>
            <span className="font-semibold text-[var(--foreground)] text-[15px]">Image Edit App</span>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFileMenuOpen((o) => !o)}
              className="rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-zinc-200 flex items-center gap-1"
            >
              File
              <IconChevronDown sizeClass="w-3.5 h-3.5" />
            </button>
            {fileMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFileMenuOpen(false)} aria-hidden />
                <div className="absolute left-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      projectNameBeforeEditRef.current = projectName;
                      setIsEditingProjectName(true);
                      setFileMenuOpen(false);
                      setTimeout(() => projectNameInputRef.current?.focus(), 0);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Rename project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      fullReset();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/10"
                  >
                    Reset project
                  </button>
                </div>
              </>
            )}
          </div>
          {isEditingProjectName ? (
            <input
              ref={projectNameInputRef}
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={saveProjectName}
              onKeyDown={handleProjectNameKeyDown}
              className="max-w-[200px] rounded-lg border border-[var(--border)] bg-white/5 px-2 py-1 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              placeholder="Project name"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                projectNameBeforeEditRef.current = projectName;
                setIsEditingProjectName(true);
                setTimeout(() => projectNameInputRef.current?.focus(), 0);
              }}
              className="max-w-[180px] truncate text-left text-sm text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg px-2 py-1"
              title={projectName}
            >
              {projectName}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setApiKeyInput(apiKey);
              setApiKeyModalOpen(true);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${apiKey ? "text-emerald-400 hover:bg-white/10" : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"}`}
            title={apiKey ? "Change API key" : "Enter API key"}
          >
            <IconKey sizeClass="w-4 h-4" />
            <span>{apiKey ? "API key set" : "API key"}</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-white/15"
          >
            <IconUpload />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={exportImage}
            disabled={visibleLayers.length === 0}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-white/15 disabled:opacity-40 disabled:pointer-events-none"
          >
            <IconDownload />
            <span>Export</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left toolbar */}
        <aside className="flex w-[72px] shrink-0 flex-col items-center gap-0.5 border-r border-[var(--border)] bg-[var(--toolbar)] py-4 backdrop-blur-xl">
          {tools.map((t) => {
            const Icon =
              t.id === "select" ? IconSelect :
              t.id === "move" ? IconMove :
              t.id === "adjust" ? IconAdjust :
              t.id === "ai" ? IconMagicWand :
              IconSparkles;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === "ai") setConfirmAction("background_remove");
                  else if (t.id === "aiPrompt") setAiPromptOpen(true);
                  else {
                    if (t.id !== "select") setSelectionRect(null);
                    setSelectedTool(t.id);
                  }
                }}
                disabled={(t.id === "ai" || t.id === "aiPrompt") && (loading || !currentImage)}
                title={t.label}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl w-12 h-12 ${
                  selectedTool === t.id || (t.id === "ai" && loading) || (t.id === "aiPrompt" && loading)
                    ? "bg-[var(--accent)] text-white"
                    : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                } disabled:opacity-50 disabled:pointer-events-none`}
              >
                <Icon sizeClass="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight max-w-full truncate">{t.label}</span>
              </button>
            );
          })}
          <div className="my-2 h-px w-8 bg-[var(--border)]" />
          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            className="flex flex-col items-center justify-center gap-1 rounded-xl w-12 h-12 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none"
            title="Undo"
          >
            <IconUndo sizeClass="w-5 h-5" />
            <span className="text-[10px] font-medium">Undo</span>
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1 || history.length === 0}
            className="flex flex-col items-center justify-center gap-1 rounded-xl w-12 h-12 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 disabled:opacity-40 disabled:pointer-events-none"
            title="Redo"
          >
            <IconRedo sizeClass="w-5 h-5" />
            <span className="text-[10px] font-medium">Redo</span>
          </button>
        </aside>

        {/* Canvas */}
        <main className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-[var(--canvas-bg)] p-6">
          <div
            ref={canvasContainerRef}
            className="checkerboard relative flex min-h-[420px] min-w-[420px] max-h-full max-w-full items-center justify-center rounded-2xl overflow-hidden shadow-2xl select-none"
            style={{ width: "min(88vh, 88vw)", height: "min(88vh, 88vw)" }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
          >
            {visibleLayers.length > 0 ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  {visibleLayers.map((layer, idx) => {
                    const isActive = activeLayerId === layer.id;
                    const px = getLayerPanX(layer) + (isActive && panDragDelta ? panDragDelta.x : 0);
                    const py = getLayerPanY(layer) + (isActive && panDragDelta ? panDragDelta.y : 0);
                    const rot = getLayerRotation(layer);
                    return (
                      <img
                        key={layer.id}
                        ref={
                          isActive || (idx === visibleLayers.length - 1 && !visibleLayers.some((l) => l.id === activeLayerId))
                            ? canvasImgRef
                            : undefined
                        }
                        src={layer.imageData}
                        alt=""
                        className="absolute max-h-full max-w-full object-contain pointer-events-none"
                        style={{
                          transform: `translate(${px}px, ${py}px) rotate(${rot}deg) scale(${zoom / 100})`,
                          ...getLayerFilterStyle(layer),
                        }}
                        draggable={false}
                      />
                    );
                  })}
                </div>
                {selectionRect && selectionRect.w > 0 && selectionRect.h > 0 && (
                  <div
                    className="absolute border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10 pointer-events-none"
                    style={{
                      left: selectionRect.x,
                      top: selectionRect.y,
                      width: selectionRect.w,
                      height: selectionRect.h,
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-zinc-500">
                <IconImage sizeClass="w-16 h-16 opacity-60" />
                <p className="text-[15px] font-medium">No image loaded</p>
                <p className="text-sm text-zinc-500">Upload an image to start editing</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] flex items-center gap-2"
                >
                  <IconUpload sizeClass="w-4 h-4" />
                  Upload image
                </button>
              </div>
            )}
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
          {loading && (
            <p className="mt-3 text-sm text-[var(--accent)]">Applying AI…</p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="rounded-xl p-2.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              aria-label="Zoom out"
            >
              <IconZoomOut sizeClass="w-5 h-5" />
            </button>
            <input
              type="range"
              min={25}
              max={200}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-28 h-2 rounded-full accent-[var(--accent)]"
            />
            <span className="w-12 text-right text-sm text-zinc-500">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="rounded-xl p-2.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              aria-label="Zoom in"
            >
              <IconZoomIn sizeClass="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="rounded-xl p-2.5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
              title="Fit to 100%"
            >
              <IconFit sizeClass="w-5 h-5" />
            </button>
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--sidebar)] backdrop-blur-xl overflow-y-auto">
          {/* Context panel: Select or Adjust */}
          <div className="border-b border-[var(--border)] px-4 py-3 shrink-0">
            {selectedTool === "adjust" ? (
              <>
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300">
                  <span>Adjust</span>
                  <IconChevronDown sizeClass="w-4 h-4 text-zinc-500" />
                </h2>
                <p className="mt-1.5 text-xs text-zinc-500">Per-layer. Export bakes them in.</p>
                {!activeLayerId && (
                  <p className="mt-2 text-xs text-zinc-500">Select a layer to adjust.</p>
                )}
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                      <span>Brightness</span>
                      <span>{activeBrightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={activeBrightness}
                      onChange={(e) => updateActiveLayer(() => ({ brightness: Number(e.target.value) }))}
                      disabled={!activeLayerId}
                      className="w-full h-2 rounded-full accent-[var(--accent)] disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                      <span>Contrast</span>
                      <span>{activeContrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={activeContrast}
                      onChange={(e) => updateActiveLayer(() => ({ contrast: Number(e.target.value) }))}
                      disabled={!activeLayerId}
                      className="w-full h-2 rounded-full accent-[var(--accent)] disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                      <span>Saturation</span>
                      <span>{activeSaturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={activeSaturation}
                      onChange={(e) => updateActiveLayer(() => ({ saturation: Number(e.target.value) }))}
                      disabled={!activeLayerId}
                      className="w-full h-2 rounded-full accent-[var(--accent)] disabled:opacity-50"
                    />
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-[11px] text-zinc-500 mb-2">Rotation</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={rotateLeft}
                        disabled={!activeLayerId}
                        className="flex-1 min-w-0 rounded-xl border border-[var(--border)] py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        90° left
                      </button>
                      <button
                        type="button"
                        onClick={rotateRight}
                        disabled={!activeLayerId}
                        className="flex-1 min-w-0 rounded-xl border border-[var(--border)] py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        90° right
                      </button>
                      <button
                        type="button"
                        onClick={rotate180}
                        disabled={!activeLayerId}
                        className="flex-1 min-w-0 rounded-xl border border-[var(--border)] py-2 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        180° (upside down)
                      </button>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[var(--border)]">
                    <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1.5">
                      <IconEraser sizeClass="w-3.5 h-3.5" />
                      Fade / Erase
                    </p>
                    <p className="text-[11px] text-zinc-500 mb-2">Brush over the image to erase (make transparent). Apply when done.</p>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-[11px] text-zinc-500 shrink-0">Brush size</label>
                      <input
                        type="range"
                        min={10}
                        max={120}
                        value={eraseBrushSize}
                        onChange={(e) => setEraseBrushSize(Number(e.target.value))}
                        disabled={!activeLayerId}
                        className="flex-1 h-2 rounded-full accent-[var(--accent)] disabled:opacity-50"
                      />
                      <span className="text-[11px] text-zinc-500 w-6">{eraseBrushSize}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEraseMode((m) => !m)}
                        disabled={!activeLayerId}
                        className={`flex-1 rounded-xl border py-2 text-[12px] font-medium disabled:opacity-50 ${eraseMode ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]" : "border-[var(--border)] text-zinc-400 hover:bg-white/5"}`}
                      >
                        {eraseMode ? "Erase on" : "Erase off"}
                      </button>
                      <button
                        type="button"
                        onClick={applyEraseToLayer}
                        disabled={!activeLayerId || !eraseMode}
                        className="flex-1 rounded-xl bg-[var(--accent)] py-2 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:pointer-events-none"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetAdjust}
                    disabled={!activeLayerId}
                    className="w-full rounded-xl border border-[var(--border)] py-2 text-[12px] font-medium text-zinc-400 hover:bg-white/5 disabled:opacity-50"
                  >
                    Reset all
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300">
                  <span>{selectedTool === "move" ? "Move" : "Select"} Tool</span>
                  <IconChevronDown sizeClass="w-4 h-4 text-zinc-500" />
                </h2>
                <p className="mt-2.5 flex items-start gap-2 text-xs text-zinc-500 leading-relaxed">
                  <span className="mt-0.5 shrink-0"><IconInfo sizeClass="w-4 h-4" /></span>
                  {selectedTool === "select"
                    ? "Click and drag on the canvas to draw a selection. Use Smart Select to refine it with AI (like Photoshop)."
                    : "Click and drag on the canvas to pan the image."}
                </p>
                {selectedTool === "select" && selectionRect && (
                  <div className="mt-2 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={runSmartSelect}
                      disabled={loading || selectionRect.w < 5 || selectionRect.h < 5}
                      className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                    >
                      Smart Select (refine with AI)
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="w-full rounded-xl border border-[var(--border)] py-2 text-[12px] font-medium text-zinc-400 hover:bg-white/5"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-1 flex-col px-4 py-3 min-h-0">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-300 shrink-0">
              <span>Layers</span>
              <IconChevronDown sizeClass="w-4 h-4 text-zinc-500" />
            </h2>
            {layers.length === 0 ? (
              <div className="mt-5 flex flex-col items-center gap-3 text-center text-zinc-500">
                <IconImage sizeClass="w-12 h-12 opacity-60" />
                <p className="text-xs">No layers yet</p>
                <p className="text-xs">Upload an image to start</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-1 overflow-y-auto">
                {layers.map((layer) => (
                  <li
                    key={layer.id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors shrink-0 ${
                      activeLayerId === layer.id ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => setActiveLayerId(layer.id)}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLayerVisibility(layer.id);
                      }}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
                      title={layer.visible ? "Hide layer" : "Show layer"}
                    >
                      {layer.visible ? <IconEye sizeClass="w-4 h-4" /> : <IconEyeOff sizeClass="w-4 h-4" />}
                    </button>
                    <img
                      src={layer.imageData}
                      alt=""
                      className={`h-10 w-10 shrink-0 rounded-lg object-cover bg-zinc-700 ${!layer.visible ? "opacity-50" : ""}`}
                    />
                    <span className="min-w-0 truncate text-[13px] text-zinc-300 flex-1">{layer.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                      className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/10"
                      title="Delete layer"
                    >
                      <IconTrash sizeClass="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto border-t border-[var(--border)] pt-4 mt-4 shrink-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-3">AI tools</p>
              <button
                type="button"
                onClick={() => setTextToImageOpen(true)}
                disabled={loading || !apiKey}
                className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:pointer-events-none"
              >
                Generate from text
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("background_remove")}
                disabled={!currentImage || loading || !apiKey}
                className="mt-2 w-full rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none"
              >
                Remove background
              </button>
              <button
                type="button"
                onClick={() => setAiPromptOpen(true)}
                disabled={!currentImage || loading || !apiKey}
                className="mt-2 w-full rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none"
              >
                Edit with prompt
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction("upscale")}
                disabled={!currentImage || loading || !apiKey}
                className="mt-2 w-full rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none"
              >
                Upscale / enhance
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
