import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Pin, X, Lock, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, LogOut, Upload, Star, Send, Pencil, Activity, LayoutGrid, FileText, Search, Terminal, GripVertical, Quote, AlignLeft, Layers, Check, AlertTriangle, RotateCcw, Music, Disc3, ChevronLeft, ChevronRight, Eye, EyeOff, Copy, Database, Network, Thermometer, Cpu, Radio, Zap, Waves, Gauge, SlidersHorizontal, Power, CircleDot, Cable, Play } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- SHARED HELPERS -------------------------------------------------------
// Deterministic pseudo-random from a string. Used for the fake process stats
// in the boot sequence so a given interest always reports the same load.
const hashPct = (str = '', min = 8, max = 94) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return min + (Math.abs(h) % Math.max(1, (max - min)));
};

const ICON_MAP = {
  Terminal, Database, Network, Thermometer, Cpu, Activity, Radio, Zap, Waves,
  Gauge, SlidersHorizontal, Power, CircleDot, Cable, Music, Disc3, Star, Layers,
};
const NODE_ICONS = Object.keys(ICON_MAP);
const RackIcon = ({ name, size = 14, className = '' }) => {
  const C = ICON_MAP[name] || CircleDot;
  return <C size={size} className={className} />;
};

const PATCH_COLORS = ['#ff5722', '#dfff00', '#0000ff', '#00ff88', '#ff2ea6', '#00d2ff'];

// --- TYPEWRITER -----------------------------------------------------------
// Reveals text over time. Long strings are typed in chunks so a 400 character
// bio does not take forty seconds to appear.
const Typewriter = ({ text = '', active = true, speed = 1, onDone, className = '', showCaret = true }) => {
  const [n, setN] = useState(active ? 0 : text.length);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!active) { setN(text.length); return; }
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(text.length);
      if (!doneRef.current) { doneRef.current = true; onDoneRef.current && onDoneRef.current(); }
      return;
    }
    setN(0);
    doneRef.current = false;
    const step = Math.max(1, Math.round(text.length / 160));
    const tick = Math.max(8, 26 / Math.max(0.25, speed));
    let i = 0;
    const id = setInterval(() => {
      i += step;
      setN(Math.min(i, text.length));
      if (i >= text.length) {
        clearInterval(id);
        if (!doneRef.current) { doneRef.current = true; onDoneRef.current && onDoneRef.current(); }
      }
    }, tick);
    return () => clearInterval(id);
  }, [text, active, speed]);

  return (
    <span className={className}>
      {text.slice(0, n)}
      {showCaret && n < text.length && <span className="boot-caret">▊</span>}
    </span>
  );
};

// --- DRAGGABLE GALLERY IMAGE COMPONENT ---
const DraggableImage = ({ item, updateImage, bringToFront, isAdmin }) => {
  const [pos, setPos] = useState({ x: item.x || 0, y: item.y || 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPos({ x: item.x || 0, y: item.y || 0 });
  }, [item.x, item.y]);

  const handlePointerDown = (e) => {
    if (!isAdmin) return;
    e.target.setPointerCapture(e.pointerId);
    setIsDragging(true);
    bringToFront(item.id);
    e.target.dataset.startX = e.clientX - pos.x;
    e.target.dataset.startY = e.clientY - pos.y;
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !isAdmin) return;
    const newX = e.clientX - parseFloat(e.target.dataset.startX);
    const newY = e.clientY - parseFloat(e.target.dataset.startY);
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isAdmin) return;
    setIsDragging(false);
    e.target.releasePointerCapture(e.pointerId);
    updateImage(item.id, { x: pos.x, y: pos.y });
  };

  return (
    <img
      src={item.image}
      alt="Gallery item"
      className={`absolute border-[3px] border-[#111] shadow-[4px_4px_0px_#111] select-none transition-transform duration-200 ${isAdmin ? 'cursor-move hover:scale-[1.02] touch-none' : ''}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: item.z || 1,
        width: item.w || 250,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      draggable={false}
    />
  );
};


// ==========================================================================
// PATCH BAY — the System tab.
// Each timeline column becomes a rack module; each node becomes a jack.
// Cables are quadratic curves that sag under their own length and sway on a
// requestAnimationFrame loop that mutates path attributes directly, so the
// idle motion never triggers a React re-render.
// ==========================================================================
const Knob = ({ value = 50, label, color = '#ff5722', editable, onChange }) => {
  const angle = -135 + (Math.max(0, Math.min(100, value)) * 2.7);
  const dragging = useRef(false);
  const startRef = useRef({ y: 0, v: 0 });

  const onDown = (e) => {
    if (!editable) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    startRef.current = { y: e.clientY, v: Number(value) || 0 };
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const delta = (startRef.current.y - e.clientY) * 0.6;
    onChange && onChange(Math.round(Math.max(0, Math.min(100, startRef.current.v + delta))));
  };
  const onUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        role={editable ? 'slider' : undefined}
        aria-label={label}
        aria-valuenow={editable ? value : undefined}
        className={`relative w-9 h-9 rounded-full bg-[#1a1a1a] border-[2px] border-[#3a3a3a] shadow-[inset_0_2px_4px_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.6)] ${editable ? 'cursor-ns-resize touch-none hover:border-[#666]' : ''} transition-colors`}
        style={{ transform: `rotate(${angle}deg)`, transition: dragging.current ? 'none' : 'transform 520ms var(--ease-out-expo)' }}
      >
        <span className="absolute left-1/2 top-1 -translate-x-1/2 w-[2px] h-3 rounded-full" style={{ background: color }} />
      </div>
      <span className="font-mono text-[7px] uppercase tracking-[0.18em] text-white/40 leading-none text-center max-w-[52px] truncate">{label}</span>
    </div>
  );
};

const VuMeter = ({ label, value, unit, index = 0, color = '#dfff00' }) => {
  // Values arrive as free text ("100/67", "36.8"). Take the first number.
  const num = parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ' ').trim().split(/\s+/)[0]);
  const pct = Number.isFinite(num) ? Math.max(4, Math.min(100, num > 100 ? (num % 100) : num)) : hashPct(String(label), 30, 88);
  const segs = 14;
  const lit = Math.round((pct / 100) * segs);

  return (
    <div className="flex-1 min-w-[132px] bg-[#141414] border-[2px] border-[#2e2e2e] px-3 py-2.5 anim-rise stagger-child" style={{ '--d': index }}>
      <div className="flex justify-between items-baseline mb-2 gap-2">
        <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/45 truncate">{label}</span>
        <span className="font-mono text-[11px] font-bold text-white whitespace-nowrap">{value}<span className="text-white/40 text-[8px] ml-0.5">{unit}</span></span>
      </div>
      <div className="flex gap-[2px] h-3 items-end">
        {Array.from({ length: segs }).map((_, i) => {
          const on = i < lit;
          const segColor = i > segs - 3 ? '#ff2e2e' : i > segs - 6 ? '#ffb300' : color;
          return (
            <span
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: `${45 + (i / segs) * 55}%`,
                background: on ? segColor : '#262626',
                boxShadow: on ? `0 0 6px ${segColor}88` : 'none',
                opacity: on ? 1 : 1,
                animation: on ? `vuSettle 620ms var(--ease-out-expo) both` : 'none',
                animationDelay: `${index * 90 + i * 26}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

const PatchBay = ({ data, isAdmin, onChange, onToast }) => {
  const rackRef = useRef(null);
  const jackEls = useRef({});
  const pathEls = useRef({});
  const [ports, setPorts] = useState({});
  const [pending, setPending] = useState(null);   // { from, x, y } while dragging a new cable
  const [hoverJack, setHoverJack] = useState(null);

  const modules = data?.timeline || [];
  const cables = data?.cables || [];
  const stats = data?.stats || [];
  const sagBase = Number(data?.cableSag ?? 34);

  const allNodes = useMemo(
    () => modules.flatMap(m => (m.nodes || []).map(n => ({ ...n, moduleId: m.id, moduleName: m.period }))),
    [modules]
  );

  // --- measure every jack centre relative to the rack -------------------
  const measure = useCallback(() => {
    const rack = rackRef.current;
    if (!rack) return;
    const base = rack.getBoundingClientRect();
    const next = {};
    Object.entries(jackEls.current).forEach(([id, el]) => {
      if (!el || !el.isConnected) { delete jackEls.current[id]; return; }
      const r = el.getBoundingClientRect();
      next[id] = { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
    });
    setPorts(next);
  }, []);

  useLayoutEffect(() => { measure(); }, [measure, modules, cables.length]);
  useEffect(() => {
    const rack = rackRef.current;
    if (!rack) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(rack);
    window.addEventListener('resize', measure);
    const t = setTimeout(measure, 400); // after entrance animations settle
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); clearTimeout(t); };
  }, [measure]);

  const buildPath = (a, b, extraSag = 0) => {
    if (!a || !b) return '';
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const droop = Math.min(190, sagBase + len * 0.28) + extraSag;
    return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + droop} ${b.x} ${b.y}`;
  };

  // --- idle sway, written straight to the DOM ---------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf;
    const loop = (t) => {
      cables.forEach((c, i) => {
        const el = pathEls.current[c.id];
        const a = ports[c.from], b = ports[c.to];
        if (!el || !a || !b) return;
        el.setAttribute('d', buildPath(a, b, Math.sin(t / 900 + i * 1.3) * 4));
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cables, ports, sagBase]);

  // --- patching interactions (admin only) -------------------------------
  const beginPatch = (nodeId, e) => {
    if (!isAdmin) return;
    e.preventDefault();
    const base = rackRef.current.getBoundingClientRect();
    setPending({ from: nodeId, x: e.clientX - base.left, y: e.clientY - base.top });
  };
  const movePatch = (e) => {
    if (!pending) return;
    const base = rackRef.current.getBoundingClientRect();
    setPending(p => ({ ...p, x: e.clientX - base.left, y: e.clientY - base.top }));
  };
  const endPatch = (nodeId) => {
    if (!pending) return;
    if (nodeId && nodeId !== pending.from) {
      const exists = cables.some(c =>
        (c.from === pending.from && c.to === nodeId) || (c.from === nodeId && c.to === pending.from));
      if (exists) {
        onToast && onToast('Those jacks are already patched.', 'error');
      } else {
        onChange({
          ...data,
          cables: [...cables, {
            id: `c${Date.now()}`,
            from: pending.from,
            to: nodeId,
            color: PATCH_COLORS[cables.length % PATCH_COLORS.length],
          }],
        });
        onToast && onToast('Cable patched.', 'success');
      }
    }
    setPending(null);
  };

  const removeCable = (id) => {
    onChange({ ...data, cables: cables.filter(c => c.id !== id) });
    onToast && onToast('Cable pulled.', 'info');
  };

  const setKnob = (moduleId, knobId, value) => {
    onChange({
      ...data,
      timeline: modules.map(m => m.id !== moduleId ? m : {
        ...m, knobs: (m.knobs || []).map(k => k.id === knobId ? { ...k, value } : k),
      }),
    });
  };

  return (
    <div
      ref={rackRef}
      onPointerMove={movePatch}
      onPointerUp={() => endPatch(null)}
      onPointerLeave={() => setPending(null)}
      className="relative flex-1 overflow-auto hide-scrollbar p-5 md:p-8"
      style={{
        background: '#0d0d0d',
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {/* ---------- VU METER STRIP ---------- */}
      <div className="flex flex-wrap gap-3 mb-6">
        {stats.length === 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30 py-4">No meters configured</p>
        ) : stats.map((st, i) => (
          <VuMeter key={st.id ?? i} index={i} label={st.label} value={st.value} unit={st.unit} color={data?.meterColor || '#dfff00'} />
        ))}
      </div>

      {/* ---------- CABLE LAYER ---------- */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="cableShadow" x="-30%" y="-30%" width="160%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.7" />
          </filter>
        </defs>
        {cables.map((c) => {
          const a = ports[c.from], b = ports[c.to];
          if (!a || !b) return null;
          return (
            <g key={c.id} filter="url(#cableShadow)">
              {/* fat dark casing */}
              <path d={buildPath(a, b)} fill="none" stroke="#000" strokeWidth="9" strokeLinecap="round" opacity="0.85" />
              {/* coloured jacket */}
              <path
                ref={el => { pathEls.current[c.id] = el; }}
                d={buildPath(a, b)}
                fill="none"
                stroke={c.color || '#ff5722'}
                strokeWidth="5"
                strokeLinecap="round"
                className="patch-cable"
                style={{ pointerEvents: isAdmin ? 'stroke' : 'none', cursor: isAdmin ? 'pointer' : 'default' }}
                onClick={() => isAdmin && removeCable(c.id)}
              >
                <title>{isAdmin ? 'Click to pull this cable' : ''}</title>
              </path>
              {/* specular highlight so the cable reads as rubber */}
              <path d={buildPath(a, b)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" pointerEvents="none" />
            </g>
          );
        })}

        {/* ghost cable while dragging a new patch */}
        {pending && ports[pending.from] && (
          <path
            d={buildPath(ports[pending.from], { x: pending.x, y: pending.y })}
            fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" opacity="0.8"
          />
        )}
      </svg>

      {/* ---------- MODULE RACK ---------- */}
      <div className="relative z-20 flex gap-4 md:gap-5 min-w-min pb-4">
        {modules.length === 0 && (
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/35 py-12">Rack is empty — add a module in Admin &gt; System.</p>
        )}
        {modules.map((mod, mi) => {
          const color = mod.color || PATCH_COLORS[mi % PATCH_COLORS.length];
          const knobs = mod.knobs || [];
          return (
            <div
              key={mod.id}
              style={{ '--d': mi }}
              className="w-[224px] md:w-[248px] shrink-0 border-[2px] border-[#2e2e2e] bg-[#161616] flex flex-col anim-rise stagger-child"
            >
              {/* rack ears with screws */}
              <div className="flex items-center justify-between px-2 py-2 border-b-[2px] border-[#2e2e2e] bg-[#101010]">
                <span className="w-2 h-2 rounded-full bg-[#3a3a3a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" />
                <div className="text-center min-w-0 px-1">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] truncate" style={{ color }}>{mod.period}</p>
                  <p className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/35 truncate">{mod.subtitle}</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#3a3a3a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" />
              </div>

              {/* status LEDs */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#242424]">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 7px ${color}`,
                      animation: 'ledBlink 2.6s ease-in-out infinite',
                      animationDelay: `${mi * 220 + i * 340}ms`,
                    }}
                  />
                ))}
                <span className="ml-auto font-mono text-[7px] uppercase tracking-[0.22em] text-white/30">{String(mi + 1).padStart(2, '0')}</span>
              </div>

              {/* knobs */}
              {knobs.length > 0 && (
                <div className="flex justify-around gap-2 px-3 py-4 border-b border-[#242424] bg-[#131313]">
                  {knobs.map(k => (
                    <Knob key={k.id} value={k.value} label={k.label} color={color} editable={isAdmin}
                          onChange={(v) => setKnob(mod.id, k.id, v)} />
                  ))}
                </div>
              )}

              {/* jacks */}
              <div className="p-3 flex flex-col gap-2.5 flex-1">
                {(mod.nodes || []).map(node => {
                  const patched = cables.some(c => c.from === node.id || c.to === node.id);
                  const isHot = hoverJack === node.id || pending?.from === node.id;
                  return (
                    <div key={node.id} className="flex items-center gap-2.5 group">
                      <button
                        type="button"
                        ref={el => { jackEls.current[node.id] = el; }}
                        onPointerDown={(e) => beginPatch(node.id, e)}
                        onPointerUp={(e) => { e.stopPropagation(); endPatch(node.id); }}
                        onPointerEnter={() => setHoverJack(node.id)}
                        onPointerLeave={() => setHoverJack(null)}
                        title={isAdmin ? 'Drag to another jack to patch' : node.title}
                        aria-label={`Jack ${node.title}`}
                        className={`relative w-8 h-8 shrink-0 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 ${isAdmin ? 'cursor-crosshair touch-none' : 'cursor-default'}`}
                        style={{
                          borderColor: isHot ? color : '#3a3a3a',
                          background: 'radial-gradient(circle at 50% 35%, #2a2a2a 0%, #0a0a0a 70%)',
                          boxShadow: isHot ? `0 0 0 3px ${color}33` : 'inset 0 2px 4px rgba(0,0,0,0.9)',
                          transform: isHot ? 'scale(1.1)' : 'none',
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{
                            background: patched ? color : '#0a0a0a',
                            boxShadow: patched ? `0 0 8px ${color}` : 'inset 0 1px 3px rgba(0,0,0,0.9)',
                          }}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/75 truncate flex items-center gap-1.5">
                          <RackIcon name={node.icon} size={10} className="shrink-0 opacity-60" />
                          {node.title}
                        </p>
                        {(node.mainValue || node.value) && (
                          <p className="font-mono text-[8px] text-white/35 truncate">{node.mainValue || node.value}{node.subValue ? ` · ${node.subValue}` : ''}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(mod.nodes || []).length === 0 && (
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/25 py-4 text-center">No jacks</p>
                )}
              </div>

              {/* vent slots at the bottom of the panel */}
              <div className="h-4 border-t border-[#242424] flex items-center justify-center gap-[3px] bg-[#101010]">
                {Array.from({ length: 12 }).map((_, i) => <span key={i} className="w-[2px] h-1.5 bg-[#232323]" />)}
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <div className="sticky bottom-0 mt-4 z-40 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50 bg-[#0d0d0d]/90 backdrop-blur-sm border-[2px] border-[#2e2e2e] px-4 py-2.5 inline-flex items-center gap-3 flex-wrap">
          <Cable size={13} style={{ color: '#dfff00' }} />
          <span>Drag jack → jack to patch</span>
          <span className="text-white/20">·</span>
          <span>Click a cable to pull it</span>
          <span className="text-white/20">·</span>
          <span>Drag a knob vertically</span>
        </div>
      )}
    </div>
  );
};

// --- DEFAULT DATA ---
/* ============================================================
   STICKER — one decal on the galleria lightbox.
   Shared by the public overlay and the admin drag-preview so what
   you arrange in the panel is exactly what visitors get.
   ============================================================ */
const Sticker = ({ s, accent, ink, index = 0, speed = 1, draggable = false, onDrag, live = true }) => {
  const dragState = useRef(null);

  const down = (e) => {
    if (!draggable) return;
    e.preventDefault();
    e.stopPropagation();
    const host = e.currentTarget.parentElement;
    const box = host.getBoundingClientRect();
    dragState.current = { box };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const move = (e) => {
    if (!dragState.current) return;
    const { box } = dragState.current;
    const x = Math.min(100, Math.max(0, ((e.clientX - box.left) / box.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - box.top) / box.height) * 100));
    onDrag?.({ x: Math.round(x), y: Math.round(y) });
  };
  const up = (e) => { dragState.current = null; try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {} };

  const size = Number(s.size) || 24;
  const base = {
    position: 'absolute',
    left: `${s.x}%`,
    top: `${s.y}%`,
    transform: `translate(-50%, -50%) rotate(${s.rot || 0}deg)`,
    fontSize: `${size}px`,
    lineHeight: 1,
    whiteSpace: 'pre',
    cursor: draggable ? 'grab' : 'default',
    touchAction: 'none',
    userSelect: 'none',
    zIndex: 20 + index,
    ...(live ? { animationDelay: `${(160 + index * 90) / (speed || 1)}ms` } : {})
  };
  const anim = live ? 'sticker-pop' : '';
  const color = s.color || accent;

  const shell = (inner, extra = {}) => (
    <div className={`${anim}`} style={{ ...base, ...extra }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {inner}
    </div>
  );

  switch (s.style) {
    case 'graffiti':
      return shell(
        <span className="font-serif italic font-bold" style={{
          color, WebkitTextStroke: `${Math.max(2, size / 14)}px ${ink}`,
          paintOrder: 'stroke fill', display: 'inline-block',
          filter: `drop-shadow(4px 5px 0 ${ink})`
        }}>{s.text}</span>
      );
    case 'scribble':
      return shell(
        <span className="font-serif italic" style={{
          color, WebkitTextStroke: `${Math.max(1.5, size / 18)}px ${ink}`,
          paintOrder: 'stroke fill', letterSpacing: '-0.04em',
          filter: `drop-shadow(2px 3px 0 ${ink})`
        }}>{s.text}</span>
      );
    case 'tag':
      return shell(
        <span className="font-mono font-bold uppercase tracking-[0.18em] px-2 py-1 inline-block"
              style={{ background: color, color: ink, border: `2px solid ${ink}`, boxShadow: `3px 3px 0 ${ink}`, transform: 'skewX(-8deg)' }}>
          {s.text}
        </span>
      );
    case 'chip':
      return shell(
        <span className="font-mono font-bold uppercase tracking-[0.25em] px-3 py-1.5 inline-flex items-center gap-2 rounded-full"
              style={{ background: ink, color, border: `2px solid ${color}` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, animation: 'softPulse 1.6s ease-in-out infinite' }} />
          {s.text}
        </span>
      );
    case 'bubble':
      return shell(
        <span className="font-sans font-semibold px-4 py-2 inline-block rounded-full"
              style={{ background: color, color: ink, border: `2px solid ${ink}`, boxShadow: `4px 4px 0 ${ink}` }}>
          {s.text}
        </span>
      );
    case 'star':
      return shell(
        <span className="font-mono font-bold inline-flex items-center justify-center"
              style={{
                background: ink, color, width: `${size * 3.2}px`, height: `${size * 3.2}px`,
                clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
                fontSize: `${size * 0.7}px`, textAlign: 'center'
              }}>
          {s.text}
        </span>
      );
    case 'outline':
      return shell(
        <span className="font-sans font-black uppercase tracking-tighter inline-block"
              style={{ color: 'transparent', WebkitTextStroke: `${Math.max(1.5, size / 16)}px ${color}` }}>
          {s.text}
        </span>
      );
    case 'marquee':
      return shell(
        <span className="font-mono font-bold uppercase tracking-[0.3em] px-3 py-1.5 inline-block overflow-hidden"
              style={{ background: ink, color, border: `2px solid ${color}`, maxWidth: '46vw' }}>
          <span className="inline-block" style={{ animation: 'tickerSlide 9s linear infinite' }}>{s.text}&nbsp;&nbsp;{s.text}</span>
        </span>
      );
    default:
      return shell(<span className="font-mono" style={{ color }}>{s.text}</span>);
  }
};

/* ============================================================
   GALLERIA LIGHTBOX
   Photo goes duotone, decals swarm in on a stagger, HUD chrome
   snaps to the corners. All of it driven by lightboxConfig.
   ============================================================ */
const GalleriaLightbox = ({ payload, cfg, onClose, onPrev, onNext, total }) => {
  if (!payload) return null;
  const { item, index } = payload;
  const accent = cfg.accent || '#c6ff2e';
  const ink = cfg.ink || '#0d0d0d';
  const speed = Number(cfg.popSpeed) || 1;
  const fill = (v = '') => String(v).replace('%N%', String(index + 1).padStart(3, '0')).replace('%DATE%', item.date || '—');

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 md:p-8"
         style={{ background: `${ink}f2`, animation: 'backdropIn 260ms ease-out both' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Corner rules */}
      <div className="pointer-events-none absolute inset-4 md:inset-6 z-[95]">
        {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']].map(([pos, br], i) => (
          <span key={i} className={`absolute w-10 h-10 ${pos} ${br} lb-corner`} style={{ borderColor: accent, animationDelay: `${i * 70}ms` }} />
        ))}
      </div>

      <div className="relative w-full max-w-[1100px] max-h-[88vh] aspect-[16/9] overflow-hidden"
           style={{ animation: 'lbFrameIn 620ms var(--ease-out-expo) both', border: `2px solid ${ink}`, boxShadow: `14px 14px 0 ${accent}` }}>

        {/* --- PHOTO + DUOTONE STACK --- */}
        <div className="absolute inset-0" style={{ background: accent }}>
          <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover"
               style={{ filter: cfg.duotone ? 'grayscale(1) contrast(1.15) brightness(1.05)' : 'none', animation: 'lbPhotoIn 900ms var(--ease-out-expo) both' }} />
          {cfg.duotone && <div className="absolute inset-0" style={{ background: accent, mixBlendMode: 'multiply' }} />}
          {cfg.duotone && <div className="absolute inset-0" style={{ background: ink, mixBlendMode: 'lighten', opacity: 0.12 }} />}
          {cfg.grain && <div className="absolute inset-0 lb-grain pointer-events-none" />}
          {cfg.scanlines && <div className="absolute inset-0 crt-scanlines pointer-events-none" />}
        </div>

        {/* --- SWEEP WIPE ON OPEN --- */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: accent, animation: 'lbWipe 760ms var(--ease-mech) both' }} />

        {/* --- DECALS --- */}
        <div className="absolute inset-0 pointer-events-none">
          {(cfg.stickers || []).map((s, i) => (
            <Sticker key={s.id} s={s} accent={accent} ink={ink} index={i} speed={speed} />
          ))}
        </div>

        {/* --- CORNER TAG --- */}
        {cfg.cornerTag && (
          <div className="absolute top-4 right-4 text-right font-sans font-black uppercase leading-[0.85] text-2xl md:text-4xl tracking-tighter sticker-pop"
               style={{ color: ink, animationDelay: `${120 / speed}ms`, textShadow: `2px 2px 0 ${accent}` }}>
            {cfg.cornerTag.split(' ').map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}

        {/* --- FRAME COUNTER --- */}
        <div className="absolute top-4 left-4 flex items-center gap-2 sticker-pop" style={{ animationDelay: `${90 / speed}ms` }}>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] px-2 py-1" style={{ background: ink, color: accent }}>
            {cfg.frameLabel} {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          {item.date && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-1" style={{ background: accent, color: ink, border: `2px solid ${ink}` }}>{item.date}</span>
          )}
        </div>

        {/* --- HUD PANEL (bottom right) --- */}
        {cfg.showHud && (
          <div className="absolute bottom-4 right-4 w-[210px] rounded-xl overflow-hidden sticker-pop"
               style={{ background: ink, border: `2px solid ${accent}`, animationDelay: `${420 / speed}ms` }}>
            {[cfg.hudTitle, cfg.hudSub].filter(Boolean).map((row, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
                   style={{ color: accent, borderTop: i ? `1px solid ${accent}55` : 'none' }}>
                <span>{row}</span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px]" style={{ border: `1px solid ${accent}` }}>{i ? '▸' : '◉'}</span>
              </div>
            ))}
          </div>
        )}

        {/* --- META CARD (bottom left) --- */}
        {cfg.showBadgeCard && (
          <div className="absolute bottom-4 left-4 p-3 sticker-pop"
               style={{ background: accent, border: `2px solid ${ink}`, boxShadow: `5px 5px 0 ${ink}`, animationDelay: `${340 / speed}ms` }}>
            <div className="font-serif italic text-2xl leading-none mb-2" style={{ color: ink }}>{cfg.badgeCardTitle}</div>
            <div className="flex gap-3">
              <div className="font-sans font-black text-3xl leading-[0.8]" style={{ color: ink }}>
                {String(cfg.badgeCardYear || '').slice(0, 2)}<br />{String(cfg.badgeCardYear || '').slice(2)}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] space-y-0.5" style={{ color: ink }}>
                {(cfg.metaRows || []).map(m => (
                  <div key={m.id} className="flex gap-2"><span className="opacity-60">{m.label}</span><span className="font-bold">{fill(m.value)}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TICKER --- */}
        {cfg.showTicker && (
          <div className="absolute left-0 right-0 bottom-0 overflow-hidden py-1" style={{ background: ink, animation: 'lbBarIn 500ms var(--ease-out-expo) both', animationDelay: `${520 / speed}ms` }}>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.35em] whitespace-nowrap" style={{ color: accent, animation: 'tickerSlide 18s linear infinite' }}>
              {Array.from({ length: 6 }).map((_, i) => <span key={i}>{cfg.tickerText} </span>)}
            </div>
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <button onClick={onClose} aria-label="Close"
              className="absolute top-6 right-6 z-[96] p-3 slide-press"
              style={{ background: accent, color: ink, border: `2px solid ${ink}` }}><X size={22} /></button>
      {total > 1 && (
        <>
          <button onClick={onPrev} aria-label="Previous" className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-[96] p-3 slide-press"
                  style={{ background: ink, color: accent, border: `2px solid ${accent}` }}><ChevronLeft size={24} /></button>
          <button onClick={onNext} aria-label="Next" className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-[96] p-3 slide-press"
                  style={{ background: ink, color: accent, border: `2px solid ${accent}` }}><ChevronRight size={24} /></button>
        </>
      )}
    </div>
  );
};

/* ============================================================
   POEM DECK — sleeve-back patch diagram. Slot field on the left
   wires into a highlighted index on the right; each highlighted
   row is a poem.
   ============================================================ */
const PoemDeck = ({ deck, poems, onOpen }) => {
  const fg = deck.fg || '#e8e8e8';
  const lineCol = deck.line || '#6b6b6b';
  const hi = deck.highlight || '#ffffff';
  const hiInk = deck.highlightInk || '#0a0a0a';
  const slotCount = Math.max(1, Math.min(30, Number(deck.slotCount) || 14));

  // Slot chips: deterministic scatter down the left third.
  const slots = useMemo(() => Array.from({ length: slotCount }).map((_, i) => ({
    id: i,
    label: `${deck.slotPrefix || 'SLOT_'}${String(i + 1).padStart(2, '0')}`,
    x: 2 + seededRand(i, 1) * 26,
    y: 14 + (i / slotCount) * 68 + (seededRand(i, 2) - 0.5) * 7
  })), [slotCount, deck.slotPrefix]);

  const waves = useMemo(() => Array.from({ length: Math.max(1, Number(deck.waveRows) || 4) }).map((_, r) =>
    Array.from({ length: 70 }).map((_, c) => 12 + seededRand(r * 100 + c, 3) * 88)
  ), [deck.waveRows]);

  const rowY = (i) => (poems.length ? (100 / poems.length) * (i + 0.5) : 50);

  return (
    <div className="w-full relative overflow-hidden border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise"
         style={{ background: deck.bg || '#0a0a0a', color: fg }}>

      {/* crop marks */}
      {deck.showCropMarks && [['top-6 left-6','border-t border-l'],['top-6 right-6','border-t border-r'],['bottom-6 left-6','border-b border-l'],['bottom-6 right-6','border-b border-r']].map(([p, b], i) => (
        <span key={i} className={`absolute w-6 h-6 ${p} ${b} pointer-events-none`} style={{ borderColor: lineCol }} />
      ))}

      <div className="p-6 md:p-12">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-8">
          <div>
            <h3 className="font-serif text-3xl md:text-4xl" style={{ color: fg }}>{deck.heading}</h3>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] mt-1" style={{ color: lineCol }}>{deck.kicker}</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] px-3 py-1" style={{ border: `1px solid ${lineCol}`, color: lineCol }}>
            {poems.length} verses
          </span>
        </div>

        <div className="relative min-h-[200px] md:min-h-[560px]">
          {/* ---------- CABLE LAYER ---------- */}
          {deck.showCables && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {poems.map((p, i) => {
                const s = slots[i % slots.length];
                const s2 = slots[(i * 3 + 5) % slots.length];
                const ty = rowY(i);
                return (
                  <g key={p.id}>
                    <polyline points={`${s.x + 9},${s.y} ${34 + (i % 4) * 2},${s.y} ${41},${ty} ${44},${ty}`}
                              fill="none" stroke={lineCol} strokeWidth="0.18" vectorEffect="non-scaling-stroke"
                              className={deck.animate ? 'deck-cable' : ''} style={{ animationDelay: `${i * 60}ms` }} />
                    {i % 3 === 0 && (
                      <polyline points={`${s2.x + 9},${s2.y} ${30},${(s2.y + ty) / 2} ${44},${ty}`}
                                fill="none" stroke={lineCol} strokeWidth="0.12" opacity="0.55" vectorEffect="non-scaling-stroke"
                                className={deck.animate ? 'deck-cable' : ''} style={{ animationDelay: `${i * 60 + 120}ms` }} />
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {/* ---------- SLOT FIELD ---------- */}
          <div className="absolute inset-0 hidden md:block pointer-events-none">
            {slots.map((s, i) => (
              <div key={s.id} className="absolute flex items-center gap-1.5 anim-fade stagger-child"
                   style={{ left: `${s.x}%`, top: `${s.y}%`, '--d': i, transform: 'translateY(-50%)' }}>
                <span className="flex items-center gap-1 px-1 py-[3px]" style={{ border: `1px solid ${lineCol}` }}>
                  <span className="block w-3 h-[7px]" style={{ background: fg }} />
                  <span className="block w-[7px] h-[7px]" style={{ border: `1px solid ${lineCol}` }} />
                </span>
                <span className="font-mono text-[7px] tracking-[0.15em]" style={{ color: lineCol }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* ---------- WAVEFORM / MODULE BOX ---------- */}
          {deck.showWaveform && (
            <div className="absolute hidden md:block" style={{ left: '18%', top: '2%', width: '24%' }}>
              <p className="font-mono text-[8px] tracking-[0.2em] mb-1" style={{ color: lineCol }}>{deck.moduleLabel}</p>
              <div className="p-1" style={{ border: `1px solid ${lineCol}` }}>
                {waves.map((row, r) => (
                  <div key={r} className="mb-1 last:mb-0">
                    <div className="flex items-end gap-[1px] h-7 overflow-hidden">
                      {row.map((h, c) => <span key={c} className="flex-1" style={{ height: `${h}%`, background: fg, opacity: 0.85 }} />)}
                    </div>
                    <p className="font-mono text-[6px] tracking-[0.2em] mt-[1px]" style={{ color: lineCol }}>
                      {(deck.passLabels || [])[r] || `PASS/${r}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- AVERAGE BOX ---------- */}
          <div className="absolute hidden md:block px-2 py-6" style={{ left: '17%', top: '58%', width: '20%', border: `1px solid ${lineCol}` }}>
            <p className="font-mono text-[7px] tracking-[0.2em]" style={{ color: lineCol }}>{deck.averageLabel}</p>
            <p className="font-mono text-[7px] tracking-[0.2em] mt-8" style={{ color: lineCol }}>{deck.totalLabel}</p>
          </div>

          {/* ---------- TRACKS LABEL ---------- */}
          <div className="hidden md:block absolute font-mono text-[11px] tracking-[0.3em]" style={{ left: '40%', top: '20%', color: fg }}>
            {deck.tracksLabel}
          </div>

          {/* ---------- THE INDEX (each row = a poem) ---------- */}
          <div className="md:absolute md:inset-y-0 md:left-[44%] md:right-0 flex flex-col justify-center gap-[6px] md:gap-0">
            {poems.length === 0 && (
              <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: lineCol }}>No verses indexed.</p>
            )}
            {poems.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 md:h-0 md:flex-1 anim-fade stagger-child" style={{ '--d': i }}>
                <span className="font-mono text-[10px] md:text-[11px] tabular-nums shrink-0" style={{ color: fg }}>
                  {String(i + 1).padStart(2, '0')}.
                </span>
                <span className="hidden md:block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: fg }} />
                <button onClick={() => onOpen(p)}
                        className="deck-row group text-left font-mono text-[11px] md:text-[12px] px-2 py-[3px] tracking-tight truncate"
                        style={{ background: hi, color: hiInk, maxWidth: '100%' }}>
                  {p.title}
                  <span className="opacity-0 group-hover:opacity-60 transition-opacity ml-2 text-[9px]">↗ OPEN</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="mt-10 pt-6 flex flex-col md:flex-row gap-6 md:items-end justify-between" style={{ borderTop: `1px solid ${lineCol}33` }}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: fg }} />
            <span className="w-2 h-2" style={{ background: fg }} />
            <span className="w-2 h-2" style={{ background: fg }} />
          </div>
          <p className="font-mono text-[8px] leading-relaxed whitespace-pre-line tracking-[0.15em]" style={{ color: lineCol }}>{deck.footerLeft}</p>
          <p className="font-mono text-[8px] leading-relaxed whitespace-pre-line tracking-[0.15em]" style={{ color: lineCol }}>{deck.footerMid}</p>
          {deck.showBarcode && (
            <div className="flex items-end gap-[2px] h-8">
              {Array.from({ length: 34 }).map((_, i) => (
                <span key={i} style={{ width: seededRand(i, 9) > 0.6 ? 3 : 1.5, height: '100%', background: fg }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   POEM OVERLAY — staggered slabs across a full-bleed image.
   Offsets are seeded-random per line (re-rollable) or pinned per
   line from the admin panel.
   ============================================================ */
const PoemOverlay = ({ poem, shuffle, onClose, onShuffle }) => {
  if (!poem) return null;
  const accent = poem.accent || '#ffffff';
  const ink = poem.ink || '#111111';
  const lines = poem.lines || [];

  const offsetFor = (line, i) => {
    if (!poem.randomStagger) return Number(line.offset ?? 30);
    return Math.round(12 + seededRand((Number(poem.seed) || 0) + shuffle * 17, i) * 48);
  };

  // Decorative empty slabs above/below the verse, like the reference sheet.
  const slabs = (key, n) => Array.from({ length: n }).map((_, i) => ({
    off: Math.round(18 + seededRand((Number(poem.seed) || 0) + key, i) * 46),
    w: Math.round(14 + seededRand((Number(poem.seed) || 0) + key + 5, i) * 22)
  }));

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden"
         style={{ animation: 'backdropIn 240ms ease-out both', background: poem.image ? ink : accent }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      {/* BACKDROP IMAGE */}
      {poem.image && (
        <img src={poem.image} alt="" className="absolute inset-0 w-full h-full object-cover"
             style={{ animation: 'poemImgIn 1400ms var(--ease-out-expo) both' }} />
      )}
      <div className="absolute inset-0 pointer-events-none" style={{ background: ink, opacity: (Number(poem.imageDim) || 0) / 100 }} />

      {/* TITLE BLOCK */}
      <div className="absolute top-6 right-6 md:top-10 md:right-12 text-right z-20 max-w-[70vw]">
        {poem.subtitle && (
          <p className="font-sans font-bold uppercase tracking-[0.05em] text-sm md:text-2xl" style={{ color: ink, animation: 'poemSlabIn 620ms var(--ease-out-expo) both' }}>
            {poem.subtitle}
          </p>
        )}
        <h2 className="font-sans font-black uppercase leading-[0.85] text-5xl md:text-8xl tracking-tighter"
            style={{ color: ink, animation: 'poemSlabIn 760ms var(--ease-out-expo) both', animationDelay: '90ms' }}>
          {poem.bigTitle || poem.title}
        </h2>
      </div>

      {/* THE STAGGERED STACK */}
      <div className="absolute inset-0 flex flex-col justify-center gap-[2px] md:gap-[3px] py-16 overflow-y-auto hide-scrollbar">
        {slabs(101, 3).map((s, i) => (
          <div key={`t${i}`} className="h-5 md:h-8 shrink-0"
               style={{ marginLeft: `${s.off}%`, width: `${s.w}%`, background: accent, animation: 'poemSlabIn 620ms var(--ease-out-expo) both', animationDelay: `${i * 70}ms` }} />
        ))}

        {lines.map((l, i) => (
          <div key={l.id || i} className="shrink-0" style={{ marginLeft: `${offsetFor(l, i)}%` }}>
            <div className="inline-flex items-baseline gap-4 md:gap-6 px-4 md:px-7 py-2 md:py-3 max-w-[90vw]"
                 style={{ background: accent, color: ink, animation: 'poemSlabIn 700ms var(--ease-out-expo) both', animationDelay: `${240 + i * 110}ms` }}>
              {l.tag && <span className="font-sans font-semibold text-xs md:text-base tabular-nums shrink-0 opacity-90">{l.tag}</span>}
              <span className="font-sans font-semibold uppercase tracking-[0.02em] text-xs md:text-base">{l.text}</span>
            </div>
          </div>
        ))}

        {slabs(202, 3).map((s, i) => (
          <div key={`b${i}`} className="h-5 md:h-8 shrink-0"
               style={{ marginLeft: `${s.off}%`, width: `${s.w}%`, background: accent, animation: 'poemSlabIn 620ms var(--ease-out-expo) both', animationDelay: `${420 + lines.length * 110 + i * 70}ms` }} />
        ))}
      </div>

      {/* FOOTER */}
      <div className="absolute bottom-6 right-6 md:bottom-10 md:right-12 text-right z-20">
        <p className="font-sans font-black uppercase tracking-tight text-sm md:text-xl" style={{ color: ink }}>{poem.title}</p>
        <p className="font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] mt-1 opacity-70" style={{ color: ink }}>{poem.footnote}</p>
      </div>

      {/* CONTROLS */}
      <div className="absolute top-6 left-6 z-30 flex gap-2">
        <button onClick={onClose} aria-label="Close poem" className="p-3 slide-press" style={{ background: accent, color: ink, border: `2px solid ${ink}` }}><X size={20} /></button>
        {poem.randomStagger && (
          <button onClick={onShuffle} title="Re-roll stagger" className="p-3 slide-press" style={{ background: ink, color: accent, border: `2px solid ${accent}` }}><RotateCcw size={20} /></button>
        )}
      </div>
    </div>
  );
};

const defaultProjects = [
  { id: 1, tabId: "94", title: "oil lamp", tabAlign: "center", type: "project", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80", content: "Main system architecture." },
  { id: 2, tabId: "95", title: "oats", tabAlign: "right", type: "gallery", galleryBlocks: [{id:1, w: 300, x: 50, y: 50, z: 1, image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80'}], content: "A collection of renders." },
  { id: 3, tabId: "O", title: "010", tabAlign: "left", type: "divider" },
  { id: 4, tabId: "96", title: "pants", tabAlign: "center", type: "video", videoTags: ["Motion", "Typography"], image: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", content: "Kinetic typography experiments." },
  { id: 5, tabId: "97", title: "plane", tabAlign: "right", type: "project", image: "https://images.unsplash.com/photo-1497493213477-0c0e5f410d32?w=400&q=80", content: "Old files and deprecated code." }
];

const defaultBlogs = [
  { 
    id: 1, type: "regular", blogCategory: "anime", date: "Oct 12, 2026", title: "Finding peace in slower development cycles", 
    excerpt: "Sometimes the best code is the code you write after stepping away from the screen for a while.", 
    category: "Life", tags: "thoughts, dev", rating: 5, coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80",
    imageEffect: "none",
    blocks: [
      { type: 'text', content: 'In a world obsessed with shipping fast, I took a month to just plan my next architecture.' },
      { type: 'pullquote', content: 'Slow down to speed up.' }
    ]
  },
  { 
    id: 2, type: "album", blogCategory: "anime", date: "Nov 01, 2026", title: "Blonde - Frank Ocean", 
    excerpt: "A masterpiece of modern R&B that explores the duality of youth, nostalgia, and heartbreak.", 
    category: "Music", tags: "rnb, classics", rating: 5, coverImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
    bgColor: "#eb5e28", bgImage: "", imageEffect: "none",
    blocks: [
      { type: 'text', content: "The minimalist production leaves so much room for emotional resonance.\n\nFavorite tracks:\n- Nikes\n- Ivy\n- White Ferrari" },
      { type: 'quote', content: "I'd rather live outside, I'd rather chip my pride than lose my mind out here." }
    ]
  },
  {
    id: 3, type: "regular", blogCategory: "manhwa", date: "Work fast. Live slow.", title: "Create your digital reality.", 
    excerpt: "From nothing to everything, let's bring your vision to life in an elegant, structured format.", 
    category: "Design", tags: "web, product, brand", rating: 5, coverImage: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80",
    imageEffect: "none", blocks: [{ type: 'text', content: 'Manhwa entry text block.' }]
  },
  {
    id: 4, type: "regular", blogCategory: "shows", date: "PREDICTIVE MODELING", title: "PREDICTIVE MODELING, RISK MITIGATION.", 
    excerpt: "EVERY DECISION TREE MAPPED. AETHERON THINKS AHEAD AND LIVES THERE.", 
    category: "Sci-Fi", tags: "PROBABILISTIC FORESIGHT, FAILSAFE FALLBACK PATHS, HEDGE LOGIC", rating: 5, coverImage: "https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?w=800&q=80",
    imageEffect: "both", blocks: [{ type: 'text', content: 'Show entry text block.' }]
  }
];

const defaultAbout = {
  // Terminal boot sequence config — fully editable from Admin > About.
  boot: {
    enabled: true,
    replay: "session",      // 'session' | 'always' | 'never'
    speed: 1,               // multiplier; higher = faster
    accent: "#00ff88",
    hostname: "iceyyy",
    user: "guest",
    shell: "~/about",
    archivePath: "/archive/obsessions",
    lines: [
      "POST ............................. OK",
      "MEM CHECK 16384K ................. OK",
      "MOUNTING /dev/personality ........ OK",
      "LOADING kernel/identity.sys ...... OK",
      "NET LINK ESTABLISHED ............. OK"
    ]
  },
  appBackground: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041&auto=format&fit=crop",
  introText: "Hellooo, the name is Vinz!\n\nYou can call me Ice^^\n\nI am 16 years of age, born on April 16, 2008\n\nI am an Aries, and Intp-t (I don't believe fully in these)\n\nMy sexuality is AroAce (Not interested romantically or sexually)\n\n3 words about me?: Chaotic, Needy, Nerdy",
  introImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
  notepadText: "This year, I decided to focus on building things I love. I wasn't able to launch many projects, but I did build a few amazing ones. I took my time with them, and I'm glad I did.",
  mood: {
    score: "85",
    status: "OPTIMAL",
    title: "System\nStability",
    desc: "Performance score and\nemotional statistics for Q3."
  },
  myspace: [
    { id: 1, name: "Dirk", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
    { id: 2, name: "Renz", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
    { id: 3, name: "Danes", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
    { id: 4, name: "Chariz", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80" }
  ],
  interests: [
    { id: 1, title: "Anime", desc: "Anime has been a very integral bonding thing...", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80" },
    { id: 2, title: "Music", desc: "This is one of my worse obsessions...", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80" },
    { id: 3, title: "Gaming", desc: "2020 me became a degen for this...", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&q=80" },
    { id: 4, title: "Aviation", desc: "Aviation has always had a place in my heart...", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=300&q=80" },
    { id: 5, title: "Cars", desc: "Exotic cars and even the largest and fastest...", image: "https://images.unsplash.com/photo-1503376760302-3c2a537f00f0?w=300&q=80" }
  ],
  obsessions: [
    { id: 1, category: "Top 10 Anime", items: ["Frieren", "Tanya", "Dangers in my heart", "Slime tensura", "Soukoku", "Bocchi the rock", "Aono Orchestra", "Apothecary Diaries", "Solo leveling", "Ranking of kings"] },
    { id: 2, category: "Top 10 Movies", items: ["Everything Everywhere all at once", "Mr. Fantastic Fox", "Dead Man's Chest", "Now you see me two", "Oblivion", "Pacific rim", "The kingdom of god", "Ford vs Ferrari", "Ready player one", "The intern"] },
    { id: 3, category: "Top 10 Songs", items: ["Godspeed / White Ferrari", "Sing about me, im dying of thirst", "Wilshire / Are we still friends?", "Sedated / Jackie and Wilson", "Love is just a feeling"] },
    { id: 4, category: "Top 10 Reads", items: ["Cherry Crush", "The guy she was interested in", "Cherry blossoms after winter", "Boyfriends", "One room TA"] }
  ]
};

const defaultSystem = {
  title: "Patch Bay",
  rackLabel: "SYS-01 // MODULAR CORE",
  meterColor: "#dfff00",
  cableSag: 34,
  navPills: ["Signal", "Routing", "Levels", "Clock", "Utility"],
  profile: { name: "System Core", role: "Primary Node", image: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80" },
  stats: [
    { id: 1, label: "Heart Rate", value: "89", unit: "bpm" },
    { id: 2, label: "Pressure", value: "100/67", unit: "" },
    { id: 3, label: "Oxygen", value: "98", unit: "%" },
    { id: 4, label: "Temperature", value: "36.8", unit: "°C" }
  ],
  timeline: [
    {
      id: "col1", period: "Phase 1", subtitle: "Initialization", color: "#ff5722",
      knobs: [ { id: "k1", label: "Gain", value: 62 }, { id: "k2", label: "Drift", value: 28 } ],
      nodes: [
        { id: "n1", type: "pill", title: "Boot Sequence", value: "x2", icon: "Terminal" },
        { id: "n2", type: "card", title: "Memory Allocation", mainValue: "160/90", subValue: "Average: 120", chartType: "bar", icon: "Database" },
        { id: "n3", type: "card", title: "Core Temp", mainValue: "Normal", subValue: "Stable", chartType: "pulse", icon: "Thermometer" }
      ]
    },
    {
      id: "col2", period: "Phase 2", subtitle: "Execution", color: "#dfff00",
      knobs: [ { id: "k3", label: "Rate", value: 74 }, { id: "k4", label: "Depth", value: 41 } ],
      nodes: [
        { id: "n4", type: "pill", title: "Routing", value: "x3", icon: "Network" },
        { id: "n5", type: "card", title: "Data Stream", mainValue: "135/92", subValue: "Average: 130", chartType: "bar", icon: "Activity" }
      ]
    },
    {
      id: "col3", period: "Phase 3", subtitle: "Output", color: "#0000ff",
      knobs: [ { id: "k5", label: "Level", value: 88 } ],
      nodes: [
        { id: "n6", type: "pill", title: "Master Out", value: "L/R", icon: "Waves" },
        { id: "n7", type: "card", title: "Clock", mainValue: "120 BPM", subValue: "Locked", chartType: "pulse", icon: "Zap" }
      ]
    }
  ],
  cables: [
    { id: "c1", from: "n1", to: "n4", color: "#ff5722" },
    { id: "c2", from: "n2", to: "n5", color: "#dfff00" },
    { id: "c3", from: "n5", to: "n6", color: "#00d2ff" },
    { id: "c4", from: "n3", to: "n7", color: "#ff2ea6" }
  ]
};

const defaultSocials = [
  { id: 1, name: 'GitHub', url: 'https://github.com', image: 'https://placehold.co/400x400/991b1b/fff?text=G' }
];

// The first item explicitly gets the journal attached by default.
const defaultGalleria = [
  "1486406146926-c627a92ad1ab", "1497366216548-37526070297c", "1513694203232-719a280e022f", 
  "1600585154340-be6161a56a0c", "1486406146926-c627a92ad1ab", "1497366216548-37526070297c",
  "1513694203232-719a280e022f", "1600585154340-be6161a56a0c"
].map((id, idx) => ({ 
  id: idx, 
  image: `https://images.unsplash.com/photo-${id}?w=600&q=80`, 
  date: "Oct 2026",
  hasJournal: idx === 0 
}));

const defaultJournals = [
  {
    id: 1, date: "Jul 15", year: "2026", shortDate: "WED . 15", timeSpan: "7 15 - 8 15", ticketClass: "COACH", 
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80", 
    logs: ["System boot."], historyYear: "1799", historyText: "Rosetta Stone found."
  },
  {
    id: 2, date: "Jul 16", year: "2026", shortDate: "THU . 16", timeSpan: "7 16 - 8 16", ticketClass: "OMNI", 
    image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80", 
    logs: ["Diagnostics clear."], historyYear: "1945", historyText: "Trinity test."
  },
  {
    id: 3, date: "Jul 17", year: "2026", shortDate: "FRI . 17", timeSpan: "7 17 - 8 17", ticketClass: "FIRST", 
    image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&q=80", 
    logs: ["Awaiting input."], historyYear: "1955", historyText: "Disneyland opens."
  },
  {
    id: 4, date: "Jul 18", year: "2026", shortDate: "SAT . 18", timeSpan: "7 18 - 8 18", ticketClass: "OMNI", 
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80", 
    logs: ["Memory hash recorded.", "Visual extraction successful.", "The architecture here defies standard Euclidean geometry, folding in on itself when unobserved."], 
    historyYear: "1968", historyText: "Intel Corporation is founded in Santa Clara, California."
  },
  {
    id: 5, date: "Jul 19", year: "2026", shortDate: "SUN . 19", timeSpan: "7 19 - 8 19", ticketClass: "FIRST", 
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80", 
    logs: ["Secondary systems offline.", "Re-routing power to main thrusters.", "Starlight looks different today."], 
    historyYear: "1848", historyText: "Women's Rights Convention opens in Seneca Falls, NY."
  },
  {
    id: 6, date: "Jul 20", year: "2026", shortDate: "MON . 20", timeSpan: "7 20 - 8 20", ticketClass: "COACH", 
    image: "https://images.unsplash.com/photo-1497493213477-0c0e5f410d32?w=800&q=80", 
    logs: ["A quiet day in the sector.", "Coffee machine is broken again."], 
    historyYear: "1969", historyText: "Apollo 11 makes the first manned landing on the Moon."
  },
  {
    id: 7, date: "Jul 21", year: "2026", shortDate: "TUE . 21", timeSpan: "7 21 - 8 21", ticketClass: "OMNI", 
    image: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&q=80", 
    logs: ["Signal intercepted."], historyYear: "1861", historyText: "First Battle of Bull Run."
  }
];

const defaultPlaylists = [
  {
    id: 1, title: "Late Night Code", price: "$0.00", genre: "Lofi", tags: "Focus", description: "Deep focus beats for long coding sessions and debugging in the dark.", image: "https://images.unsplash.com/photo-1516280440502-5c058ddf6567?w=600&q=80", url: "#", color: "#1f2937"
  },
  {
    id: 2, title: "Sunday Morning", price: "$0.00", genre: "Acoustic", tags: "Warm", description: "Warm acoustic melodies to start your day right with a cup of coffee.", image: "https://images.unsplash.com/photo-1495434942714-9b1efa10a89a?w=600&q=80", url: "#", color: "#6b4226"
  },
  {
    id: 3, title: "Tokyo Drift", price: "$0.00", genre: "Phonk", tags: "Fast", description: "High energy tracks for when you need to push through a tough deadline.", image: "https://images.unsplash.com/photo-1542051842-83531bcfbb7a?w=600&q=80", url: "#", color: "#3a2e39"
  }
];

/* ============================================================
   GALLERIA LIGHTBOX ("sticker slam")
   Clicking a galleria plate throws this up: the photo goes duotone
   under the accent, then a swarm of decals pops in on a stagger.
   Every decal is admin-editable (text, position, rotation, style).
   ============================================================ */
const STICKER_STYLES = ['graffiti', 'tag', 'chip', 'bubble', 'star', 'outline', 'marquee', 'scribble'];

const defaultLightbox = {
  enabled: true,
  accent: "#c6ff2e",
  ink: "#0d0d0d",
  duotone: true,          // recolor photo into accent/ink duotone
  grain: true,
  scanlines: false,
  popSpeed: 1,            // stagger multiplier
  frameLabel: "FRAME",
  cornerTag: "green [+] SOUL",
  hudTitle: "MUTE \\ ON",
  hudSub: "VEDIO SCREEN",
  showHud: true,
  showTicker: true,
  tickerText: "ARCHIVE ENTRY · NO SIGNAL LOSS · KEEP SCROLLING ·",
  showBadgeCard: true,
  badgeCardTitle: "pretty",
  badgeCardYear: "2026",
  stickers: [
    { id: 's1', text: "HEY",  style: "graffiti", x: 20, y: 14, rot: -14, size: 52 },
    { id: 's2', text: "LOL",  style: "scribble", x: 76, y: 62, rot: 12,  size: 46 },
    { id: 's3', text: "MADE / 2 . 0", style: "tag", x: 24, y: 58, rot: -6, size: 18 },
    { id: 's4', text: "SOUL", style: "outline",  x: 88, y: 30, rot: 0,   size: 40 },
    { id: 's5', text: "?!",   style: "star",     x: 90, y: 10, rot: 8,   size: 28 },
    { id: 's6', text: "peitos", style: "bubble", x: 87, y: 52, rot: -3,  size: 20 },
    { id: 's7', text: "NO SIGNAL", style: "chip", x: 12, y: 84, rot: 4,  size: 14 },
    { id: 's8', text: "▓▒░ OVER ░▒▓", style: "marquee", x: 62, y: 90, rot: -2, size: 13 },
  ],
  metaRows: [
    { id: 'm1', label: "FILE", value: "IMG_%N%" },
    { id: 'm2', label: "DATE", value: "%DATE%" },
    { id: 'm3', label: "PASS", value: "0A / 0B / 0C" },
  ]
};

/* ============================================================
   POEM DECK — the sleeve-back patch diagram (sits under Audio
   Archives). Left half is a generated slot/cable field, right half
   is the highlighted "tracklist" where each line opens a poem.
   ============================================================ */
const defaultPoemDeck = {
  enabled: true,
  heading: "Verse Index",
  kicker: "Patch Sleeve — Reverse",
  bg: "#0a0a0a",
  fg: "#e8e8e8",
  line: "#6b6b6b",
  highlight: "#ffffff",
  highlightInk: "#0a0a0a",
  tracksLabel: "TRACKS",
  moduleLabel: "DUCD4",
  averageLabel: "AVERAGE",
  totalLabel: "TOTAL TIME 1:03 · 185:MM",
  passLabels: ["PASS/0A", "PASS/0B", "PASS/0C", "PASS/0E"],
  slotCount: 14,
  slotPrefix: "SLOT_",
  waveRows: 4,
  showWaveform: true,
  showCables: true,
  showCropMarks: true,
  showBarcode: true,
  footerLeft: "© 2026 ARCHIVE™\nDETROITUNDERGROUND.NET",
  footerMid: "277 GRATIOT AVE, SUITE 100 · A0G04\nDETROIT, MI 48226",
  animate: true
};

const defaultPoems = [
  {
    id: 1, title: "PlonkedSpectral", image: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1600&q=80",
    subtitle: "THE FUTURE IS OURS :", bigTitle: "LOST", footnote: "ARCHIVE 01 · VERSE",
    accent: "#ffffff", ink: "#111111", randomStagger: true, seed: 7, imageDim: 0,
    lines: [
      { id: 'l1', tag: "5/12", text: "the sky kept its receipts" },
      { id: 'l2', tag: "5/15", text: "and charged me for the weather" },
      { id: 'l3', tag: "5/16", text: "I paid in afternoons" },
      { id: 'l4', tag: "5/17", text: "and one long vowel" },
      { id: 'l5', tag: "5/19", text: "held under the tongue" },
      { id: 'l6', tag: "5/22", text: "until it went soft" },
      { id: 'l7', tag: "5/29", text: "and became a door" }
    ]
  },
  {
    id: 2, title: "ErkWerks", image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80",
    subtitle: "SECOND PASS :", bigTitle: "STATIC", footnote: "ARCHIVE 02 · VERSE",
    accent: "#ffffff", ink: "#111111", randomStagger: true, seed: 3, imageDim: 10,
    lines: [
      { id: 'l1', tag: "01", text: "nothing here is load-bearing" },
      { id: 'l2', tag: "02", text: "not the ceiling, not the promise" },
      { id: 'l3', tag: "03", text: "I keep testing it anyway" },
      { id: 'l4', tag: "04", text: "with my whole weight" }
    ]
  },
  {
    id: 3, title: "Oxin2lin", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&q=80",
    subtitle: "THIRD PASS :", bigTitle: "DRIFT", footnote: "ARCHIVE 03 · VERSE",
    accent: "#ffffff", ink: "#111111", randomStagger: false, seed: 11, imageDim: 20,
    lines: [
      { id: 'l1', tag: "i", text: "the room remembers its furniture", offset: 30 },
      { id: 'l2', tag: "ii", text: "the way a mouth remembers a name", offset: 46 },
      { id: 'l3', tag: "iii", text: "badly, and out loud", offset: 22 },
      { id: 'l4', tag: "iv", text: "and only when it is late", offset: 52 }
    ]
  },
  { id: 4, title: "TipTopBD808", image: "", subtitle: "", bigTitle: "TIP TOP", footnote: "ARCHIVE 04", accent: "#ffffff", ink: "#111111", randomStagger: true, seed: 5, imageDim: 0,
    lines: [{ id: 'l1', tag: "—", text: "a metronome with nothing to keep" }] },
  { id: 5, title: "Varseop", image: "", subtitle: "", bigTitle: "VARSEOP", footnote: "ARCHIVE 05", accent: "#ffffff", ink: "#111111", randomStagger: true, seed: 9, imageDim: 0,
    lines: [{ id: 'l1', tag: "—", text: "I left the light on for a season" }] },
  { id: 6, title: "Morro", image: "", subtitle: "", bigTitle: "MORRO", footnote: "ARCHIVE 06", accent: "#ffffff", ink: "#111111", randomStagger: true, seed: 2, imageDim: 0,
    lines: [{ id: 'l1', tag: "—", text: "the hill did not move. I did." }] }
];

const ADMIN_TABS = [
  { id: 'about',       label: 'About' },
  { id: 'projects',    label: 'Projects' },
  { id: 'galleria',    label: 'Galleria' },
  { id: 'lightbox',    label: 'Lightbox' },
  { id: 'poems',       label: 'Poems' },
  { id: 'system',      label: 'System' },
  { id: 'blogs',       label: 'Blogs' },
  { id: 'journals',    label: 'Journals' },
  { id: 'socials',     label: 'Socials' },
  { id: 'messages',    label: 'Messages' },
  { id: 'settings',    label: 'Settings' },
  { id: 'access_logs', label: 'Access Logs' },
];

// Shipped default backdrop (the StormDay plate). Replaceable in
// Admin > Settings > Site Backdrop.
const STORMDAY_BACKDROP = "data:image/jpeg;base64,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";

const defaultSettings = {
  wip: { intro: false, portfolio: false, galleria: false, system: false, blog: false, socials: false, blank: false },
  // Replaces the old blueprint gridlines everywhere .bg-blueprint was used.
  backdrop: {
    enabled: true,
    image: STORMDAY_BACKDROP, // swap in Admin > Settings
    size: "cover",        // cover | contain | repeat
    position: "center",
    opacity: 0.5,
    blend: "multiply",    // normal | multiply | luminosity | overlay
    grayscale: 0,
    keepGrid: false,      // draw the old gridlines on top of the photo
    useTint: false,       // paint a flat colour under the photo
    tint: "#e9e9e6"
  }
};

// Older saved payloads predate the boot/rack config, so merge defaults in on
// load rather than scattering fallbacks through the render tree.
const mergeAbout = (saved) => ({ ...defaultAbout, ...(saved || {}), boot: { ...defaultAbout.boot, ...((saved || {}).boot || {}) } });
const mergeSystem = (saved) => ({ ...defaultSystem, ...(saved || {}), cables: (saved || {}).cables || defaultSystem.cables });
const mergeSettings = (saved) => ({ ...defaultSettings, ...(saved || {}), wip: { ...defaultSettings.wip, ...((saved || {}).wip || {}) }, backdrop: { ...defaultSettings.backdrop, ...((saved || {}).backdrop || {}) } });
const mergeLightbox = (saved) => ({ ...defaultLightbox, ...(saved || {}), stickers: (saved || {}).stickers || defaultLightbox.stickers, metaRows: (saved || {}).metaRows || defaultLightbox.metaRows });
const mergePoemDeck = (saved) => ({ ...defaultPoemDeck, ...(saved || {}), passLabels: (saved || {}).passLabels || defaultPoemDeck.passLabels });

// Deterministic pseudo-random so a poem's stagger is stable per seed but
// still looks scattered. Same seed => same layout on every open.
const seededRand = (seed, i) => {
  const x = Math.sin((seed + 1) * 9301 + (i + 1) * 49297) * 233280;
  return x - Math.floor(x);
};

export default function App() {
  const [activeTab, setActiveTab] = useState('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null); // { msg, type, id, leaving }
  const toastTimers = useRef([]);
  
  const [projects, setProjects] = useState(defaultProjects);
  const [blogs, setBlogs] = useState(defaultBlogs);
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('anime'); // NEW STATE FOR BLOG TABS
  const [aboutData, setAboutData] = useState(defaultAbout);
  const [systemData, setSystemData] = useState(defaultSystem);
  const [socials, setSocials] = useState(defaultSocials);
  const [galleriaData, setGalleriaData] = useState(defaultGalleria);
  const [siteSettings, setSiteSettings] = useState(defaultSettings);
  const [journalEntries, setJournalEntries] = useState(defaultJournals);
  const [playlists, setPlaylists] = useState(defaultPlaylists);
  const [lightboxConfig, setLightboxConfig] = useState(defaultLightbox);
  const [poemDeck, setPoemDeck] = useState(defaultPoemDeck);
  const [poems, setPoems] = useState(defaultPoems);
  const [accessLogs, setAccessLogs] = useState([]); // NEW STATE FOR JOURNAL LOGS

  // Galleria lightbox + poem overlays
  const [activeGalleriaImage, setActiveGalleriaImage] = useState(null); // { item, index }
  const [activePoem, setActivePoem] = useState(null);
  const [poemShuffle, setPoemShuffle] = useState(0); // bump to re-roll a random stagger
  const [expandedPoem, setExpandedPoem] = useState(null); // admin accordion
  
  const [journalIndex, setJournalIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [guestMessages, setGuestMessages] = useState([]);
  const [newGuestMessage, setNewGuestMessage] = useState("");
  const [playgroundMode, setPlaygroundMode] = useState('text');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null); 
  const [itemType, setItemType] = useState(null); 
  const [modalGalleryBlocks, setModalGalleryBlocks] = useState([]);
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [adminTab, setAdminTab] = useState('about');
  const [editingItem, setEditingItem] = useState(null);
  const [adminSearch, setAdminSearch] = useState("");     // filter within a list
  const [confirmDelete, setConfirmDelete] = useState(null); // { listType, id }
  const [showPassword, setShowPassword] = useState(false);

  // === NEW: JOURNAL OVERLAY & TICKET STATE ===
  const [pendingJournal, setPendingJournal] = useState(null); 
  const [activeJournal, setActiveJournal] = useState(null);
  const [visitorName, setVisitorName] = useState("");
  const [isTicketValidating, setIsTicketValidating] = useState(false);

  // --- REAL-TIME CLOCK HOOK ---
  useEffect(() => {
    if (!activeJournal) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [activeJournal]);

  const formatTime = (date) => {
    let h = date.getHours();
    const m = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { h, m, s, ampm };
  };

  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [galleriaPanX, setGalleriaPanX] = useState(0);

  // Toast: single source of truth, timers tracked so rapid-fire calls can't
  // leave a stale timeout that clears a newer message.
  const showToast = (msg, type = 'info') => {
    toastTimers.current.forEach(clearTimeout);
    toastTimers.current = [];
    const id = Date.now();
    setToast({ msg, type, id, leaving: false });
    toastTimers.current.push(setTimeout(() => setToast(t => (t && t.id === id ? { ...t, leaving: true } : t)), 3000));
    toastTimers.current.push(setTimeout(() => setToast(t => (t && t.id === id ? null : t)), 3320));
  };
  useEffect(() => () => toastTimers.current.forEach(clearTimeout), []);

  const handleSortAboutList = (listName, isRootState = false) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    
    if (isRootState) {
        let list = listName === 'galleria' ? [...galleriaData] : [];
        const draggedItemContent = list.splice(dragItem.current, 1)[0];
        list.splice(dragOverItem.current, 0, draggedItemContent);
        if (listName === 'galleria') setGalleriaData(list);
    } else {
        const _aboutData = { ...aboutData };
        const list = [..._aboutData[listName]];
        const draggedItemContent = list.splice(dragItem.current, 1)[0];
        list.splice(dragOverItem.current, 0, draggedItemContent);
        setAboutData({ ..._aboutData, [listName]: list });
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  useEffect(() => {
    async function loadDataAndAuth() {
      // 1. LOCAL STORAGE FALLBACK (If Supabase is missing)
      if (!supabase) {
        console.warn("Supabase credentials not found. Running in local fallback mode.");
        const localData = localStorage.getItem('site_data_fallback');
        if (localData) {
          try {
            const parsed = JSON.parse(localData);
            if (parsed.projects) setProjects(parsed.projects);
            if (parsed.blogs) setBlogs(parsed.blogs);
            if (parsed.about) setAboutData(mergeAbout(parsed.about));
            if (parsed.socials) setSocials(parsed.socials);
            if (parsed.galleria) setGalleriaData(parsed.galleria);
            if (parsed.system) setSystemData(mergeSystem(parsed.system));
            if (parsed.settings) setSiteSettings(mergeSettings(parsed.settings));
            if (parsed.journals) setJournalEntries(parsed.journals);
            if (parsed.playlists) setPlaylists(parsed.playlists);
            if (parsed.lightbox) setLightboxConfig(mergeLightbox(parsed.lightbox));
            if (parsed.poem_deck) setPoemDeck(mergePoemDeck(parsed.poem_deck));
            if (parsed.poems) setPoems(parsed.poems);
            if (parsed.access_logs) setAccessLogs(parsed.access_logs);
          } catch(e) { console.error("Failed to parse local data", e); }
        }
        setIsLoading(false);
        return;
      }

      // 2. SUPABASE DB LOAD (If configured)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setIsAdmin(true);

        const { data: siteData } = await supabase.from('site_data').select('*');
        if (siteData && siteData.length > 0) {
          const p = siteData.find(d => d.section === 'projects');
          const b = siteData.find(d => d.section === 'blogs');
          const a = siteData.find(d => d.section === 'about');
          const s = siteData.find(d => d.section === 'socials');
          const g = siteData.find(d => d.section === 'galleria');
          const sys = siteData.find(d => d.section === 'system');
          const set = siteData.find(d => d.section === 'settings');
          const j = siteData.find(d => d.section === 'journals');
          const pl = siteData.find(d => d.section === 'playlists');
          const lb = siteData.find(d => d.section === 'lightbox');
          const pd = siteData.find(d => d.section === 'poem_deck');
          const pm = siteData.find(d => d.section === 'poems');
          
          if (p) setProjects(p.data);
          if (b) setBlogs(b.data);
          if (a) setAboutData(mergeAbout(a.data));
          if (s) setSocials(s.data);
          if (g) setGalleriaData(g.data);
          if (sys && sys.data?.timeline) setSystemData(mergeSystem(sys.data));
          if (set && set.data.wip) setSiteSettings(mergeSettings(set.data));
          if (j) setJournalEntries(j.data);
          if (pl) setPlaylists(pl.data);
          if (lb) setLightboxConfig(mergeLightbox(lb.data));
          if (pd) setPoemDeck(mergePoemDeck(pd.data));
          if (pm) setPoems(pm.data);
        }

        const { data: messages } = await supabase.from('playground_messages').select('*').order('created_at', { ascending: false });
        if (messages) setGuestMessages(messages);
        
        // Try fetching access logs. If table missing, ignore error.
        const { data: logs } = await supabase.from('journal_access_logs').select('*').order('created_at', { ascending: false });
        if (logs) setAccessLogs(logs);

      } catch (e) {
        console.error("Error loading data:", e);
      }
      setIsLoading(false);
    }
    loadDataAndAuth();
  }, []);

  useEffect(() => {
    if (playgroundMode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#111111';
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [playgroundMode]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  };

  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    // Seed the path at the press point, otherwise the first stroke drags a
    // line in from wherever the previous stroke ended.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(cx - rect.left, cy - rect.top);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const stopDrawing = (e) => {
    e.preventDefault(); setIsDrawing(false);
    if (canvasRef.current) canvasRef.current.getContext('2d').beginPath(); 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    // Allow 'admin123' fallback login when testing locally without DB
    if (!supabase) {
      if (passwordInput === 'admin123') {
        setIsAdmin(true); setShowLogin(false); setActiveTab('admin'); setPasswordInput(""); setEmailInput("");
        showToast("Local Admin Access Granted.");
      } else {
        showToast("Database missing. Local dev password is: admin123");
      }
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
    setIsLoading(false);
    if (error) showToast("Login Failed: " + error.message);
    else { setIsAdmin(true); setShowLogin(false); setActiveTab('admin'); setPasswordInput(""); setEmailInput(""); }
  };

  const handleLogout = async () => { 
    if(supabase) await supabase.auth.signOut(); 
    setIsAdmin(false); 
    setActiveTab('intro'); 
  };

  const openModal = (item, type) => { 
    if (item.type === 'divider') return;
    setSelectedItem(item); 
    setItemType(type); 
    if (type === 'project' && item.type === 'gallery') {
      setModalGalleryBlocks(item.galleryBlocks || []);
    }
  };

  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { showToast("Please choose an image smaller than 2MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBatchGalleriaUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    showToast(`Processing batch upload of ${files.length} images...`);
    Promise.all(files.map(file => {
       return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({
             id: Date.now() + Math.random(),
             image: reader.result,
             date: new Date().toLocaleDateString(),
             hasJournal: false // By default, bulk uploads don't have journals
          });
          reader.readAsDataURL(file);
       });
    })).then(newImages => {
       setGalleriaData(prev => [...prev, ...newImages]);
       showToast(`Successfully added ${newImages.length} images!`);
    });
  };

  const saveAllToCloud = async (overrideProjects = null) => {
    setIsSaving(true);
    
    // Save to LocalStorage if no Supabase connection
    if (!supabase) {
      localStorage.setItem('site_data_fallback', JSON.stringify({
        about: aboutData, 
        projects: overrideProjects || projects, 
        blogs: blogs, 
        socials: socials, 
        galleria: galleriaData, 
        system: systemData, 
        settings: siteSettings, 
        journals: journalEntries,
        playlists: playlists,
        lightbox: lightboxConfig,
        poem_deck: poemDeck,
        poems: poems,
        access_logs: accessLogs
      }));
      setIsSaving(false);
      setIsDirty(false);
      showToast("Deployed changes to Local Storage.", 'success');
      return;
    }

    const updates = [
      { section: 'about', data: aboutData },
      { section: 'projects', data: overrideProjects || projects },
      { section: 'blogs', data: blogs },
      { section: 'socials', data: socials },
      { section: 'galleria', data: galleriaData },
      { section: 'system', data: systemData },
      { section: 'settings', data: siteSettings },
      { section: 'journals', data: journalEntries },
      { section: 'playlists', data: playlists },
      { section: 'lightbox', data: lightboxConfig },
      { section: 'poem_deck', data: poemDeck },
      { section: 'poems', data: poems }
    ];
    const { error } = await supabase.from('site_data').upsert(updates, { onConflict: 'section' });
    setIsSaving(false);
    if (error) showToast("Error saving: " + error.message, 'error');
    else { setIsDirty(false); showToast("Deployed all changes to the cloud.", 'success'); }
  };

  const handleListSave = (e, listType) => {
    e.preventDefault();
    if (editingItem.isPlaylist) {
      const newList = editingItem.id ? playlists.map(pl => pl.id === editingItem.id ? editingItem : pl) : [...playlists, { ...editingItem, id: Date.now() }];
      setPlaylists(newList);
    } else if (listType === 'projects') {
      const newList = editingItem.id ? projects.map(p => p.id === editingItem.id ? editingItem : p) : [...projects, { ...editingItem, id: Date.now() }];
      setProjects(newList);
    } else if (listType === 'blogs') {
      const newList = editingItem.id ? blogs.map(b => b.id === editingItem.id ? editingItem : b) : [...blogs, { ...editingItem, id: Date.now() }];
      setBlogs(newList);
    } else if (listType === 'socials') {
      const newList = editingItem.id ? socials.map(s => s.id === editingItem.id ? editingItem : s) : [...socials, { ...editingItem, id: Date.now() }];
      setSocials(newList);
    } else if (listType === 'journals') {
      const newList = editingItem.id ? journalEntries.map(j => j.id === editingItem.id ? editingItem : j) : [...journalEntries, { ...editingItem, id: Date.now() }];
      setJournalEntries(newList);
    }
    setEditingItem(null);
  };

  // Generic setter lookup so reorder/duplicate work across every list type.
  const listRegistry = {
    projects: [projects, setProjects],
    blogs: [blogs, setBlogs],
    socials: [socials, setSocials],
    journals: [journalEntries, setJournalEntries],
    playlists: [playlists, setPlaylists],
    poems: [poems, setPoems],
  };

  const moveListItem = (listType, index, dir) => {
    const entry = listRegistry[listType];
    if (!entry) return;
    const [list, setter] = entry;
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setter(next);
  };

  const duplicateListItem = (listType, item) => {
    const entry = listRegistry[listType];
    if (!entry) return;
    const [list, setter] = entry;
    const copy = { ...item, id: Date.now(), title: item.title ? `${item.title} (copy)` : item.title };
    setter([...list, copy]);
    showToast("Record duplicated.", 'success');
  };

  // Boot config writer — keeps the nested object shape intact.
  const setBoot = (patch) => setAboutData(a => ({ ...a, boot: { ...(a.boot || {}), ...patch } }));

  /* ---------- LIGHTBOX WRITERS ---------- */
  const setLB = (patch) => setLightboxConfig(c => ({ ...c, ...patch }));
  const updateSticker = (id, patch) => setLightboxConfig(c => ({
    ...c, stickers: (c.stickers || []).map(s => s.id === id ? { ...s, ...patch } : s)
  }));
  const addSticker = () => setLightboxConfig(c => ({
    ...c, stickers: [...(c.stickers || []), { id: `s${Date.now()}`, text: "NEW", style: "tag", x: 50, y: 50, rot: 0, size: 22 }]
  }));
  const removeSticker = (id) => setLightboxConfig(c => ({ ...c, stickers: (c.stickers || []).filter(s => s.id !== id) }));
  const setMetaRow = (id, patch) => setLightboxConfig(c => ({
    ...c, metaRows: (c.metaRows || []).map(m => m.id === id ? { ...m, ...patch } : m)
  }));

  /* ---------- POEM DECK WRITERS ---------- */
  const setDeck = (patch) => setPoemDeck(d => ({ ...d, ...patch }));
  const updatePoem = (id, patch) => setPoems(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  const addPoem = () => {
    const id = Date.now();
    setPoems(ps => [...ps, {
      id, title: "Untitled Verse", image: "", subtitle: "", bigTitle: "UNTITLED", footnote: "ARCHIVE",
      accent: "#ffffff", ink: "#111111", randomStagger: true, seed: Math.floor(Math.random() * 99), imageDim: 0,
      lines: [{ id: `l${id}`, tag: "01", text: "first line" }]
    }]);
    setExpandedPoem(id);
  };
  const addPoemLine = (poemId) => updatePoemLines(poemId, ls => [...ls, { id: `l${Date.now()}`, tag: "", text: "", offset: 30 }]);
  const updatePoemLines = (poemId, fn) => setPoems(ps => ps.map(p => p.id === poemId ? { ...p, lines: fn(p.lines || []) } : p));
  const updatePoemLine = (poemId, lineId, patch) => updatePoemLines(poemId, ls => ls.map(l => l.id === lineId ? { ...l, ...patch } : l));
  const removePoemLine = (poemId, lineId) => updatePoemLines(poemId, ls => ls.filter(l => l.id !== lineId));
  const movePoemLine = (poemId, idx, dir) => updatePoemLines(poemId, ls => {
    const t = idx + dir;
    if (t < 0 || t >= ls.length) return ls;
    const next = [...ls];
    [next[idx], next[t]] = [next[t], next[idx]];
    return next;
  });

  /* ---------- BACKDROP WRITER ---------- */
  const setBackdrop = (patch) => setSiteSettings(s => ({ ...s, backdrop: { ...defaultSettings.backdrop, ...(s.backdrop || {}), ...patch } }));

  // System / patch bay writers
  const setRack = (patch) => setSystemData(sd => ({ ...sd, ...patch }));
  const updateModule = (id, patch) => setSystemData(sd => ({
    ...sd, timeline: (sd.timeline || []).map(m => m.id === id ? { ...m, ...patch } : m)
  }));
  const addModule = () => setSystemData(sd => ({
    ...sd,
    timeline: [...(sd.timeline || []), {
      id: `col${Date.now()}`, period: "New Module", subtitle: "Untitled",
      color: PATCH_COLORS[((sd.timeline || []).length) % PATCH_COLORS.length],
      knobs: [{ id: `k${Date.now()}`, label: "Gain", value: 50 }],
      nodes: [{ id: `n${Date.now()}`, type: "pill", title: "Jack 1", value: "", icon: "CircleDot" }],
    }]
  }));
  const removeModule = (id) => setSystemData(sd => {
    const mod = (sd.timeline || []).find(m => m.id === id);
    const nodeIds = new Set((mod?.nodes || []).map(n => n.id));
    return {
      ...sd,
      timeline: (sd.timeline || []).filter(m => m.id !== id),
      // Pull any cable that pointed at a jack on the removed module.
      cables: (sd.cables || []).filter(c => !nodeIds.has(c.from) && !nodeIds.has(c.to)),
    };
  });
  const addNode = (moduleId) => setSystemData(sd => ({
    ...sd,
    timeline: (sd.timeline || []).map(m => m.id !== moduleId ? m : {
      ...m, nodes: [...(m.nodes || []), { id: `n${Date.now()}`, type: "pill", title: "New Jack", value: "", icon: "CircleDot" }]
    })
  }));
  const removeNode = (moduleId, nodeId) => setSystemData(sd => ({
    ...sd,
    timeline: (sd.timeline || []).map(m => m.id !== moduleId ? m : { ...m, nodes: (m.nodes || []).filter(n => n.id !== nodeId) }),
    cables: (sd.cables || []).filter(c => c.from !== nodeId && c.to !== nodeId),
  }));
  const updateNode = (moduleId, nodeId, patch) => setSystemData(sd => ({
    ...sd,
    timeline: (sd.timeline || []).map(m => m.id !== moduleId ? m : {
      ...m, nodes: (m.nodes || []).map(n => n.id === nodeId ? { ...n, ...patch } : n)
    })
  }));

  const handleDeleteItem = (listType, id) => {
    setConfirmDelete(null);
    setEditingItem(null);
    if (listType === 'projects') setProjects(projects.filter(p => p.id !== id));
    if (listType === 'blogs') setBlogs(blogs.filter(b => b.id !== id));
    if (listType === 'socials') setSocials(socials.filter(s => s.id !== id));
    if (listType === 'journals') setJournalEntries(journalEntries.filter(j => j.id !== id));
    if (listType === 'playlists') setPlaylists(playlists.filter(pl => pl.id !== id));
    if (listType === 'poems') setPoems(poems.filter(p => p.id !== id));
  }

  const updateModalGalleryImage = (id, newPos) => {
    setModalGalleryBlocks(prev => prev.map(img => img.id === id ? { ...img, ...newPos } : img));
  };

  const bringToFrontModalGallery = (id) => {
    setModalGalleryBlocks(prev => {
      const maxZ = Math.max(...prev.map(img => img.z || 0), 0);
      return prev.map(img => img.id === id ? { ...img, z: maxZ + 1 } : img);
    });
  };

  const saveGalleryLayout = async () => {
    const updatedProjects = projects.map(p => p.id === selectedItem.id ? { ...p, galleryBlocks: modalGalleryBlocks } : p);
    setProjects(updatedProjects);
    await saveAllToCloud(updatedProjects);
    showToast("Gallery layout saved successfully!");
  };

  const sendAnonymousMessage = async (e) => {
    e.preventDefault();
    let payload = newGuestMessage;
    if (playgroundMode === 'draw' && canvasRef.current) payload = canvasRef.current.toDataURL(); 
    if (!payload.trim() || payload === 'data:,') return;

    setIsSendingMessage(true);
    
    // Save to local state if no Supabase connection
    if (!supabase) {
      const newMsg = { id: Date.now(), created_at: new Date().toISOString(), message: payload };
      setGuestMessages([newMsg, ...guestMessages]);
      setNewGuestMessage("");
      if (playgroundMode === 'draw') {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      showToast("Note sent anonymously (Local Mode)!");
      setIsSendingMessage(false);
      return;
    }

    const { data, error } = await supabase.from('playground_messages').insert([{ message: payload }]).select();
    if (!error && data) {
      setGuestMessages([data[0], ...guestMessages]);
      setNewGuestMessage("");
      if (playgroundMode === 'draw') {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#f4f4f0';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      showToast("Note sent anonymously!");
    } else {
      showToast("Error sending note.");
    }
    setIsSendingMessage(false);
  };

  // Opening a journal should land the radial wheel on a matching entry rather
  // than whatever index was left over from the last session.
  const openJournal = (galleriaItem) => {
    const match = journalEntries.findIndex(j => j.id === galleriaItem?.id);
    setJournalIndex(match >= 0 ? match : 0);
    setActiveJournal(galleriaItem);
  };

  // --- NEW: TICKET GATE SUBMIT HANDLER ---
  const submitJournalAccess = async (e) => {
    e.preventDefault();
    if (!visitorName.trim()) return showToast("Identification required.");
    setIsTicketValidating(true);
    
    const newLog = {
      id: Date.now(),
      created_at: new Date().toISOString(),
      visitor_name: visitorName.trim(),
      journal_id: pendingJournal.id || "Unknown"
    };

    if (!supabase) {
      // Local Only Mode
      const updatedLogs = [newLog, ...accessLogs];
      setAccessLogs(updatedLogs);
      localStorage.setItem('site_data_fallback', JSON.stringify({
        ...JSON.parse(localStorage.getItem('site_data_fallback') || '{}'),
        access_logs: updatedLogs
      }));
      
      // Artificial delay for aesthetic validation
      setTimeout(() => {
        openJournal(pendingJournal);
        setPendingJournal(null);
        setVisitorName("");
        setIsTicketValidating(false);
      }, 800); 
      return;
    }

    // Supabase Mode
    const { data, error } = await supabase.from('journal_access_logs').insert([
      { visitor_name: newLog.visitor_name, journal_id: newLog.journal_id }
    ]).select();

    if (!error && data) {
       setAccessLogs([data[0], ...accessLogs]);
    } else {
       // Graceful fallback if table isn't created yet but db is linked
       console.warn("Table journal_access_logs missing, saving to local state only.");
       setAccessLogs([newLog, ...accessLogs]);
    }
    
    openJournal(pendingJournal);
    setPendingJournal(null);
    setVisitorName("");
    setIsTicketValidating(false);
  };

  // ===================== TERMINAL BOOT ORCHESTRATION =====================
  // bootStep gates which section of the intro has "come online" yet.
  // 0 POST log · 1 identity · 2 circle · 3 processes · 4 archive · 5 ready
  const BOOT_DONE = 5;
  const bootCfg = aboutData?.boot || {};
  const bootEnabled = bootCfg.enabled !== false;
  const bootSpeed = Math.max(0.25, Number(bootCfg.speed) || 1);
  const bootPostLines = useMemo(
    () => (Array.isArray(bootCfg.lines) ? bootCfg.lines : []).filter(l => String(l).trim().length),
    [bootCfg.lines]
  );

  const [bootStep, setBootStep] = useState(BOOT_DONE);
  const [postIndex, setPostIndex] = useState(0);

  const skipBoot = () => { setPostIndex(bootPostLines.length); setBootStep(BOOT_DONE); };
  const restartBoot = () => {
    try { sessionStorage.removeItem('iceyyy_boot_done'); } catch (_) {}
    setPostIndex(0);
    setBootStep(0);
  };

  // Decide whether this visit replays the sequence.
  // useLayoutEffect, not useEffect: a passive effect would let one frame paint
  // with bootStep still at DONE, flashing the whole page before it collapses
  // back into the console.
  useLayoutEffect(() => {
    if (isLoading) return;
    let seen = false;
    try { seen = sessionStorage.getItem('iceyyy_boot_done') === '1'; } catch (_) {}
    const mode = bootCfg.replay || 'session';
    const reduced = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!bootEnabled || mode === 'never' || reduced || (mode === 'session' && seen)) {
      setPostIndex(bootPostLines.length);
      setBootStep(BOOT_DONE);
    } else {
      setPostIndex(0);
      setBootStep(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, bootEnabled, bootCfg.replay]);

  // Advance the sequence: POST lines first, then one section at a time.
  useEffect(() => {
    if (activeTab !== 'intro' || bootStep >= BOOT_DONE) return;
    if (postIndex < bootPostLines.length) {
      const t = setTimeout(() => setPostIndex(i => i + 1), 190 / bootSpeed);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setBootStep(st => st + 1), (bootStep === 0 ? 460 : 700) / bootSpeed);
    return () => clearTimeout(t);
  }, [activeTab, bootStep, postIndex, bootPostLines.length, bootSpeed]);

  useEffect(() => {
    if (bootStep >= BOOT_DONE) {
      try { sessionStorage.setItem('iceyyy_boot_done', '1'); } catch (_) {}
    }
  }, [bootStep]);

  // --- QoL: track unsaved edits so the deploy button can signal state ---
  const [isDirty, setIsDirty] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) { hydrated.current = !isLoading; return; }
    setIsDirty(true);
  }, [aboutData, projects, blogs, socials, galleriaData, systemData, siteSettings, journalEntries, playlists, lightboxConfig, poemDeck, poems, isLoading]);

  // Warn before losing unsaved admin work
  useEffect(() => {
    if (!isDirty || !isAdmin) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isAdmin]);

  // --- Global ESC handling for every layered surface, innermost first ---
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showLogin) return setShowLogin(false);
        if (selectedItem) return setSelectedItem(null);
        if (activePoem) return setActivePoem(null);
        if (activeGalleriaImage) return setActiveGalleriaImage(null);
        if (pendingJournal) { setPendingJournal(null); setVisitorName(''); return; }
        if (activeJournal) return setActiveJournal(null);
        if (editingItem) return setEditingItem(null);
      }
      // Cmd/Ctrl+S deploys from anywhere in the admin panel
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && isAdmin) {
        e.preventDefault();
        saveAllToCloud(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Lock body scroll whenever an overlay owns the screen ---
  useEffect(() => {
    const locked = !!(selectedItem || showLogin || pendingJournal || activeJournal || activeGalleriaImage || activePoem);
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedItem, showLogin, pendingJournal, activeJournal, activeGalleriaImage, activePoem]);

  useEffect(() => { setAdminSearch(""); setConfirmDelete(null); }, [adminTab]);

  const adminCounts = {
    projects: projects.length,
    galleria: galleriaData.length,
    blogs: blogs.length,
    journals: journalEntries.length,
    socials: socials.length,
    messages: guestMessages.length,
    access_logs: accessLogs.length,
  };

  const tabs = [
    { id: 'intro', label: 'Intro' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'galleria', label: 'Galleria' },
    { id: 'system', label: 'System' },
    { id: 'blog', label: 'Blog' },
    { id: 'socials', label: 'Socials' },
    { id: 'blank', label: 'Playground' },
  ];
  if (isAdmin) tabs.push({ id: 'admin', label: 'Admin Panel' });

  /* Backdrop → CSS custom properties. Every surface that used to draw
     blueprint gridlines (.bg-blueprint) reads these instead, so one
     setting swaps the texture across the whole site. */
  const backdropVars = useMemo(() => {
    const bd = { ...defaultSettings.backdrop, ...(siteSettings.backdrop || {}) };
    const grid = 'linear-gradient(rgba(17,17,17,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.08) 1px, transparent 1px)';
    const hasImg = !!(bd.enabled && bd.image);
    const repeating = bd.size === 'repeat';
    // Tint rides along as a flat gradient layer so a panel's own bg-white /
    // bg-[#e5e5e5] class survives when the tint is switched off.
    const layers = !hasImg
      ? grid
      : [bd.useTint ? `linear-gradient(${bd.tint || 'transparent'}, ${bd.tint || 'transparent'})` : null, bd.keepGrid ? grid : null]
          .filter(Boolean).join(', ') || 'none';
    return {
      '--backdrop-layers': layers,
      '--backdrop-image': hasImg ? `url("${bd.image}")` : 'none',
      '--backdrop-size': repeating ? 'auto' : (bd.size || 'cover'),
      '--backdrop-position': bd.position || 'center',
      '--backdrop-repeat': repeating ? 'repeat' : 'no-repeat',
      '--backdrop-opacity': String(bd.opacity ?? 1),
      '--backdrop-blend': bd.blend || 'normal',
      '--backdrop-gray': `${bd.grayscale ?? 0}%`,
    };
  }, [siteSettings.backdrop]);

  const renderContent = () => {
    if (isLoading && activeTab !== 'admin') {
      // Skeleton beats a spinner: the page shape appears before the data does,
      // so nothing jumps when content lands.
      return (
        <div className="min-h-full pb-16 anim-fade">
          <div className="h-20 w-3/4 max-w-2xl skeleton border-[2px] border-[#111] mb-6" />
          <div className="h-4 w-1/2 skeleton border-[2px] border-[#111] mb-3" />
          <div className="h-4 w-2/5 skeleton border-[2px] border-[#111] mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="h-56 skeleton border-[2px] border-[#111] shadow-[6px_6px_0px_rgba(17,17,17,0.15)]" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.3em] text-gray-500" style={{ animation: 'softPulse 1.6s ease-in-out infinite' }}>Loading core systems</p>
        </div>
      );
    }

    if (siteSettings?.wip?.[activeTab] && activeTab !== 'admin') {
      if (!isAdmin) {
        return (
          <div className="min-h-full flex flex-col items-center justify-center text-center pb-20">
            <div className="w-24 h-24 mb-6 border-[3px] border-dashed border-[#111] rounded-full animate-[spin_6s_linear_infinite] flex items-center justify-center anim-stamp">
               <div className="w-16 h-16 bg-[#111] rounded-full" style={{ animation: 'softPulse 2.4s ease-in-out infinite' }}></div>
            </div>
            <h1 className="text-5xl md:text-6xl font-serif text-[#111] mb-4 anim-rise stagger-child" style={{ '--d': 1 }}>Under Construction</h1>
            <p className="font-mono text-gray-700 text-sm max-w-md anim-rise stagger-child" style={{ '--d': 2 }}>I am currently compiling this section. Please stand by for updates.</p>
          </div>
        );
      }
    }

    switch (activeTab) {
      case 'intro': {
        // Defensive: cloud payloads have shipped without introText before.
        const introLines = (aboutData?.introText || '').split('\n');
        const circle = aboutData?.myspace || [];
        const interests = aboutData?.interests || [];
        const obsessions = aboutData?.obsessions || [];

        const bootAccent = bootCfg.accent || '#00ff88';
        const host = bootCfg.hostname || 'iceyyy';
        const user = bootCfg.user || 'guest';
        const shell = bootCfg.shell || '~/about';
        const archive = bootCfg.archivePath || '/archive/obsessions';
        const booting = bootStep < BOOT_DONE;

        // A command prompt that heads each section as it comes online.
        // NOTE: a plain function, not a component — declaring a component inside
        // render gives it a new identity each pass and remounts its children.
        const promptRow = (cmd, step, note) => (
          <div className="font-mono text-[11px] md:text-xs mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 anim-left">
            <span style={{ color: bootAccent }}>{user}@{host}</span>
            <span className="text-gray-400">:</span>
            <span className="text-[#0000ff]">{shell}</span>
            <span className="text-gray-400">$</span>
            <span className="text-[#111] font-bold">
              <Typewriter text={cmd} active={bootStep === step} speed={bootSpeed * 3} />
            </span>
            {note && <span className="text-gray-400 text-[10px]">{note}</span>}
          </div>
        );

        return (
          <div className="flex flex-col lg:flex-row gap-8 items-start min-h-full pb-16 relative">
            <div className="flex-1 w-full space-y-14 min-w-0">

              {/* ============ CONSOLE / POST LOG ============ */}
              <div className="border-[2px] border-[#111] bg-[#0b0b0b] shadow-[8px_8px_0px_#111] relative overflow-hidden anim-rise">
                <div className="crt-scanlines absolute inset-0 pointer-events-none z-10" />

                <div className="flex items-center justify-between px-4 py-2 border-b-[2px] border-[#222] bg-[#111]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5722]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#dfff00]" />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: bootAccent }} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/40 ml-3 truncate">
                      {host}.core — tty0
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {booting ? (
                      <button onClick={skipBoot} className="font-mono text-[9px] uppercase tracking-[0.2em] px-2.5 py-1 border border-white/25 text-white/60 hover:text-[#111] hover:bg-white transition-colors">
                        Skip
                      </button>
                    ) : (
                      <button onClick={restartBoot} title="Replay boot sequence" className="font-mono text-[9px] uppercase tracking-[0.2em] px-2.5 py-1 border border-white/25 text-white/60 hover:text-[#111] hover:bg-white transition-colors flex items-center gap-1.5">
                        <Play size={9} /> Reboot
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 md:p-6 font-mono text-[10px] md:text-[11px] leading-relaxed min-h-[132px]">
                  {bootPostLines.slice(0, postIndex).map((line, i) => (
                    <div key={i} className="flex gap-3 anim-fade" style={{ color: bootAccent }}>
                      <span className="text-white/25 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="truncate">{line}</span>
                    </div>
                  ))}
                  {postIndex >= bootPostLines.length && (
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 anim-fade">
                      <span className="text-white/45">modules loaded: <span className="text-white">{interests.length}</span></span>
                      <span className="text-white/45">nodes linked: <span className="text-white">{circle.length}</span></span>
                      <span className="text-white/45">archives: <span className="text-white">{obsessions.length}</span></span>
                      <span style={{ color: bootAccent }}>
                        {booting ? 'initialising…' : 'system ready'}
                        {!booting && <span className="boot-caret ml-1">▊</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ============ IDENTITY ============ */}
              {bootStep >= 1 && (
                <div className="anim-rise">
                  {promptRow("cat identity.txt", 1)}
                  <div className="border-b-[2px] border-[#111] pb-10">
                    <h1 className="text-5xl md:text-7xl font-serif text-[#111] mb-6 tracking-tight leading-none anim-wipe">
                      Designed for Living, <br/><span className="italic text-gray-500">Built for You.</span>
                    </h1>
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="whitespace-pre-wrap font-sans text-lg text-gray-800 flex-1 leading-relaxed border-l-4 border-[#ff5722] pl-6 anim-left stagger-child" style={{ '--d': 1 }}>
                        <mark className="bg-[#dfff00] text-[#111] px-1">{introLines[0]}</mark>
                        {introLines.length > 1 && (
                          <Typewriter
                            text={'\n' + introLines.slice(1).join('\n')}
                            active={bootStep === 1}
                            speed={bootSpeed}
                            showCaret={false}
                          />
                        )}
                      </div>
                      {aboutData.introImage && (
                        <div className="group w-full md:w-64 shrink-0 shadow-[8px_8px_0px_#111] border-2 border-[#111] bg-white p-2 slide-card anim-right stagger-child overflow-hidden" style={{ '--d': 2 }}>
                          <img src={aboutData.introImage} alt="Intro" className="w-full grayscale img-reveal" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============ CIRCLE — nodes handshake, then resolve to photos ============ */}
              {bootStep >= 2 && (
                <div className="anim-rise">
                  {promptRow("netstat --peers", 2, `// ${circle.length} nodes`)}
                  <div className="bg-white border-[2px] border-[#111] shadow-[6px_6px_0px_#111] p-6 md:p-8 relative">
                    <div className="absolute -top-3 left-6 bg-[#ff5722] text-white font-mono text-xs font-bold px-3 py-1 border-[2px] border-[#111] anim-stamp">THE CIRCLE</div>
                    <h2 className="text-3xl font-serif text-[#111] mb-5 mt-2">People I Like</h2>

                    {/* connection log */}
                    <div className="font-mono text-[10px] leading-relaxed mb-6 bg-[#0b0b0b] border-[2px] border-[#111] p-3 md:p-4 overflow-x-auto">
                      {circle.map((friend, i) => (
                        <div key={friend.id ?? i} className="flex gap-3 whitespace-nowrap anim-fade stagger-child" style={{ '--d': i }}>
                          <span style={{ color: bootAccent }}>[OK]</span>
                          <span className="text-white/85">NODE_{String(friend.name || 'UNKNOWN').toUpperCase().replace(/\s+/g, '_')}</span>
                          <span className="text-white/25 hidden sm:inline">…………………</span>
                          <span className="text-white/45">connected</span>
                        </div>
                      ))}
                      {circle.length === 0 && <span className="text-white/40">no peers configured</span>}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {circle.map((friend, i) => (
                        <div key={friend.id ?? i} className="group flex flex-col items-center anim-rise stagger-child" style={{ '--d': 3 + i }}>
                          <div className="w-full aspect-square border-[2px] border-[#111] overflow-hidden bg-gray-100 mb-3 slide-card relative">
                            <img src={friend.image} alt={friend.name} className="w-full h-full object-cover grayscale img-reveal" />
                            <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: bootAccent, boxShadow: `0 0 6px ${bootAccent}`, animation: 'ledBlink 3s ease-in-out infinite', animationDelay: `${i * 400}ms` }} />
                          </div>
                          <p className="text-sm font-mono text-[#111] font-bold uppercase tracking-widest bg-[#dfff00] px-2 transition-transform duration-300 group-hover:-translate-y-0.5">{friend.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ============ INTERESTS AS RUNNING PROCESSES ============ */}
              {bootStep >= 3 && (
                <div className="anim-rise">
                  {promptRow("ps aux --sort=-%cpu", 3)}
                  <div className="border-[2px] border-[#111] bg-white shadow-[6px_6px_0px_#111]">
                    {/* table header */}
                    <div className="hidden md:grid grid-cols-[64px_1fr_92px_72px] gap-3 px-4 py-2 bg-[#111] text-white font-mono text-[9px] uppercase tracking-[0.2em]">
                      <span>PID</span><span>Process</span><span>%CPU</span><span>State</span>
                    </div>
                    <div className="divide-y-[2px] divide-[#111]">
                      {interests.map((interest, i) => {
                        const cpu = hashPct(String(interest.title || i), 11, 96);
                        const pid = 1000 + hashPct(String(interest.title || i), 100, 999);
                        return (
                          <div key={interest.id ?? i} className="group anim-rise stagger-child" style={{ '--d': i }}>
                            <div className="grid grid-cols-1 md:grid-cols-[64px_1fr_92px_72px] gap-3 px-4 py-3 items-center hover:bg-[#f4f4f0] transition-colors">
                              <span className="font-mono text-[10px] text-gray-400 hidden md:block">{pid}</span>
                              <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#111] truncate">{interest.title}</span>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-[#e5e5e5] border border-[#111] overflow-hidden">
                                  <div
                                    className="h-full origin-left"
                                    style={{
                                      width: `${cpu}%`,
                                      background: cpu > 80 ? '#ff5722' : cpu > 45 ? '#dfff00' : '#0000ff',
                                      animation: 'barFill 900ms var(--ease-out-expo) both',
                                      animationDelay: `${i * 110}ms`,
                                    }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-bold w-8 text-right">{cpu}</span>
                              </div>
                              <span className="font-mono text-[9px] uppercase tracking-widest text-[#111] bg-[#dfff00] border border-[#111] px-1.5 py-0.5 w-fit">running</span>
                            </div>

                            {/* expanded detail — the original card content, preserved */}
                            <div className="grid md:grid-cols-[200px_1fr] gap-4 px-4 pb-4 items-start">
                              <div className="overflow-hidden border-[2px] border-[#111]">
                                <img src={interest.image} alt={interest.title} className="w-full aspect-video object-cover grayscale img-reveal" />
                              </div>
                              <p className="text-xs text-gray-700 font-sans leading-relaxed whitespace-pre-wrap pt-1">{interest.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ============ TOP 10s AS DIRECTORY LISTINGS ============ */}
              {bootStep >= 4 && (
                <div className="anim-rise">
                  {promptRow(`ls -la ${archive}`, 4)}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {obsessions.map((obs, index) => {
                      const slug = String(obs.category || 'list').toLowerCase().replace(/[^a-z0-9]+/g, '_');
                      const items = obs.items || [];
                      return (
                        <div key={obs.id ?? index} className="border-[2px] border-[#111] bg-[#0b0b0b] shadow-[6px_6px_0px_#111] overflow-hidden slide-card anim-rise stagger-child" style={{ '--d': index }}>
                          <div className="flex justify-between items-center px-4 py-2 bg-[#111] border-b-[2px] border-[#222] gap-3">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] truncate" style={{ color: bootAccent }}>
                              {archive}/{slug}/
                            </span>
                            <span className="font-mono text-[9px] text-white/35 whitespace-nowrap">{items.length} items</span>
                          </div>
                          <div className="p-3 md:p-4 font-mono text-[10px] md:text-[11px] overflow-x-auto">
                            <p className="text-white/30 mb-2 whitespace-nowrap">total {items.length * 4}</p>
                            {items.map((item, i) => (
                              <div key={i} className="flex gap-3 items-baseline whitespace-nowrap hover:bg-white/5 px-1 -mx-1 transition-colors group">
                                <span className="text-white/25 hidden sm:inline">-rw-r--r--</span>
                                <span className="text-white/25 hidden md:inline w-8 text-right">{4 + i}k</span>
                                <span className="text-white/40 w-6 text-right shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-white/90 truncate group-hover:text-[#dfff00] transition-colors">{item}</span>
                              </div>
                            ))}
                            {items.length === 0 && <span className="text-white/30">empty directory</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============ READY PROMPT ============ */}
              {bootStep >= BOOT_DONE && (
                <div className="font-mono text-[11px] md:text-xs flex items-center gap-2 anim-fade pt-2">
                  <span style={{ color: bootAccent }}>{user}@{host}</span>
                  <span className="text-gray-400">:</span>
                  <span className="text-[#0000ff]">{shell}</span>
                  <span className="text-gray-400">$</span>
                  <span className="boot-caret text-[#111]">▊</span>
                </div>
              )}
            </div>

            {/* Right Side Memo & Mood Checker */}
            {bootStep >= 2 && (
            <div className="w-full lg:w-72 shrink-0 mt-8 lg:mt-0 flex flex-col gap-8 lg:sticky lg:top-8 self-start z-20">

              <div className="bg-[#dfff00] p-6 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] relative anim-right stagger-child" style={{ '--d': 2 }}>
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#0000ff] rounded-full border-[2px] border-[#111] flex items-center justify-center text-white shadow-sm anim-stamp"><Pin size={16}/></div>
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#111] mb-4 border-b-[2px] border-[#111] pb-2">System Memo</p>
                <p className="font-sans text-[#111] leading-relaxed text-sm">
                  {aboutData.notepadText || "No active memos."}
                </p>
              </div>

              {/* MOOD CHECKER COMPONENT */}
              <div className="w-full border-[2px] border-[#111] shadow-[8px_8px_0px_#111] rounded-xl overflow-hidden flex flex-col bg-white select-none anim-right stagger-child" style={{ '--d': 3 }}>
                 {/* Top Row */}
                 <div className="flex h-16 border-b-[2px] border-[#111]">
                    <div className="flex-1 bg-[#f4f4f0] flex items-center px-5">
                       <span className="font-sans text-3xl font-semibold tracking-tighter text-[#111]">Mood<span className="text-[#ff5722]">.</span></span>
                    </div>
                    <div className="w-16 shrink-0 border-l-[2px] border-[#111] relative overflow-hidden"
                         style={{ background: 'conic-gradient(from 145deg at 50% 50%, #d1d5db 0deg, #f9fafb 90deg, #9ca3af 180deg, #f9fafb 270deg, #d1d5db 360deg)' }}>
                         <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.9) 50%, transparent 60%)' }}></div>
                    </div>
                 </div>

                 {/* Bottom Row */}
                 <div className="flex h-[13rem]">
                    <div className="w-[35%] bg-[#ff5722] flex flex-col border-r-[2px] border-[#111]">
                       <div className="h-16 border-b-[2px] border-[#111] bg-[#111]"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #111, #111 3px, #ff5722 3px, #ff5722 4px)' }}>
                       </div>
                       <div className="flex-1 flex flex-col items-center justify-center relative">
                          <span className="font-sans text-6xl font-medium tracking-tighter text-[#111] -mt-6">{aboutData.mood?.score || "85"}</span>
                          <div className="w-8 h-8 rounded-full bg-[#111] text-[#ff5722] flex items-center justify-center font-sans text-sm font-bold absolute bottom-4">
                             %
                          </div>
                       </div>
                    </div>

                    <div className="flex-1 bg-[#f4f4f0] flex flex-col p-5 relative">
                       <div className="flex justify-between items-center font-mono text-[10px] text-[#111] uppercase tracking-widest mb-auto">
                          <span className="cursor-pointer hover:opacity-50 transition-opacity">&larr;</span>
                          <span>status: {aboutData.mood?.status || "OPTIMAL"}</span>
                          <span className="cursor-pointer hover:opacity-50 transition-opacity">&rarr;</span>
                       </div>

                       <div className="mt-auto">
                          <h3 className="font-sans text-[#111] font-semibold text-2xl leading-[1.1] tracking-tight mb-2 whitespace-pre-wrap">{aboutData.mood?.title || "System\nStability"}</h3>
                          <p className="font-sans text-[11px] text-gray-500 leading-snug whitespace-pre-wrap">{aboutData.mood?.desc || "Performance score and\nemotional statistics for Q3."}</p>
                       </div>
                    </div>
                 </div>
              </div>

            </div>
            )}
          </div>
        );
      }

      case 'portfolio': {
        const containerHeightRem = 6 + projects.length * 1.6;
        return (
          <div className="min-h-full pb-16 flex flex-col items-center">
            
            <div className="w-full text-center border-b-[2px] border-[#111] pb-8 mb-12">
               <h1 className="text-5xl md:text-7xl font-serif text-[#111] tracking-tight uppercase mb-2 anim-wipe">Project Index</h1>
               <p className="font-mono text-gray-500 text-sm anim-rise stagger-child" style={{ '--d': 1 }}>A complete repository of engineering and design deliverables.</p>
            </div>

            <div className="w-full max-w-4xl flex flex-col items-center relative z-20">
              <div 
                className="w-[96%] relative overflow-hidden flex justify-center bg-blueprint border-x-[2px] border-t-[2px] border-[#111]"
                style={{ height: `${containerHeightRem}rem`, minHeight: '14rem' }}
              >
                {/* 1. The Slanted Grey Background (Pure Trapezoid) */}
                <div 
                  className="absolute inset-0 bg-[#e5e5e5] z-0 opacity-80"
                  style={{ clipPath: 'polygon(10% 2.5rem, 90% 2.5rem, 98% 100%, 2% 100%)' }}
                ></div>

                {/* 2. The Perspective Lines */}
                <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" style={{ overflow: 'visible' }}>
                   <line x1="10%" y1="2.5rem" x2="90%" y2="2.5rem" stroke="#111" strokeWidth="2" />
                   <line x1="10%" y1="2.5rem" x2="2%" y2="100%" stroke="#111" strokeWidth="2" />
                   <line x1="90%" y1="2.5rem" x2="98%" y2="100%" stroke="#111" strokeWidth="2" />
                </svg>
                
                {projects.map((item, i) => {
                  const zIndex = 20 + i;
                  const topPos = 2.5 + (i * 1.6); 
                  const progressY = (topPos - 2.5) / (containerHeightRem - 2.5);
                  const leftPercent = 10 - (progressY * 8); 
                  const widthPercent = 100 - (leftPercent * 2);
                  const colIndex = i % 5;
                  const leftOffset = colIndex * 19.5;
                  
                  const isBlack = item.author?.toLowerCase() === 'black' || item.type === 'divider';
                  const folderBg = isBlack ? 'bg-[#111]' : 'bg-white';
                  const textColor = isBlack ? 'text-white' : 'text-[#111]';
                  const borderColor = 'border-[#111]';

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => openModal(item, 'project')}
                      className="absolute cursor-pointer group select-none anim-left stagger-child hover:-translate-y-3 hover:drop-shadow-[0_12px_0_rgba(17,17,17,0.18)]"
                      style={{ top: `${topPos}rem`, left: `${leftPercent}%`, width: `${widthPercent}%`, zIndex: zIndex, '--d': i, transition: 'transform 420ms var(--ease-out-expo), filter 420ms ease' }}
                    >
                      <div 
                        className={`absolute -top-[1.75rem] h-[2rem] w-[22%] min-w-[50px] ${folderBg} border-[2px] ${borderColor} border-b-0 rounded-t-sm flex items-center justify-between px-2 z-20`}
                        style={{ left: `${leftOffset}%` }}
                      >
                        <span className={`font-mono text-[9px] md:text-[11px] font-bold ${textColor}`}>
                          {isBlack ? (item.title || '?').charAt(0).toUpperCase() : (i+94).toString().padStart(3, '0')}
                        </span>
                        <div className={`w-[1px] h-[50%] ${isBlack ? 'bg-white/20' : 'bg-[#111]/30'} mx-1 md:mx-2`}></div>
                        <span className={`font-mono text-[9px] md:text-[11px] font-bold truncate ${textColor} uppercase tracking-wider`}>
                          {isBlack ? (i+3).toString().padStart(3, '0') : (item.title || 'UNTITLED').split(' ')[0]}
                        </span>
                      </div>
                      <div 
                        className={`absolute -top-[2px] h-[4px] bg-transparent z-30 pointer-events-none flex justify-center`}
                        style={{ left: `${leftOffset}%`, width: '22%' }}
                      >
                         <div className={`w-[calc(100%-4px)] h-full ${folderBg}`}></div>
                      </div>
                      <div className={`w-full h-[24rem] ${folderBg} border-[2px] ${borderColor} relative z-10`}>
                         <div className="absolute top-0 left-0 w-full h-[1px] bg-black/10 pointer-events-none"></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="w-[100%] h-14 bg-[#111] border-[2px] border-[#111] border-b-[16px] z-50 flex items-center justify-center relative mt-[-2px]">
                 <div className="absolute bottom-[-12px] right-8 md:right-16 bg-[#dfff00] px-4 py-1.5 border-[2px] border-[#111] shadow-[4px_4px_0px_#111] font-mono font-bold text-[10px] md:text-xs uppercase tracking-widest hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111] transition-all cursor-pointer z-50">
                   System Files
                 </div>
              </div>

            </div>
          </div>
        );
      }

      case 'galleria':
        return (
          <div className="w-full flex flex-col gap-12 pb-16">
            <div className="w-full h-[70vh] min-h-[500px] relative overflow-hidden bg-blueprint bg-[#e5e5e5] border-[2px] border-[#111] shadow-[8px_8px_0px_#111] flex items-center justify-center shrink-0 anim-rise"
                 onWheel={(e) => {
                   // Clamp: previously you could scroll indefinitely past the
                   // last image and end up staring at empty blueprint.
                   const span = Math.max(0, galleriaData.length - 1) * 55 + 600;
                   setGalleriaPanX(p => Math.min(span, Math.max(-span, p - e.deltaY * 2.5)));
                 }}>
              
              <div className="absolute top-8 left-8 font-mono text-[10px] font-bold tracking-widest uppercase text-[#111] bg-[#dfff00] px-3 py-1 border-[2px] border-[#111] z-20 shadow-[2px_2px_0px_#111]">
                 Timeline : Infinite
              </div>
              
              {galleriaData.length === 0 ? (
                 <p className="text-gray-500 font-serif text-3xl">No images uploaded.</p>
              ) : (
                 /* THE 3D VIEWPORT */
                 <div className="gal-viewport absolute inset-0 w-full h-full pointer-events-none">
                    
                    {/* THE 3D SCENE (Shifted to perfectly cross center of screen) */}
                    <div className="gal-scene absolute top-[60%] left-[50%] pointer-events-auto"
                         style={{ transform: `rotateX(60deg) rotateZ(45deg) translateY(${galleriaPanX}px)` }}>
                      
                      {galleriaData.map((img, i) => (
                         <div key={img.id} 
                              /* Journal photos still hit the ticket gate first;
                                 everything else slams open the sticker lightbox. */
                              onClick={() => {
                                if (img.hasJournal) return setPendingJournal(img);
                                if (lightboxConfig.enabled) setActiveGalleriaImage({ item: img, index: i });
                              }} 
                              style={{ '--i': i }}
                              className="gal-item group cursor-pointer">
                            
                            {/* Image respects its own aspect ratio while filling the height */}
                            <img src={img.image} className="h-full w-auto max-w-none grayscale group-hover:grayscale-0 transition-all duration-[600ms] block" alt="galleria" />
                            
                            {/* Hover Tag */}
                            <div className="absolute bottom-3 left-3 p-1.5 bg-[#dfff00] border-[2px] border-[#111] opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[4px_4px_0px_#111] flex items-center gap-2">
                               <p className="text-[#111] font-mono font-bold tracking-widest uppercase text-[10px] whitespace-nowrap">{img.date}</p>
                               
                               {/* VISUAL CUE: Only shows up if this specific photo has a journal entry */}
                               {img.hasJournal && (
                                  <span className="bg-[#ff5722] text-white px-1.5 py-0.5 text-[8px] tracking-widest shadow-sm" style={{ animation: 'softPulse 2s ease-in-out infinite' }}>MEMO ATTACHED ↗</span>
                               )}
                            </div>
                            
                         </div>
                      ))}
                    </div>
                 </div>
              )}

              <div className="absolute bottom-8 right-8 flex items-center gap-4 text-[#111] font-mono text-[10px] font-bold uppercase z-20 bg-white px-3 py-1 border-[2px] border-[#111] shadow-[2px_2px_0px_#111]">
                 <span>Scroll to pan</span>
                 <div className="flex gap-1">
                    <span className="w-4 h-4 rounded-full border-[2px] border-[#111] flex items-center justify-center bg-[#dfff00]">&larr;</span>
                    <span className="w-4 h-4 rounded-full border-[2px] border-[#111] flex items-center justify-center bg-[#dfff00]">&rarr;</span>
                 </div>
              </div>
            </div>

            {/* PLAYLISTS SECTION (Underneath Galleria) */}
            <div className="w-full">
              <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-10">
                 <h2 className="text-4xl md:text-5xl font-serif text-[#111] tracking-tight">Audio Archives</h2>
                 <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest bg-[#111] text-white px-3 py-1 border-[2px] border-[#111] shadow-[4px_4px_0px_#ff5722]">Curated Playlists</span>
              </div>

              {playlists.length === 0 ? (
                <p className="font-mono text-gray-500 text-sm">No playlists configured.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {playlists.map((pl, plIdx) => ({ ...pl, __i: plIdx })).map((pl) => (
                      <div key={pl.id} style={{ backgroundColor: pl.color || '#333', '--d': pl.__i }} className="rounded-[2.5rem] overflow-hidden shadow-[8px_8px_0px_rgba(17,17,17,0.3)] flex flex-col text-white border-[2px] border-transparent hover:border-[#111] group relative anim-rise stagger-child slide-card">
                         
                         {/* Image & Gradient Fade Area */}
                         <div className="w-full h-56 relative shrink-0 bg-[#111]">
                            {pl.image && <img src={pl.image} alt={pl.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 text-transparent" />}
                            {/* CSS Gradient dynamically bound to the configured hex color */}
                            <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to bottom, transparent 10%, ${pl.color || '#333'} 100%)` }}></div>
                         </div>
                         
                         {/* Text Content Area */}
                         <div className="px-8 pb-8 pt-0 flex-1 flex flex-col relative z-10">
                            {/* Title & Genre Tag */}
                            <div className="flex justify-between items-center mb-4 gap-4">
                               <h3 className="font-sans font-bold text-2xl tracking-tight truncate">{pl.title}</h3>
                               {pl.genre && <span className="font-sans text-[11px] font-bold tracking-wider bg-black/40 px-3 py-1.5 rounded-full shrink-0">{pl.genre}</span>}
                            </div>
                            
                            {/* Description */}
                            <p className="font-sans text-sm text-white/70 leading-relaxed mb-6 flex-1 line-clamp-3">{pl.description}</p>
                            
                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mb-8">
                               {pl.price && <span className="font-sans text-[10px] font-medium tracking-wide bg-white/10 px-3 py-1.5 rounded-full text-white/90">{pl.price}</span>}
                               {pl.tags && <span className="font-sans text-[10px] font-medium tracking-wide bg-white/10 px-3 py-1.5 rounded-full text-white/90">{pl.tags}</span>}
                            </div>
                            
                            {/* Action Button */}
                            <a href={pl.url} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-white text-black font-sans font-bold text-sm rounded-full text-center hover:bg-[#dfff00] transition-colors shadow-lg hover:scale-[1.02] active:scale-95">
                               Listen Now
                            </a>
                         </div>
                      </div>
                   ))}
                </div>
              )}
            </div>

            {/* VERSE INDEX / PATCH SLEEVE (sits under Audio Archives) */}
            {poemDeck.enabled && (
              <div className="w-full">
                <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-10">
                   <h2 className="text-4xl md:text-5xl font-serif text-[#111] tracking-tight">Verse Sleeve</h2>
                   <span className="font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest bg-[#111] text-white px-3 py-1 border-[2px] border-[#111] shadow-[4px_4px_0px_#dfff00]">Click a line</span>
                </div>
                <PoemDeck deck={poemDeck} poems={poems} onOpen={(p) => { setPoemShuffle(s => s + 1); setActivePoem(p); }} />
              </div>
            )}
          </div>
        );

      case 'system': {
        return (
          <div className="min-h-full pb-16 relative z-30 font-sans">
            <div className="bg-[#f4f4f0] border-[2px] border-[#111] shadow-[12px_12px_0px_#111] relative w-full overflow-hidden flex flex-col h-[80vh] min-h-[700px] anim-sheet">
              <div className="bg-[#111] text-[#f4f4f0] px-5 py-4 flex justify-between items-center border-b-[2px] border-[#111] shrink-0 z-20 relative">
                 <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#ff5722]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#dfff00]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#0000ff]"></div>
                 </div>
                 <h1 className="text-xl font-mono font-bold tracking-[0.2em] uppercase absolute left-1/2 -translate-x-1/2">{systemData?.title || 'System Core'}</h1>
                 <div className="flex gap-2">
                    {(systemData?.navPills || []).slice(0, 2).map((nav, i) => (
                       <div key={i} style={{ '--d': i }} className="hidden md:block bg-transparent border border-white/30 text-white px-3 py-1 font-mono text-[10px] uppercase tracking-widest anim-right stagger-child">
                          {nav}
                       </div>
                    ))}
                 </div>
              </div>
              {/* Rack label strip between the window chrome and the bay */}
              <div className="bg-[#0d0d0d] border-b-[2px] border-[#2e2e2e] px-5 py-2 flex items-center justify-between gap-4 shrink-0">
                 <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/45 truncate">{systemData?.rackLabel || 'RACK'}</span>
                 <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/30 whitespace-nowrap flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" style={{ boxShadow: '0 0 8px #00ff88', animation: 'ledBlink 2s ease-in-out infinite' }} />
                    {(systemData?.cables || []).length} patched
                 </span>
              </div>

              <PatchBay
                data={systemData}
                isAdmin={isAdmin}
                onChange={setSystemData}
                onToast={showToast}
              />
            </div>
          </div>
        );
      }

      case 'blog': {
        const filteredBlogs = (blogs || []).filter(b => (b.blogCategory || 'anime') === blogCategoryFilter);

        return (
          <div className="min-h-full pb-16 max-w-7xl mx-auto flex flex-col relative items-start">
            
            <div className="w-full flex flex-col md:flex-row justify-between items-end border-b-[2px] border-[#111] pb-4 mb-10 pt-6">
               <h1 className="text-5xl md:text-6xl font-serif text-[#111] tracking-tight anim-wipe">Transmission Log</h1>
               <div className="flex gap-2 mt-4 md:mt-0">
                  {['anime', 'manhwa', 'shows'].map(cat => (
                     <button key={cat} onClick={() => setBlogCategoryFilter(cat)} className={`relative font-mono text-[10px] md:text-xs font-bold uppercase px-4 py-2 border-[2px] border-[#111] slide-press overflow-hidden ${blogCategoryFilter === cat ? 'bg-[#111] text-[#dfff00] shadow-[2px_2px_0px_#ff5722] -translate-y-[2px]' : 'bg-white text-[#111] hover:bg-[#dfff00]'}`}>
                        {cat}
                        {blogCategoryFilter === cat && <span className="absolute left-0 bottom-0 h-[3px] w-full bg-[#ff5722] origin-left" style={{ animation: 'barFill 420ms var(--ease-out-expo) both' }} />}
                     </button>
                  ))}
               </div>
            </div>

            {filteredBlogs.length === 0 ? (
               <p className="text-lg font-mono text-gray-500 w-full text-center py-20">No logs found in this sector.</p>
            ) : (
               <>
                  {blogCategoryFilter === 'anime' && (
                     <div className="flex flex-col lg:flex-row gap-8 w-full">
                        <div className="flex-1 w-full min-w-0">
                           <div className="space-y-8">
                             {filteredBlogs.filter(b => b.type !== 'album').map((p, bi) => ({ ...p, __i: bi })).map((post) => (
                               <div key={post.id} onClick={() => openModal(post, 'blog')} style={{ '--d': post.__i }} className="bg-white flex flex-col md:flex-row border-[2px] border-[#111] shadow-[6px_6px_0px_#111] slide-card cursor-pointer group anim-rise stagger-child overflow-hidden">
                                 {post.coverImage && (
                                   <div className="w-full md:w-[35%] h-64 md:h-auto shrink-0 overflow-hidden border-b-[2px] md:border-b-0 md:border-r-[2px] border-[#111]">
                                     <img src={post.coverImage} className={`w-full h-full object-cover grayscale img-reveal ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'img-duotone' : ''}`} alt="cover"/>
                                     {(post.imageEffect === 'ascii' || post.imageEffect === 'both') && <div className="effect-ascii-overlay"></div>}
                                   </div>
                                 )}
                                 <div className="p-6 md:p-8 flex-1 flex flex-col justify-center min-w-0">
                                   <div className="flex justify-between items-start mb-4">
                                     <p className="font-mono text-xs font-bold bg-[#e5e5e5] px-2 py-1 border border-[#111]">{post.date}</p>
                                     {post.rating && !isNaN(Number(post.rating)) && (
                                       <div className="flex text-[#ff5722] shrink-0 gap-0.5">
                                         {[...Array(Math.max(0, Number(post.rating)))].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                                       </div>
                                     )}
                                   </div>
                                   <h2 className="font-serif text-3xl md:text-4xl mb-4 text-[#111] group-hover:text-[#0000ff] transition-colors leading-tight">{post.title}</h2>
                                   <div className="flex gap-2 mb-4">
                                      {post.category && <span className="text-[10px] font-bold uppercase tracking-widest text-[#111] bg-[#dfff00] px-2 py-1 border border-[#111]">{post.category}</span>}
                                   </div>
                                   <p className="font-sans text-gray-700 text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">{post.excerpt}</p>
                                 </div>
                               </div>
                             ))}
                           </div>
                        </div>

                        <div className="w-full lg:w-[340px] shrink-0 lg:mt-8 sticky top-8 z-10 self-start">
                          <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-2 mb-6">
                             <h2 className="text-2xl font-serif text-[#111]">Audio Logs</h2>
                             <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">Vinyl Collection</span>
                          </div>
                          <div className="bg-[#111] p-6 rounded-sm shadow-[8px_8px_0px_rgba(17,17,17,0.2)] flex flex-col-reverse gap-1.5 min-h-[400px] border-[2px] border-[#111] relative overflow-hidden">
                              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                              {filteredBlogs.filter(b => b.type === 'album').map((a, ai) => ({ ...a, __i: ai })).map(album => (
                                  <div key={album.id} onClick={() => openModal(album, 'blog')} className="spine h-12 bg-white border border-[#333] cursor-pointer hover:bg-[#dfff00] flex items-center px-4 relative group anim-right stagger-child" style={{ '--d': album.__i }}>
                                     <div className="w-2 h-full bg-[#e5e5e5] absolute left-0 top-0 border-r border-[#ccc]"></div>
                                     <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#111] truncate w-full pl-3 group-hover:text-[#ff5722] transition-colors">{album.title}</span>
                                     <div className="absolute right-0 top-0 h-full w-10 bg-[#111] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 border-l border-black/20" 
                                          style={{ backgroundImage: 'repeating-linear-gradient(90deg, #111, #111 2px, #333 3px, #111 4px)' }}>
                                     </div>
                                  </div>
                              ))}
                          </div>
                        </div>
                     </div>
                  )}

                  {blogCategoryFilter === 'manhwa' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                       {filteredBlogs.map((p, mi) => ({ ...p, __i: mi })).map(post => (
                          <div key={post.id} onClick={() => openModal(post, 'blog')} style={{ '--d': post.__i }} className="relative w-full min-h-[480px] bg-[#111] rounded-[24px] overflow-hidden shadow-[8px_8px_0px_#111] border-[2px] border-[#111] cursor-pointer group flex flex-col justify-end p-8 slide-card pb-6 anim-rise stagger-child">
                             <div className="absolute inset-0 z-0 bg-[#111]">
                                <img src={post.coverImage} className={`w-full h-[60%] object-cover transition-transform duration-700 group-hover:scale-105 ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'img-duotone opacity-80' : ''}`} alt={post.title} />
                                {(post.imageEffect === 'ascii' || post.imageEffect === 'both') && <div className="effect-ascii-overlay mix-blend-color-dodge opacity-60"></div>}
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#111]/90 to-[#111] h-full w-full"></div>
                             </div>
                             
                             <div className="absolute top-8 left-8 z-10 font-serif text-white/80 text-sm tracking-wide">{post.date}</div>
                             
                             <div className="relative z-10 flex flex-col gap-4">
                                <h2 className="text-4xl font-serif text-white leading-tight">{post.title}</h2>
                                <p className="font-sans text-white/70 text-sm line-clamp-3">{post.excerpt}</p>
                                <div className="flex mt-2">
                                   <span className="border-[2px] border-white/20 rounded-full px-5 py-2 text-white font-bold group-hover:bg-white group-hover:text-[#111] group-hover:border-white transition-all duration-300 shadow-sm text-sm inline-flex items-center gap-2">Read entry <ChevronRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" /></span>
                                </div>
                             </div>
                             
                             <div className="relative w-full flex justify-between items-center text-white/50 text-[10px] font-sans z-10 border-t border-white/10 pt-4 mt-8">
                                <span className="font-bold tracking-wider text-white uppercase">{post.category || 'iceyyy.design'}</span>
                                <span className="tracking-widest uppercase truncate max-w-[60%] text-right text-white font-bold">{(post.tags?.toString() || '').split(',').join(' ✦ ')}</span>
                             </div>
                          </div>
                       ))}
                    </div>
                  )}

                  {blogCategoryFilter === 'shows' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 w-full">
                       {filteredBlogs.map((p, si) => ({ ...p, __i: si })).map(post => (
                          <div key={post.id} onClick={() => openModal(post, 'blog')} style={{ '--d': post.__i }} className="bg-[#111] p-6 md:p-8 border-[2px] border-[#333] cursor-pointer group hover:-translate-y-2 hover:border-[#ff5722] transition-all duration-[380ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col anim-rise stagger-child">
                             <div className="relative w-full aspect-[4/3] bg-[#ff5722] mb-8 overflow-hidden border-[2px] border-[#333]">
                                 <img src={post.coverImage} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'mix-blend-multiply grayscale contrast-[1.2]' : ''}`} alt={post.title} />
                                 {(post.imageEffect === 'ascii' || post.imageEffect === 'both') && <div className="effect-ascii-overlay mix-blend-color-dodge opacity-80"></div>}
                             </div>
                             
                             {post.category && <span className="text-[#ff5722] font-bold text-[10px] uppercase tracking-widest mb-1">{post.category}</span>}
                             <h2 className="font-mono text-white text-base md:text-lg uppercase tracking-widest mb-4 font-bold leading-tight">{post.title}</h2>
                             <p className="font-mono text-gray-400 text-xs md:text-sm uppercase mb-8 leading-relaxed flex-1 line-clamp-4">{post.excerpt}</p>
                             
                             <ul className="space-y-4 mt-auto border-t-[1px] border-[#444] pt-6">
                               {(post.tags?.toString() || '').split(',').map((tag, i) => (
                                 <li key={i} className="font-mono text-[10px] md:text-xs text-white flex gap-3 items-center">
                                    <span className="text-[#ff5722] font-bold">&gt;</span> 
                                    <span className="bg-white/10 text-white px-2 py-1 leading-none font-bold uppercase tracking-wider">{tag.trim()}</span>
                                 </li>
                               ))}
                             </ul>
                          </div>
                       ))}
                    </div>
                  )}
               </>
            )}
          </div>
        );
      }

      case 'blank':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center relative">
            <div className="border-[2px] border-[#111] p-8 md:p-12 w-full max-w-2xl bg-white shadow-[8px_8px_0px_#111] anim-sheet">
              <div className="border-b-[2px] border-[#111] pb-6 mb-8 text-center">
                 <h1 className="text-5xl font-serif text-[#111] mb-2">Public Sandbox</h1>
                 <p className="text-gray-600 font-mono text-xs uppercase tracking-widest">End-to-End Encryption Disabled</p>
              </div>
              
              <div className="flex gap-2 mb-6 justify-center">
                <button type="button" onClick={() => setPlaygroundMode('text')} className={`flex items-center gap-2 px-6 py-2 border-[2px] border-[#111] font-mono text-sm font-bold slide-press ${playgroundMode === 'text' ? 'bg-[#dfff00] shadow-[2px_2px_0px_#111] -translate-y-[2px]' : 'bg-white hover:bg-gray-100'}`}><Type size={16}/> TEXT</button>
                <button type="button" onClick={() => setPlaygroundMode('draw')} className={`flex items-center gap-2 px-6 py-2 border-[2px] border-[#111] font-mono text-sm font-bold slide-press ${playgroundMode === 'draw' ? 'bg-[#dfff00] shadow-[2px_2px_0px_#111] -translate-y-[2px]' : 'bg-white hover:bg-gray-100'}`}><Pencil size={16}/> SKETCH</button>
              </div>

              <form onSubmit={sendAnonymousMessage}>
                {playgroundMode === 'text' ? (
                  <textarea required value={newGuestMessage} onChange={(e) => setNewGuestMessage(e.target.value)} placeholder="Enter transmission..." className="w-full h-48 p-4 border-[2px] border-[#111] bg-[#f4f4f0] outline-none font-mono text-sm text-[#111] resize-none mb-6 focus:bg-white transition-colors" />
                ) : (
                  <div className="mb-6 touch-none relative border-[2px] border-[#111] bg-blueprint">
                    <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-64 cursor-crosshair relative z-10" />
                  </div>
                )}
                <div className="flex gap-3">
                  {playgroundMode === 'draw' && (
                    <button type="button" onClick={clearCanvas} className="px-5 py-4 bg-white text-[#111] border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest slide-press flex items-center gap-2 shrink-0"><RotateCcw size={16}/> CLEAR</button>
                  )}
                  <button disabled={isSendingMessage} type="submit" className="flex-1 bg-[#111] text-[#f4f4f0] font-mono font-bold uppercase tracking-widest py-4 border-[2px] border-[#111] hover:bg-[#dfff00] hover:text-[#111] transition-colors flex items-center justify-center gap-3 disabled:opacity-50">
                    {isSendingMessage ? <span style={{ animation: 'softPulse 1.2s ease-in-out infinite' }}>UPLOADING...</span> : <><Send size={18}/> SUBMIT LOG</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'socials':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center">
            <h1 className="text-5xl md:text-7xl font-serif text-[#111] mb-12 tracking-tight border-b-[2px] border-[#111] pb-4 anim-wipe">External Links</h1>
            {socials.length === 0 ? (
              <p className="text-xl font-mono text-gray-500 text-center">Awaiting configuration.</p>
            ) : (
              <div className="flex gap-6 flex-wrap justify-center">
                {socials.map((social, i) => (
                  <a key={social.id} href={social.url} target="_blank" rel="noopener noreferrer" className="bg-white p-4 border-[2px] border-[#111] shadow-[6px_6px_0px_#111] slide-card cursor-pointer w-48 text-center group block anim-rise stagger-child" style={{ '--d': i }}>
                    <div className="w-full h-32 bg-[#f4f4f0] border-[2px] border-[#111] mb-4 overflow-hidden flex items-center justify-center">
                      {social.image ? <img src={social.image} alt={social.name} className="w-full h-full object-cover grayscale img-reveal" /> : <span className="font-mono text-[#111] text-xs font-bold">MISSING_IMG</span>}
                    </div>
                    <span className="font-mono font-bold text-sm uppercase tracking-widest text-[#111] bg-[#dfff00] px-2 py-1">{social.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );

      case 'admin':
        if (!isAdmin) return null;
        
        if (editingItem) {
          return (
            <div className="max-w-5xl mx-auto bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] mb-16 relative anim-sheet">
              <button aria-label="Close editor" onClick={() => setEditingItem(null)} className="absolute top-4 right-4 text-[#111] hover:bg-[#111] hover:text-white p-2 border-[2px] border-transparent hover:border-[#111] transition-colors"><X size={24}/></button>

              <button type="button" onClick={() => setEditingItem(null)} className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-[#ff5722] transition-colors flex items-center gap-1 mb-3">
                <ChevronLeft size={14}/> Back to {adminTab.replace('_',' ')}
              </button>
              <h2 className="text-3xl font-serif border-b-[2px] border-[#111] pb-4 mb-2">
                {editingItem.id ? 'Edit Record' : 'New Record'}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-8">Esc to cancel · changes apply on commit</p>
              
              <form onSubmit={(e) => handleListSave(e, adminTab)} className="space-y-6 font-mono text-sm">
                
                {adminTab === 'projects' && (
                  <>
                    <div className="flex items-center gap-4 bg-[#f4f4f0] p-4 border-[2px] border-[#111]">
                      <label className="font-bold uppercase tracking-widest">Type:</label>
                      <select value={editingItem.type || 'project'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="p-2 border-[2px] border-[#111] bg-white font-bold outline-none">
                         <option value="project">Standard Project</option>
                         <option value="gallery">Canvas Gallery</option>
                         <option value="video">Video Player</option>
                         <option value="custom">Custom HTML</option>
                         <option value="iframe">URL Embed</option>
                         <option value="divider">Black Folder</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Tab ID</label>
                        <input value={editingItem.tabId || ''} onChange={e => setEditingItem({...editingItem, tabId: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Tab Title</label>
                        <input value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Alignment</label>
                        <select value={editingItem.tabAlign || 'left'} onChange={e => setEditingItem({...editingItem, tabAlign: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none">
                           <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    {editingItem.type !== 'divider' && (
                      <>
                        <div>
                          <label className="block font-bold uppercase mb-2">Media URL</label>
                          <div className="flex gap-2">
                            <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                            <label className="cursor-pointer bg-[#111] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#ff5722] transition-colors">
                              <Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block font-bold uppercase mb-2">Content Payload</label>
                          {editingItem.type === 'custom' ? (
                             <textarea placeholder="<style>...</style> <div>My Code</div>" value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-4 border-[2px] border-[#111] bg-[#111] text-[#00ff00] h-64 outline-none" />
                          ) : editingItem.type === 'iframe' ? (
                             <input placeholder="https://..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                          ) : (
                             <textarea placeholder="Description..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-4 border-[2px] border-[#111] h-32 outline-none focus:bg-[#dfff00]" />
                          )}
                        </div>
                        
                        {editingItem.type === 'gallery' && (
                          <div className="p-6 border-[2px] border-[#111] bg-[#f4f4f0]">
                            <h3 className="font-bold uppercase border-b-[2px] border-[#111] pb-2 mb-4 flex items-center gap-2"><LayoutGrid size={18}/> Canvas Image Array</h3>
                            <div className="flex flex-wrap gap-4 mb-6">
                              {(editingItem.galleryBlocks || []).map((block, idx) => (
                                <div key={idx} className="relative group border-[2px] border-[#111] p-2 bg-white w-48">
                                  <button type="button" onClick={() => { const n = [...editingItem.galleryBlocks]; n.splice(idx, 1); setEditingItem({...editingItem, galleryBlocks: n}); }} className="absolute -top-3 -right-3 bg-[#ff5722] text-white border-[2px] border-[#111] p-1 opacity-0 group-hover:opacity-100 z-10 hover:scale-110"><Trash2 size={14}/></button>
                                  {block.image ? (
                                    <img src={block.image} className="w-full h-32 object-cover border-[2px] border-[#111] mb-2" alt="block"/>
                                  ) : (
                                    <label className="w-full h-32 flex flex-col items-center justify-center bg-[#f4f4f0] border-[2px] border-[#111] border-dashed mb-2 cursor-pointer hover:bg-[#dfff00]">
                                      <Upload size={20} className="mb-2"/> <span className="text-[10px]">ADD IMAGE</span>
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.galleryBlocks]; n[idx].image = base64; setEditingItem({...editingItem, galleryBlocks: n}); })} />
                                    </label>
                                  )}
                                  <div className="flex items-center gap-2 bg-[#f4f4f0] border-[2px] border-[#111] p-1">
                                    <span className="text-[10px] font-bold">W:</span>
                                    <input type="number" value={block.w || 250} onChange={e => { const n = [...editingItem.galleryBlocks]; n[idx].w = Number(e.target.value); setEditingItem({...editingItem, galleryBlocks: n}); }} className="w-full text-xs bg-transparent outline-none" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => setEditingItem({...editingItem, galleryBlocks: [...(editingItem.galleryBlocks||[]), {id: Date.now(), w: 250, x: Math.random()*100, y: Math.random()*100, z: 1, image: ''}]})} className="bg-[#111] text-[#f4f4f0] px-4 py-2 font-bold uppercase tracking-widest hover:bg-[#ff5722] transition-colors border-[2px] border-[#111]">+ APPEND IMAGE</button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {adminTab === 'blogs' && (
                  <>
                    {(!editingItem.blogCategory || editingItem.blogCategory === 'anime') && (
                       <div className="bg-[#f4f4f0] p-4 border-[2px] border-[#111] mb-6 flex flex-col gap-4 md:flex-row items-start md:items-center">
                          <label className="font-bold uppercase tracking-widest text-[#111]">Log Format:</label>
                          <select value={editingItem.type || 'regular'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="p-2 border-[2px] border-[#111] bg-white font-bold outline-none text-[#ff5722]">
                              <option value="regular">Standard Log</option>
                              <option value="album">Vinyl Showcase</option>
                          </select>
                       </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                       <div>
                          <label className="block font-bold uppercase mb-2">Category (Sub-page)</label>
                          <select value={editingItem.blogCategory || 'anime'} onChange={e => {
                             const newCat = e.target.value;
                             setEditingItem({
                                ...editingItem, 
                                blogCategory: newCat, 
                                type: (newCat === 'manhwa' || newCat === 'shows') ? 'regular' : editingItem.type
                             });
                          }} className="w-full p-3 border-[2px] border-[#111] outline-none">
                             <option value="anime">Anime</option>
                             <option value="manhwa">Manhwa</option>
                             <option value="shows">Shows</option>
                          </select>
                       </div>
                       <div>
                          <label className="block font-bold uppercase mb-2">Cover Image Effect</label>
                          <select value={editingItem.imageEffect || 'none'} onChange={e => setEditingItem({...editingItem, imageEffect: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none">
                             <option value="none">None</option>
                             <option value="duotone">Duotone (Orange/Black)</option>
                             <option value="ascii">ASCII Matrix Overlay</option>
                             <option value="both">Both (Duotone + ASCII)</option>
                          </select>
                       </div>
                    </div>

                    {editingItem.type === 'album' && (!editingItem.blogCategory || editingItem.blogCategory === 'anime') && (
                       <div className="flex gap-6 mb-6 bg-[#ff5722]/10 p-6 border-[2px] border-[#ff5722]">
                          <div>
                             <label className="block font-bold text-[#ff5722] uppercase mb-2">Backdrop Color</label>
                             <input type="color" value={editingItem.bgColor || '#eb5e28'} onChange={e => setEditingItem({...editingItem, bgColor: e.target.value})} className="w-20 h-12 p-1 cursor-pointer bg-white border-[2px] border-[#ff5722]" />
                          </div>
                          <div className="flex-1">
                             <label className="block font-bold text-[#ff5722] uppercase mb-2">Backdrop Image URL (Optional)</label>
                             <div className="flex gap-2">
                                <input value={editingItem.bgImage || ''} onChange={e => setEditingItem({...editingItem, bgImage: e.target.value})} className="flex-1 p-3 border-[2px] border-[#ff5722] bg-white outline-none focus:bg-[#ff5722]/20" placeholder="https://" />
                                <label className="cursor-pointer bg-[#ff5722] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#111] transition-colors border-[2px] border-[#ff5722]">
                                   <Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, bgImage: base64}))} />
                                </label>
                             </div>
                          </div>
                       </div>
                    )}

                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="col-span-2">
                        <label className="block font-bold uppercase mb-2">Title</label>
                        <input required value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Date</label>
                        <input required value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Rating (1-5)</label>
                        <input type="number" min="1" max="5" value={editingItem.rating || ''} onChange={e => setEditingItem({...editingItem, rating: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                      </div>
                    </div>
                    
                    <div className="flex gap-4 mb-6">
                       <div className="flex-1">
                          <label className="block font-bold uppercase mb-2">Category (Tag)</label>
                          <input value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                       </div>
                       <div className="flex-1">
                          <label className="block font-bold uppercase mb-2">Tags (Comma separated)</label>
                          <input value={editingItem.tags || ''} onChange={e => setEditingItem({...editingItem, tags: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="tag1, tag2" />
                       </div>
                    </div>

                    <div className="mb-6">
                      <label className="block font-bold uppercase mb-2">
                         {editingItem.type === 'album' ? 'Album Art (Sticky Note Image)' : 'Cover Image'}
                      </label>
                      <div className="flex gap-2">
                         <input value={editingItem.coverImage || ''} onChange={e => setEditingItem({...editingItem, coverImage: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" />
                         <label className="cursor-pointer bg-[#111] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#0000ff] transition-colors border-[2px] border-[#111]">
                           <Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, coverImage: base64}))} />
                         </label>
                      </div>
                    </div>

                    <div className="mb-6">
                       <label className="block font-bold uppercase mb-2">Preview Excerpt</label>
                       <textarea value={editingItem.excerpt || ''} onChange={e => setEditingItem({...editingItem, excerpt: e.target.value})} className="w-full p-4 border-[2px] border-[#111] outline-none h-24 focus:bg-[#dfff00]" />
                    </div>

                    {/* WP BLOCK BUILDER */}
                    <div className="bg-[#f4f4f0] p-6 border-[2px] border-[#111]">
                        <h3 className="font-bold text-xl uppercase mb-6 flex items-center gap-3 border-b-[2px] border-[#111] pb-2"><FileText size={20}/> Content Builder</h3>
                        
                        <div className="space-y-4 mb-6">
                          {(editingItem.blocks || []).map((block, idx) => (
                            <div key={idx} className="flex gap-4 items-start bg-white p-4 border-[2px] border-[#111] shadow-[4px_4px_0px_#111] relative group">
                              <div className="mt-3 text-[#111]">
                                 {block.type === 'text' && <AlignLeft size={20}/>}
                                 {block.type === 'quote' && <Quote size={20}/>}
                                 {block.type === 'pullquote' && <span className="font-serif text-2xl font-bold">""</span>}
                                 {block.type === 'image' && <ImageIcon size={20}/>}
                              </div>
                              <div className="flex-1">
                                {block.type === 'image' ? (
                                  <div className="flex gap-2">
                                    <input 
                                      value={block.content} 
                                      onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }}
                                      className="flex-1 p-3 border-[2px] border-[#111] outline-none" placeholder="Image URL..." 
                                    />
                                    <label className="cursor-pointer bg-[#111] text-white px-4 font-bold flex items-center gap-2 hover:bg-[#ff5722] border-[2px] border-[#111]">
                                      <Upload size={14}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.blocks]; n[idx].content = base64; setEditingItem({...editingItem, blocks: n}); })} />
                                    </label>
                                  </div>
                                ) : (
                                  <textarea 
                                    value={block.content} 
                                    onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }}
                                    className={`w-full p-4 border-[2px] border-[#111] outline-none min-h-[100px] ${block.type === 'quote' ? 'italic font-serif text-lg bg-gray-50' : block.type === 'pullquote' ? 'font-serif text-2xl text-center text-[#ff5722] bg-[#ff5722]/10' : 'font-sans'}`} 
                                    placeholder={`Write your ${block.type} block here...`} 
                                  />
                                )}
                              </div>
                              <button type="button" onClick={() => { const n = [...editingItem.blocks]; n.splice(idx, 1); setEditingItem({...editingItem, blocks: n}); }} className="p-3 bg-red-100 text-[#991b1b] border-[2px] border-[#111] hover:bg-[#991b1b] hover:text-white transition-colors">
                                <Trash2 size={20} />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'text', content: ''}]})} className="flex items-center gap-2 bg-white border-[2px] border-[#111] px-4 py-2 font-bold uppercase hover:bg-[#111] hover:text-white transition-colors"><AlignLeft size={16}/> Text</button>
                          <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'quote', content: ''}]})} className="flex items-center gap-2 bg-white border-[2px] border-[#111] px-4 py-2 font-bold uppercase hover:bg-[#111] hover:text-white transition-colors"><Quote size={16}/> Quote</button>
                          <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'pullquote', content: ''}]})} className="flex items-center gap-2 bg-white border-[2px] border-[#111] px-4 py-2 font-bold uppercase hover:bg-[#111] hover:text-white transition-colors"><span className="font-serif">""</span> Pull Quote</button>
                          <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'image', content: ''}]})} className="flex items-center gap-2 bg-white border-[2px] border-[#111] px-4 py-2 font-bold uppercase hover:bg-[#111] hover:text-white transition-colors"><ImageIcon size={16}/> Image</button>
                        </div>
                    </div>
                  </>
                )}

                {editingItem.isPlaylist && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Title</label>
                        <input required value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Price / Sub-label</label>
                        <input required value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">URL Link</label>
                        <input required value={editingItem.url || ''} onChange={e => setEditingItem({...editingItem, url: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Card Color (Hex)</label>
                        <div className="flex gap-2">
                           <input type="color" value={editingItem.color || '#333333'} onChange={e => setEditingItem({...editingItem, color: e.target.value})} className="w-16 h-12 p-1 border-[2px] border-[#111] cursor-pointer" />
                           <input value={editingItem.color || ''} onChange={e => setEditingItem({...editingItem, color: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] uppercase outline-none" />
                        </div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block font-bold uppercase mb-2">Cover Image</label>
                      <div className="flex gap-2">
                        <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] outline-none" />
                        <label className="cursor-pointer bg-[#111] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#0000ff] border-[2px] border-[#111]">
                          <Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Genre Tag</label>
                        <input value={editingItem.genre || ''} onChange={e => setEditingItem({...editingItem, genre: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Secondary Tag</label>
                        <input value={editingItem.tags || ''} onChange={e => setEditingItem({...editingItem, tags: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none" />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block font-bold uppercase mb-2">Description</label>
                      <textarea value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-4 border-[2px] border-[#111] h-24 outline-none" />
                    </div>
                  </>
                )}
                
                {/* --- SOCIALS: this form did not exist, so the editor opened blank --- */}
                {adminTab === 'socials' && !editingItem.isPlaylist && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Display Name</label>
                        <input required value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="GitHub" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">URL</label>
                        <input required type="url" value={editingItem.url || ''} onChange={e => setEditingItem({...editingItem, url: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="https://" />
                      </div>
                    </div>
                    <div>
                      <label className="block font-bold uppercase mb-2">Tile Image</label>
                      <div className="flex gap-2">
                        <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="https://" />
                        <label className="cursor-pointer bg-[#111] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#ff5722] transition-colors border-[2px] border-[#111]">
                          <Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => setEditingItem({...editingItem, image: b}))} />
                        </label>
                      </div>
                    </div>
                    {editingItem.image && (
                      <div className="w-40 p-3 bg-[#f4f4f0] border-[2px] border-[#111] anim-fade">
                        <img src={editingItem.image} alt="preview" className="w-full h-28 object-cover border-[2px] border-[#111] grayscale" />
                        <p className="font-mono text-[9px] uppercase tracking-widest text-center mt-2">Live preview</p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- JOURNALS: also previously missing --- */}
                {adminTab === 'journals' && !editingItem.isPlaylist && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Date</label>
                        <input required value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="Jul 15" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Year</label>
                        <input value={editingItem.year || ''} onChange={e => setEditingItem({...editingItem, year: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="2026" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Short Date</label>
                        <input value={editingItem.shortDate || ''} onChange={e => setEditingItem({...editingItem, shortDate: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="WED . 15" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Ticket Class</label>
                        <select value={editingItem.ticketClass || 'COACH'} onChange={e => setEditingItem({...editingItem, ticketClass: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none bg-white">
                          <option value="COACH">COACH</option><option value="FIRST">FIRST</option><option value="OMNI">OMNI</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">Time Span</label>
                        <input value={editingItem.timeSpan || ''} onChange={e => setEditingItem({...editingItem, timeSpan: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="7 15 - 8 15" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">Banner Image</label>
                        <div className="flex gap-2">
                          <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="https://" />
                          <label className="cursor-pointer bg-[#111] text-white px-5 font-bold flex items-center gap-2 hover:bg-[#ff5722] transition-colors border-[2px] border-[#111]">
                            <Upload size={16}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => setEditingItem({...editingItem, image: b}))} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold uppercase mb-2">Entry Log <span className="normal-case font-normal text-gray-500">(one bullet per line)</span></label>
                      <textarea value={(editingItem.logs || []).join('\n')} onChange={e => setEditingItem({...editingItem, logs: e.target.value.split('\n')})} className="w-full p-4 border-[2px] border-[#111] h-40 outline-none focus:bg-[#dfff00] leading-relaxed" placeholder={'System boot.\nDiagnostics clear.'} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
                      <div>
                        <label className="block font-bold uppercase mb-2">History Year</label>
                        <input value={editingItem.historyYear || ''} onChange={e => setEditingItem({...editingItem, historyYear: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="1969" />
                      </div>
                      <div>
                        <label className="block font-bold uppercase mb-2">History Text</label>
                        <input value={editingItem.historyText || ''} onChange={e => setEditingItem({...editingItem, historyText: e.target.value})} className="w-full p-3 border-[2px] border-[#111] outline-none focus:bg-[#dfff00]" placeholder="Apollo 11 lands on the Moon." />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sticky action bar so Commit is always reachable in long forms */}
                <div className="sticky bottom-0 -mx-8 px-8 pt-6 pb-2 bg-gradient-to-t from-white via-white to-transparent flex flex-col sm:flex-row gap-3 mt-8">
                  <button type="button" onClick={() => setEditingItem(null)} className="sm:w-48 bg-white text-[#111] p-4 font-bold uppercase tracking-widest border-[2px] border-[#111] slide-press">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-[#111] text-[#f4f4f0] p-4 text-xl font-bold uppercase tracking-widest border-[2px] border-[#111] hover:bg-[#dfff00] hover:text-[#111] transition-colors flex justify-center items-center gap-3">
                    <Save size={24}/> COMMIT CHANGES
                  </button>
                </div>
              </form>
            </div>
          );
        }

        return (
          <div className="min-h-full pb-32 relative text-[#111]">
            <div className="flex flex-col md:flex-row justify-between md:items-end border-b-[4px] border-[#111] pb-6 mb-6 gap-4">
              <div>
                <h1 className="text-5xl md:text-6xl font-serif tracking-tight anim-wipe">Admin Override</h1>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500 mt-2 flex items-center gap-2">
                   {supabase ? 'Cloud session' : 'Local storage session'}
                   <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00a000]" />
                   {isDirty
                     ? <span className="text-[#ff5722] font-bold">Unsaved changes</span>
                     : <span className="text-gray-400">All changes deployed</span>}
                </p>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 bg-[#ff5722] text-white px-4 py-2 border-[2px] border-[#111] font-mono font-bold uppercase hover:bg-[#111] transition-colors shadow-[4px_4px_0px_#111] slide-press self-start md:self-auto"><LogOut size={16}/> DISCONNECT</button>
            </div>

            {/* Sticky sub-nav with live record counts so you always know where you are */}
            <div className="sticky top-0 z-40 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-10 bg-[#f4f4f0]/95 backdrop-blur-sm border-b-[2px] border-[#111]">
              <div className="flex flex-wrap gap-2">
                {ADMIN_TABS.map((tab, i) => {
                  const count = adminCounts[tab.id];
                  const active = adminTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setAdminTab(tab.id)}
                            aria-current={active ? 'page' : undefined}
                            className={`relative font-mono text-[10px] md:text-xs font-bold uppercase px-4 py-2.5 border-[2px] border-[#111] slide-press flex items-center gap-2 anim-rise stagger-child ${active ? 'bg-[#111] text-white shadow-[4px_4px_0px_#ff5722] -translate-y-[2px]' : 'bg-white text-[#111] hover:bg-[#dfff00]'}`}
                            style={{ '--d': i }}>
                      {tab.label}
                      {typeof count === 'number' && (
                        <span className={`px-1.5 py-0.5 text-[9px] leading-none border ${active ? 'bg-[#dfff00] text-[#111] border-[#dfff00]' : 'bg-[#f4f4f0] text-[#111] border-[#111]'}`}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ACCESS LOGS (NEW) */}
            {adminTab === 'access_logs' && (
              <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                 <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-6">
                   <h2 className="text-3xl font-serif">Journal Access Logs</h2>
                   <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{accessLogs.length} entr{accessLogs.length === 1 ? 'y' : 'ies'}</span>
                 </div>
                 <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {accessLogs.length === 0 ? (
                      <div className="border-[2px] border-dashed border-[#111]/40 p-12 text-center">
                        <p className="font-serif text-2xl mb-1">No visitors logged</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Access records appear here once someone validates a ticket.</p>
                      </div>
                    ) : accessLogs.map((log, i) => (
                       <div key={log.id || i} style={{ '--d': Math.min(i, 10) }} className="bg-[#f4f4f0] p-4 border-[2px] border-[#111] shadow-[4px_4px_0px_rgba(17,17,17,0.2)] flex justify-between items-center gap-4 anim-rise stagger-child">
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold tracking-widest font-mono uppercase mb-1">{new Date(log.created_at).toLocaleString()}</p>
                            <p className="font-mono text-sm font-bold uppercase text-[#111]">{log.visitor_name}</p>
                          </div>
                          <span className="font-mono text-[10px] bg-[#111] text-[#dfff00] px-3 py-1 font-bold tracking-widest uppercase border-[2px] border-[#111]">NODE: {log.journal_id}</span>
                       </div>
                    ))}
                 </div>
              </div>
            )}

            {/* SETTINGS (WIP) */}
            {adminTab === 'settings' && (
              <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] space-y-8">
                <div className="border-b-[2px] border-[#111] pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-3">
                   <div>
                     <h3 className="font-serif text-3xl mb-2">Access Control (WIP Toggles)</h3>
                     <p className="font-mono text-sm text-gray-600">Restrict public access to specific modules. Admin maintains full visibility.</p>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => setSiteSettings({ ...siteSettings, wip: Object.fromEntries(['intro','portfolio','galleria','system','blog','socials','blank'].map(t => [t, true])) })} className="font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-white border-[2px] border-[#111] slide-press">Hide all</button>
                     <button onClick={() => setSiteSettings({ ...siteSettings, wip: {} })} className="font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-white border-[2px] border-[#111] slide-press">Show all</button>
                   </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                   {['intro', 'portfolio', 'galleria', 'system', 'blog', 'socials', 'blank'].map(tab => (
                     <label key={tab} className={`flex items-center gap-3 cursor-pointer p-4 border-[2px] border-[#111] slide-press ${siteSettings.wip?.[tab] ? 'bg-[#ff5722] text-white shadow-[4px_4px_0px_#111] -translate-y-[2px]' : 'bg-[#f4f4f0] text-[#111] hover:bg-white'}`}>
                        <input type="checkbox" checked={!!siteSettings.wip?.[tab]} onChange={e => setSiteSettings({ ...siteSettings, wip: { ...siteSettings.wip, [tab]: e.target.checked } })} className="w-6 h-6 border-[2px] border-[#111] accent-[#111]" />
                        <span className="font-mono font-bold uppercase tracking-widest flex-1">{tab === 'blank' ? 'Sandbox' : tab}</span>
                        {siteSettings.wip?.[tab] ? <EyeOff size={16}/> : <Eye size={16} className="opacity-40"/>}
                     </label>
                   ))}
                </div>

                {/* ---------- SITE BACKDROP (replaces the blueprint grid) ---------- */}
                <div className="border-t-[2px] border-[#111] pt-8">
                   <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-6">
                      <div>
                        <h3 className="font-serif text-3xl mb-2">Site Backdrop</h3>
                        <p className="font-mono text-sm text-gray-600">Paints behind every panel that used to show blueprint gridlines — galleria stage, project sheets, journal body, sandbox.</p>
                      </div>
                      <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${siteSettings.backdrop?.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!siteSettings.backdrop?.enabled} onChange={e => setBackdrop({ enabled: e.target.checked })} />
                        {siteSettings.backdrop?.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {siteSettings.backdrop?.enabled ? 'Active' : 'Off (grid)'}
                      </label>
                   </div>

                   <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
                      <div className="space-y-5">
                         <div>
                           <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Backdrop Image</label>
                           <div className="flex">
                             <input value={siteSettings.backdrop?.image || ''} onChange={e => setBackdrop({ image: e.target.value })} placeholder="https://… or upload" className="flex-1 p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                             <label className="cursor-pointer bg-[#111] text-white px-6 flex items-center font-bold font-mono text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111]">
                               <Upload size={16} className="mr-2"/> UPLOAD
                               <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setBackdrop({ image: b }))} />
                             </label>
                           </div>
                         </div>

                         <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Fit</label>
                              <select value={siteSettings.backdrop?.size} onChange={e => setBackdrop({ size: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                <option value="cover">Cover</option><option value="contain">Contain</option><option value="repeat">Tile</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Position</label>
                              <select value={siteSettings.backdrop?.position} onChange={e => setBackdrop({ position: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                {['center','top','bottom','left','right','top left','top right','bottom left','bottom right'].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Blend</label>
                              <select value={siteSettings.backdrop?.blend} onChange={e => setBackdrop({ blend: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                {['normal','multiply','luminosity','overlay','soft-light','darken'].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                         </div>

                         <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Opacity ({Math.round((siteSettings.backdrop?.opacity ?? 1) * 100)}%)</label>
                              <input type="range" min="0" max="1" step="0.05" value={siteSettings.backdrop?.opacity ?? 1} onChange={e => setBackdrop({ opacity: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                            </div>
                            <div>
                              <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Grayscale ({siteSettings.backdrop?.grayscale ?? 0}%)</label>
                              <input type="range" min="0" max="100" value={siteSettings.backdrop?.grayscale ?? 0} onChange={e => setBackdrop({ grayscale: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                            </div>
                         </div>

                         <div className="flex flex-wrap items-center gap-4">
                            <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${siteSettings.backdrop?.keepGrid ? 'bg-[#dfff00]' : 'bg-white'}`}>
                              <input type="checkbox" className="hidden" checked={!!siteSettings.backdrop?.keepGrid} onChange={e => setBackdrop({ keepGrid: e.target.checked })} />
                              {siteSettings.backdrop?.keepGrid ? <Check size={14}/> : <X size={14}/>} Keep gridlines on top
                            </label>
                            <div className="flex items-center gap-2">
                              <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${siteSettings.backdrop?.useTint ? 'bg-[#dfff00]' : 'bg-white'}`}>
                                <input type="checkbox" className="hidden" checked={!!siteSettings.backdrop?.useTint} onChange={e => setBackdrop({ useTint: e.target.checked })} />
                                {siteSettings.backdrop?.useTint ? <Check size={14}/> : <X size={14}/>} Tint
                              </label>
                              <input type="color" value={siteSettings.backdrop?.tint || '#e9e9e6'} onChange={e => setBackdrop({ tint: e.target.value })} className="w-12 h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                            </div>
                            <button onClick={() => setBackdrop({ ...defaultSettings.backdrop })} className="font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-white border-[2px] border-[#111] slide-press flex items-center gap-2"><RotateCcw size={14}/> Reset</button>
                         </div>
                      </div>

                      {/* live preview of the exact treatment */}
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Preview</p>
                        <div className="h-[260px] border-[2px] border-[#111] bg-blueprint relative overflow-hidden" style={backdropVars}>
                           <div className="absolute inset-6 border-[2px] border-[#111] bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#111]">Panel content</span>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {/* SYSTEM SETTINGS */}
            {adminTab === 'system' && (
              <div className="space-y-10">

                {/* ---------- RACK CHROME ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <h3 className="font-serif text-3xl mb-1">Rack Chrome</h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 border-b-[2px] border-[#111] pb-4">Window title, rack label and global cable behaviour.</p>
                  <div className="grid md:grid-cols-2 gap-6">
                     <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Window Title</label>
                        <input value={systemData.title || ''} onChange={e => setRack({ title: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00]" />
                     </div>
                     <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Rack Label Strip</label>
                        <input value={systemData.rackLabel || ''} onChange={e => setRack({ rackLabel: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00]" placeholder="SYS-01 // MODULAR CORE" />
                     </div>
                     <div className="md:col-span-2">
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Nav Pills (Comma Separated)</label>
                        <input value={(systemData.navPills || []).join(', ')} onChange={e => setRack({ navPills: e.target.value.split(',').map(v => v.trim()) })} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00]" />
                     </div>
                     <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Meter Colour</label>
                        <div className="flex gap-2">
                          <input type="color" value={systemData.meterColor || '#dfff00'} onChange={e => setRack({ meterColor: e.target.value })} className="w-16 h-12 p-1 border-[2px] border-[#111] cursor-pointer" />
                          <input value={systemData.meterColor || ''} onChange={e => setRack({ meterColor: e.target.value })} className="flex-1 p-3 border-[2px] border-[#111] font-mono uppercase outline-none" />
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Cable Sag — {systemData.cableSag ?? 34}px</label>
                        <input type="range" min="0" max="140" value={systemData.cableSag ?? 34} onChange={e => setRack({ cableSag: Number(e.target.value) })} className="w-full accent-[#ff5722] h-12" />
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">How heavily the patch cables droop.</p>
                     </div>
                  </div>
                </div>

                {/* ---------- VU METERS ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl">VU Meters</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">The readout strip above the rack. Numeric values drive the bar height.</p>
                    </div>
                    <button onClick={() => setRack({ stats: [...(systemData.stats || []), { id: Date.now(), label: "New Meter", value: "50", unit: "" }] })} className="bg-[#111] text-[#dfff00] px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-2 slide-press shrink-0"><Plus size={16}/> Add Meter</button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {(systemData.stats || []).map((st, idx) => (
                      <div key={st.id ?? idx} style={{ '--d': idx }} className="bg-[#f4f4f0] p-4 border-[2px] border-[#111] flex gap-3 items-end anim-rise stagger-child">
                        <div className="flex-1 min-w-0">
                          <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Label</label>
                          <input value={st.label || ''} onChange={e => setRack({ stats: systemData.stats.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                        <div className="w-24">
                          <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Value</label>
                          <input value={st.value || ''} onChange={e => setRack({ stats: systemData.stats.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                        <div className="w-16">
                          <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Unit</label>
                          <input value={st.unit || ''} onChange={e => setRack({ stats: systemData.stats.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x) })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                        <button onClick={() => setRack({ stats: systemData.stats.filter((_, i) => i !== idx) })} className="p-2.5 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors shrink-0"><Trash2 size={16}/></button>
                      </div>
                    ))}
                    {(systemData.stats || []).length === 0 && (
                      <p className="md:col-span-2 border-[2px] border-dashed border-[#111]/40 p-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">No meters configured.</p>
                    )}
                  </div>
                </div>

                {/* ---------- MODULES + JACKS ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl">Modules</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">{(systemData.timeline || []).length} module(s) · each jack is patchable</p>
                    </div>
                    <button onClick={addModule} className="bg-[#111] text-[#dfff00] px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-2 slide-press shrink-0"><Plus size={16}/> Add Module</button>
                  </div>

                  <div className="space-y-6">
                    {(systemData.timeline || []).map((mod, mi) => (
                      <div key={mod.id} style={{ '--d': mi, borderColor: mod.color || '#111' }} className="bg-[#f4f4f0] p-5 border-[3px] anim-rise stagger-child">
                        <div className="flex flex-wrap gap-3 items-end mb-5">
                          <div className="flex-1 min-w-[140px]">
                            <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Module Name</label>
                            <input value={mod.period || ''} onChange={e => updateModule(mod.id, { period: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-sm font-bold outline-none focus:bg-[#dfff00]" />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Subtitle</label>
                            <input value={mod.subtitle || ''} onChange={e => updateModule(mod.id, { subtitle: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                          </div>
                          <div>
                            <label className="block font-mono text-[9px] font-bold uppercase tracking-widest mb-1">Colour</label>
                            <input type="color" value={mod.color || '#ff5722'} onChange={e => updateModule(mod.id, { color: e.target.value })} className="w-16 h-[42px] p-1 border-[2px] border-[#111] cursor-pointer" />
                          </div>
                          <button onClick={() => removeModule(mod.id)} title="Remove module and its cables" className="p-2.5 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={18}/></button>
                        </div>

                        {/* knobs */}
                        <div className="mb-5">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">Knobs</span>
                            <button onClick={() => updateModule(mod.id, { knobs: [...(mod.knobs || []), { id: `k${Date.now()}`, label: "Knob", value: 50 }] })} className="font-mono text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-white border-[2px] border-[#111] slide-press flex items-center gap-1.5"><Plus size={12}/> Knob</button>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {(mod.knobs || []).map((k, ki) => (
                              <div key={k.id} className="bg-white border-[2px] border-[#111] p-2.5 flex items-end gap-2">
                                <div className="w-24">
                                  <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Label</label>
                                  <input value={k.label || ''} onChange={e => updateModule(mod.id, { knobs: mod.knobs.map((x, i) => i === ki ? { ...x, label: e.target.value } : x) })} className="w-full p-1.5 border-[2px] border-[#111] font-mono text-[11px] outline-none focus:bg-[#dfff00]" />
                                </div>
                                <div className="w-28">
                                  <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Value {k.value}</label>
                                  <input type="range" min="0" max="100" value={k.value ?? 50} onChange={e => updateModule(mod.id, { knobs: mod.knobs.map((x, i) => i === ki ? { ...x, value: Number(e.target.value) } : x) })} className="w-full accent-[#ff5722]" />
                                </div>
                                <button onClick={() => updateModule(mod.id, { knobs: mod.knobs.filter((_, i) => i !== ki) })} className="p-1.5 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={13}/></button>
                              </div>
                            ))}
                            {(mod.knobs || []).length === 0 && <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400 py-3">No knobs on this module.</span>}
                          </div>
                        </div>

                        {/* jacks */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">Jacks</span>
                            <button onClick={() => addNode(mod.id)} className="font-mono text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 bg-white border-[2px] border-[#111] slide-press flex items-center gap-1.5"><Plus size={12}/> Jack</button>
                          </div>
                          <div className="space-y-2">
                            {(mod.nodes || []).map(node => (
                              <div key={node.id} className="bg-white border-[2px] border-[#111] p-2.5 flex flex-wrap gap-2 items-end">
                                <div className="flex-1 min-w-[130px]">
                                  <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Title</label>
                                  <input value={node.title || ''} onChange={e => updateNode(mod.id, node.id, { title: e.target.value })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                </div>
                                <div className="w-28">
                                  <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Readout</label>
                                  <input value={node.mainValue ?? node.value ?? ''} onChange={e => updateNode(mod.id, node.id, { mainValue: e.target.value, value: e.target.value })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                </div>
                                <div className="w-32">
                                  <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Icon</label>
                                  <select value={node.icon || 'CircleDot'} onChange={e => updateNode(mod.id, node.id, { icon: e.target.value })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none bg-white">
                                    {NODE_ICONS.map(n => <option key={n} value={n}>{n}</option>)}
                                  </select>
                                </div>
                                <span className="font-mono text-[8px] uppercase tracking-widest text-gray-400 px-1 pb-2.5">{node.id}</span>
                                <button onClick={() => removeNode(mod.id, node.id)} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={14}/></button>
                              </div>
                            ))}
                            {(mod.nodes || []).length === 0 && <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 py-3">No jacks — this module has nothing to patch.</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(systemData.timeline || []).length === 0 && (
                      <div className="border-[2px] border-dashed border-[#111]/40 p-12 text-center">
                        <p className="font-serif text-2xl mb-1">Empty rack</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6">Add a module to start building the patch bay.</p>
                        <button onClick={addModule} className="bg-[#111] text-[#dfff00] px-6 py-3 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest inline-flex items-center gap-2 slide-press"><Plus size={16}/> Add Module</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---------- CABLES ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl">Patch Cables</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                        {(systemData.cables || []).length} patched · you can also drag jack&nbsp;→&nbsp;jack directly on the System tab
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const nodes = (systemData.timeline || []).flatMap(m => m.nodes || []);
                        if (nodes.length < 2) return showToast("Need at least two jacks to patch.", 'error');
                        setRack({ cables: [...(systemData.cables || []), { id: `c${Date.now()}`, from: nodes[0].id, to: nodes[1].id, color: PATCH_COLORS[(systemData.cables || []).length % PATCH_COLORS.length] }] });
                      }}
                      className="bg-[#111] text-[#dfff00] px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-2 slide-press shrink-0"><Plus size={16}/> Add Cable</button>
                  </div>

                  {(() => {
                    const allJacks = (systemData.timeline || []).flatMap(m => (m.nodes || []).map(n => ({ ...n, mod: m.period })));
                    const jackLabel = (id) => {
                      const j = allJacks.find(x => x.id === id);
                      return j ? `${j.mod} · ${j.title}` : `${id} (missing)`;
                    };
                    return (
                      <div className="space-y-3">
                        {(systemData.cables || []).map((c, ci) => {
                          const broken = !allJacks.some(j => j.id === c.from) || !allJacks.some(j => j.id === c.to);
                          return (
                            <div key={c.id} style={{ '--d': ci }} className={`p-3 border-[2px] flex flex-wrap gap-3 items-end anim-rise stagger-child ${broken ? 'border-[#ff5722] bg-[#ff5722]/10' : 'border-[#111] bg-[#f4f4f0]'}`}>
                              <div className="flex-1 min-w-[160px]">
                                <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">From</label>
                                <select value={c.from} onChange={e => setRack({ cables: systemData.cables.map((x, i) => i === ci ? { ...x, from: e.target.value } : x) })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none bg-white">
                                  {allJacks.map(j => <option key={j.id} value={j.id}>{jackLabel(j.id)}</option>)}
                                </select>
                              </div>
                              <span className="font-mono text-lg pb-1.5">→</span>
                              <div className="flex-1 min-w-[160px]">
                                <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">To</label>
                                <select value={c.to} onChange={e => setRack({ cables: systemData.cables.map((x, i) => i === ci ? { ...x, to: e.target.value } : x) })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none bg-white">
                                  {allJacks.map(j => <option key={j.id} value={j.id}>{jackLabel(j.id)}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block font-mono text-[8px] uppercase tracking-widest mb-1 text-gray-500">Colour</label>
                                <input type="color" value={c.color || '#ff5722'} onChange={e => setRack({ cables: systemData.cables.map((x, i) => i === ci ? { ...x, color: e.target.value } : x) })} className="w-14 h-[38px] p-1 border-[2px] border-[#111] cursor-pointer" />
                              </div>
                              <button onClick={() => setRack({ cables: systemData.cables.filter((_, i) => i !== ci) })} className="p-2.5 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={16}/></button>
                              {broken && <p className="w-full font-mono text-[9px] uppercase tracking-widest text-[#ff5722] font-bold">Dangling cable — one end points at a jack that no longer exists.</p>}
                            </div>
                          );
                        })}
                        {(systemData.cables || []).length === 0 && (
                          <p className="border-[2px] border-dashed border-[#111]/40 p-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Nothing patched yet.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ABOUT TAB SETTINGS */}
            {adminTab === 'about' && (
              <div className="space-y-12">
                <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-6 border-b-[2px] border-[#111] pb-2">Global Content</h3>
                  <textarea value={aboutData.introText || ''} onChange={e => setAboutData({...aboutData, introText: e.target.value})} className="w-full p-4 border-[2px] border-[#111] h-32 font-mono text-sm mb-4 outline-none focus:bg-[#dfff00]" placeholder="Intro Text" />
                  <div className="flex gap-2 mb-4">
                    <input value={aboutData.introImage || ''} onChange={e => setAboutData({...aboutData, introImage: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] font-mono text-sm outline-none" placeholder="Intro Image URL" />
                    <label className="cursor-pointer bg-[#111] text-white px-6 flex items-center font-bold font-mono hover:bg-[#ff5722] transition-colors"><Upload size={16} className="mr-2"/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setAboutData({...aboutData, introImage: b}))} /></label>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <input value={aboutData.appBackground || ''} onChange={e => setAboutData({...aboutData, appBackground: e.target.value})} className="flex-1 p-3 border-[2px] border-[#111] font-mono text-sm outline-none" placeholder="App Background Image URL" />
                    <label className="cursor-pointer bg-[#111] text-white px-6 flex items-center font-bold font-mono hover:bg-[#ff5722] transition-colors"><Upload size={16} className="mr-2"/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setAboutData({...aboutData, appBackground: b}))} /></label>
                  </div>
                  <textarea value={aboutData.notepadText || ''} onChange={e => setAboutData({...aboutData, notepadText: e.target.value})} maxLength={120} className="w-full p-4 border-[2px] border-[#111] h-24 font-mono text-sm outline-none focus:bg-[#dfff00]" placeholder="System Memo Text (Max 120 chars)" />
                  <div className="flex justify-end mt-1">
                    <span className={`font-mono text-[10px] uppercase tracking-widest ${(aboutData.notepadText || '').length > 110 ? 'text-[#ff5722] font-bold' : 'text-gray-400'}`}>
                      {(aboutData.notepadText || '').length} / 120
                    </span>
                  </div>
                </div>

                {/* ---------- TERMINAL BOOT SEQUENCE ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl">Terminal Boot</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">Controls the intro tab's start-up sequence.</p>
                    </div>
                    <button onClick={() => { restartBoot(); setActiveTab('intro'); }} className="bg-[#0000ff] text-white px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-2 slide-press shrink-0">
                      <Play size={14}/> Preview Boot
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <label className={`flex items-center gap-3 cursor-pointer p-4 border-[2px] border-[#111] slide-press ${aboutData.boot?.enabled !== false ? 'bg-[#dfff00]' : 'bg-[#f4f4f0]'}`}>
                      <input type="checkbox" checked={aboutData.boot?.enabled !== false} onChange={e => setBoot({ enabled: e.target.checked })} className="w-6 h-6 border-[2px] border-[#111] accent-[#111]" />
                      <span className="font-mono font-bold uppercase tracking-widest flex-1">Boot sequence enabled</span>
                      {aboutData.boot?.enabled !== false ? <Eye size={16}/> : <EyeOff size={16} className="opacity-40"/>}
                    </label>

                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Replay Behaviour</label>
                      <select value={aboutData.boot?.replay || 'session'} onChange={e => setBoot({ replay: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none bg-white focus:bg-[#dfff00]">
                        <option value="session">Once per session (recommended)</option>
                        <option value="always">Every visit to the intro tab</option>
                        <option value="never">Never — show content immediately</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Speed — {Number(aboutData.boot?.speed || 1).toFixed(2)}×</label>
                      <input type="range" min="0.25" max="4" step="0.25" value={aboutData.boot?.speed ?? 1} onChange={e => setBoot({ speed: Number(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                      <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Higher is faster. Affects typing and section timing.</p>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Console Accent</label>
                      <div className="flex gap-2">
                        <input type="color" value={aboutData.boot?.accent || '#00ff88'} onChange={e => setBoot({ accent: e.target.value })} className="w-16 h-12 p-1 border-[2px] border-[#111] cursor-pointer" />
                        <input value={aboutData.boot?.accent || ''} onChange={e => setBoot({ accent: e.target.value })} className="flex-1 p-3 border-[2px] border-[#111] font-mono uppercase outline-none focus:bg-[#dfff00]" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Hostname</label>
                      <input value={aboutData.boot?.hostname || ''} onChange={e => setBoot({ hostname: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" placeholder="iceyyy" />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">User</label>
                      <input value={aboutData.boot?.user || ''} onChange={e => setBoot({ user: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" placeholder="guest" />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Shell Path</label>
                      <input value={aboutData.boot?.shell || ''} onChange={e => setBoot({ shell: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" placeholder="~/about" />
                    </div>
                    <div>
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest mb-2">Archive Path</label>
                      <input value={aboutData.boot?.archivePath || ''} onChange={e => setBoot({ archivePath: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" placeholder="/archive/obsessions" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="font-mono text-[10px] font-bold uppercase tracking-widest">POST Lines <span className="normal-case font-normal text-gray-500">(one per line)</span></label>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{(aboutData.boot?.lines || []).filter(l => String(l).trim()).length} lines</span>
                    </div>
                    <textarea
                      value={(aboutData.boot?.lines || []).join('\n')}
                      onChange={e => setBoot({ lines: e.target.value.split('\n') })}
                      className="w-full p-4 border-[2px] border-[#111] bg-[#0b0b0b] h-44 font-mono text-xs outline-none leading-relaxed"
                      style={{ color: aboutData.boot?.accent || '#00ff88' }}
                      placeholder={'POST ............................. OK\nMEM CHECK 16384K ................. OK'}
                    />
                    <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mt-2">These scroll one at a time before the identity block appears.</p>
                  </div>
                </div>

                <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-6 border-b-[2px] border-[#111] pb-2">Mood / System Checker</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                       <label className="block font-bold uppercase mb-2">Score (Number)</label>
                       <input value={aboutData.mood?.score || ''} onChange={e => setAboutData({...aboutData, mood: {...(aboutData.mood || {}), score: e.target.value}})} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00]" placeholder="85" />
                    </div>
                    <div>
                       <label className="block font-bold uppercase mb-2">Status (e.g. OPTIMAL)</label>
                       <input value={aboutData.mood?.status || ''} onChange={e => setAboutData({...aboutData, mood: {...(aboutData.mood || {}), status: e.target.value}})} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00]" placeholder="OPTIMAL" />
                    </div>
                    <div>
                       <label className="block font-bold uppercase mb-2">Title (Allows Newlines)</label>
                       <textarea value={aboutData.mood?.title || ''} onChange={e => setAboutData({...aboutData, mood: {...(aboutData.mood || {}), title: e.target.value}})} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00] h-24 whitespace-pre-wrap" placeholder="System&#10;Stability" />
                    </div>
                    <div>
                       <label className="block font-bold uppercase mb-2">Description</label>
                       <textarea value={aboutData.mood?.desc || ''} onChange={e => setAboutData({...aboutData, mood: {...(aboutData.mood || {}), desc: e.target.value}})} className="w-full p-3 border-[2px] border-[#111] font-mono outline-none focus:bg-[#dfff00] h-24 whitespace-pre-wrap" placeholder="Performance score..." />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-6 border-b-[2px] border-[#111] pb-2">The Circle (Myspace)</h3>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {(aboutData.myspace || []).map((friend, idx) => (
                      <div key={friend.id} draggable onDragStart={() => dragItem.current = idx} onDragEnter={() => dragOverItem.current = idx} onDragEnd={() => handleSortAboutList('myspace')} onDragOver={(e) => e.preventDefault()} className="bg-[#f4f4f0] p-4 border-[2px] border-[#111] flex gap-4 items-center hover:bg-white transition-colors shadow-[4px_4px_0px_rgba(17,17,17,0.2)]">
                        <div className="cursor-grab text-[#111] p-1 border-[2px] border-[#111] bg-white"><GripVertical size={20}/></div>
                        <img src={friend.image || 'https://placehold.co/100x100'} className="w-16 h-16 border-[2px] border-[#111] object-cover grayscale" alt="prev"/>
                        <div className="flex-1 space-y-2">
                          <input value={friend.name} onChange={(e) => { const n = [...aboutData.myspace]; n[idx].name = e.target.value; setAboutData({...aboutData, myspace: n}); }} className="w-full p-2 border-[2px] border-[#111] font-mono font-bold text-sm outline-none focus:bg-[#dfff00]" placeholder="Name" />
                          <div className="flex gap-2">
                             <input value={friend.image} onChange={(e) => { const n = [...aboutData.myspace]; n[idx].image = e.target.value; setAboutData({...aboutData, myspace: n}); }} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none" placeholder="Image URL" />
                             <label className="cursor-pointer bg-[#111] text-white p-2 border-[2px] border-[#111] hover:bg-[#0000ff]"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...aboutData.myspace]; n[idx].image = base64; setAboutData({...aboutData, myspace: n}); })} /></label>
                          </div>
                        </div>
                        <button type="button" onClick={() => setAboutData({...aboutData, myspace: aboutData.myspace.filter((_, i) => i !== idx)})} className="bg-[#ff5722] text-white p-3 border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={20}/></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, myspace: [...aboutData.myspace, { id: Date.now(), name: "New Friend", image: "" }]})} className="bg-[#111] text-white px-6 py-3 font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#0000ff] border-[2px] border-[#111]"><Plus size={18}/> Append Record</button>
                </div>

                <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-6 border-b-[2px] border-[#111] pb-2">Technical Interests</h3>
                  <div className="space-y-6 mb-6">
                    {(aboutData.interests || []).map((interest, idx) => (
                      <div key={interest.id} draggable onDragStart={() => dragItem.current = idx} onDragEnter={() => dragOverItem.current = idx} onDragEnd={() => handleSortAboutList('interests')} onDragOver={(e) => e.preventDefault()} className="bg-[#f4f4f0] p-6 border-[2px] border-[#111] flex flex-col md:flex-row gap-6 shadow-[4px_4px_0px_rgba(17,17,17,0.2)]">
                        <div className="cursor-grab text-[#111] p-2 border-[2px] border-[#111] bg-white h-fit"><GripVertical size={24}/></div>
                        <img src={interest.image || 'https://placehold.co/300x200'} className="w-full md:w-48 h-32 object-cover border-[2px] border-[#111]" alt="prev"/>
                        <div className="flex-1 space-y-3 font-mono">
                          <input value={interest.title} onChange={(e) => { const n = [...aboutData.interests]; n[idx].title = e.target.value; setAboutData({...aboutData, interests: n}); }} className="w-full p-3 border-[2px] border-[#111] font-bold outline-none focus:bg-[#dfff00]" placeholder="Interest Title" />
                          <div className="flex gap-2">
                            <input value={interest.image} onChange={(e) => { const n = [...aboutData.interests]; n[idx].image = e.target.value; setAboutData({...aboutData, interests: n}); }} className="w-full p-3 border-[2px] border-[#111] text-sm outline-none" placeholder="Image URL" />
                            <label className="cursor-pointer bg-[#111] text-white px-6 font-bold flex items-center gap-2 hover:bg-[#ff5722] border-[2px] border-[#111]"><Upload size={16}/> UPLOAD <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...aboutData.interests]; n[idx].image = base64; setAboutData({...aboutData, interests: n}); })} /></label>
                          </div>
                          <textarea value={interest.desc} onChange={(e) => { const n = [...aboutData.interests]; n[idx].desc = e.target.value; setAboutData({...aboutData, interests: n}); }} className="w-full p-4 border-[2px] border-[#111] min-h-[6rem] outline-none whitespace-pre-wrap text-sm" placeholder="Description..." />
                        </div>
                        <button type="button" onClick={() => setAboutData({...aboutData, interests: aboutData.interests.filter((_, i) => i !== idx)})} className="bg-[#ff5722] text-white p-4 border-[2px] border-[#111] hover:bg-[#111] transition-colors h-fit"><Trash2 size={24}/></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, interests: [...aboutData.interests, { id: Date.now(), title: "New Interest", desc: "", image: "" }]})} className="bg-[#111] text-white px-6 py-3 font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#0000ff] border-[2px] border-[#111]"><Plus size={18}/> Append Record</button>
                </div>

                <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-6 border-b-[2px] border-[#111] pb-2">Obsessions Data</h3>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    {(aboutData.obsessions || []).map((obs, idx) => (
                      <div key={obs.id} draggable onDragStart={() => dragItem.current = idx} onDragEnter={() => dragOverItem.current = idx} onDragEnd={() => handleSortAboutList('obsessions')} onDragOver={(e) => e.preventDefault()} className="bg-[#f4f4f0] p-6 border-[2px] border-[#111] relative shadow-[4px_4px_0px_rgba(17,17,17,0.2)]">
                        <div className="absolute top-4 left-4 cursor-grab text-[#111] bg-white border-[2px] border-[#111] p-1"><GripVertical size={16}/></div>
                        <button type="button" onClick={() => setAboutData({...aboutData, obsessions: aboutData.obsessions.filter((_, i) => i !== idx)})} className="absolute top-4 right-4 bg-[#ff5722] text-white border-[2px] border-[#111] p-2 hover:bg-[#111]"><Trash2 size={16}/></button>
                        
                        <input value={obs.category} onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].category = e.target.value; setAboutData({...aboutData, obsessions: n}); }} className="w-full mt-10 mb-4 p-3 border-[2px] border-[#111] font-mono font-bold outline-none focus:bg-[#dfff00] text-center uppercase tracking-widest" />
                        <textarea value={(obs.items || []).join('\n')} onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].items = e.target.value.split('\n'); setAboutData({...aboutData, obsessions: n}); }} className="w-full p-4 border-[2px] border-[#111] h-48 font-mono text-sm outline-none whitespace-pre-wrap leading-relaxed bg-white" placeholder="Enter items, one per line..." />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, obsessions: [...aboutData.obsessions, { id: Date.now(), category: "New List", items: ["Item 1"] }]})} className="bg-[#111] text-white px-6 py-3 font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#0000ff] border-[2px] border-[#111]"><Plus size={18}/> Append Record</button>
                </div>
              </div>
            )}

            {/* GALLERIA MANAGER */}
            {adminTab === 'galleria' && (
              <>
              <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] mb-8">
                <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-6">
                  <div>
                     <h2 className="text-3xl font-serif text-[#111]">Manage Galleria</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mt-2">{galleriaData.length} image{galleriaData.length === 1 ? '' : 's'} · drag to reorder</p>
                  </div>
                  <label className="bg-[#0000ff] text-white px-6 py-2 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 cursor-pointer shadow-[4px_4px_0px_#111] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111] transition-all">
                     <Layers size={18} /> BATCH UPLOAD
                     <input type="file" multiple accept="image/*" className="hidden" onChange={handleBatchGalleriaUpload} />
                  </label>
                </div>
                
                {galleriaData.length === 0 && (
                  <div className="border-[2px] border-dashed border-[#111]/40 p-12 text-center mb-6">
                    <p className="font-serif text-2xl mb-1">No images ingested</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Use batch upload to populate the timeline.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {galleriaData.map((item, idx) => (
                    <div 
                        key={item.id}
                        draggable
                        onDragStart={() => dragItem.current = idx}
                        onDragEnter={() => dragOverItem.current = idx}
                        onDragEnd={() => handleSortAboutList('galleria', true)}
                        onDragOver={(e) => e.preventDefault()}
                        style={{ '--d': Math.min(idx, 12) }}
                        className="bg-[#f4f4f0] p-2 border-[2px] border-[#111] group relative slide-card shadow-[4px_4px_0px_rgba(17,17,17,0.2)] anim-rise stagger-child"
                    >
                       <div className="absolute top-1 left-1 bg-[#111] text-[#dfff00] p-1 border-[2px] border-[#111] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"><GripVertical size={16}/></div>
                       <button onClick={() => setGalleriaData(galleriaData.filter(g => g.id !== item.id))} className="absolute top-1 right-1 bg-[#ff5722] text-white p-1 border-[2px] border-[#111] opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-[#111]"><Trash2 size={16}/></button>
                       <img src={item.image} className="w-full aspect-square object-cover border-[2px] border-[#111] mb-2 grayscale group-hover:grayscale-0 transition-all" alt="gal_prev"/>
                       <input value={item.date} onChange={(e) => { const n = [...galleriaData]; n[idx].date = e.target.value; setGalleriaData(n); }} className="w-full text-[10px] p-2 border-[2px] border-[#111] text-center font-mono font-bold outline-none focus:bg-[#dfff00]" placeholder="LABEL"/>
                       
                       {/* === NEW: ATTACH MEMO CHECKBOX === */}
                       <label className="flex items-center gap-2 mt-2 bg-white border-[2px] border-[#111] p-1.5 cursor-pointer hover:bg-[#dfff00] transition-colors">
                           <input type="checkbox" checked={item.hasJournal || false} onChange={(e) => { const n = [...galleriaData]; n[idx].hasJournal = e.target.checked; setGalleriaData(n); }} className="w-3 h-3 accent-[#ff5722] border-[2px] border-[#111] outline-none" />
                           <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#111]">Attach Memo</span>
                       </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* PLAYLISTS MANAGER */}
              <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-6">
                  <div>
                     <h2 className="text-3xl font-serif text-[#111]">Manage Playlists</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-widest mt-2">Audio archives displayed below galleria.</p>
                  </div>
                  <button onClick={() => setEditingItem({ isPlaylist: true })} className="bg-[#111] text-[#dfff00] px-6 py-2 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-[#0000ff] hover:text-white transition-colors"><Plus size={18} /> ADD PLAYLIST</button>
                </div>
                <div className="space-y-3 font-mono">
                  {playlists.length === 0 && (
                    <div className="border-[2px] border-dashed border-[#111]/40 p-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">No playlists configured.</div>
                  )}
                  {playlists.map((pl, idx) => {
                    const pendingDelete = confirmDelete && confirmDelete.listType === 'playlists' && confirmDelete.id === pl.id;
                    return (
                    <div key={pl.id} style={{ '--d': idx }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[#f4f4f0] p-3 border-[2px] border-[#111] hover:bg-white transition-colors anim-rise stagger-child">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex flex-col shrink-0">
                          <button aria-label="Move up" disabled={idx === 0} onClick={() => moveListItem('playlists', idx, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 transition-colors leading-none text-[10px]">▲</button>
                          <button aria-label="Move down" disabled={idx === playlists.length - 1} onClick={() => moveListItem('playlists', idx, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 transition-colors leading-none text-[10px]">▼</button>
                        </div>
                        <div className="w-10 h-10 border-[2px] border-[#111] shrink-0" style={{ backgroundColor: pl.color || '#333' }} />
                        {pl.image
                          ? <img src={pl.image} alt="" className="w-10 h-10 object-cover border-[2px] border-[#111] grayscale shrink-0" />
                          : <div className="w-10 h-10 border-[2px] border-dashed border-[#111]/40 shrink-0 flex items-center justify-center"><Music size={14} className="text-gray-400"/></div>}
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{pl.title || 'UNTITLED_PLAYLIST'}</p>
                          <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate">{pl.genre || '—'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                        <button title="Duplicate" onClick={() => duplicateListItem('playlists', pl)} className="p-2 bg-white border-[2px] border-[#111] hover:bg-[#0000ff] hover:text-white transition-colors"><Copy size={16} /></button>
                        <button title="Edit" onClick={() => setEditingItem({ ...pl, isPlaylist: true })} className="p-2 bg-[#dfff00] border-[2px] border-[#111] hover:bg-[#111] hover:text-white transition-colors"><Edit2 size={16} /></button>
                        {pendingDelete ? (
                          <div className="flex gap-1 anim-fade">
                            <button onClick={() => handleDeleteItem('playlists', pl.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest hover:bg-[#111]">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest">Keep</button>
                          </div>
                        ) : (
                          <button title="Delete" onClick={() => setConfirmDelete({ listType: 'playlists', id: pl.id })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>
                  );})}
                </div>
              </div>
              </>
            )}

            {(adminTab === 'projects' || adminTab === 'blogs' || adminTab === 'socials' || adminTab === 'journals') && (() => {
              const source = adminTab === 'projects' ? projects
                           : adminTab === 'blogs'    ? blogs
                           : adminTab === 'journals' ? journalEntries
                           : socials;
              const label = (it) => it.title || it.name || it.date || 'UNTITLED_RECORD';
              const q = adminSearch.trim().toLowerCase();
              const rows = source
                .map((item, idx) => ({ item, idx }))
                .filter(({ item }) => !q || label(item).toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q) || (item.tags || '').toString().toLowerCase().includes(q));

              return (
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-4">
                  <div>
                    <h2 className="text-3xl font-serif capitalize">Manage {adminTab}</h2>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
                      {rows.length} of {source.length} record{source.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search: long lists were previously unnavigable */}
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="FILTER RECORDS" className="w-full sm:w-64 pl-10 pr-9 py-2.5 border-[2px] border-[#111] font-mono text-xs uppercase tracking-widest outline-none focus:bg-[#dfff00] transition-colors" />
                      {adminSearch && (
                        <button aria-label="Clear filter" onClick={() => setAdminSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:text-[#ff5722]"><X size={14}/></button>
                      )}
                    </div>
                    <button onClick={() => setEditingItem(adminTab === 'blogs' ? { blocks: [], type: 'regular' } : adminTab === 'journals' ? { logs: [] } : {})} className="bg-[#111] text-[#dfff00] px-6 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#0000ff] hover:text-white transition-colors slide-press shrink-0"><Plus size={18} /> INITIALIZE NEW</button>
                  </div>
                </div>

                {source.length === 0 ? (
                  <div className="border-[2px] border-dashed border-[#111]/40 p-12 text-center anim-fade">
                    <p className="font-serif text-2xl text-[#111] mb-2">Nothing here yet</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6">This collection is empty. Create the first record to populate the public view.</p>
                    <button onClick={() => setEditingItem(adminTab === 'blogs' ? { blocks: [], type: 'regular' } : adminTab === 'journals' ? { logs: [] } : {})} className="bg-[#111] text-[#dfff00] px-6 py-3 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest inline-flex items-center gap-2 slide-press"><Plus size={16}/> Create record</button>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="border-[2px] border-dashed border-[#111]/40 p-10 text-center font-mono text-xs uppercase tracking-[0.2em] text-gray-500 anim-fade">
                    No records match “{adminSearch}”.
                  </div>
                ) : (
                <div className="space-y-3 font-mono">
                  {rows.map(({ item, idx }, i) => {
                    const thumb = item.coverImage || item.image;
                    const pendingDelete = confirmDelete && confirmDelete.listType === adminTab && confirmDelete.id === item.id;
                    return (
                    <div key={item.id} style={{ '--d': i }} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[#f4f4f0] p-3 md:p-4 border-[2px] border-[#111] hover:bg-white transition-colors anim-rise stagger-child">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Reorder handles — ordering drives the public layout */}
                        <div className="flex flex-col shrink-0">
                          <button aria-label="Move up" disabled={idx === 0 || !!q} onClick={() => moveListItem(adminTab, idx, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none text-[10px]">▲</button>
                          <button aria-label="Move down" disabled={idx === source.length - 1 || !!q} onClick={() => moveListItem(adminTab, idx, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 disabled:cursor-not-allowed transition-colors leading-none text-[10px]">▼</button>
                        </div>
                        <span className="font-mono text-[10px] text-gray-400 w-6 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                        {thumb
                          ? <img src={thumb} alt="" className="w-12 h-12 object-cover border-[2px] border-[#111] grayscale shrink-0" />
                          : <div className="w-12 h-12 border-[2px] border-dashed border-[#111]/40 shrink-0 flex items-center justify-center text-[8px] text-gray-400">NONE</div>}
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{label(item)}</p>
                          <p className="text-[10px] uppercase tracking-widest text-gray-500 truncate">
                            {item.type || item.blogCategory || item.ticketClass || '—'}
                            {item.blogCategory && item.type ? ` · ${item.blogCategory}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                        <button title="Duplicate" onClick={() => duplicateListItem(adminTab, item)} className="p-2 bg-white border-[2px] border-[#111] hover:bg-[#0000ff] hover:text-white transition-colors"><Copy size={16} /></button>
                        <button title="Edit" onClick={() => setEditingItem({ ...item, type: item.type || (adminTab === 'blogs' ? 'regular' : adminTab === 'journals' ? undefined : 'project') })} className="p-2 bg-[#dfff00] border-[2px] border-[#111] hover:bg-[#111] hover:text-white transition-colors"><Edit2 size={16} /></button>
                        {/* Two-step delete: destructive actions should never be one click */}
                        {pendingDelete ? (
                          <div className="flex gap-1 anim-fade">
                            <button onClick={() => handleDeleteItem(adminTab, item.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest hover:bg-[#111]">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest hover:bg-[#f4f4f0]">Keep</button>
                          </div>
                        ) : (
                          <button title="Delete" onClick={() => setConfirmDelete({ listType: adminTab, id: item.id })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </div>
                  );})}
                </div>
                )}
                {q && <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400">Reordering is disabled while a filter is active.</p>}
              </div>
            );})()}

            {/* ============================================================
                LIGHTBOX PANEL — galleria click-through overlay
                ============================================================ */}
            {adminTab === 'lightbox' && (
              <div className="space-y-10">

                {/* ---------- LIVE PREVIEW (drag decals) ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl mb-1">Sticker Slam</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Drag decals to place them. Positions are stored as % so they hold at any screen size.</p>
                    </div>
                    <div className="flex gap-2">
                      <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${lightboxConfig.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!lightboxConfig.enabled} onChange={e => setLB({ enabled: e.target.checked })} />
                        {lightboxConfig.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {lightboxConfig.enabled ? 'Enabled' : 'Disabled'}
                      </label>
                      <button onClick={addSticker} className="bg-[#111] text-[#dfff00] px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 slide-press"><Plus size={16}/> Decal</button>
                    </div>
                  </div>

                  <div className="relative w-full aspect-[16/9] overflow-hidden border-[2px] border-[#111]"
                       style={{ background: lightboxConfig.accent }}>
                    <img src={galleriaData[0]?.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&q=80'} alt=""
                         className="absolute inset-0 w-full h-full object-cover"
                         style={{ filter: lightboxConfig.duotone ? 'grayscale(1) contrast(1.15)' : 'none' }} />
                    {lightboxConfig.duotone && <div className="absolute inset-0" style={{ background: lightboxConfig.accent, mixBlendMode: 'multiply' }} />}
                    {lightboxConfig.grain && <div className="absolute inset-0 lb-grain pointer-events-none" />}
                    {(lightboxConfig.stickers || []).map((s, i) => (
                      <Sticker key={s.id} s={s} accent={lightboxConfig.accent} ink={lightboxConfig.ink} index={i}
                               live={false} draggable onDrag={(pos) => updateSticker(s.id, pos)} />
                    ))}
                    <span className="absolute bottom-2 right-2 font-mono text-[9px] uppercase tracking-[0.2em] px-2 py-1 pointer-events-none"
                          style={{ background: lightboxConfig.ink, color: lightboxConfig.accent }}>Drag to arrange</span>
                  </div>
                </div>

                {/* ---------- LOOK ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-1">Look</h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 border-b-[2px] border-[#111] pb-4">Colour treatment and texture for the overlay.</p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[['accent','Accent'],['ink','Ink']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" value={lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.value })} className="w-14 h-12 border-[2px] border-[#111] p-0 cursor-pointer" />
                          <input value={lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.value })} className="flex-1 p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Pop Speed ({lightboxConfig.popSpeed}×)</label>
                      <input type="range" min="0.4" max="3" step="0.1" value={lightboxConfig.popSpeed} onChange={e => setLB({ popSpeed: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-12" />
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                      {[['duotone','Duotone photo'],['grain','Film grain'],['scanlines','Scanlines']].map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer">
                          <input type="checkbox" checked={!!lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.checked })} className="w-5 h-5 border-[2px] border-[#111] accent-[#111]" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ---------- CHROME ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-1">Chrome & HUD</h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 border-b-[2px] border-[#111] pb-4">Corner tags, the fake device panel, the ticker and the meta card.</p>
                  <div className="grid md:grid-cols-2 gap-6">
                    {[['frameLabel','Frame Label'],['cornerTag','Corner Tag'],['hudTitle','HUD Row 1'],['hudSub','HUD Row 2'],['tickerText','Ticker Text'],['badgeCardTitle','Meta Card Title'],['badgeCardYear','Meta Card Year']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <input value={lightboxConfig[k] || ''} onChange={e => setLB({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t-[2px] border-[#111]">
                    {[['showHud','Show HUD'],['showTicker','Show Ticker'],['showBadgeCard','Show Meta Card']].map(([k, label]) => (
                      <label key={k} className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${lightboxConfig[k] ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.checked })} />
                        {lightboxConfig[k] ? <Check size={14}/> : <X size={14}/>} {label}
                      </label>
                    ))}
                  </div>

                  <div className="mt-8">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Meta rows — use %N% for frame number, %DATE% for the image label</p>
                    <div className="space-y-2">
                      {(lightboxConfig.metaRows || []).map(m => (
                        <div key={m.id} className="flex gap-2">
                          <input value={m.label} onChange={e => setMetaRow(m.id, { label: e.target.value })} className="w-32 p-2.5 border-[2px] border-[#111] font-mono text-xs uppercase outline-none focus:bg-[#dfff00]" />
                          <input value={m.value} onChange={e => setMetaRow(m.id, { value: e.target.value })} className="flex-1 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ---------- DECAL TABLE ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <h3 className="font-serif text-3xl mb-1">Decals</h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 border-b-[2px] border-[#111] pb-4">{(lightboxConfig.stickers || []).length} elements · they pop in top-to-bottom in this order.</p>
                  <div className="space-y-3">
                    {(lightboxConfig.stickers || []).map((s, i) => (
                      <div key={s.id} style={{ '--d': i }} className="bg-[#f4f4f0] p-4 border-[2px] border-[#111] anim-rise stagger-child">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[180px]">
                            <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Text</label>
                            <input value={s.text} onChange={e => updateSticker(s.id, { text: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                          </div>
                          <div>
                            <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Style</label>
                            <select value={s.style} onChange={e => updateSticker(s.id, { style: e.target.value })} className="p-2.5 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                              {STICKER_STYLES.map(st => <option key={st} value={st}>{st}</option>)}
                            </select>
                          </div>
                          {[['x','X %'],['y','Y %'],['rot','Rot°'],['size','Size']].map(([k, label]) => (
                            <div key={k} className="w-[74px]">
                              <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">{label}</label>
                              <input type="number" value={s[k] ?? 0} onChange={e => updateSticker(s.id, { [k]: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                            </div>
                          ))}
                          <div>
                            <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Colour</label>
                            <input type="color" value={s.color || lightboxConfig.accent} onChange={e => updateSticker(s.id, { color: e.target.value })} className="w-12 h-[42px] border-[2px] border-[#111] p-0 cursor-pointer" />
                          </div>
                          <button onClick={() => removeSticker(s.id)} className="p-2.5 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                POEMS PANEL — sleeve diagram + the verses it indexes
                ============================================================ */}
            {adminTab === 'poems' && (
              <div className="space-y-10">

                {/* ---------- SLEEVE CHROME ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl mb-1">Verse Sleeve</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">The patch diagram under Audio Archives. Each indexed row opens a poem.</p>
                    </div>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${poemDeck.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!poemDeck.enabled} onChange={e => setDeck({ enabled: e.target.checked })} />
                      {poemDeck.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {poemDeck.enabled ? 'Enabled' : 'Disabled'}
                    </label>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[['heading','Heading'],['kicker','Kicker'],['tracksLabel','Tracks Label'],['moduleLabel','Module Label'],['averageLabel','Average Label'],['totalLabel','Total Time Label'],['slotPrefix','Slot Prefix']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <input value={poemDeck[k] || ''} onChange={e => setDeck({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Slot Count ({poemDeck.slotCount})</label>
                      <input type="range" min="4" max="30" value={poemDeck.slotCount} onChange={e => setDeck({ slotCount: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-12" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Waveform Rows ({poemDeck.waveRows})</label>
                      <input type="range" min="1" max="6" value={poemDeck.waveRows} onChange={e => setDeck({ waveRows: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-12" />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mt-6 pt-6 border-t-[2px] border-[#111]">
                    {[['bg','Sleeve BG'],['fg','Foreground'],['line','Hairlines'],['highlight','Highlight'],['highlightInk','Highlight Ink']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" value={poemDeck[k]} onChange={e => setDeck({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                          <input value={poemDeck[k]} onChange={e => setDeck({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t-[2px] border-[#111]">
                    {[['showWaveform','Waveform'],['showCables','Cables'],['showCropMarks','Crop Marks'],['showBarcode','Barcode'],['animate','Animate Cables']].map(([k, label]) => (
                      <label key={k} className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${poemDeck[k] ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!poemDeck[k]} onChange={e => setDeck({ [k]: e.target.checked })} />
                        {poemDeck[k] ? <Check size={14}/> : <X size={14}/>} {label}
                      </label>
                    ))}
                  </div>

                  <div className="grid md:grid-cols-3 gap-5 mt-6 pt-6 border-t-[2px] border-[#111]">
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Footer Left</label>
                      <textarea value={poemDeck.footerLeft || ''} onChange={e => setDeck({ footerLeft: e.target.value })} rows={3} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Footer Middle</label>
                      <textarea value={poemDeck.footerMid || ''} onChange={e => setDeck({ footerMid: e.target.value })} rows={3} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Pass Labels (comma separated)</label>
                      <input value={(poemDeck.passLabels || []).join(', ')} onChange={e => setDeck({ passLabels: e.target.value.split(',').map(v => v.trim()) })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                    </div>
                  </div>
                </div>

                {/* ---------- THE VERSES ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="font-serif text-3xl mb-1">Verses</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{poems.length} indexed · order here is the order on the sleeve</p>
                    </div>
                    <button onClick={addPoem} className="bg-[#111] text-[#dfff00] px-6 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 slide-press"><Plus size={18}/> Add Verse</button>
                  </div>

                  {poems.length === 0 && (
                    <div className="border-[2px] border-dashed border-[#111]/40 p-10 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">No verses yet.</div>
                  )}

                  <div className="space-y-3">
                    {poems.map((p, idx) => {
                      const open = expandedPoem === p.id;
                      const pendingDelete = confirmDelete && confirmDelete.listType === 'poems' && confirmDelete.id === p.id;
                      return (
                        <div key={p.id} style={{ '--d': idx }} className="border-[2px] border-[#111] anim-rise stagger-child">
                          {/* row header */}
                          <div className="flex flex-wrap items-center gap-3 bg-[#f4f4f0] p-3">
                            <div className="flex flex-col shrink-0">
                              <button aria-label="Move up" disabled={idx === 0} onClick={() => moveListItem('poems', idx, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▲</button>
                              <button aria-label="Move down" disabled={idx === poems.length - 1} onClick={() => moveListItem('poems', idx, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▼</button>
                            </div>
                            <span className="font-mono text-[10px] text-gray-400 w-6 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                            {p.image
                              ? <img src={p.image} alt="" className="w-11 h-11 object-cover border-[2px] border-[#111] grayscale shrink-0" />
                              : <div className="w-11 h-11 border-[2px] border-dashed border-[#111]/40 shrink-0 flex items-center justify-center"><ImageIcon size={14} className="text-gray-400"/></div>}
                            <div className="min-w-0 flex-1">
                              <p className="font-mono font-bold text-sm truncate">{p.title}</p>
                              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">{(p.lines || []).length} lines · {p.randomStagger ? 'random stagger' : 'pinned offsets'}</p>
                            </div>
                            <button onClick={() => { setPoemShuffle(s => s + 1); setActivePoem(p); }} title="Preview" className="p-2 bg-white border-[2px] border-[#111] hover:bg-[#0000ff] hover:text-white transition-colors"><Play size={16}/></button>
                            <button onClick={() => duplicateListItem('poems', p)} title="Duplicate" className="p-2 bg-white border-[2px] border-[#111] hover:bg-[#0000ff] hover:text-white transition-colors"><Copy size={16}/></button>
                            <button onClick={() => setExpandedPoem(open ? null : p.id)} className="p-2 bg-[#dfff00] border-[2px] border-[#111] hover:bg-[#111] hover:text-white transition-colors"><Edit2 size={16}/></button>
                            {pendingDelete ? (
                              <div className="flex gap-1 anim-fade">
                                <button onClick={() => handleDeleteItem('poems', p.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest">Confirm</button>
                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase tracking-widest">Keep</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete({ listType: 'poems', id: p.id })} title="Delete" className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={16}/></button>
                            )}
                          </div>

                          {/* expanded editor */}
                          {open && (
                            <div className="p-4 md:p-6 bg-white border-t-[2px] border-[#111] space-y-6 anim-fade">
                              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[['title','Index Title (sleeve row)'],['bigTitle','Big Title (overlay)'],['subtitle','Subtitle (overlay)'],['footnote','Footnote']].map(([k, label]) => (
                                  <div key={k}>
                                    <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">{label}</label>
                                    <input value={p[k] || ''} onChange={e => updatePoem(p.id, { [k]: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                                  </div>
                                ))}
                              </div>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">Background Image</label>
                                  <div className="flex">
                                    <input value={p.image || ''} onChange={e => updatePoem(p.id, { image: e.target.value })} placeholder="https://…" className="flex-1 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center font-mono font-bold text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111]">
                                      <Upload size={14}/><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => updatePoem(p.id, { image: b }))} />
                                    </label>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">Slab / Text</label>
                                    <div className="flex gap-2">
                                      <input type="color" value={p.accent || '#ffffff'} onChange={e => updatePoem(p.id, { accent: e.target.value })} className="w-11 h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                                      <input type="color" value={p.ink || '#111111'} onChange={e => updatePoem(p.id, { ink: e.target.value })} className="w-11 h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">Image Dim ({p.imageDim || 0}%)</label>
                                    <input type="range" min="0" max="80" value={p.imageDim || 0} onChange={e => updatePoem(p.id, { imageDim: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 border-t-[2px] border-b-[2px] border-[#111] py-4">
                                <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${p.randomStagger ? 'bg-[#dfff00]' : 'bg-white'}`}>
                                  <input type="checkbox" className="hidden" checked={!!p.randomStagger} onChange={e => updatePoem(p.id, { randomStagger: e.target.checked })} />
                                  {p.randomStagger ? <Check size={14}/> : <X size={14}/>} Random stagger
                                </label>
                                {p.randomStagger ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold uppercase text-gray-500">Seed</span>
                                    <input type="number" value={p.seed ?? 0} onChange={e => updatePoem(p.id, { seed: parseInt(e.target.value) || 0 })} className="w-24 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    <button onClick={() => updatePoem(p.id, { seed: Math.floor(Math.random() * 999) })} className="p-2.5 bg-white border-[2px] border-[#111] hover:bg-[#dfff00] transition-colors" title="Re-roll"><RotateCcw size={14}/></button>
                                  </div>
                                ) : (
                                  <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">Each line uses its own offset %</span>
                                )}
                                <button onClick={() => addPoemLine(p.id)} className="ml-auto bg-[#111] text-[#dfff00] px-4 py-2.5 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 slide-press"><Plus size={14}/> Line</button>
                              </div>

                              <div className="space-y-2">
                                {(p.lines || []).map((l, li) => (
                                  <div key={l.id} className="flex flex-wrap items-end gap-2 bg-[#f4f4f0] p-2.5 border-[2px] border-[#111]">
                                    <div className="flex flex-col shrink-0">
                                      <button disabled={li === 0} onClick={() => movePoemLine(p.id, li, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[9px] leading-none">▲</button>
                                      <button disabled={li === (p.lines || []).length - 1} onClick={() => movePoemLine(p.id, li, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[9px] leading-none">▼</button>
                                    </div>
                                    <div className="w-[86px]">
                                      <label className="text-[8px] font-mono font-bold uppercase text-gray-500 block mb-1">Tag</label>
                                      <input value={l.tag || ''} onChange={e => updatePoemLine(p.id, l.id, { tag: e.target.value })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    </div>
                                    <div className="flex-1 min-w-[200px]">
                                      <label className="text-[8px] font-mono font-bold uppercase text-gray-500 block mb-1">Line</label>
                                      <input value={l.text || ''} onChange={e => updatePoemLine(p.id, l.id, { text: e.target.value })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    </div>
                                    {!p.randomStagger && (
                                      <div className="w-[100px]">
                                        <label className="text-[8px] font-mono font-bold uppercase text-gray-500 block mb-1">Offset %</label>
                                        <input type="number" min="0" max="80" value={l.offset ?? 30} onChange={e => updatePoemLine(p.id, l.id, { offset: parseInt(e.target.value) || 0 })} className="w-full p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                      </div>
                                    )}
                                    <button onClick={() => removePoemLine(p.id, l.id)} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors"><Trash2 size={14}/></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'messages' && (
              <div className="bg-white p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                 <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-4 mb-6">
                   <h2 className="text-3xl font-serif">Received Intercepts</h2>
                   <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{guestMessages.length} total</span>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {guestMessages.length === 0 ? (
                      <div className="sm:col-span-2 border-[2px] border-dashed border-[#111]/40 p-12 text-center">
                        <p className="font-serif text-2xl mb-1">Inbox clear</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">No transmissions received yet.</p>
                      </div>
                    ) : guestMessages.map((msg, mi) => (
                       <div key={msg.id} style={{ '--d': mi }} className="bg-[#f4f4f0] p-6 border-[2px] border-[#111] shadow-[4px_4px_0px_rgba(17,17,17,0.2)] anim-rise stagger-child relative group">
                          <p className="text-[10px] text-[#111] mb-4 uppercase font-bold tracking-widest bg-[#dfff00] w-fit px-2 border border-[#111]">{new Date(msg.created_at).toLocaleString()}</p>
                          {msg.message.startsWith('data:image') ? (
                             <img src={msg.message} alt="drawing" className="w-full border-[2px] border-[#111]" />
                          ) : (
                             <>
                               <p className="font-mono text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                               <button
                                 onClick={() => { navigator.clipboard?.writeText(msg.message); showToast("Message copied.", 'success'); }}
                                 className="absolute top-4 right-4 p-2 bg-white border-[2px] border-[#111] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#dfff00]"
                                 title="Copy text"><Copy size={14}/></button>
                             </>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
            )}
            
            <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
              {isDirty && !isSaving && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] bg-[#ff5722] text-white px-3 py-1.5 border-[2px] border-[#111] shadow-[3px_3px_0px_#111] anim-right">
                  Unsaved changes
                </span>
              )}
              <button
                disabled={isSaving}
                onClick={() => saveAllToCloud(null)}
                title="Deploy (Ctrl/Cmd + S)"
                className={`px-8 py-4 border-[2px] border-[#111] shadow-[8px_8px_0px_rgba(17,17,17,1)] hover:-translate-y-[2px] hover:shadow-[10px_10px_0px_rgba(17,17,17,1)] active:translate-y-[2px] active:shadow-[4px_4px_0px_rgba(17,17,17,1)] flex items-center gap-3 font-mono font-bold text-base md:text-lg tracking-widest transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-60 ${
                  isDirty ? 'bg-[#111] text-[#dfff00]' : 'bg-[#f4f4f0] text-[#111]'
                }`}
              >
                {isSaving
                  ? <><Save size={24} className="animate-[spin_1.2s_linear_infinite]"/> <span>UPLOADING…</span></>
                  : isDirty
                    ? <><Save size={24}/> <span>DEPLOY CHANGES</span></>
                    : <><Check size={24}/> <span>ALL DEPLOYED</span></>}
                <kbd className="hidden md:inline font-mono text-[9px] font-normal opacity-60 border border-current px-1.5 py-0.5 ml-1">⌘S</kbd>
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
     <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;500;600&display=swap');
        .font-serif { font-family: 'Instrument Serif', serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        .font-sans { font-family: 'Inter', sans-serif; }

        /* ============================================================
           MOTION SYSTEM
           One shared easing vocabulary so every surface moves alike.
           ============================================================ */
        :root {
          --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
          --ease-spring:   cubic-bezier(0.34, 1.4, 0.5, 1);
          --ease-mech:     cubic-bezier(0.65, 0, 0.35, 1);
          --dur-fast: 180ms;
          --dur-base: 380ms;
          --dur-slow: 720ms;
        }

        @keyframes riseIn      { from { opacity:0; transform: translateY(22px); } to { opacity:1; transform:none; } }
        @keyframes slideInL    { from { opacity:0; transform: translateX(-32px); } to { opacity:1; transform:none; } }
        @keyframes slideInR    { from { opacity:0; transform: translateX(32px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn      { from { opacity:0; } to { opacity:1; } }
        @keyframes wipeUp      { from { opacity:0; clip-path: inset(100% 0 0 0); transform: translateY(10px);} to { opacity:1; clip-path: inset(0 0 0 0); transform:none; } }
        @keyframes stampIn     { 0% { opacity:0; transform: scale(1.25) rotate(-4deg); } 60% { opacity:1; transform: scale(0.97) rotate(1deg); } 100% { opacity:1; transform: none; } }
        @keyframes toastIn     { 0% { opacity:0; transform: translate(-50%, -140%); } 70% { opacity:1; transform: translate(-50%, 6%); } 100% { opacity:1; transform: translate(-50%, 0); } }
        @keyframes toastOut    { from { opacity:1; transform: translate(-50%, 0); } to { opacity:0; transform: translate(-50%, -140%); } }
        @keyframes backdropIn  { from { opacity:0; backdrop-filter: blur(0px); } to { opacity:1; } }
        @keyframes sheetIn     { 0% { opacity:0; transform: translateY(40px) scale(0.97); } 100% { opacity:1; transform:none; } }
        @keyframes ticketIn    { 0% { opacity:0; transform: translateY(60px) rotate(-6deg) scale(0.94); } 100% { opacity:1; transform:none; } }
        @keyframes barFill     { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes softPulse   { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        @keyframes shimmer     { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes underlineIn { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        /* Utility classes ------------------------------------------------ */
        .anim-rise    { animation: riseIn   var(--dur-slow) var(--ease-out-expo) both; }
        .anim-left    { animation: slideInL var(--dur-slow) var(--ease-out-expo) both; }
        .anim-right   { animation: slideInR var(--dur-slow) var(--ease-out-expo) both; }
        .anim-fade    { animation: fadeIn   var(--dur-base) ease-out both; }
        .anim-wipe    { animation: wipeUp   var(--dur-slow) var(--ease-out-expo) both; }
        .anim-stamp   { animation: stampIn  520ms var(--ease-spring) both; }
        .anim-sheet   { animation: sheetIn  var(--dur-slow) var(--ease-out-expo) both; }

        /* Stagger: set style={{'--d': i}} on the child */
        .stagger-child { animation-delay: calc(var(--d, 0) * 70ms); }

        /* The whole tab panel re-enters on every tab change (keyed remount) */
        .tab-enter { animation: riseIn 520ms var(--ease-out-expo) both; }

        /* --- Interaction primitives ------------------------------------ */
        /* Replaces the old jumpy "pop" hovers with a directional slide      */
        .slide-card {
          transition: transform var(--dur-base) var(--ease-out-expo),
                      box-shadow var(--dur-base) var(--ease-out-expo),
                      background-color var(--dur-fast) ease;
          will-change: transform;
        }
        .slide-card:hover { transform: translate(-3px, -3px); box-shadow: 10px 10px 0 #111; }
        .slide-card:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 #111; transition-duration: 90ms; }

        .slide-press {
          transition: transform var(--dur-fast) var(--ease-out-expo), box-shadow var(--dur-fast) var(--ease-out-expo), background-color var(--dur-fast) ease, color var(--dur-fast) ease;
        }
        .slide-press:hover  { transform: translate(-2px, -2px); box-shadow: 4px 4px 0 #111; }
        .slide-press:active { transform: translate(1px, 1px);  box-shadow: 0 0 0 #111; transition-duration: 80ms; }

        /* Animated underline for section headings */
        .rule-grow::after {
          content: ''; display: block; height: 2px; background: #111; margin-top: 0.5rem;
          transform-origin: left; animation: underlineIn 900ms var(--ease-out-expo) both; animation-delay: 120ms;
        }

        /* Image reveal: grayscale lifts and the frame settles */
        .img-reveal { transition: filter 700ms var(--ease-out-expo), transform 900ms var(--ease-out-expo); }
        .group:hover .img-reveal { filter: grayscale(0); transform: scale(1.04); }

        /* ============================================================
           SITE BACKDROP
           .bg-blueprint used to paint gridlines. It now paints the
           configured backdrop photo (Admin > Settings > Backdrop) and
           only falls back to the grid when no image is set, or when
           "keep grid" is on and it draws on top.
           ============================================================ */
        .bg-blueprint {
          background-image: var(--backdrop-layers, linear-gradient(rgba(17,17,17,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.08) 1px, transparent 1px));
          background-size: 30px 30px;
          position: relative;
          /* isolate so the negative-z backdrop layer stays inside this box */
          isolation: isolate;
        }
        .bg-blueprint::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: var(--backdrop-image, none);
          background-size: var(--backdrop-size, cover);
          background-position: var(--backdrop-position, center);
          background-repeat: var(--backdrop-repeat, no-repeat);
          opacity: var(--backdrop-opacity, 1);
          mix-blend-mode: var(--backdrop-blend, normal);
          filter: grayscale(var(--backdrop-gray, 0));
          z-index: -1;
        }

        /* --- Galleria lightbox ---------------------------------------- */
        @keyframes lbFrameIn  { 0% { opacity:0; transform: scale(0.9) rotate(-1.5deg); } 100% { opacity:1; transform:none; } }
        @keyframes lbPhotoIn  { 0% { transform: scale(1.18); } 100% { transform: scale(1); } }
        @keyframes lbWipe     { 0% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 0 100%); } }
        @keyframes lbBarIn    { 0% { transform: translateY(120%); } 100% { transform: none; } }
        @keyframes cornerIn   { 0% { opacity:0; transform: scale(0.4); } 100% { opacity:1; transform:none; } }
        @keyframes tickerSlide { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

        /* The decal carries its own translate/rotate inline, so the pop
           animates the independent scale property instead of clobbering
           the transform. */
        .sticker-pop {
          animation: stickerPopSimple 620ms var(--ease-spring) both;
        }
        @keyframes stickerPopSimple {
          0%   { opacity: 0; scale: 0.25; }
          60%  { opacity: 1; scale: 1.16; }
          80%  { scale: 0.95; }
          100% { opacity: 1; scale: 1; }
        }
        .lb-corner { animation: cornerIn 460ms var(--ease-spring) both; }
        .lb-grain {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E");
          opacity: 0.22;
          mix-blend-mode: overlay;
        }

        /* --- Poem deck ------------------------------------------------- */
        @keyframes cableDraw  { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
        .deck-cable { stroke-dasharray: 400; animation: cableDraw 1400ms var(--ease-out-expo) both; }
        .deck-row {
          transition: transform 260ms var(--ease-out-expo), letter-spacing 260ms ease, filter 260ms ease;
        }
        .deck-row:hover  { transform: translateX(8px); filter: drop-shadow(-6px 0 0 rgba(255,255,255,0.35)); }
        .deck-row:active { transform: translateX(3px); transition-duration: 90ms; }

        /* --- Poem overlay ---------------------------------------------- */
        @keyframes poemSlabIn { 0% { opacity:0; clip-path: inset(0 100% 0 0); transform: translateX(-24px); } 100% { opacity:1; clip-path: inset(0 0 0 0); transform:none; } }
        @keyframes poemImgIn  { 0% { opacity:0; transform: scale(1.12); } 100% { opacity:1; transform:none; } }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Focus ring that matches the brutalist language */
        .focus-brut:focus-visible { outline: 3px solid #0000ff; outline-offset: 2px; }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 3px solid #0000ff; outline-offset: 2px;
        }

        /* Skeleton shimmer for the loading state */
        .skeleton {
          background: linear-gradient(90deg, #e5e5e5 25%, #f4f4f0 50%, #e5e5e5 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s linear infinite;
        }

        /* === TRUE 3D DOMINO ENGINE (galleria) === */
        .gal-viewport { perspective: 2500px; transform-style: preserve-3d; }
        .gal-scene {
            transform-style: preserve-3d;
            /* was 0.1s linear -> now eased so flick-scrolling glides instead of snapping */
            transition: transform 620ms var(--ease-out-expo);
        }
        .gal-item {
            position: absolute;
            left: 50%;
            top: 0;
            height: 260px;
            width: max-content;
            transform-origin: bottom center;
            transform-style: preserve-3d;
            transform: translate(-50%, calc(var(--i) * -10px)) rotateX(-90deg);
            transition: transform 560ms var(--ease-out-expo), box-shadow 460ms ease;
            background: transparent;
            border-radius: 12px;
            box-shadow: 0px 0px 10px rgba(0,0,0,0.3);
            cursor: pointer;
            z-index: 1;
            animation: fadeIn 600ms ease-out both;
            animation-delay: calc(var(--i) * 45ms);
        }
        .gal-item img { border-radius: 12px; }
        .gal-item:hover {
            transform: translate(-50%, calc(var(--i) * -55px)) rotateX(-90deg) scale(1.4);
            box-shadow: 0px -20px 40px rgba(0,0,0,0.6);
            z-index: 50;
        }
        .gal-scene:has(.gal-item:hover) .gal-item:has(~ .gal-item:hover) {
            transform: translate(-50%, calc(var(--i) * -55px + 400px)) rotateX(-90deg);
        }
        .gal-item:hover ~ .gal-item {
            transform: translate(-50%, calc(var(--i) * -55px - 400px)) rotateX(-90deg);
        }

        /* ============================================================
           VINYL SEQUENCE
           sleeve slides in -> record pulls out of the sleeve -> tonearm
           drops -> platter spins. Each stage is its own keyframe so the
           timing reads mechanical rather than instant.
           ============================================================ */
        @keyframes sleeveIn {
          0%   { opacity: 0; transform: translateX(-70px) rotate(-3deg); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes vinylPullOut {
          0%   { transform: translateX(-6%) scale(0.94); opacity: 0; }
          18%  { opacity: 1; }
          70%  { transform: translateX(48%) scale(1.01); }
          100% { transform: translateX(45%) scale(1); opacity: 1; }
        }
        @keyframes platterSpin { to { transform: rotate(360deg); } }
        @keyframes spinUp {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes tonearmDrop {
          0%   { transform: rotate(-32deg); }
          65%  { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes needleGlow { 0%,100% { opacity: .35; } 50% { opacity: 1; } }

        .vinyl-sleeve { animation: sleeveIn 820ms var(--ease-out-expo) both; }
        .vinyl-disc   { animation: vinylPullOut 1400ms var(--ease-out-expo) both; animation-delay: 240ms; }
        /* Two nested spins: a slow start-up, then constant rotation */
        .vinyl-platter {
          animation: spinUp 2.4s var(--ease-mech) 900ms 1 both,
                     platterSpin 3.4s linear 3.3s infinite;
        }
        .vinyl-tonearm { transform-origin: 88% 12%; animation: tonearmDrop 1100ms var(--ease-out-expo) both; animation-delay: 1500ms; }
        .vinyl-needle-led { animation: needleGlow 1.8s ease-in-out infinite; animation-delay: 2.4s; }
        .vinyl-shine {
          background: conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.22) 40deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.14) 220deg, transparent 280deg);
        }

        /* Vinyl spine list in the blog sidebar: slides out like a record being pulled */
        .spine {
          transition: transform 420ms var(--ease-out-expo), background-color 260ms ease, box-shadow 420ms ease;
        }
        .spine:hover { transform: translateX(-26px); box-shadow: -8px 0 18px rgba(0,0,0,0.35); }
        .spine:active { transform: translateX(-14px); transition-duration: 110ms; }

        /* ============================================================
           TERMINAL BOOT
           ============================================================ */
        @keyframes caretBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .boot-caret { animation: caretBlink 1s steps(1) infinite; }

        /* Faint CRT scanlines over the console panel */
        .crt-scanlines {
          background-image: repeating-linear-gradient(
            to bottom,
            rgba(255,255,255,0.05) 0px,
            rgba(255,255,255,0.05) 1px,
            transparent 1px,
            transparent 3px
          );
          opacity: 0.55;
        }

        /* ============================================================
           PATCH BAY
           ============================================================ */
        @keyframes ledBlink { 0%, 100% { opacity: 1; } 45% { opacity: 0.22; } }
        @keyframes vuSettle {
          0%   { transform: scaleY(0.1); opacity: 0; }
          70%  { transform: scaleY(1.12); opacity: 1; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .patch-cable {
          transition: stroke-width 200ms var(--ease-out-expo), filter 200ms ease;
        }
        .patch-cable:hover { stroke-width: 7; filter: brightness(1.35); }

        /* === IMAGE EFFECTS === */
        .img-duotone { mix-blend-mode: multiply; filter: grayscale(100%) contrast(150%); }
        .effect-ascii-overlay {
           position: absolute; inset: 0;
           background-image: radial-gradient(circle, #ff5722 1px, transparent 1px);
           background-size: 4px 4px;
           pointer-events: none;
        }

        /* ============================================================
           RESPECT THE USER'S SYSTEM PREFERENCE
           ============================================================ */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
            scroll-behavior: auto !important;
          }
          .slide-card:hover, .slide-press:hover, .spine:hover { transform: none; }
          .boot-caret { opacity: 1; }
        }
      `}} />

      <div className="min-h-screen bg-[#e8e8e3] p-4 md:p-8 flex items-center justify-center relative transition-all duration-1000"
           style={backdropVars}>
        
        {/* GLOBAL TOAST NOTIFICATION */}
        {toast && (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={`fixed top-8 left-1/2 z-[100] px-8 py-4 border-[4px] shadow-[6px_6px_0px_#000] font-mono font-bold uppercase tracking-widest text-xs md:text-sm flex items-center gap-3 max-w-[90vw] ${
              toast.type === 'error'   ? 'bg-[#111] text-[#ff5722] border-[#ff5722]' :
              toast.type === 'success' ? 'bg-[#111] text-[#dfff00] border-[#dfff00]' :
                                         'bg-[#111] text-[#00ff00] border-[#00ff00]'
            }`}
            style={{ animation: `${toast.leaving ? 'toastOut 300ms var(--ease-mech) forwards' : 'toastIn 620ms var(--ease-out-expo) both'}` }}
          >
            {toast.type === 'error' ? <AlertTriangle size={20}/> : toast.type === 'success' ? <Check size={20}/> : <Terminal size={20}/>}
            <span>{toast.msg}</span>
          </div>
        )}

       {/* === GALLERIA STICKER LIGHTBOX === */}
       <GalleriaLightbox
          payload={activeGalleriaImage}
          cfg={lightboxConfig}
          total={galleriaData.length}
          onClose={() => setActiveGalleriaImage(null)}
          onPrev={() => setActiveGalleriaImage(p => {
            const n = (p.index - 1 + galleriaData.length) % galleriaData.length;
            return { item: galleriaData[n], index: n };
          })}
          onNext={() => setActiveGalleriaImage(p => {
            const n = (p.index + 1) % galleriaData.length;
            return { item: galleriaData[n], index: n };
          })}
       />

       {/* === POEM OVERLAY === */}
       <PoemOverlay
          poem={activePoem}
          shuffle={poemShuffle}
          onClose={() => setActivePoem(null)}
          onShuffle={() => setPoemShuffle(s => s + 1)}
       />

       {/* === NEW: TICKET GATE OVERLAY === */}
       {pendingJournal && (
          <div className="fixed inset-0 z-[70] bg-[#111]/80 backdrop-blur-md flex items-center justify-center p-4"
               style={{ animation: 'backdropIn 300ms ease-out both' }}
               onClick={(e) => { if (e.target === e.currentTarget) { setPendingJournal(null); setVisitorName(''); } }}>
             <div className="w-[300px] h-[580px] bg-[#ff5722] rounded-[20px] p-4 flex flex-col relative shadow-[16px_16px_0px_rgba(0,0,0,0.5)] border-[2px] border-[#111]"
                  style={{ animation: 'ticketIn 720ms var(--ease-out-expo) both' }}>
                
                <button onClick={() => {setPendingJournal(null); setIsTicketValidating(false); setVisitorName('');}} className="absolute top-2 right-2 text-white hover:text-[#111] z-50 p-2"><X size={20}/></button>

                {/* Top Image Box */}
                <div className="w-full h-[220px] rounded-[16px] overflow-hidden relative border-[2px] border-[#111] bg-white">
                   <img src={pendingJournal.image} className="w-full h-full object-cover grayscale mix-blend-multiply opacity-80" alt="Ticket Art" />
                   
                   {/* Decorative holes */}
                   <div className="absolute top-8 -right-4 w-8 h-8 bg-[#f4f4f0] border-[2px] border-[#111] rounded-full"></div>
                   <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#f4f4f0] border-[2px] border-[#111] rounded-full"></div>
                </div>

                {/* Middle Date/Title */}
                <div className="mt-8 px-2 flex justify-between items-start font-mono font-bold text-sm text-[#111] border-b-[2px] border-[#111] pb-2 relative">
                   <span>{new Date().getDate().toString().padStart(2, '0')}</span>
                   <div className="flex flex-col items-end">
                      <span>{(new Date().getMonth()+1).toString().padStart(2, '0')}</span>
                      <span className="text-[8px] opacity-70 mt-1">{new Date().getFullYear()}</span>
                   </div>
                </div>
                <h2 className="text-6xl font-serif text-[#111] text-center mt-2 tracking-tight">archive</h2>

                {/* Perforation */}
                <div className="w-full border-t-[3px] border-dashed border-[#111] my-8 relative">
                   <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#111]/80 rounded-r-full"></div>
                   <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-4 h-6 bg-[#111]/80 rounded-l-full"></div>
                </div>

                {/* Bottom Form */}
                <div className="flex-1 flex flex-col px-2">
                   <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2 font-mono font-bold text-[10px] uppercase text-[#111] tracking-widest"><div className="w-2.5 h-2.5 rounded-full bg-[#111]"></div> TICKET</div>
                      {/* Fake Barcode */}
                      <div className="w-16 h-6 bg-[#111]" style={{backgroundImage: 'repeating-linear-gradient(90deg, #ff5722, #ff5722 1px, transparent 1px, transparent 3px)'}}></div>
                   </div>
                   
                   <form onSubmit={submitJournalAccess} className="mt-auto">
                      <input 
                         required
                         autoFocus
                         disabled={isTicketValidating}
                         value={visitorName} 
                         onChange={e=>setVisitorName(e.target.value)} 
                         placeholder="ENTER IDENTIFICATION" 
                         className="w-full bg-transparent border-b-[2px] border-[#111] placeholder:text-[#111]/60 text-[#111] font-mono text-sm font-bold outline-none py-2 mb-6 focus:bg-white/20 transition-colors disabled:opacity-50" 
                      />
                      <div className="flex justify-between items-end">
                        <p className="text-[6.5px] font-mono text-[#111] leading-tight w-[55%]">This ticket grants temporary access to the specified memory node. Unauthorized extraction is strictly prohibited.</p>
                        <button disabled={isTicketValidating} type="submit" className="bg-[#111] text-[#ff5722] font-mono font-bold text-[10px] tracking-widest px-4 py-2.5 hover:bg-white hover:text-[#111] transition-colors shadow-[2px_2px_0px_#111] disabled:opacity-50 border-[2px] border-[#111]">
                           {isTicketValidating ? 'VERIFYING...' : 'VALIDATE'}
                        </button>
                      </div>
                   </form>
                </div>
             </div>
          </div>
       )}

       <div className="w-full max-w-7xl relative z-10 flex flex-col h-[95vh] mt-4 md:mt-0 pt-8">
          
          {/* === SCALE STUDIO FOLDER HEADER === */}
          {/* Increased height to 104px to ensure text never clips */}
          <div className="grid grid-cols-[auto_60px_1fr] w-full h-[104px] items-end relative z-20 -mb-[4px] pointer-events-none">
            
            {/* 1. THE LEFT TAB (Logo) */}
            <div className="h-[104px] bg-[#f4f4f0] border-t-[4px] border-l-[4px] border-[#111] rounded-tl-[16px] pl-6 md:pl-10 pr-4 pt-5 relative z-30 pointer-events-auto">
               <h1 className="font-serif text-3xl md:text-4xl text-[#111] leading-none tracking-tight">iceyyy's<br/>intro</h1>
               {/* Mask to erase the folder body border underneath */}
               <div className="absolute bottom-[-4px] left-0 w-full h-[8px] bg-[#f4f4f0]"></div>
            </div>

            {/* 2. THE PERFECT S-CURVE (SVG) */}
            <div className="h-[104px] w-[60px] relative z-20 pointer-events-none -ml-[2px] -mr-[2px]">
               {/* overflow-visible ensures the 4px stroke is never clipped by the edge */}
               <svg width="100%" height="100%" viewBox="0 0 60 104" className="absolute bottom-0 left-0 overflow-visible">
                  {/* The fill: Fills everything below the stroke to bridge the folder body */}
                  <path d="M-2,2 C30,2 30,82 62,82 L62,104 L-2,104 Z" fill="#f4f4f0" />
                  {/* The stroke: Starts at Y=2 (tab top border), swoops down to Y=82 (track top border center) */}
                  <path d="M-2,2 C30,2 30,82 62,82" fill="none" stroke="#111" strokeWidth="4" />
               </svg>
               <div className="absolute bottom-[-4px] left-0 w-full h-[8px] bg-[#f4f4f0] z-30"></div>
            </div>

            {/* 3. THE HORIZONTAL TRACK & FLOATING BUTTONS */}
            <div className="h-[24px] border-t-[4px] border-r-[4px] border-[#111] rounded-tr-[16px] bg-[#f4f4f0] relative z-10 flex justify-end pointer-events-auto">
               
               {/* The Pill Buttons (Added pb-3 so the shadow doesn't get clipped by overflow) */}
               <div className="absolute bottom-[28px] right-2 md:right-8 flex gap-3 overflow-x-auto hide-scrollbar max-w-[calc(100vw-120px)] md:max-w-none pl-4 pb-3 pt-2">
                  {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            aria-current={activeTab === tab.id ? 'page' : undefined}
                            className={`relative px-5 py-2 rounded-full border-[2px] border-[#111] font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#111] slide-press flex-shrink-0 ${
                              activeTab === tab.id ? 'bg-[#111] text-[#f4f4f0]' : 'bg-white text-[#111] hover:bg-[#dfff00]'
                            }`}>
                      {tab.label}
                      {/* Active marker slides in under the pill instead of the label just recolouring */}
                      {activeTab === tab.id && (
                        <span className="absolute left-1/2 -bottom-[7px] h-[3px] w-[60%] -translate-x-1/2 bg-[#ff5722] rounded-full origin-center"
                              style={{ animation: 'barFill 380ms var(--ease-out-expo) both' }} />
                      )}
                    </button>
                  ))}
               </div>

               {/* Mask to erase the folder body border underneath */}
               <div className="absolute bottom-[-4px] left-0 w-full h-[8px] bg-[#f4f4f0] z-30"></div>
            </div>
          </div>

          {/* === THE MAIN FOLDER BODY === */}
          <div className="flex-1 bg-[#f4f4f0] border-[4px] border-[#111] border-t-0 shadow-[16px_16px_0px_rgba(17,17,17,0.3)] relative z-10 flex flex-col overflow-hidden rounded-b-[24px] w-full pt-1">
            
            {/* INNER BLUEPRINT CONTENT FRAME */}
            <div className="flex-1 m-4 md:m-6 mt-3 border-[2px] border-[#111] bg-white bg-blueprint flex flex-col relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.05)]">
              
              {isAdmin && siteSettings?.wip?.[activeTab] && activeTab !== 'admin' && (
                <div className="absolute top-0 left-0 w-full bg-[#ff5722] text-white text-center py-1.5 font-mono font-bold text-[10px] uppercase tracking-widest z-50 border-b-[2px] border-[#111]">
                  ADMIN OVERRIDE: MODULE HIDDEN FROM PUBLIC (WIP ACTIVE)
                </div>
              )}

              {/* === NEW: JOURNALING TAB OVERLAY === */}
              {activeJournal && (
                <div className="absolute inset-0 z-[60] bg-[#f0ebd8] flex flex-col overflow-y-auto font-sans hide-scrollbar" style={{ animation: 'sheetIn 620ms var(--ease-out-expo) both' }}>
                   
                   {(() => {
                      const len = journalEntries.length;
                      if (len === 0) return <div className="p-8 font-mono text-sm uppercase tracking-widest">No journal entries found in system.</div>;

                      // PAD THE WHEEL: Ensure we always have enough items to draw a continuous loop
                      const displayCount = len < 7 ? len * Math.ceil(7 / len) : len;
                      
                      const virtualEntries = Array.from({ length: displayCount }, (_, i) => ({
                         ...journalEntries[i % len],
                         virtualIndex: i
                      }));
                      
                      const activeEntry = len > 0 ? journalEntries[journalIndex % len] : null;
                      const { h, m, s, ampm } = formatTime(currentTime);
                      
                      if (!activeEntry) return <div className="p-8">No journal entries found in system.</div>;
                      
                      return (
                        <>
                           {/* Fake Inspo Top Nav & Close Button */}
                           <div className="flex justify-between items-center p-6 md:p-8 border-b border-[#111]/10">
                              <div className="flex items-center gap-2">
                                 <div className="w-8 h-8 border-[2px] border-[#111] flex items-center justify-center">
                                    <div className="w-4 h-4 bg-[#111]"></div>
                                 </div>
                                 <span className="font-mono text-[10px] bg-[#111] text-[#f0ebd8] px-1 ml-1">STUDIO</span>
                              </div>
                              <div className="hidden md:flex gap-6 font-mono text-[10px] font-bold tracking-widest text-[#111] uppercase">
                                 <span className="cursor-pointer hover:opacity-50">Home</span>
                                 <span className="cursor-pointer hover:opacity-50">. About .</span>
                                 <span className="cursor-pointer hover:opacity-50">Month</span>
                              </div>
                              <button onClick={() => setActiveJournal(null)} className="font-mono text-xs font-bold tracking-widest uppercase bg-[#111] text-[#f0ebd8] px-4 py-2 hover:bg-[#ff5722] transition-colors shadow-[2px_2px_0px_rgba(17,17,17,0.3)] slide-press">
                                 Close Entry <span className="opacity-50 ml-1">ESC</span>
                              </button>
                           </div>

                           <div className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col pb-24">
                              
                              {/* THE TICKET BANNER (Dynamic to Journal Entry) */}
                              <div className="w-full h-[220px] md:h-[320px] bg-white rounded-2xl md:rounded-[32px] overflow-hidden relative group cursor-crosshair shadow-[0_20px_40px_rgba(0,0,0,0.1)] mb-12 shrink-0 border-[4px] border-[#111]/5">
                                 <img src={activeEntry.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105" alt="Journal cover" />
                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-700"></div>
                                 
                                 <div className="absolute top-0 left-0 w-[80px] md:w-[120px] h-full bg-[#f8f9fa] border-r-[3px] border-dashed border-[#111]/30 -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] flex flex-col items-center justify-between py-6 shadow-[10px_0_20px_rgba(0,0,0,0.2)]">
                                    <p className="[writing-mode:vertical-lr] rotate-180 font-mono text-[8px] md:text-[10px] text-gray-500 tracking-widest">STAPLE HERE</p>
                                    <h3 className="[writing-mode:vertical-lr] rotate-180 font-serif text-3xl md:text-5xl text-[#111]">{activeEntry.year}</h3>
                                    <p className="[writing-mode:vertical-lr] rotate-180 font-mono text-[8px] md:text-[10px] uppercase font-bold text-[#111] text-center leading-tight">PASSENGER<br/>TICKET</p>
                                 </div>
                                 
                                 <div className="absolute bottom-6 right-6 md:bottom-10 md:right-10 flex flex-col items-end text-white opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-700 delay-150 ease-out">
                                    <h2 className="font-serif text-5xl md:text-7xl leading-none shadow-black drop-shadow-xl">{activeEntry.date} {activeEntry.year}</h2>
                                    <div className="flex gap-4 font-mono text-[10px] md:text-xs mt-2 opacity-90 tracking-widest bg-black/40 px-3 py-1 backdrop-blur-md rounded shadow-lg">
                                       <span>{activeEntry.timeSpan}</span>
                                       <span>CLASS: {activeEntry.ticketClass}</span>
                                    </div>
                                    <div className="mt-4 h-10 w-48 md:w-64 bg-white/90 backdrop-blur-md rounded-sm shadow-xl" style={{backgroundImage: 'repeating-linear-gradient(90deg, #111, #111 2px, transparent 2px, transparent 5px, #111 5px, #111 6px, transparent 6px, transparent 10px, #111 10px, #111 14px, transparent 14px)'}}></div>
                                 </div>
                              </div>

                              {/* THE BEIGE CALENDAR LAYOUT */}
                              <div className="flex flex-col md:flex-row gap-12 text-[#111] w-full mt-4">
                                 
                                 {/* Left: Huge Date Block */}
                                 <div className="md:w-1/3 flex flex-col items-start pt-4">
                                    <p className="font-mono text-sm mb-2">{activeEntry.date.split(' ')[0]}</p>
                                    <div className="flex items-center gap-3">
                                       <div className="flex flex-col text-xs text-gray-400 font-mono leading-none">
                                          <span>^</span><span className="rotate-180 pt-1">^</span>
                                       </div>
                                       <h2 className="font-serif text-7xl md:text-8xl leading-[0.8] tracking-tighter uppercase">{activeEntry.year}</h2>
                                    </div>
                                    <p className="font-mono text-xl mt-4 self-end pr-8">2026</p>
                                    <p className="text-[8px] text-gray-400 font-mono uppercase mt-12 tracking-widest">© STUDIO 2026</p>
                                 </div>

                                 {/* Center: Radial CSS Scrollable Wheel */}
                                 <div className="hidden lg:block relative w-64 shrink-0 h-[400px] mt-24" 
                                      onWheel={(e) => {
                                         if (len === 0) return;
                                         if (e.deltaY > 0) setJournalIndex((prev) => (prev + 1) % displayCount);
                                         else if (e.deltaY < 0) setJournalIndex((prev) => (prev - 1 + displayCount) % displayCount);
                                      }}>
                                      <div className="absolute top-1/2 right-12 w-[220px] h-[1px] -translate-y-1/2 transition-transform duration-300">
                                         
                                         {/* Infinite Spoke Generator */}
                                         {virtualEntries.map((entry, i) => {
                                            let offset = i - journalIndex;
                                            
                                            // Circular boundary calculation for infinite scrolling
                                            const half = Math.floor(displayCount / 2);
                                            if (offset > half) offset -= displayCount;
                                            if (offset < -half) offset += displayCount;
                                            
                                            const angle = offset * 22; // Degrees between spokes
                                            const isVisible = Math.abs(offset) <= 3; // EXACTLY 7 LINES VISIBLE
                                            
                                            return (
                                              <div key={`wheel-${i}`} className="absolute top-0 right-0 w-full h-[1px] origin-right transition-all duration-500 ease-out" 
                                                   style={{transform: `rotate(${angle}deg)`, opacity: isVisible ? 1 : 0, zIndex: offset === 0 ? 10 : 1, pointerEvents: isVisible ? 'auto' : 'none'}}>
                                                 <div className={`w-full h-full relative transition-colors duration-500 ${offset === 0 ? 'bg-[#111]' : 'bg-[#111]/20'}`}>
                                                     <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-4 font-mono cursor-pointer transition-all duration-300 flex items-center justify-end ${offset === 0 ? 'text-[#111] scale-110' : 'text-[#111]/40 hover:text-[#111]'}`} 
                                                           style={{transform: `rotate(${-angle}deg)`}} 
                                                           onClick={() => setJournalIndex(i)}>
                                                        
                                                        {/* CLEANED UP Typography */}
                                                        <div className="flex items-center whitespace-nowrap">
                                                           {offset === 0 && <span className="text-4xl font-bold tracking-tighter leading-none mr-3">{entry.year}</span>} 
                                                           <span className={`${offset === 0 ? "font-bold text-sm" : "text-xs tracking-widest uppercase"}`}>{entry.shortDate}</span>
                                                        </div>
                                                        
                                                     </div>
                                                 </div>
                                              </div>
                                            )
                                         })}
                                         <div className="absolute top-1/2 right-[-16px] -translate-y-1/2 bg-[#111] text-[#f0ebd8] font-mono text-[9px] tracking-widest px-1.5 py-4 rounded-full [writing-mode:vertical-lr] z-20 shadow-[0_4px_10px_rgba(0,0,0,0.3)] pointer-events-none">TODAY</div>
                                      </div>
                                 </div>

                                 {/* Right: Data & Text Column */}
                                 <div className="md:w-1/3 flex flex-col gap-6 md:pt-4">
                                    
                                    {/* Real-time Clock Header */}
                                    <div className="flex justify-between items-end border-b border-[#111]/30 pb-2">
                                       <div className="flex gap-4 font-serif text-5xl leading-none tracking-tight">
                                          <span>{h.toString().padStart(2, '0')}</span>
                                          <div className="flex gap-2 items-start pt-1 font-mono tracking-normal">
                                             <span className="text-xl">{m}</span>
                                             <span className="text-xl text-gray-500">{s}</span>
                                          </div>
                                       </div>
                                       <span className="font-mono text-sm mb-1 font-bold">{ampm}</span>
                                    </div>

                                    {/* Section 1 */}
                                    <div>
                                       <p className="font-mono text-[9px] font-bold tracking-widest uppercase border-b border-[#111]/30 pb-1 mb-3">Location Status</p>
                                       <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">Coordinates Locked</p>
                                    </div>

                                    {/* Section 2 (Dynamic Journal Logs) */}
                                    <div>
                                       <p className="font-mono text-[9px] font-bold tracking-widest uppercase border-b border-[#111]/30 pb-1 mb-3">Today | Entry Log</p>
                                       <ul className="space-y-3 font-sans text-sm text-[#111]/80 leading-relaxed">
                                          {(activeEntry.logs || []).map((log, idx) => (
                                             <li key={idx}>• {log}</li>
                                          ))}
                                       </ul>
                                    </div>

                                    {/* Section 3 (Dynamic History) */}
                                    <div className="mt-4">
                                       <p className="font-mono text-[9px] font-bold tracking-widest uppercase border-b border-[#111]/30 pb-1 mb-3">This Day In History</p>
                                       <div className="flex gap-4 items-start">
                                          <span className="font-serif text-4xl">{activeEntry.historyYear}</span>
                                          <span className="font-mono text-[9px] uppercase text-gray-500 leading-tight pt-1.5">{activeEntry.historyText}</span>
                                       </div>
                                    </div>

                                 </div>
                              </div>
                           </div>
                        </>
                      );
                   })()}
                </div>
              )}

              {/* key forces a remount per tab so the entrance choreography replays */}
              <main key={activeTab} className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 hide-scrollbar relative tab-enter">
                {renderContent()}
              </main>

              {/* FOOTER BAR */}
              <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 flex justify-between items-end text-[#111] pointer-events-none bg-gradient-to-t from-white via-white/90 to-transparent pt-16 border-t border-[#111]/10 z-50">
                <span className="font-mono font-bold tracking-widest text-[10px] uppercase bg-white/80 px-2 py-1 border-[2px] border-[#111] shadow-[2px_2px_0px_#111] backdrop-blur-sm pointer-events-auto">SYS_ARCHIVE // 2026</span>
                <button onClick={() => setShowLogin(true)} className="pointer-events-auto font-mono text-[#111]/30 hover:text-[#ff5722] transition-colors flex items-center justify-center p-2 bg-white/80 backdrop-blur-sm rounded-full border-[2px] border-transparent hover:border-[#111]" title="Auth Override"><Lock size={14}/></button>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL HANDLING */}
        {selectedItem && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}
            className="fixed inset-0 bg-[#f4f4f0]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8"
            style={{ animation: 'backdropIn 320ms ease-out both' }}
          >
            
            {/* === VINYL ALBUM MODAL === */}
            {itemType === 'blog' && selectedItem.type === 'album' ? (
               <div className="w-[95vw] max-w-6xl h-[85vh] min-h-[500px] shadow-[16px_16px_0px_#111] relative flex flex-col items-center justify-center overflow-hidden border-[4px] border-[#111] anim-sheet"
                    style={{ backgroundColor: selectedItem.bgColor || '#ff5722', backgroundImage: selectedItem.bgImage ? `url(${selectedItem.bgImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}>

                  {/* Diagonal slash background accent */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #111, #111 2px, transparent 2px, transparent 10px)' }}></div>

                  <button aria-label="Close" onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 z-50 text-white bg-[#111] p-3 border-[2px] border-white/20 hover:bg-white hover:text-[#111] hover:border-[#111] transition-all slide-press"><X size={24} /></button>

                  {/* NOW PLAYING strip — slides in from the left once the needle lands */}
                  <div className="absolute top-6 left-6 z-40 flex items-center gap-3 bg-[#111] text-[#dfff00] border-[2px] border-[#dfff00] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] anim-left" style={{ animationDelay: '1.6s' }}>
                     <Disc3 size={14} className="animate-[spin_3s_linear_infinite]" />
                     <span>Now spinning</span>
                     <span className="w-1.5 h-1.5 rounded-full bg-[#ff5722] vinyl-needle-led" />
                  </div>

                  <div className="relative flex items-center justify-center scale-[0.65] sm:scale-75 md:scale-100 md:-translate-x-12">

                      {/* --- THE RECORD: pulled out of the sleeve, then spun up --- */}
                      <div className="absolute w-[300px] h-[300px] md:w-[450px] md:h-[450px] z-10 vinyl-disc border-[2px] border-[#111] rounded-full shadow-[8px_8px_0px_rgba(17,17,17,0.5)]">
                          <div className="w-full h-full rounded-full bg-[#111] vinyl-platter" style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, #111, #111 2px, #222 3px, #222 4px)' }}>
                               <div className="absolute inset-0 m-auto w-1/3 h-1/3 rounded-full bg-white flex items-center justify-center border-[4px] border-[#111]">
                                   <div className="w-3 h-3 rounded-full bg-[#111]"></div>
                               </div>
                          </div>
                          {/* Static sheen so the disc reads as lacquer, not a flat circle */}
                          <div className="absolute inset-0 rounded-full pointer-events-none vinyl-shine mix-blend-screen" />

                          {/* --- TONEARM: swings down onto the record after the pull-out --- */}
                          <div className="absolute -top-6 right-[-6%] w-[62%] h-[10px] z-30 vinyl-tonearm pointer-events-none">
                             <div className="absolute right-0 -top-3 w-8 h-8 rounded-full bg-[#111] border-[2px] border-white/30 shadow-[3px_3px_0px_rgba(0,0,0,0.4)]" />
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 h-[6px] w-full bg-[#111] rounded-full shadow-[2px_2px_0px_rgba(0,0,0,0.35)]" />
                             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-4 bg-[#ff5722] border-[2px] border-[#111] rotate-[18deg]" />
                          </div>
                      </div>

                      {/* --- THE SLEEVE --- */}
                      <div className="w-[300px] h-[300px] md:w-[450px] md:h-[450px] bg-white shadow-[12px_12px_0px_rgba(17,17,17,0.7)] z-20 relative p-8 md:p-12 flex flex-col border-[3px] border-[#111] vinyl-sleeve">
                          <h2 className="text-3xl md:text-5xl font-serif text-[#111] mb-4 leading-none uppercase anim-rise stagger-child" style={{ '--d': 6 }}>{selectedItem.title}</h2>

                          <div className="flex text-[#0000ff] mb-6 drop-shadow-sm border-b-[2px] border-[#111] pb-4 shrink-0">
                              {[...Array(Math.max(0, Math.min(5, Number(selectedItem.rating) || 5)))].map((_, i) => (
                                <Star key={i} size={18} fill="currentColor" className="anim-stamp stagger-child" style={{ '--d': 8 + i }} />
                              ))}
                          </div>
                          
                          <div className="flex-1 overflow-y-auto font-sans text-sm md:text-base text-gray-800 whitespace-pre-wrap hide-scrollbar pr-4 space-y-6">
                              {selectedItem.excerpt && <p className="font-bold mb-4 bg-[#dfff00] p-2 border-[2px] border-[#111]">{selectedItem.excerpt}</p>}
                              {(selectedItem.blocks || []).map((block, idx) => {
                                if (block.type === 'text') return <p key={idx} className="leading-relaxed">{block.content}</p>;
                                if (block.type === 'quote') return <blockquote key={idx} className="border-l-4 border-[#ff5722] pl-4 py-2 my-4 text-[#111] italic font-serif text-xl">{block.content}</blockquote>;
                                if (block.type === 'pullquote') return <div key={idx} className="text-2xl md:text-3xl font-serif text-center text-[#0000ff] my-8 leading-tight">"{block.content}"</div>;
                                if (block.type === 'image') return <img key={idx} src={block.content} alt="review visual" className="w-full border-[2px] border-[#111] shadow-[4px_4px_0px_#111] my-6 grayscale hover:grayscale-0 transition-all" />;
                                return null;
                              })}
                          </div>

                          <div className="absolute -bottom-8 -right-8 w-28 h-28 md:w-40 md:h-40 bg-[#dfff00] shadow-[8px_8px_0px_#111] rotate-[4deg] p-2 border-[2px] border-[#111] flex flex-col transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] hover:rotate-0 hover:scale-105 z-30 anim-stamp" style={{ animationDelay: '1.1s' }}>
                             <Pin size={28} fill="#ff5722" className="absolute -top-4 left-1/2 -translate-x-1/2 text-[#111] z-10" />
                             {selectedItem.coverImage ? (
                                <img src={selectedItem.coverImage} className="w-full h-full object-cover border-[2px] border-[#111]" alt="Album Art" />
                             ) : (
                                <div className="w-full h-full border-[2px] border-[#111] flex items-center justify-center text-[10px] font-mono font-bold text-center p-2 uppercase">No Asset Provided</div>
                             )}
                          </div>
                      </div>
                  </div>
               </div>

            // === VIDEO PLAYER ===
            ) : selectedItem.type === 'video' ? (
               <div className="bg-[#111] border-[4px] border-[#ff5722] shadow-[16px_16px_0px_#ff5722] p-8 md:p-12 w-full max-w-3xl mx-auto flex flex-col md:flex-row gap-8 md:gap-12 text-[#f4f4f0] font-mono select-none relative anim-sheet">
                 <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-50 text-white/50 hover:text-[#ff5722] transition-colors"><X size={28} /></button>
                 
                 <div className="w-full md:w-80 aspect-video md:aspect-square bg-[#000] border-[2px] border-[#333] overflow-hidden shrink-0 flex items-center justify-center relative shadow-[8px_8px_0px_#000]">
                   <video src={selectedItem.image} controls autoPlay loop className="absolute inset-0 w-full h-full object-cover" />
                 </div>
                 
                 <div className="flex-1 flex flex-col justify-center py-2">
                    <div className="flex justify-between items-center border-b-[2px] border-[#333] pb-2 mb-4">
                       <span className="text-[10px] uppercase tracking-widest text-[#00ff00]">A/V Playback Active</span>
                       <Activity size={16} className="text-[#00ff00] animate-pulse"/>
                    </div>
                    <h2 className="text-4xl font-serif text-white mb-2 leading-none uppercase">{selectedItem.title}</h2>
                    <p className="text-sm opacity-70 mb-8 truncate">{selectedItem.author || 'UNKNOWN_AUTHOR'} // {selectedItem.tabId || 'ARCHIVE'}</p>
                    
                    <div className="flex items-center gap-4 text-xs mb-8 font-bold text-[#ff5722]">
                       <span>0:00</span>
                       <div className="flex-1 h-2 bg-[#333] border border-[#555] relative">
                          <div className="absolute left-0 top-0 h-full w-1/3 bg-[#ff5722]"></div>
                       </div>
                       <span>3:14</span>
                    </div>
                    
                    <div className="flex justify-center gap-12 items-center px-4">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="hover:text-white cursor-pointer"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
                       <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="text-white cursor-pointer hover:scale-110 transition-transform"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="hover:text-white cursor-pointer"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
                    </div>
                 </div>
               </div>

            ) : (

              /* === ALL OTHER MODALS === */
              <div className="bg-[#f4f4f0] border-[4px] border-[#111] shadow-[16px_16px_0px_#111] w-full max-w-5xl max-h-[90vh] overflow-y-auto relative anim-sheet hide-scrollbar">
                <button aria-label="Close" onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-50 bg-[#111] text-white p-3 border-[2px] border-[#111] hover:bg-[#ff5722] transition-colors slide-press"><X size={20} /></button>
                
                {itemType === 'project' && (
                  <div className="relative">
                    
                    {selectedItem.type === 'gallery' ? (
                      <div className="w-full bg-blueprint border-b-[4px] border-[#111] min-h-[75vh] relative overflow-hidden p-8">
                         {isAdmin && (
                           <div className="absolute top-4 left-4 z-50 flex gap-3">
                              <span className="bg-[#111] text-[#00ff00] font-mono font-bold px-4 py-2 text-xs uppercase tracking-widest border-[2px] border-[#00ff00]">ADMIN OVERRIDE: DRAG ACTIVE</span>
                              <button onClick={saveGalleryLayout} className="bg-[#0000ff] text-white font-mono font-bold px-6 py-2 uppercase tracking-widest border-[2px] border-[#111] shadow-[4px_4px_0px_#111] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111]">SAVE LAYOUT</button>
                           </div>
                         )}
                         {modalGalleryBlocks.map((img) => (
                           <DraggableImage key={img.id} item={img} updateImage={updateModalGalleryImage} bringToFront={bringToFrontModalGallery} isAdmin={isAdmin} />
                         ))}
                         
                         <div className="absolute bottom-8 left-8 z-40 pointer-events-none bg-white p-8 border-[4px] border-[#111] shadow-[8px_8px_0px_#111] max-w-xl">
                            <h2 className="text-5xl md:text-7xl font-serif text-[#111] mb-2 uppercase leading-none">{selectedItem.title}</h2>
                            <div className="flex items-center gap-3 mb-4">
                               <p className="font-mono text-white bg-[#111] px-3 py-1 font-bold text-xs uppercase">{selectedItem.tabId}</p>
                               <span className="w-full h-[2px] bg-[#111]"></span>
                            </div>
                            {selectedItem.content && <p className="font-sans text-[#111] leading-relaxed border-l-[4px] border-[#ff5722] pl-4">{selectedItem.content}</p>}
                         </div>
                      </div>

                    ) : selectedItem.type === 'custom' ? (
                      <div className="w-full bg-white overflow-hidden p-8 border-b-[4px] border-[#111]" dangerouslySetInnerHTML={{ __html: selectedItem.content }} />
                    
                    ) : selectedItem.type === 'iframe' ? (
                      <iframe src={selectedItem.content} className="w-full h-[70vh] bg-white border-b-[4px] border-[#111]" title={selectedItem.title} />
                    
                    ) : (
                      selectedItem.image && <img src={selectedItem.image} className="w-full h-96 object-cover border-b-[4px] border-[#111] grayscale" alt="cover" />
                    )}
                    
                    {selectedItem.type !== 'custom' && selectedItem.type !== 'iframe' && selectedItem.type !== 'gallery' && (
                      <div className="p-12 md:p-16 bg-[#f4f4f0]">
                        <h2 className="text-6xl md:text-8xl font-serif text-[#111] mb-6 uppercase tracking-tight leading-none">{selectedItem.title}</h2>
                        <div className="flex items-center gap-4 mb-10 border-b-[2px] border-[#111] pb-6">
                           <p className="font-mono text-white bg-[#111] px-4 py-1 text-sm font-bold uppercase">{selectedItem.tabId}</p>
                           {selectedItem.author && <p className="font-mono text-[#111] text-sm font-bold uppercase tracking-widest">{selectedItem.author}</p>}
                        </div>
                        <p className="font-sans text-xl text-[#111] leading-relaxed whitespace-pre-wrap max-w-4xl">{selectedItem.content}</p>
                      </div>
                    )}
                  </div>
                )}

                {itemType === 'blog' && (
                  <div className="p-12 md:p-20 bg-white">
                      <div className="flex items-center gap-4 mb-8">
                         <p className="font-mono text-white bg-[#0000ff] px-4 py-1 text-xs font-bold uppercase tracking-widest">{selectedItem.category}</p>
                         <p className="font-mono text-[#111] text-xs font-bold uppercase tracking-widest">{selectedItem.date}</p>
                      </div>
                      
                      <h2 className="text-5xl md:text-7xl font-serif text-[#111] mb-10 uppercase tracking-tight leading-none">{selectedItem.title}</h2>
                      
                      {selectedItem.tags && (
                         <div className="flex items-center gap-2 mb-12 border-b-[2px] border-[#111] pb-8">
                           <span className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">TAGS:</span>
                           <span className="font-mono text-[#111] text-xs uppercase bg-[#e5e5e5] border border-[#111] px-2 py-1">{selectedItem.tags}</span>
                         </div>
                      )}
                      
                      <div className="space-y-8 font-sans text-lg text-[#111] leading-relaxed max-w-4xl mx-auto">
                         {selectedItem.excerpt && <p className="font-bold text-2xl mb-8 bg-[#dfff00] p-4 border-[2px] border-[#111]">{selectedItem.excerpt}</p>}
                         
                         {(selectedItem.blocks || []).map((block, idx) => {
                            if (block.type === 'text') return <p key={idx}>{block.content}</p>;
                            if (block.type === 'quote') return <blockquote key={idx} className="border-l-[6px] border-[#111] pl-6 py-2 my-8 text-3xl font-serif italic text-gray-600">{block.content}</blockquote>;
                            if (block.type === 'pullquote') return <div key={idx} className="text-3xl md:text-5xl font-serif text-center text-[#ff5722] my-16 px-8 leading-tight uppercase">"{block.content}"</div>;
                            if (block.type === 'image') return <img key={idx} src={block.content} alt="blog content" className="w-full border-[2px] border-[#111] shadow-[8px_8px_0px_#111] my-12 grayscale hover:grayscale-0 transition-all" />;
                            return null;
                         })}
                      </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AUTH MODAL */}
        {showLogin && !isAdmin && (
          <div className="fixed inset-0 bg-[#f4f4f0]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
               style={{ animation: 'backdropIn 280ms ease-out both' }}
               onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}>
            <div className="bg-white p-10 border-[4px] border-[#111] shadow-[16px_16px_0px_#111] w-full max-w-md relative anim-sheet">
              <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-[#111] hover:bg-[#ff5722] hover:text-white p-2 transition-colors border-[2px] border-transparent hover:border-[#111]"><X size={24}/></button>
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-[#111] text-white flex items-center justify-center mb-4 border-[2px] border-[#111] shadow-[4px_4px_0px_#ff5722]"><Lock size={32} /></div>
                <h2 className="text-3xl font-serif text-[#111] uppercase tracking-widest">Admin Override</h2>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* In local fallback mode there is no account, so email is optional */}
                <input type="email" required={!!supabase} autoComplete="username" placeholder={supabase ? "IDENTIFICATION" : "IDENTIFICATION (OPTIONAL — LOCAL MODE)"} value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full p-4 border-[2px] border-[#111] bg-[#f4f4f0] font-mono text-sm outline-none focus:bg-[#dfff00] transition-colors" />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="PASSCODE" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-4 pr-14 border-[2px] border-[#111] bg-[#f4f4f0] font-mono text-sm outline-none focus:bg-[#dfff00] transition-colors" />
                  <button type="button" aria-label={showPassword ? 'Hide passcode' : 'Show passcode'} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111] hover:text-[#ff5722] transition-colors p-1">
                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
                <button disabled={isLoading} type="submit" className="w-full bg-[#111] text-[#f4f4f0] font-mono font-bold uppercase tracking-widest p-4 border-[2px] border-[#111] hover:bg-[#0000ff] hover:text-white transition-colors disabled:opacity-50 mt-4 shadow-[4px_4px_0px_#111] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#111]">
                  {isLoading ? 'AUTHENTICATING...' : 'INITIALIZE ACCESS'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}