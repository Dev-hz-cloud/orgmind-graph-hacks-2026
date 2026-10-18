import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderGit2,
  ArrowLeft,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
  Boxes,
  Layers,
  Eye,
  EyeOff,
  Share2,
  Sparkles,
  GitBranch,
  MousePointer2,
  ChevronRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { EvidenceItem, GraphEdge, GraphNode } from '../types';
import {
  CUBE_DIMENSIONS,
  CubeDimension,
  DIMENSION_ICONS,
  DIMENSION_RAMP,
  FocusRequest,
  dimensionOf,
} from '../shared/dimensions';

/* ==========================================================================
   Nothing OS Cube Knowledge Explorer
   --------------------------------------------------------------------------
   The six real entity categories behave as six navigable spatial dimensions:
   one per face of a CSS-3D cube. Nothing here is mock data — every tile is a
   real graph node, every link is a real graph edge, and node IDs / relationship
   names are passed through untouched to the rest of the app.

   The projection maths below intentionally mirrors the CSS transform chain
   (`translate3d ⇒ rotateX ⇒ rotateY ⇒ scale`) so the DOM faces and the
   projected relationship overlay always agree, pixel for pixel.
   ========================================================================== */

const DEG = Math.PI / 180;
const TILE_COLS = 3;
const MAX_TILES = TILE_COLS * 4;

/** Default three-quarter view: three dimensions readable at once, like a cube. */
const DEFAULT_VIEW = { rx: -16, ry: -26 };

/** Minimal shape shared by React keyboard events and native window events. */
interface ExplorerKeyEvent {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
}

type Vec3 = { x: number; y: number; z: number };

interface FaceDef {
  dim: CubeDimension;
  /** CSS transform that places this face on the cube */
  transform: string;
  /** Outward normal, face local basis vectors and the cube rotation that looks at it */
  normal: Vec3;
  right: Vec3;
  down: Vec3;
  view: { rx: number; ry: number };
}

/** Face geometry derived directly from the CSS transforms (S = cube edge length). */
function buildFaces(S: number): FaceDef[] {
  const h = S / 2;
  return [
    {
      dim: 'Project',
      transform: `translateZ(${h}px)`,
      normal: { x: 0, y: 0, z: 1 },
      right: { x: 1, y: 0, z: 0 },
      down: { x: 0, y: 1, z: 0 },
      view: { rx: 0, ry: 0 },
    },
    {
      dim: 'Task',
      transform: `rotateY(90deg) translateZ(${h}px)`,
      normal: { x: 1, y: 0, z: 0 },
      right: { x: 0, y: 0, z: -1 },
      down: { x: 0, y: 1, z: 0 },
      view: { rx: 0, ry: -90 },
    },
    {
      dim: 'Person',
      transform: `rotateY(-90deg) translateZ(${h}px)`,
      normal: { x: -1, y: 0, z: 0 },
      right: { x: 0, y: 0, z: 1 },
      down: { x: 0, y: 1, z: 0 },
      view: { rx: 0, ry: 90 },
    },
    {
      dim: 'Decision',
      transform: `rotateY(180deg) translateZ(${h}px)`,
      normal: { x: 0, y: 0, z: -1 },
      right: { x: -1, y: 0, z: 0 },
      down: { x: 0, y: 1, z: 0 },
      view: { rx: 0, ry: 180 },
    },
    {
      dim: 'Team',
      transform: `rotateX(90deg) translateZ(${h}px)`,
      normal: { x: 0, y: -1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      down: { x: 0, y: 0, z: 1 },
      view: { rx: -90, ry: 0 },
    },
    {
      dim: 'Document',
      transform: `rotateX(-90deg) translateZ(${h}px)`,
      normal: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      down: { x: 0, y: 0, z: -1 },
      view: { rx: 90, ry: 0 },
    },
  ];
}

function clampNum(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function normalizeAngle(a: number) {
  return (((a + 180) % 360) + 360) % 360 - 180;
}

/** CSS `rotateX(rx) rotateY(ry)` applied to a cube-local point. */
function rotatePoint(p: Vec3, rx: number, ry: number): Vec3 {
  const cyr = Math.cos(ry * DEG);
  const syr = Math.sin(ry * DEG);
  const cxr = Math.cos(rx * DEG);
  const sxr = Math.sin(rx * DEG);

  const x1 = p.x * cyr + p.z * syr;
  const z1 = -p.x * syr + p.z * cyr;

  return {
    x: x1,
    y: p.y * cxr - z1 * sxr,
    z: p.y * sxr + z1 * cxr,
  };
}

interface TileSlot {
  dx: number;
  dy: number;
  w: number;
  h: number;
}

/**
 * Deterministic tile grid for a face. Positions are relative to the face centre
 * so the same numbers can be projected into screen space for the link overlay.
 */
function layoutTiles(count: number, S: number) {
  const pad = Math.round(S * 0.035);
  const header = Math.round(S * 0.082);
  const gap = Math.round(S * 0.014);
  const cols = TILE_COLS;
  const tileW = Math.floor((S - pad * 2 - gap * (cols - 1)) / cols);
  const areaH = S - header - pad;
  const rows = Math.max(1, Math.ceil(count / cols));
  const tileH = Math.min(
    Math.round(S * 0.2),
    Math.floor((areaH - gap * (rows - 1)) / rows)
  );
  const gridH = rows * tileH + gap * (rows - 1);
  const top = -S / 2 + header + Math.max(0, Math.floor((areaH - gridH) / 2));

  const slots: TileSlot[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, count - row * cols);
    const rowW = inRow * tileW + (inRow - 1) * gap;
    const startX = -rowW / 2 + tileW / 2;
    slots.push({
      dx: Math.round(startX + col * (tileW + gap)),
      dy: Math.round(top + row * (tileH + gap) + tileH / 2),
      w: tileW,
      h: tileH,
    });
  }

  return { slots, tileW, tileH, rows, overflow: Math.max(0, count - MAX_TILES) };
}

/**
 * Half-extent of the cube's projected silhouette at the default view, per unit
 * edge length. Fitting against this constant (instead of the full 45°/45°
 * diagonal) keeps the default view big and its text legible, without the cube
 * breathing in size while it is rotated.
 */
const DEFAULT_VIEW_EXTENT = (() => {
  let mx = 0;
  let my = 0;
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        const r = rotatePoint({ x, y, z }, DEFAULT_VIEW.rx, DEFAULT_VIEW.ry);
        mx = Math.max(mx, Math.abs(r.x));
        my = Math.max(my, Math.abs(r.y));
      }
    }
  }
  return { x: mx, y: my };
})();

/** Stage space reserved for the floating toolbar and the legend/hint overlays. */
const CHROME_TOP = 58;
const CHROME_BOTTOM = 58;
const STAGE_PADDING = 16;

/**
 * Fits the cube to the fully unobstructed part of the stage, and returns the
 * centre that geometry must be positioned and projected against.
 * Returns integer sizes so tiles land on whole pixels (crisper text).
 */
function cubeViewport(width: number, height: number) {
  const w = width || 1200;
  const h = height || 800;
  const availW = Math.max(240, (w - STAGE_PADDING * 2) * 0.98);
  const availH = Math.max(200, (h - CHROME_TOP - CHROME_BOTTOM) * 0.98);
  const raw = Math.min(availW / (2 * DEFAULT_VIEW_EXTENT.x), availH / (2 * DEFAULT_VIEW_EXTENT.y));
  // floor() keeps the fitted cube strictly inside the free space at every size
  const size = Math.floor(clampNum(raw, 360, 1180));
  // When the size floor/ceiling binds (very small or very large stages) the view
  // scale compensates instead, so the cube never spills out of its box.
  const fitScale = Math.min(1, raw / size);
  return {
    size,
    fitScale,
    availW,
    availH,
    center: { x: Math.round(w / 2), y: Math.round(CHROME_TOP + availH / 2) },
  };
}

/**
 * Quantised zoom stops. Arbitrary fractional scales are the main reason text
 * inside a scaled layer looks soft, so every zoom path snaps to one of these.
 */
const ZOOM_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5, 2.8];

function snapZoom(value: number) {
  const clamped = clampNum(value, ZOOM_STEPS[0], ZOOM_STEPS[ZOOM_STEPS.length - 1]);
  let best = ZOOM_STEPS[0];
  let bestDelta = Infinity;
  ZOOM_STEPS.forEach((step) => {
    const delta = Math.abs(step - clamped);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = step;
    }
  });
  return best;
}

interface CubeExplorerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  highlightNodes: string[];
  highlightEdges: string[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onClearHighlight: () => void;
  selectedProject: string | null;
  onBackToChat?: () => void;
  onOpenFlashcard?: (nodeId: string) => void;
  evidence?: EvidenceItem[];
  onAskAboutNode?: (title: string) => void;
  /** Ask the parent to switch back to the classic node graph */
  onSwitchView?: () => void;
  /** Selection that arrived from another panel and should be flown to */
  focusRequest?: FocusRequest | null;
  /** Mirrors the active dimension upwards (breadcrumbs live in the parent) */
  onDimensionChange?: (dim: CubeDimension | null) => void;
}

export const CubeExplorer: React.FC<CubeExplorerProps> = ({
  nodes,
  edges,
  highlightNodes,
  highlightEdges,
  selectedNodeId,
  onSelectNode,
  onClearHighlight,
  selectedProject,
  onBackToChat,
  onOpenFlashcard,
  evidence,
  onAskAboutNode,
  onSwitchView,
  focusRequest,
  onDimensionChange,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    mode: 'rotate' | 'pan';
    x: number;
    y: number;
    rx: number;
    ry: number;
    panX: number;
    panY: number;
  } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const [stage, setStage] = useState({ w: 1200, h: 800 });
  const [rx, setRx] = useState(DEFAULT_VIEW.rx);
  const [ry, setRy] = useState(DEFAULT_VIEW.ry);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [activeDimension, setActiveDimension] = useState<CubeDimension | null>(null);
  const [animated, setAnimated] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Nonce of the focus request already applied (render-phase sync guard) */
  const [appliedFocus, setAppliedFocus] = useState<number | null>(null);

  /* ---------------------------------------------------------------- Lock-In */
  const [lockedIn, setLockedIn] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.36);
  const [yawInvert, setYawInvert] = useState(false);

  /* ---------------------------------------------------------------- geometry */

  const viewport = useMemo(() => cubeViewport(stage.w, stage.h), [stage.w, stage.h]);
  const size = viewport.size;
  const faces = useMemo(() => buildFaces(size), [size]);
  const scale = viewport.fitScale * zoom;
  const center = viewport.center;

  const visibleFaces = useMemo(() => faces.filter((f) => !hidden[f.dim]), [faces, hidden]);

  const faceNodes = useMemo(() => {
    const map = new Map<CubeDimension, GraphNode[]>();
    CUBE_DIMENSIONS.forEach((dim) => map.set(dim, []));
    nodes.forEach((n) => {
      map.get(dimensionOf(n))!.push(n);
    });
    return map;
  }, [nodes]);

  const faceLayouts = useMemo(() => {
    const map = new Map<CubeDimension, ReturnType<typeof layoutTiles>>();
    visibleFaces.forEach((f) => {
      map.set(f.dim, layoutTiles(Math.min(MAX_TILES, faceNodes.get(f.dim)!.length), size));
    });
    return map;
  }, [visibleFaces, faceNodes, size]);

  /** nodeId → the face slot it occupies, used by the projected link overlay */
  const tileIndex = useMemo(() => {
    const map = new Map<string, { def: FaceDef; slot: TileSlot }>();
    visibleFaces.forEach((f) => {
      const list = faceNodes.get(f.dim)!;
      const layout = faceLayouts.get(f.dim);
      if (!layout) return;
      list.slice(0, MAX_TILES).forEach((n, i) => {
        const slot = layout.slots[i];
        if (slot) map.set(n.id, { def: f, slot });
      });
    });
    return map;
  }, [visibleFaces, faceNodes, faceLayouts]);

  const project = useCallback(
    (p: Vec3) => {
      const r = rotatePoint(p, rx, ry);
      return {
        x: center.x + pan.x + r.x * scale,
        y: center.y + pan.y + r.y * scale,
        z: r.z * scale,
      };
    },
    [rx, ry, scale, pan, center]
  );

  const dimPoint = useCallback(
    (def: FaceDef, dx: number, dy: number): Vec3 => {
      const half = size / 2;
      return {
        x: def.normal.x * half + def.right.x * dx + def.down.x * dy,
        y: def.normal.y * half + def.right.y * dx + def.down.y * dy,
        z: def.normal.z * half + def.right.z * dx + def.down.z * dy,
      };
    },
    [size]
  );

  /* ------------------------------------------------------------- relations */

  const nodeTitle = useCallback(
    (node: GraphNode) => node.properties?.name || node.properties?.title || node.id,
    []
  );

  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    edges.forEach((e) => {
      map.set(e.src, (map.get(e.src) || 0) + 1);
      map.set(e.dst, (map.get(e.dst) || 0) + 1);
    });
    return map;
  }, [edges]);

  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    edges.forEach((e) => {
      if (e.src === selectedNodeId) set.add(e.dst);
      if (e.dst === selectedNodeId) set.add(e.src);
    });
    return set;
  }, [edges, selectedNodeId]);

  const focusActive = selectedNodeId !== null || highlightNodes.length > 0;

  const relatedIds = useMemo(() => {
    const set = new Set<string>(highlightNodes);
    if (selectedNodeId) {
      set.add(selectedNodeId);
      neighborIds.forEach((id) => set.add(id));
    }
    return set;
  }, [highlightNodes, selectedNodeId, neighborIds]);

  /* Relationship overlay: real edges of the selection, projected onto the cube */
  const links = useMemo(() => {
    if (!selectedNodeId) return [];
    const hub = tileIndex.get(selectedNodeId);
    if (!hub) return [];
    const hubPoint = project(dimPoint(hub.def, hub.slot.dx, hub.slot.dy));

    return edges
      .filter((e) => e.src === selectedNodeId || e.dst === selectedNodeId)
      .flatMap((e) => {
        const otherId = e.src === selectedNodeId ? e.dst : e.src;
        const target = tileIndex.get(otherId);
        if (!target) return [];
        const point = dimPoint(target.def, target.slot.dx, target.slot.dy);
        const normal = rotatePoint(target.def.normal, rx, ry);
        const projected = project(point);
        return [
          {
            id: e.id,
            rel: e.rel,
            outgoing: e.src === selectedNodeId,
            from: hubPoint,
            to: projected,
            facing: normal.z > 0.001,
            highlighted: highlightEdges.includes(e.id),
            targetId: otherId,
          },
        ];
      });
  }, [selectedNodeId, edges, tileIndex, dimPoint, project, rx, ry, highlightEdges]);

  const hopDimensions = useMemo(() => {
    const map = new Map<CubeDimension, number>();
    links.forEach((l) => {
      const target = tileIndex.get(l.targetId);
      if (!target) return;
      map.set(target.def.dim, (map.get(target.def.dim) || 0) + 1);
    });
    return [...map.entries()];
  }, [links, tileIndex]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  /* ------------------------------------------------------------ view control */

  /* Animated transitions only for deliberate jumps: any direct manipulation
     (drag, wheel, keys) turns them off again, so the CSS transition never
     fights the pointer. */
  const animate = useCallback(() => setAnimated(true), []);

  useEffect(() => {
    onDimensionChange?.(activeDimension);
    // Intentionally mirrors dimension state upwards only when it changes.
  }, [activeDimension, onDimensionChange]);

  const jumpToDimension = useCallback(
    (dim: CubeDimension) => {
      const face = faces.find((f) => f.dim === dim);
      if (!face) return;
      setHidden((prev) => (prev[dim] ? { ...prev, [dim]: false } : prev));
      setRx(face.view.rx);
      setRy((current) => normalizeAngle(current + normalizeAngle(face.view.ry - current)));
      setPan({ x: 0, y: 0 });
      setActiveDimension(dim);
      setShowDimensions(false);
      animate();
    },
    [faces, animate]
  );

  /** Pure: where the cube has to sit for a given entity to be front and centred */
  const viewForNode = useCallback(
    (nodeId: string) => {
      const entry = tileIndex.get(nodeId);
      if (!entry) return null;
      const face = entry.def;
      const point = dimPoint(face, entry.slot.dx, entry.slot.dy);
      const rotated = rotatePoint(point, face.view.rx, face.view.ry);
      return {
        dim: face.dim,
        rx: face.view.rx,
        ry: face.view.ry,
        pan: { x: -rotated.x * scale, y: -rotated.y * scale },
      };
    },
    [tileIndex, dimPoint, scale]
  );

  const applyView = useCallback(
    (view: { dim: CubeDimension; rx: number; ry: number; pan: { x: number; y: number } }) => {
      setHidden((prev) => (prev[view.dim] ? { ...prev, [view.dim]: false } : prev));
      setRx(view.rx);
      setRy((current) => normalizeAngle(current + normalizeAngle(view.ry - current)));
      setPan(view.pan);
      setActiveDimension(view.dim);
      animate();
    },
    [animate]
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      const view = viewForNode(nodeId);
      if (view) applyView(view);
    },
    [viewForNode, applyView]
  );

  const resetView = useCallback(() => {
    setRx(DEFAULT_VIEW.rx);
    setRy(DEFAULT_VIEW.ry);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    animate();
  }, [animate]);

  const fitAll = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    animate();
  }, [animate]);

  const fullCube = useCallback(() => {
    setHidden({});
    setRx(DEFAULT_VIEW.rx);
    setRy(DEFAULT_VIEW.ry);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActiveDimension(null);
    setShowDimensions(false);
    animate();
  }, [animate]);

  const toggleDimension = useCallback(
    (dim: CubeDimension) => {
      setHidden((prev) => {
        const next = { ...prev };
        if (next[dim]) delete next[dim];
        else next[dim] = true;
        const visibleCount = CUBE_DIMENSIONS.filter((d) => !next[d]).length;
        // Never let the explorer end up with nothing to show.
        if (visibleCount === 0) return prev;
        return next;
      });
      setActiveDimension((current) => (current === dim ? null : current));
    },
    []
  );

  const focusSelection = useCallback(() => {
    if (selectedNodeId) focusNode(selectedNodeId);
  }, [selectedNodeId, focusNode]);

  /* External focus requests (a block click in the Scratch map, or a hand-off
     from the Directory Index). Applied during render — React's documented way
     to adjust state when a prop changes — so no effect cascade is needed. */
  if (focusRequest && focusRequest.nonce !== appliedFocus) {
    setAppliedFocus(focusRequest.nonce);
    const view = viewForNode(focusRequest.nodeId);
    if (view) applyView(view);
  }

  /* --------------------------------------------------------------- pointers */

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, a, input, .cube-tile, .canvas-floating-toolbar, .cube-dim-popover, .cube-hud-chip'
      )
    ) {
      return;
    }
    if ((e.target as HTMLElement).closest('.cube-stage')) {
      stageRef.current?.focus({ preventScroll: true });
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setAnimated(false);

    if (pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom };
      dragRef.current = null;
      return;
    }

    const mode: 'rotate' | 'pan' =
      e.shiftKey || e.button === 1 || e.button === 2 ? 'pan' : 'rotate';
    dragRef.current = { mode, x: e.clientX, y: e.clientY, rx, ry, panX: pan.x, panY: pan.y };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      setZoom(snapZoom((pinchRef.current.zoom * dist) / pinchRef.current.dist));
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (drag.mode === 'pan') {
      setPan({ x: drag.panX + dx, y: drag.panY + dy });
      return;
    }

    setRy(normalizeAngle(drag.ry + dx * 0.45));
    setRx(clampNum(drag.rx - dy * 0.45, -90, 90));
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  /* Native wheel listener so zooming never scrolls the workspace */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setAnimated(false);
      setZoom((z) => snapZoom(z * Math.exp(-e.deltaY * 0.0012)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setStage({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* --------------------------------------------------------- Pointer Lock-In */

  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;
  const yawInvertRef = useRef(yawInvert);
  yawInvertRef.current = yawInvert;

  const toggleLockIn = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.pointerLockElement === el) {
      document.exitPointerLock();
    } else {
      el.requestPointerLock();
    }
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const onLockChange = () => {
      setLockedIn(document.pointerLockElement === el);
    };

    const onLockedMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const s = sensitivityRef.current;
      const yi = yawInvertRef.current;
      const direction = yi ? -1 : 1;
      const dyaw = -e.movementX * s * direction;
      const dpitch = -e.movementY * s * direction;
      setAnimated(false);
      setRy((r) => normalizeAngle(r + dyaw));
      setRx((r) => normalizeAngle(r + dpitch));
    };

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onLockedMove);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onLockedMove);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: ExplorerKeyEvent) => {
      const panStep = 32;
    const rotateStep = 12;
    const key = e.key;

    if (/^[1-6]$/.test(key)) {
      e.preventDefault();
      jumpToDimension(CUBE_DIMENSIONS[Number(key) - 1]);
      return;
    }

    switch (key) {
      case 'ArrowLeft':
        e.preventDefault();
        setAnimated(false);
        if (e.shiftKey) setPan((p) => ({ x: p.x - panStep, y: p.y }));
        else setRy((r) => normalizeAngle(r - rotateStep));
        return;
      case 'ArrowRight':
        e.preventDefault();
        setAnimated(false);
        if (e.shiftKey) setPan((p) => ({ x: p.x + panStep, y: p.y }));
        else setRy((r) => normalizeAngle(r + rotateStep));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setAnimated(false);
        if (e.shiftKey) setPan((p) => ({ x: p.x, y: p.y - panStep }));
        else setRx((r) => clampNum(r - rotateStep, -90, 90));
        return;
      case 'ArrowDown':
        e.preventDefault();
        setAnimated(false);
        if (e.shiftKey) setPan((p) => ({ x: p.x, y: p.y + panStep }));
        else setRx((r) => clampNum(r + rotateStep, -90, 90));
        return;
      case '+':
      case '=':
        e.preventDefault();
        setAnimated(false);
        setZoom((z) => snapZoom(z * 1.15));
        return;
      case '-':
      case '_':
        e.preventDefault();
        setAnimated(false);
        setZoom((z) => snapZoom(z / 1.15));
        return;
      case '0':
      case 'Home':
        e.preventDefault();
        fullCube();
        return;
      case 'f':
      case 'F':
        e.preventDefault();
        fitAll();
        return;
      case 'r':
      case 'R':
        e.preventDefault();
        resetView();
        return;
      case 'Escape':
        e.preventDefault();
        if (selectedNodeId) onSelectNode(null);
        else if (activeDimension) fullCube();
        return;
      default:
      }
    },
    [jumpToDimension, fullCube, fitAll, resetView, selectedNodeId, onSelectNode, activeDimension]
  );

  /* Keyboard shortcuts live on the window while this view is open, so the cube
     is navigable without hunting for focus. Text fields and open modals keep
     their keys, and modifier combos stay with the browser. */
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || typeof el.closest !== 'function') return false;
      if (el.isContentEditable) return true;
      return !!el.closest('input, textarea, select, [contenteditable="true"]');
    };

    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('.modal-backdrop, .db-modal-overlay, .flashcard-overlay, [role="dialog"]')) {
        return;
      }
      handleKeyDown(e);
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [handleKeyDown]);

  /* ------------------------------------------------------------------ render */

  const hasGraphData = nodes.length > 0;
  const hiddenCount = CUBE_DIMENSIONS.length - visibleFaces.length;
  const evidenceIds = useMemo(
    () => new Set((evidence || []).map((ev) => ev.entity_id)),
    [evidence]
  );

  /* Text is authored in rem so it stays legible; --cube-fs keeps it in step with
     the fitted cube size, with a floor so the smallest labels never collapse.
     The cube is positioned in whole pixels (centre comes from cubeViewport) so
     type lands on the device-pixel grid instead of half pixels. */
  const transformStyle = {
    left: center.x,
    top: center.y,
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`,
    '--cube-fs': String(clampNum(size / 700, 0.96, 1.32)),
  } as React.CSSProperties;

  return (
    <div className="scratch-graph-workspace cube-explorer-workspace">
      <main className="n8n-cube-canvas-panel">
        {/* Floating cube toolbar */}
        <div className="canvas-floating-toolbar">
          <div className="canvas-toolbar-left">
            {onBackToChat && (
              <button className="btn-canvas-back" onClick={onBackToChat} title="Return to Company Brain">
                <ArrowLeft size={14} />
                <span>Brain</span>
              </button>
            )}

            <nav className="cube-breadcrumbs" aria-label="Cube breadcrumbs">
              <button
                type="button"
                className={`cube-crumb ${activeDimension === null ? 'is-current' : ''}`}
                onClick={fullCube}
                title="Show all six dimensions"
              >
                <Boxes size={12} />
                <span>Full graph</span>
              </button>
              {activeDimension && (
                <>
                  <ChevronRight size={11} className="cube-crumb-sep" />
                  <span className="cube-crumb is-current">
                    {React.createElement(DIMENSION_ICONS[activeDimension], { size: 12 })}
                    <span>{activeDimension}</span>
                    <span className="cube-crumb-count">
                      {faceNodes.get(activeDimension)?.length || 0}
                    </span>
                  </span>
                </>
              )}
              {!activeDimension && (
                <span className="canvas-node-count">
                  {selectedProject ? selectedProject.toUpperCase().replace('PROJ-', '') : 'ALL'} ·{' '}
                  {nodes.length} nodes · {visibleFaces.length}/6 dimensions
                </span>
              )}
            </nav>
          </div>

          <div className="canvas-toolbar-right">
            {onSwitchView && (
              <button
                className="btn-canvas-tool"
                onClick={onSwitchView}
                title="Switch to the classic node graph"
              >
                <Layers size={13} />
                <span>Node graph</span>
              </button>
            )}

            <button
              className={`btn-canvas-tool ${showDimensions ? 'is-active' : ''}`}
              onClick={() => setShowDimensions((v) => !v)}
              title="Jump between dimensions and toggle visibility"
              aria-expanded={showDimensions}
            >
              <Boxes size={13} />
              <span>Dimensions</span>
              {hiddenCount > 0 && <span className="cube-tool-badge">{hiddenCount} hidden</span>}
            </button>

            <button className="btn-canvas-tool btn-icon" onClick={() => setZoom((z) => snapZoom(z / 1.15))} title="Zoom out">
              <ZoomOut size={14} />
            </button>
            <button className="btn-canvas-tool btn-icon" onClick={() => setZoom((z) => snapZoom(z * 1.15))} title="Zoom in">
              <ZoomIn size={14} />
            </button>
            <button className="btn-canvas-tool btn-icon" onClick={fitAll} title="Fit all (F)">
              <Maximize2 size={13} />
            </button>
            <button className="btn-canvas-tool btn-icon" onClick={resetView} title="Reset view (R)">
              <RotateCcw size={13} />
            </button>
            <button
              className="btn-canvas-tool"
              onClick={focusSelection}
              disabled={!selectedNodeId}
              title="Focus the selected entity (fly to its dimension)"
            >
              <Crosshair size={13} />
              <span>Focus</span>
            </button>
            <button className="btn-canvas-tool" onClick={fullCube} title="Return to the full graph (0)">
              <Share2 size={13} />
              <span>Full cube</span>
            </button>

            {(highlightNodes.length > 0 || selectedNodeId !== null) && (
              <button className="btn-canvas-tool btn-clear-focus" onClick={onClearHighlight}>
                <GitBranch size={13} />
                <span>Clear Focus</span>
              </button>
            )}
          </div>
        </div>

        {/* Dimension jump + visibility popover */}
        {showDimensions && (
          <div className="cube-dim-popover" role="menu" aria-label="Dimensions">
            <div className="cube-dim-popover-title">
              <span>Six dimensions</span>
              <span className="cube-dim-popover-hint">jump · toggle</span>
            </div>
            {faces.map((face, index) => {
              const Icon = DIMENSION_ICONS[face.dim];
              const isHidden = !!hidden[face.dim];
              const count = faceNodes.get(face.dim)?.length || 0;
              return (
                <div key={face.dim} className={`cube-dim-row ${isHidden ? 'is-hidden' : ''}`}>
                  <button
                    type="button"
                    className="cube-dim-main"
                    onClick={() => jumpToDimension(face.dim)}
                    title={`Jump to the ${face.dim} dimension`}
                  >
                    <span className="cube-dim-key">{index + 1}</span>
                    <Icon size={13} />
                    <span className="cube-dim-name">{face.dim}</span>
                    <span className="cube-dim-count">{count}</span>
                  </button>
                  <button
                    type="button"
                    className={`cube-dim-eye ${isHidden ? 'is-off' : ''}`}
                    onClick={() => toggleDimension(face.dim)}
                    title={isHidden ? `Show ${face.dim}` : `Hide ${face.dim}`}
                    aria-pressed={!isHidden}
                  >
                    {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!hasGraphData && (
          <div className="graph-empty-state">
            <FolderGit2 size={40} className="graph-empty-icon" />
            <h3>No graph data yet</h3>
            <p>
              The cube will appear here once data loads. Check your FalkorDB connection in Settings,
              or re-seed the demo dataset from the sidebar.
            </p>
          </div>
        )}

        {hasGraphData && (
          <div
            className="cube-stage"
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Six-dimensional cube knowledge explorer. Drag to rotate, shift-drag to pan, scroll to zoom, keys 1 to 6 jump between dimensions."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="cube-floor-grid" aria-hidden="true" />

            <div
              className={`cube-space ${animated ? 'is-animated' : ''}`}
              style={transformStyle}
            >
              {visibleFaces.map((face) => {
                const Icon = DIMENSION_ICONS[face.dim];
                const list = faceNodes.get(face.dim)!;
                const layout = faceLayouts.get(face.dim)!;
                const shown = list.slice(0, MAX_TILES);
                const isActive = activeDimension === face.dim;

                return (
                  <div
                    key={face.dim}
                    className={`cube-face ${isActive ? 'is-active' : ''}`}
                    style={{
                      width: size,
                      height: size,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                      transform: face.transform,
                    }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('.cube-tile')) return;
                      jumpToDimension(face.dim);
                    }}
                    title={`Select the ${face.dim} dimension`}
                  >
                    <div
                      className="cube-face-header"
                      style={{ borderLeftColor: DIMENSION_RAMP[face.dim] }}
                    >
                      <span className="cube-face-title">
                        <Icon size={14} />
                        <span>{face.dim}</span>
                      </span>
                      <span className="cube-face-meta">
                        {list.length} {list.length === 1 ? 'node' : 'nodes'}
                      </span>
                    </div>

                    <div className="cube-face-body">
                      {shown.map((node, index) => {
                        const slot = layout.slots[index];
                        if (!slot) return null;
                        const isSelected = selectedNodeId === node.id;
                        const isHighlighted = highlightNodes.includes(node.id);
                        const isRelated = !isSelected && relatedIds.has(node.id);
                        const isDimmed = focusActive && !relatedIds.has(node.id);
                        const status = node.properties?.status as string | undefined;
                        const isBlocked = status === 'BLOCKED' || status === 'DELAYED';
                        const degree = degrees.get(node.id) || 0;

                        return (
                          <button
                            type="button"
                            key={node.id}
                            className={[
                              'cube-tile',
                              isSelected ? 'is-selected' : '',
                              isHighlighted ? 'is-highlighted' : '',
                              isRelated ? 'is-related' : '',
                              isDimmed ? 'is-dimmed' : '',
                              isBlocked ? 'is-blocked' : '',
                              hoveredId === node.id ? 'is-hovered' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={{
                              left: '50%',
                              top: '50%',
                              width: slot.w,
                              height: slot.h,
                              transform: `translate(-50%, -50%) translate(${slot.dx}px, ${slot.dy}px)`,
                              borderLeftColor: DIMENSION_RAMP[face.dim],
                            }}
                            onMouseEnter={() => setHoveredId(node.id)}
                            onMouseLeave={() => setHoveredId((current) => (current === node.id ? null : current))}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectNode(isSelected ? null : node.id);
                            }}
                            onDoubleClick={() => onOpenFlashcard?.(node.id)}
                            title={`${node.label} · ${nodeTitle(node)} — click to select, double-click for the full card`}
                            aria-pressed={isSelected}
                          >
                            <span className="cube-tile-top">
                              <span className="cube-tile-index">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              {status && (
                                <span className={`cube-tile-status ${isBlocked ? 'is-blocked' : ''}`}>
                                  {status}
                                </span>
                              )}
                              {evidenceIds.has(node.id) && (
                                <span className="cube-tile-evidence" title="Cited in the current Brain answer" />
                              )}
                            </span>
                            <span className="cube-tile-title">{nodeTitle(node)}</span>
                            <span className="cube-tile-bottom">
                              <span className="cube-tile-id">{node.id}</span>
                              <span className="cube-tile-degree">{degree} links</span>
                            </span>
                          </button>
                        );
                      })}

                      {layout.overflow > 0 && (
                        <span className="cube-face-overflow">
                          +{layout.overflow} more in Directory Index
                        </span>
                      )}

                      {list.length === 0 && (
                        <span className="cube-face-empty">No {face.dim.toLowerCase()} records in view</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Projected relationship overlay — real edges only */}
            <svg
              className="cube-link-layer"
              width={stage.w}
              height={stage.h}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <marker
                  id="orgmind-cube-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.75)" />
                </marker>
                <marker
                  id="orgmind-cube-arrow-red"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#D71921" />
                </marker>
              </defs>

              {links.map((link) => {
                const isBlocked = link.rel === 'BLOCKED_BY' || link.rel === 'WAITING_FOR';
                const stroke = isBlocked ? '#D71921' : link.highlighted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
                const midX = (link.from.x + link.to.x) / 2;
                const midY = (link.from.y + link.to.y) / 2;
                // Bow the line so overlapping edges stay readable.
                const curve = isBlocked ? 26 : 14;
                const nx = -(link.to.y - link.from.y);
                const ny = link.to.x - link.from.x;
                const len = Math.max(1, Math.hypot(nx, ny));
                const cx = midX + (nx / len) * curve;
                const cy = midY + (ny / len) * curve;

                return (
                  <path
                    key={link.id}
                    className={`cube-link ${isBlocked ? 'is-blocked' : ''} ${
                      link.facing ? '' : 'is-back'
                    }`}
                    d={`M ${link.from.x} ${link.from.y} Q ${cx} ${cy} ${link.to.x} ${link.to.y}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isBlocked || link.highlighted ? 1.8 : 1.1}
                    strokeDasharray={link.facing ? undefined : '4 4'}
                    markerEnd={`url(#${isBlocked ? 'orgmind-cube-arrow-red' : 'orgmind-cube-arrow'})`}
                    opacity={link.facing ? 0.95 : 0.45}
                  />
                );
              })}
            </svg>

            {/* Selection HUD */}
            {selectedNode && (
              <div className="cube-selection-hud">
                <div className="cube-hud-head">
                  <span className="cube-hud-dot" />
                  <span className="cube-hud-dim">
                    {dimensionOf(selectedNode)} dimension
                  </span>
                  <span className="cube-hud-links">
                    {links.length} {links.length === 1 ? 'link' : 'links'}
                  </span>
                </div>
                <div className="cube-hud-title">{nodeTitle(selectedNode)}</div>
                <div className="cube-hud-sub">{selectedNode.id}</div>
                {hopDimensions.length > 0 && (
                  <div className="cube-hud-hops">
                    {hopDimensions.map(([dim, count]) => {
                      const Icon = DIMENSION_ICONS[dim];
                      return (
                        <button
                          key={dim}
                          type="button"
                          className="cube-hud-chip"
                          onClick={() => jumpToDimension(dim)}
                          title={`Jump to ${dim}`}
                        >
                          <Icon size={11} />
                          <span>{dim}</span>
                          <span className="cube-hud-chip-count">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="cube-hud-actions">
                  <button
                    type="button"
                    className="cube-hud-action"
                    onClick={() => focusNode(selectedNode.id)}
                  >
                    <Crosshair size={11} /> Focus
                  </button>
                  {onOpenFlashcard && (
                    <button
                      type="button"
                      className="cube-hud-action"
                      onClick={() => onOpenFlashcard(selectedNode.id)}
                    >
                      <Maximize2 size={11} /> Card
                    </button>
                  )}
                  {onAskAboutNode && (
                    <button
                      type="button"
                      className="cube-hud-action"
                      onClick={() => onAskAboutNode(nodeTitle(selectedNode))}
                    >
                      <Sparkles size={11} /> Ask Brain
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Legend + controls hint */}
            <div className="canvas-legend cube-legend">
              {faces.map((face) => (
                <button
                  key={face.dim}
                  type="button"
                  className={`legend-item cube-legend-item ${activeDimension === face.dim ? 'is-active' : ''} ${
                    hidden[face.dim] ? 'is-off' : ''
                  }`}
                  onClick={() => jumpToDimension(face.dim)}
                  title={`Jump to the ${face.dim} dimension`}
                >
                  <span className="legend-dot" style={{ background: DIMENSION_RAMP[face.dim] }} />
                  {face.dim}
                </button>
              ))}
            </div>

            {/* Roll The Cube — Lock-In floating panel */}
            <div className={`cube-lockin-panel ${lockedIn ? 'is-locked' : ''}`}>
              <div className="cube-lockin-header">
                <span className="cube-lockin-icon">◎</span>
                <span>ROLL THE CUBE</span>
              </div>

              {/* Wireframe sphere */}
              <div className="cube-lockin-sphere" aria-hidden="true">
                <svg viewBox="0 0 100 100" width="100" height="100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" />
                  <ellipse cx="50" cy="50" rx="42" ry="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
                  <ellipse cx="50" cy="50" rx="16" ry="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6"
                    transform={`rotate(${ry % 360}, 50, 50)`}
                  />
                  <ellipse cx="50" cy="50" rx="42" ry="8" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.5"
                    transform={`rotate(${rx}, 50, 50)`}
                  />
                  {/* Crosshair */}
                  <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                  <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                  {/* Rotation indicator dot */}
                  <circle
                    cx={50 + 42 * Math.sin(ry * DEG) * Math.cos(rx * DEG)}
                    cy={50 - 42 * Math.sin(rx * DEG)}
                    r="3" fill="#D71921" opacity="0.9"
                  />
                </svg>
              </div>

              {/* Angle readout */}
              <div className="cube-lockin-readout">
                <span>yaw {Math.round(((ry % 360) + 360) % 360).toString().padStart(2, '0')}°</span>
                <span className="cube-lockin-readout-sep">·</span>
                <span>pitch {Math.round(rx)}°</span>
              </div>

              {/* Sensitivity slider */}
              <div className="cube-lockin-slider-row">
                <span className="cube-lockin-slider-label">SENS</span>
                <input
                  type="range"
                  className="cube-lockin-slider"
                  min="0.05"
                  max="1"
                  step="0.01"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                  title={`Sensitivity: ${sensitivity.toFixed(2)}`}
                />
                <span className="cube-lockin-slider-value">{sensitivity.toFixed(2)}</span>
              </div>

              {/* Action buttons */}
              <div className="cube-lockin-buttons">
                <button
                  type="button"
                  className={`cube-lockin-btn cube-lockin-btn-primary ${lockedIn ? 'is-active' : ''}`}
                  onClick={toggleLockIn}
                  title={lockedIn ? 'Release pointer (Esc)' : 'Lock pointer to cube for free rotation'}
                >
                  {lockedIn ? <Unlock size={12} /> : <Lock size={12} />}
                  <span>{lockedIn ? 'Unlock' : 'Lock In'}</span>
                </button>
                <button
                  type="button"
                  className={`cube-lockin-btn ${yawInvert ? 'is-active' : ''}`}
                  onClick={() => setYawInvert((v) => !v)}
                  title="Invert yaw axis"
                >
                  Yi
                </button>
                <button
                  type="button"
                  className="cube-lockin-btn"
                  onClick={resetView}
                  title="Reset rotation (R)"
                >
                  <RotateCcw size={12} />
                </button>
              </div>

              <div className="cube-lockin-footer">
                {lockedIn ? 'ESC • UNLOCK' : 'CLICK • LOCK IN'}
              </div>
            </div>

            <div className="cube-hint">
              <MousePointer2 size={11} />
              <span>drag rotate</span>
              <span className="cube-hint-sep">·</span>
              <span>shift+drag pan</span>
              <span className="cube-hint-sep">·</span>
              <span>scroll zoom</span>
              <span className="cube-hint-sep">·</span>
              <span>1–6 dimensions</span>
              <span className="cube-hint-sep">·</span>
              <span>F fit</span>
              <span className="cube-hint-sep">·</span>
              <span>R reset</span>
              <span className="cube-hint-sep">·</span>
              <span>sphere: click to lock</span>
            </div>
          </div>
        )}

        {/* Keyboard focus target for the shortcuts above (a11y affordance) */}
        <span className="visually-hidden">
          {`Cube explorer: ${nodes.length} nodes across ${visibleFaces.length} visible dimensions.`}
        </span>
      </main>
    </div>
  );
};

export default CubeExplorer;
