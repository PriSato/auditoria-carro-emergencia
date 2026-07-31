import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Circle,
  Square,
  Diamond,
  Menu,
  X,
  Link2,
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Info,
} from "lucide-react";

/* ---------------------------------------------------------
   Config: BPMN shape definitions
--------------------------------------------------------- */
const VBW = 1600;
const VBH = 1100;

const SHAPES = {
  start: {
    kind: "circle",
    w: 48,
    h: 48,
    stroke: "#2F9E44",
    sw: 2.5,
    fill: "#FFFFFF",
    label: "Início",
    group: "events",
  },
  intermediate: {
    kind: "circle",
    w: 48,
    h: 48,
    stroke: "#E8890C",
    sw: 2.5,
    fill: "#FFFFFF",
    double: true,
    label: "Intermediário",
    group: "events",
  },
  end: {
    kind: "circle",
    w: 48,
    h: 48,
    stroke: "#E0393E",
    sw: 4.5,
    fill: "#FFFFFF",
    label: "Fim",
    group: "events",
  },
  task: {
    kind: "rect",
    w: 148,
    h: 72,
    stroke: "#1C2333",
    sw: 2,
    fill: "#FFFFFF",
    label: "Tarefa",
    group: "activities",
  },
  subprocess: {
    kind: "rect",
    w: 160,
    h: 80,
    stroke: "#1C2333",
    sw: 2,
    fill: "#FFFFFF",
    label: "Subprocesso",
    marker: "plus",
    group: "activities",
  },
  "gateway-exclusive": {
    kind: "diamond",
    w: 66,
    h: 66,
    stroke: "#E8890C",
    sw: 2.5,
    fill: "#FFFFFF",
    label: "Gateway Exclusivo",
    symbol: "x",
    group: "gateways",
  },
  "gateway-parallel": {
    kind: "diamond",
    w: 66,
    h: 66,
    stroke: "#E8890C",
    sw: 2.5,
    fill: "#FFFFFF",
    label: "Gateway Paralelo",
    symbol: "plus",
    group: "gateways",
  },
  "gateway-inclusive": {
    kind: "diamond",
    w: 66,
    h: 66,
    stroke: "#E8890C",
    sw: 2.5,
    fill: "#FFFFFF",
    label: "Gateway Inclusivo",
    symbol: "circle",
    group: "gateways",
  },
};

const PALETTE_GROUPS = [
  {
    key: "events",
    title: "Eventos",
    hint: "Início, fim e pontos intermediários do fluxo",
    items: ["start", "intermediate", "end"],
  },
  {
    key: "activities",
    title: "Atividades",
    hint: "Etapas de trabalho executadas no processo",
    items: ["task", "subprocess"],
  },
  {
    key: "gateways",
    title: "Gateways",
    hint: "Pontos de decisão e divisão do fluxo",
    items: ["gateway-exclusive", "gateway-parallel", "gateway-inclusive"],
  },
];

/* ---------------------------------------------------------
   Config: BPMN connector (fluxo/associação) definitions
--------------------------------------------------------- */
const CONNECTOR_TYPES = {
  sequence: {
    label: "Sequência",
    hint: "Fluxo padrão entre elementos do mesmo pool",
    dash: null,
    markerStart: null,
    markerEnd: "arrow",
    markerEndSel: "arrowSel",
  },
  conditional: {
    label: "Condicional",
    hint: "Só segue adiante se a condição indicada for satisfeita",
    dash: null,
    markerStart: "diamond",
    markerStartSel: "diamondSel",
    markerEnd: "arrow",
    markerEndSel: "arrowSel",
  },
  default: {
    label: "Padrão",
    hint: "Caminho padrão de um gateway, usado quando nenhuma outra condição é satisfeita",
    dash: null,
    markerStart: "slash",
    markerStartSel: "slashSel",
    markerEnd: "arrow",
    markerEndSel: "arrowSel",
  },
  message: {
    label: "Mensagem",
    hint: "Troca de mensagem entre participantes/pools diferentes",
    dash: "7 5",
    markerStart: "circle",
    markerStartSel: "circleSel",
    markerEnd: "arrowOpen",
    markerEndSel: "arrowOpenSel",
  },
  association: {
    label: "Associação",
    hint: "Liga um elemento a uma anotação ou artefato, sem indicar fluxo",
    dash: "1.5 4",
    markerStart: null,
    markerEnd: null,
  },
};

const CONNECTOR_ORDER = ["sequence", "conditional", "default", "message", "association"];

/* ---------------------------------------------------------
   Geometry helpers
--------------------------------------------------------- */
function getEdgePoint(el, tx, ty) {
  const s = SHAPES[el.type];
  const dx = tx - el.x;
  const dy = ty - el.y;
  if (dx === 0 && dy === 0) return { x: el.x, y: el.y };

  if (s.kind === "circle") {
    const r = s.w / 2;
    const len = Math.sqrt(dx * dx + dy * dy);
    return { x: el.x + (dx / len) * r, y: el.y + (dy / len) * r };
  }
  if (s.kind === "diamond") {
    const hw = s.w / 2;
    const hh = s.h / 2;
    const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
    const t = denom === 0 ? 0 : 1 / denom;
    return { x: el.x + dx * t, y: el.y + dy * t };
  }
  // rect
  const hw = s.w / 2;
  const hh = s.h / 2;
  const tX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return { x: el.x + dx * t, y: el.y + dy * t };
}

function wrapLines(text, maxChars = 16, maxLines = 2) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (test.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = test;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    const consumed = lines.slice(0, maxLines - 1).join(" ").length;
    const remaining = words.join(" ").length - consumed;
    if (remaining > last.length) lines[maxLines - 1] = last.slice(0, maxChars - 1).trimEnd() + "…";
  }
  return lines.length ? lines : [""];
}

/* ---------------------------------------------------------
   Small icon for palette (mini bpmn shape preview)
--------------------------------------------------------- */
function MiniShape({ type }) {
  const s = SHAPES[type];
  if (s.kind === "circle") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="11" fill="#fff" stroke={s.stroke} strokeWidth={s.sw} />
        {s.double && <circle cx="15" cy="15" r="7.5" fill="none" stroke={s.stroke} strokeWidth="1.4" />}
      </svg>
    );
  }
  if (s.kind === "diamond") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30">
        <polygon points="15,3 27,15 15,27 3,15" fill="#fff" stroke={s.stroke} strokeWidth={s.sw} />
        {s.symbol === "x" && (
          <path d="M11,11 L19,19 M19,11 L11,19" stroke={s.stroke} strokeWidth="1.6" strokeLinecap="round" />
        )}
        {s.symbol === "plus" && (
          <path d="M15,10 V20 M10,15 H20" stroke={s.stroke} strokeWidth="1.8" strokeLinecap="round" />
        )}
        {s.symbol === "circle" && <circle cx="15" cy="15" r="5" fill="none" stroke={s.stroke} strokeWidth="1.6" />}
      </svg>
    );
  }
  return (
    <svg width="34" height="26" viewBox="0 0 34 26">
      <rect x="2" y="2" width="30" height="22" rx="5" fill="#fff" stroke={s.stroke} strokeWidth={s.sw} />
      {s.marker === "plus" && (
        <g transform="translate(17,20)">
          <rect x="-5" y="-5" width="10" height="10" fill="none" stroke={s.stroke} strokeWidth="1.2" />
          <path d="M0,-2.5 V2.5 M-2.5,0 H2.5" stroke={s.stroke} strokeWidth="1.2" />
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------
   Small icon for a connector type (line + marker preview)
--------------------------------------------------------- */
function MiniConnector({ type, variant = "light" }) {
  const t = CONNECTOR_TYPES[type];
  const dark = variant === "dark";
  const bg = dark ? "#1C2333" : "#FFFFFF";
  const line = type === "association" ? (dark ? "#C7C4B6" : "#8B8878") : dark ? "#F5F4EF" : "#1C2333";
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" style={{ flexShrink: 0 }}>
      <line
        x1="3"
        y1="8"
        x2="26"
        y2="8"
        stroke={line}
        strokeWidth="1.6"
        strokeDasharray={t.dash || undefined}
        strokeLinecap="round"
      />
      {type === "conditional" && (
        <polygon points="3,8 6.5,5 10,8 6.5,11" fill={bg} stroke={line} strokeWidth="1.3" />
      )}
      {type === "default" && <line x1="5" y1="11.5" x2="9" y2="4.5" stroke={line} strokeWidth="1.6" strokeLinecap="round" />}
      {type === "message" && <circle cx="5" cy="8" r="2.6" fill={bg} stroke={line} strokeWidth="1.3" />}
      {type !== "message" && type !== "association" && <polygon points="26,8 20.5,5.2 20.5,10.8" fill={line} />}
      {type === "message" && (
        <path d="M20.5,5 L26,8 L20.5,11" fill="none" stroke={line} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/* ---------------------------------------------------------
   Main component
--------------------------------------------------------- */
export default function BpmnBuilder() {
  const [elements, setElements] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(null); // {kind:'element'|'connection', id}
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [connectType, setConnectType] = useState("sequence");
  const [zoom, setZoom] = useState(1);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [newDrag, setNewDrag] = useState(null); // {type, x, y, startX, startY}
  const [helpOpen, setHelpOpen] = useState(false);

  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const counters = useRef({});
  const idRef = useRef(1);
  const dragRef = useRef(null); // active element drag tracking

  const nextId = () => `el-${idRef.current++}`;

  const clientToSvg = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const scaleX = VBW / rect.width;
    const scaleY = VBH / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, []);

  const addElement = useCallback((type, pt) => {
    counters.current[type] = (counters.current[type] || 0) + 1;
    const label = `${SHAPES[type].label} ${counters.current[type]}`;
    const s = SHAPES[type];
    const x = Math.min(Math.max(pt.x, s.w / 2 + 10), VBW - s.w / 2 - 10);
    const y = Math.min(Math.max(pt.y, s.h / 2 + 10), VBH - s.h / 2 - 10);
    const id = nextId();
    setElements((els) => [...els, { id, type, x, y, label }]);
    setSelected({ kind: "element", id });
  }, []);

  /* ---- palette drag-to-canvas (pointer-event based, touch friendly) ---- */
  const startPaletteDrag = (e, type) => {
    e.preventDefault();
    setNewDrag({ type, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
  };

  useEffect(() => {
    if (!newDrag) return;
    const move = (e) => setNewDrag((nd) => (nd ? { ...nd, x: e.clientX, y: e.clientY } : nd));
    const up = (e) => {
      const wrap = wrapRef.current;
      const rect = wrap.getBoundingClientRect();
      const overCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      const dist = Math.hypot(e.clientX - newDrag.startX, e.clientY - newDrag.startY);
      if (overCanvas) {
        const pt = clientToSvg(e.clientX, e.clientY);
        addElement(newDrag.type, pt);
      } else if (dist < 12) {
        // tap on palette item: drop near center of current viewport
        const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / zoom;
        const cy = (wrap.scrollTop + wrap.clientHeight / 2) / zoom;
        addElement(newDrag.type, { x: cx, y: cy });
      }
      setNewDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newDrag, zoom, clientToSvg, addElement]);

  /* ---- element move / select / connect ---- */
  const onShapePointerDown = (e, id) => {
    e.stopPropagation();
    if (connectMode) {
      if (!connectSource) {
        setConnectSource(id);
      } else if (connectSource === id) {
        setConnectSource(null);
      } else {
        setConnections((cs) => [...cs, { id: `c-${idRef.current++}`, from: connectSource, to: id, type: connectType }]);
        setConnectSource(null);
      }
      return;
    }
    const el = elements.find((x) => x.id === id);
    dragRef.current = {
      id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      elStartX: el.x,
      elStartY: el.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onShapePointerMove = (e) => {
    const d = dragRef.current;
    if (!d || d.id === undefined) return;
    const scale = VBW / svgRef.current.getBoundingClientRect().width;
    const dx = (e.clientX - d.startClientX) * scale;
    const dy = (e.clientY - d.startClientY) * scale;
    if (!d.moved && Math.hypot(dx, dy) > 3) d.moved = true;
    if (d.moved) {
      const s = SHAPES[elements.find((x) => x.id === d.id).type];
      let nx = d.elStartX + dx;
      let ny = d.elStartY + dy;
      nx = Math.min(Math.max(nx, s.w / 2 + 5), VBW - s.w / 2 - 5);
      ny = Math.min(Math.max(ny, s.h / 2 + 5), VBH - s.h / 2 - 5);
      setElements((els) => els.map((el) => (el.id === d.id ? { ...el, x: nx, y: ny } : el)));
    }
  };

  const onShapePointerUp = (e, id) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!connectMode) {
      setSelected({ kind: "element", id });
    }
  };

  const onConnectionClick = (id) => {
    if (connectMode) return;
    setSelected({ kind: "connection", id });
  };

  const onCanvasBackgroundPointerDown = () => {
    setSelected(null);
    if (connectMode) setConnectSource(null);
  };

  /* ---- delete / rename / clear ---- */
  const deleteSelected = () => {
    if (!selected) return;
    if (selected.kind === "element") {
      setElements((els) => els.filter((e) => e.id !== selected.id));
      setConnections((cs) => cs.filter((c) => c.from !== selected.id && c.to !== selected.id));
    } else {
      setConnections((cs) => cs.filter((c) => c.id !== selected.id));
    }
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") {
        setConnectSource(null);
        setConnectMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const renameSelected = (val) => {
    if (!selected || selected.kind !== "element") return;
    setElements((els) => els.map((el) => (el.id === selected.id ? { ...el, label: val } : el)));
  };

  const changeConnectionType = (id, type) => {
    setConnections((cs) => cs.map((c) => (c.id === id ? { ...c, type } : c)));
  };

  const clearAll = () => {
    setElements([]);
    setConnections([]);
    setSelected(null);
    setConnectSource(null);
    setConfirmClear(false);
    counters.current = {};
  };

  const selectedElement = selected?.kind === "element" ? elements.find((e) => e.id === selected.id) : null;
  const selectedConnection = selected?.kind === "connection" ? connections.find((c) => c.id === selected.id) : null;

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden select-none"
      style={{
        background: "#F5F4EF",
        fontFamily: "'IBM Plex Sans', sans-serif",
        color: "#1C2333",
        minHeight: "640px",
        height: "100%",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      {/* ---------- Top toolbar ---------- */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: "#E4E1D8", background: "#FFFFFF" }}
      >
        <button
          onClick={() => setPaletteOpen((v) => !v)}
          className="p-2 rounded-md hover:bg-gray-100 flex-shrink-0"
          title="Elementos"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-baseline gap-2 min-w-0 mr-auto">
          <span
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em" }}
          >
            Modelador BPMN
          </span>
          <span className="hidden sm:inline text-xs text-gray-400 truncate">construtor de fluxogramas</span>
        </div>

        <button
          onClick={() => {
            setConnectMode((v) => !v);
            setConnectSource(null);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium flex-shrink-0"
          style={{
            background: connectMode ? "#1C2333" : "#F5F4EF",
            color: connectMode ? "#fff" : "#1C2333",
            border: "1px solid " + (connectMode ? "#1C2333" : "#E4E1D8"),
          }}
          title="Conectar elementos"
        >
          <Link2 size={15} />
          <span className="hidden sm:inline">Conectar</span>
        </button>

        <button
          onClick={deleteSelected}
          disabled={!selected}
          className="p-2 rounded-md flex-shrink-0"
          style={{ opacity: selected ? 1 : 0.35, background: "#F5F4EF", border: "1px solid #E4E1D8" }}
          title="Excluir selecionado"
        >
          <Trash2 size={16} />
        </button>

        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            className="p-2 rounded-md flex-shrink-0"
            style={{ background: "#F5F4EF", border: "1px solid #E4E1D8" }}
            title="Limpar tudo"
          >
            <RotateCcw size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={clearAll} className="px-2 py-1.5 rounded-md text-xs font-medium" style={{ background: "#E0393E", color: "#fff" }}>
              Confirmar
            </button>
            <button onClick={() => setConfirmClear(false)} className="px-2 py-1.5 rounded-md text-xs" style={{ background: "#F5F4EF", border: "1px solid #E4E1D8" }}>
              Cancelar
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 flex-shrink-0 border-l pl-2" style={{ borderColor: "#E4E1D8" }}>
          <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} className="p-2 rounded-md hover:bg-gray-100">
            <ZoomOut size={15} />
          </button>
          <span className="text-xs w-9 text-center" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))} className="p-2 rounded-md hover:bg-gray-100">
            <ZoomIn size={15} />
          </button>
        </div>

        <button onClick={() => setHelpOpen((v) => !v)} className="p-2 rounded-md hover:bg-gray-100 flex-shrink-0" title="Ajuda">
          <Info size={16} />
        </button>
      </div>

      {connectMode && (
        <div className="px-3 py-2 flex-shrink-0 flex flex-col gap-1.5" style={{ background: "#1C2333" }}>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CONNECTOR_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => setConnectType(key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  background: connectType === key ? "#3B5BDB" : "rgba(255,255,255,0.08)",
                  color: "#F5F4EF",
                  border: "1px solid " + (connectType === key ? "#3B5BDB" : "rgba(255,255,255,0.18)"),
                }}
                title={CONNECTOR_TYPES[key].hint}
              >
                <MiniConnector type={key} variant="dark" />
                {CONNECTOR_TYPES[key].label}
              </button>
            ))}
          </div>
          <div className="text-[11px]" style={{ color: "#C7C4B6", fontFamily: "'IBM Plex Mono', monospace" }}>
            {connectSource
              ? "Toque no elemento de destino para concluir a conexão (Esc para cancelar)"
              : "Toque no elemento de origem para iniciar a conexão"}
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="px-4 py-3 text-xs leading-relaxed border-b flex-shrink-0" style={{ background: "#FFFDF7", borderColor: "#E4E1D8" }}>
          <b>Como usar:</b> arraste um elemento da paleta até o canvas (ou toque nele para adicioná-lo ao centro).
          Toque num elemento para selecioná-lo e editar o nome no painel à direita. Arraste um elemento para
          reposicioná-lo. Use <b>Conectar</b>, escolha o tipo de conector (sequência, condicional, padrão, mensagem
          ou associação) e ligue dois elementos. O tipo de uma conexão já criada pode ser trocado no painel de
          propriedades. Selecione um elemento ou conexão e toque em excluir (ou tecle Delete) para removê-lo.
        </div>
      )}

      {/* ---------- Body ---------- */}
      <div className="relative flex-1 min-h-0 flex">
        {/* Palette drawer */}
        {paletteOpen && (
          <div
            className="absolute sm:relative z-20 top-0 left-0 h-full w-64 flex-shrink-0 border-r overflow-y-auto"
            style={{ background: "#FFFFFF", borderColor: "#E4E1D8" }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#E4E1D8" }}>
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#6B7280" }}>
                Elementos BPMN
              </span>
              <button onClick={() => setPaletteOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>

            {PALETTE_GROUPS.map((g) => (
              <div key={g.key} className="px-3 py-3 border-b" style={{ borderColor: "#F0EEE6" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px" }}>{g.title}</div>
                <div className="text-[11px] mb-2" style={{ color: "#8B8878" }}>
                  {g.hint}
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.items.map((type) => (
                    <div
                      key={type}
                      onPointerDown={(e) => startPaletteDrag(e, type)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing"
                      style={{ border: "1px solid #E4E1D8", background: "#FBFAF6", touchAction: "none" }}
                    >
                      <MiniShape type={type} />
                      <span className="text-xs font-medium">{SHAPES[type].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="px-3 py-3 border-b" style={{ borderColor: "#F0EEE6" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "13px" }}>Conectores</div>
              <div className="text-[11px] mb-2" style={{ color: "#8B8878" }}>
                Tipos de ligação — escolha um ao ativar "Conectar"
              </div>
              <div className="flex flex-col gap-2">
                {CONNECTOR_ORDER.map((key) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <MiniConnector type={key} />
                    <span className="text-xs font-medium">{CONNECTOR_TYPES[key].label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 py-3 text-[11px] leading-relaxed" style={{ color: "#8B8878" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#2F9E44" }} /> início do
                processo
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#E0393E" }} /> fim do
                processo
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#E8890C" }} /> decisão /
                evento intermediário
              </div>
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={wrapRef} className="flex-1 min-w-0 overflow-auto relative" style={{ background: "#F5F4EF" }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VBW} ${VBH}`}
            width={VBW * zoom}
            height={VBH * zoom}
            style={{ display: "block" }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) onCanvasBackgroundPointerDown();
            }}
            onPointerMove={onShapePointerMove}
          >
            <defs>
              <pattern id="dotgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="1.2" fill="#DEDBD0" />
              </pattern>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="#1C2333" />
              </marker>
              <marker id="arrowSel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="#3B5BDB" />
              </marker>

              {/* open (unfilled) arrowhead — message flow end */}
              <marker id="arrowOpen" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M1,1 L9,5 L1,9" fill="none" stroke="#1C2333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker id="arrowOpenSel" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
                <path d="M1,1 L9,5 L1,9" fill="none" stroke="#3B5BDB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </marker>

              {/* open circle — message flow start */}
              <marker id="circle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <circle cx="5" cy="5" r="4" fill="#FFFFFF" stroke="#1C2333" strokeWidth="1.4" />
              </marker>
              <marker id="circleSel" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <circle cx="5" cy="5" r="4" fill="#FFFFFF" stroke="#3B5BDB" strokeWidth="1.4" />
              </marker>

              {/* open diamond — conditional sequence flow start */}
              <marker id="diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <polygon points="5,1 9,5 5,9 1,5" fill="#FFFFFF" stroke="#1C2333" strokeWidth="1.4" />
              </marker>
              <marker id="diamondSel" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <polygon points="5,1 9,5 5,9 1,5" fill="#FFFFFF" stroke="#3B5BDB" strokeWidth="1.4" />
              </marker>

              {/* diagonal tick — default sequence flow start */}
              <marker id="slash" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <line x1="2" y1="8" x2="8" y2="2" stroke="#1C2333" strokeWidth="1.6" strokeLinecap="round" />
              </marker>
              <marker id="slashSel" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                <line x1="2" y1="8" x2="8" y2="2" stroke="#3B5BDB" strokeWidth="1.6" strokeLinecap="round" />
              </marker>
            </defs>

            <rect x="0" y="0" width={VBW} height={VBH} fill="url(#dotgrid)" onPointerDown={onCanvasBackgroundPointerDown} />

            {/* connections */}
            {connections.map((c) => {
              const from = elements.find((e) => e.id === c.from);
              const to = elements.find((e) => e.id === c.to);
              if (!from || !to) return null;
              const p1 = getEdgePoint(from, to.x, to.y);
              const p2 = getEdgePoint(to, from.x, from.y);
              const isSel = selected?.kind === "connection" && selected.id === c.id;
              const ctype = CONNECTOR_TYPES[c.type] || CONNECTOR_TYPES.sequence;
              const baseColor = c.type === "association" ? "#8B8878" : "#1C2333";
              const strokeColor = isSel ? "#3B5BDB" : baseColor;
              const markerStart = ctype.markerStart ? `url(#${isSel ? ctype.markerStartSel : ctype.markerStart})` : undefined;
              const markerEnd = ctype.markerEnd ? `url(#${isSel ? ctype.markerEndSel : ctype.markerEnd})` : undefined;
              return (
                <g key={c.id} onPointerDown={(e) => { e.stopPropagation(); onConnectionClick(c.id); }} style={{ cursor: "pointer" }}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="18" />
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={strokeColor}
                    strokeWidth={isSel ? 2.5 : 1.8}
                    strokeDasharray={ctype.dash || undefined}
                    markerStart={markerStart}
                    markerEnd={markerEnd}
                  />
                </g>
              );
            })}

            {/* connect-mode preview from source */}
            {connectMode && connectSource && (() => {
              const src = elements.find((e) => e.id === connectSource);
              if (!src) return null;
              return <circle cx={src.x} cy={src.y} r={SHAPES[src.type].w / 2 + 6} fill="none" stroke="#3B5BDB" strokeDasharray="4 3" strokeWidth="2" />;
            })()}

            {/* elements */}
            {elements.map((el) => {
              const s = SHAPES[el.type];
              const isSel = selected?.kind === "element" && selected.id === el.id;
              const isConnectSrc = connectSource === el.id;
              const ringColor = isConnectSrc ? "#3B5BDB" : isSel ? "#3B5BDB" : "transparent";

              return (
                <g
                  key={el.id}
                  onPointerDown={(e) => onShapePointerDown(e, el.id)}
                  onPointerUp={(e) => onShapePointerUp(e, el.id)}
                  style={{ cursor: connectMode ? "crosshair" : "grab", touchAction: "none" }}
                >
                  {isSel && !connectMode && (
                    <rect
                      x={el.x - s.w / 2 - 6}
                      y={el.y - s.h / 2 - 6}
                      width={s.w + 12}
                      height={s.h + 12}
                      rx="10"
                      fill="none"
                      stroke="#3B5BDB"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                    />
                  )}

                  {s.kind === "circle" && (
                    <>
                      <circle cx={el.x} cy={el.y} r={s.w / 2} fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />
                      {s.double && <circle cx={el.x} cy={el.y} r={s.w / 2 - 5} fill="none" stroke={s.stroke} strokeWidth="1.3" />}
                    </>
                  )}

                  {s.kind === "diamond" && (
                    <>
                      <polygon
                        points={`${el.x},${el.y - s.h / 2} ${el.x + s.w / 2},${el.y} ${el.x},${el.y + s.h / 2} ${el.x - s.w / 2},${el.y}`}
                        fill={s.fill}
                        stroke={s.stroke}
                        strokeWidth={s.sw}
                      />
                      {s.symbol === "x" && (
                        <path
                          d={`M${el.x - 9},${el.y - 9} L${el.x + 9},${el.y + 9} M${el.x + 9},${el.y - 9} L${el.x - 9},${el.y + 9}`}
                          stroke={s.stroke}
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                      )}
                      {s.symbol === "plus" && (
                        <path
                          d={`M${el.x},${el.y - 11} V${el.y + 11} M${el.x - 11},${el.y} H${el.x + 11}`}
                          stroke={s.stroke}
                          strokeWidth="2.4"
                          strokeLinecap="round"
                        />
                      )}
                      {s.symbol === "circle" && <circle cx={el.x} cy={el.y} r="9" fill="none" stroke={s.stroke} strokeWidth="2.2" />}
                    </>
                  )}

                  {s.kind === "rect" && (
                    <>
                      <rect x={el.x - s.w / 2} y={el.y - s.h / 2} width={s.w} height={s.h} rx="12" fill={s.fill} stroke={s.stroke} strokeWidth={s.sw} />
                      {s.marker === "plus" && (
                        <g transform={`translate(${el.x}, ${el.y + s.h / 2 - 12})`}>
                          <rect x="-8" y="-8" width="16" height="16" rx="2" fill="none" stroke={s.stroke} strokeWidth="1.3" />
                          <path d="M0,-4 V4 M-4,0 H4" stroke={s.stroke} strokeWidth="1.3" />
                        </g>
                      )}
                    </>
                  )}

                  {/* labels */}
                  {s.kind === "rect" ? (
                    <text x={el.x} y={el.y - (wrapLines(el.label).length - 1) * 7} textAnchor="middle" fontSize="13" fontFamily="'IBM Plex Sans', sans-serif" fill="#1C2333">
                      {wrapLines(el.label, 17).map((line, i) => (
                        <tspan key={i} x={el.x} dy={i === 0 ? 0 : 15}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  ) : (
                    <text x={el.x} y={el.y + s.h / 2 + 17} textAnchor="middle" fontSize="12.5" fontFamily="'IBM Plex Sans', sans-serif" fill="#1C2333">
                      {wrapLines(el.label, 20).map((line, i) => (
                        <tspan key={i} x={el.x} dy={i === 0 ? 0 : 14}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center px-6">
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "15px", color: "#B9B6A8" }}>
                  Canvas vazio
                </div>
                <div className="text-xs mt-1" style={{ color: "#C7C4B6" }}>
                  Arraste elementos da paleta até aqui para começar o fluxo
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Properties panel */}
        {(selectedElement || selectedConnection) && (
          <div className="absolute sm:relative z-20 top-0 right-0 h-full w-64 flex-shrink-0 border-l overflow-y-auto" style={{ background: "#FFFFFF", borderColor: "#E4E1D8" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#E4E1D8" }}>
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#6B7280" }}>
                Propriedades
              </span>
              <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-gray-100">
                <X size={15} />
              </button>
            </div>

            {selectedElement && (
              <div className="p-3 flex flex-col gap-3">
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "#8B8878" }}>
                    Nome da etapa
                  </label>
                  <input
                    value={selectedElement.label}
                    onChange={(e) => renameSelected(e.target.value)}
                    className="w-full mt-1 px-2 py-1.5 rounded-md text-sm outline-none"
                    style={{ border: "1px solid #E4E1D8" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "#8B8878" }}>
                    Tipo
                  </label>
                  <div className="text-xs mt-1 px-2 py-1.5 rounded-md" style={{ background: "#F5F4EF", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {SHAPES[selectedElement.type].label}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "#8B8878" }}>
                    Posição
                  </label>
                  <div className="text-xs mt-1 px-2 py-1.5 rounded-md" style={{ background: "#F5F4EF", fontFamily: "'IBM Plex Mono', monospace" }}>
                    x:{Math.round(selectedElement.x)} y:{Math.round(selectedElement.y)}
                  </div>
                </div>
                <button onClick={deleteSelected} className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: "#FBEAEA", color: "#C92A2A" }}>
                  <Trash2 size={14} /> Excluir elemento
                </button>
              </div>
            )}

            {selectedConnection && (
              <div className="p-3 flex flex-col gap-3">
                <div className="text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6B7280" }}>
                  {CONNECTOR_TYPES[selectedConnection.type || "sequence"].label}
                </div>
                <div className="text-sm">
                  <div className="mb-1" style={{ color: "#8B8878" }}>
                    De
                  </div>
                  <div className="px-2 py-1.5 rounded-md" style={{ background: "#F5F4EF" }}>
                    {elements.find((e) => e.id === selectedConnection.from)?.label}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="mb-1" style={{ color: "#8B8878" }}>
                    Para
                  </div>
                  <div className="px-2 py-1.5 rounded-md" style={{ background: "#F5F4EF" }}>
                    {elements.find((e) => e.id === selectedConnection.to)?.label}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium" style={{ color: "#8B8878" }}>
                    Tipo de conector
                  </label>
                  <div className="flex flex-col gap-1 mt-1">
                    {CONNECTOR_ORDER.map((key) => {
                      const active = (selectedConnection.type || "sequence") === key;
                      return (
                        <button
                          key={key}
                          onClick={() => changeConnectionType(selectedConnection.id, key)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-left"
                          style={{
                            background: active ? "#EDF0FC" : "#F5F4EF",
                            border: "1px solid " + (active ? "#3B5BDB" : "#E4E1D8"),
                            color: "#1C2333",
                          }}
                          title={CONNECTOR_TYPES[key].hint}
                        >
                          <MiniConnector type={key} />
                          {CONNECTOR_TYPES[key].label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "#8B8878" }}>
                    {CONNECTOR_TYPES[selectedConnection.type || "sequence"].hint}
                  </div>
                </div>
                <button onClick={deleteSelected} className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: "#FBEAEA", color: "#C92A2A" }}>
                  <Trash2 size={14} /> Excluir conexão
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ghost preview while dragging a new element from the palette */}
      {newDrag && (
        <div
          style={{
            position: "fixed",
            left: newDrag.x,
            top: newDrag.y,
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
            zIndex: 50,
            opacity: 0.85,
          }}
        >
          <MiniShape type={newDrag.type} />
        </div>
      )}

      {/* Status bar */}
      <div
        className="flex items-center gap-4 px-3 py-1.5 text-[11px] border-t flex-shrink-0"
        style={{ borderColor: "#E4E1D8", background: "#FFFFFF", fontFamily: "'IBM Plex Mono', monospace", color: "#8B8878" }}
      >
        <span>{elements.length} elemento{elements.length === 1 ? "" : "s"}</span>
        <span>{connections.length} {connections.length === 1 ? "conexão" : "conexões"}</span>
        <span className="ml-auto">{connectMode ? "modo: conectar" : selected ? "modo: editar" : "modo: seleção"}</span>
      </div>
    </div>
  );
}
