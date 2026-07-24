import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { Pin, X, Lock, GitBranch, UserPlus, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, LogOut, Upload, Star, Send, Pencil, Activity, LayoutGrid, FileText, Search, Terminal, GripVertical, Quote, AlignLeft, Layers, Check, AlertTriangle, RotateCcw, Music, Disc3, ChevronLeft, ChevronRight, Eye, EyeOff, Copy, Database, Network, Thermometer, Cpu, Radio, Zap, Waves, Gauge, SlidersHorizontal, Power, CircleDot, Cable, Play } from 'lucide-react';
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
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] break-words" style={{ color }}>{mod.period}</p>
                  <p className="font-mono text-[7px] uppercase tracking-[0.22em] text-white/35 break-words">{mod.subtitle}</p>
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
                          <p className="font-mono text-[8px] text-white/35 break-words">{node.mainValue || node.value}{node.subValue ? ` · ${node.subValue}` : ''}</p>
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
   TOPOGRAPHIC FIELD
   Procedural contour lines — no image, no stored asset. A 3D value
   noise field is sampled on a grid and marching squares traces one
   iso-line per level; advancing the third axis makes the terrain
   reshape while drift migrates it sideways.

   ARCHITECTURE: one shared engine, not one per surface.
   Every <TopoField/> registers a client canvas. The engine renders the
   terrain ONCE per frame into a single offscreen buffer sized to the
   viewport, then blits each client's slice out of it. So N panels cost
   the same as one, and because every client samples the buffer at its
   own viewport position, the contours line up across panels as a single
   continuous landscape.

   Memory is bounded by construction: one offscreen canvas (hard pixel
   cap), one Float32Array (grown, never churned), and client backing
   stores at 1x. Nothing is allocated per frame.
   ============================================================ */
const _smooth = (t) => t * t * (3 - 2 * t);
const _lerp = (a, b, t) => a + (b - a) * t;
const _clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Cheap integer hash -> [0,1). Deterministic, so a seed always yields
// the same terrain.
const _hash3 = (x, y, z, seed) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177) + Math.imul(seed | 0, 2654435761);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Trilinear value noise. Deliberately closure-free: this runs on the
// order of 10^5 times per frame and a per-call lambda was the single
// biggest source of GC churn in the first cut.
const _vnoise = (x, y, z, seed) => {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = _smooth(x - xi), v = _smooth(y - yi), w = _smooth(z - zi);
  const x1 = xi + 1, y1 = yi + 1, z1 = zi + 1;
  const c000 = _hash3(xi, yi, zi, seed), c100 = _hash3(x1, yi, zi, seed);
  const c010 = _hash3(xi, y1, zi, seed), c110 = _hash3(x1, y1, zi, seed);
  const c001 = _hash3(xi, yi, z1, seed), c101 = _hash3(x1, yi, z1, seed);
  const c011 = _hash3(xi, y1, z1, seed), c111 = _hash3(x1, y1, z1, seed);
  return _lerp(
    _lerp(_lerp(c000, c100, u), _lerp(c010, c110, u), v),
    _lerp(_lerp(c001, c101, u), _lerp(c011, c111, u), v),
    w
  );
};

const _fbm = (x, y, z, octaves, seed) => {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * _vnoise(x * freq, y * freq, z * freq, seed + i * 31);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
};

const TopoEngine = (() => {
  // Hard ceilings. These are the whole reason this can't run away:
  // whatever the viewport or the settings, the engine can never
  // allocate more than one ~1.8M-pixel buffer and one ~24k-float grid.
  const MAX_PIXELS = 1800000;   // offscreen buffer ceiling (~7MB RGBA)
  const MAX_CELLS  = 24000;     // sample-grid ceiling
  const MIN_FRAME  = 1000 / 24; // 24fps is plenty for terrain this slow
  const ASCII_FRAME = 1000 / 8;  // ASCII wants to be choppy; 8fps also keeps
                                 // thousands of fillText calls affordable

  const clients = new Map();    // canvas -> ctx
  let cfg = null;
  let off = null, offCtx = null;
  let field = null;             // reused; only ever grows
  let cols = 0, rows = 0, cell = 14;
  let bufW = 0, bufH = 0, bufScale = 1;
  let raf = 0, last = 0, t0 = 0, needsField = true, running = false;
  let reduced = false;

  const ensureBuffer = () => {
    const vw = Math.max(1, window.innerWidth || 1280);
    const vh = Math.max(1, window.innerHeight || 800);
    // Render below CSS resolution and upscale on blit — contours are
    // soft geometry, the difference is invisible and it quarters the fill.
    const s = Math.min(1, Math.sqrt(MAX_PIXELS / (vw * vh)));
    const w = Math.max(1, Math.round(vw * s));
    const h = Math.max(1, Math.round(vh * s));

    if (!off) {
      off = document.createElement('canvas');
      offCtx = off.getContext('2d');
    }
    if (w !== bufW || h !== bufH) {
      off.width = w; off.height = h;
      bufW = w; bufH = h; bufScale = s;
      needsField = true;
    }

    // Grid derived from the buffer, then clamped by cell count so a
    // 4K monitor with detail=8 can't ask for a million samples.
    // ASCII needs a coarser grid — one glyph per cell, not one sample.
    const baseCell = cfg.mode === 'ascii'
      ? _clamp(Number(cfg.asciiSize) || 14, 8, 40)
      : _clamp(Number(cfg.detail) || 14, 6, 60);
    let c = baseCell * bufScale;
    let nc = Math.ceil(bufW / c) + 2, nr = Math.ceil(bufH / c) + 2;
    while (nc * nr > MAX_CELLS && c < 400) {
      c *= 1.18;
      nc = Math.ceil(bufW / c) + 2; nr = Math.ceil(bufH / c) + 2;
    }
    if (nc !== cols || nr !== rows) {
      cols = nc; rows = nr;
      const need = cols * rows;
      if (!field || field.length < need) field = new Float32Array(need);
      needsField = true;
    }
    cell = c;
  };

  const sampleField = (t) => {
    const freq = (Number(cfg.scale) || 1) * 0.055 * (cell / (18 * bufScale)) * bufScale;
    const oct = _clamp(Number(cfg.octaves) || 2, 1, 5) | 0;
    const seed = Number(cfg.seed) || 0;
    const ox = t * (Number(cfg.driftX) || 0) * 0.06;
    const oy = t * (Number(cfg.driftY) || 0) * 0.06;
    const z = t * (Number(cfg.morph) || 0) * 0.08;
    for (let j = 0; j < rows; j++) {
      const base = j * cols, yy = j * cell * freq + oy;
      for (let i = 0; i < cols; i++) {
        field[base + i] = _fbm(i * cell * freq + ox, yy, z, oct, seed);
      }
    }
  };

  // Marching squares, allocation-free: no closures, no arrays, no
  // lookup table indirection inside the hot loop.
  const contour = (ctx, level) => {
    ctx.beginPath();
    const maxJ = rows - 1, maxI = cols - 1;
    for (let j = 0; j < maxJ; j++) {
      const r0 = j * cols, r1 = r0 + cols;
      const y0 = j * cell, y1 = y0 + cell;
      for (let i = 0; i < maxI; i++) {
        const a = field[r0 + i];      // top-left
        const b = field[r0 + i + 1];  // top-right
        const c = field[r1 + i + 1];  // bottom-right
        const d = field[r1 + i];      // bottom-left
        let idx = 0;
        if (a > level) idx |= 8;
        if (b > level) idx |= 4;
        if (c > level) idx |= 2;
        if (d > level) idx |= 1;
        if (idx === 0 || idx === 15) continue;

        const x0 = i * cell, x1 = x0 + cell;
        const tx = x0 + cell * ((level - a) / (b - a || 1e-6)); // top edge
        const ry = y0 + cell * ((level - b) / (c - b || 1e-6)); // right edge
        const bx = x0 + cell * ((level - d) / (c - d || 1e-6)); // bottom edge
        const ly = y0 + cell * ((level - a) / (d - a || 1e-6)); // left edge

        switch (idx) {
          case 1: case 14: ctx.moveTo(x0, ly); ctx.lineTo(bx, y1); break;
          case 2: case 13: ctx.moveTo(bx, y1); ctx.lineTo(x1, ry); break;
          case 3: case 12: ctx.moveTo(x0, ly); ctx.lineTo(x1, ry); break;
          case 4: case 11: ctx.moveTo(tx, y0); ctx.lineTo(x1, ry); break;
          case 6: case 9:  ctx.moveTo(tx, y0); ctx.lineTo(bx, y1); break;
          case 7: case 8:  ctx.moveTo(x0, ly); ctx.lineTo(tx, y0); break;
          // The two saddles must resolve opposite ways, or every ridge
          // junction develops an X artefact.
          case 5:  ctx.moveTo(tx, y0); ctx.lineTo(x0, ly);
                   ctx.moveTo(x1, ry); ctx.lineTo(bx, y1); break;
          case 10: ctx.moveTo(tx, y0); ctx.lineTo(x1, ry);
                   ctx.moveTo(x0, ly); ctx.lineTo(bx, y1); break;
          default: break;
        }
      }
    }
    ctx.stroke();
  };

  const chrome = (ctx, t) => {
    const w = bufW, h = bufH;
    if (cfg.rings) {
      const fx = w * 0.72, fy = h * 0.42, base = Math.min(w, h) * 0.1;
      ctx.save();
      ctx.strokeStyle = cfg.ringColor || '#ff5722';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const pulse = (t * 0.06 + i * 0.25) % 1;
        ctx.globalAlpha = Number(cfg.ringOpacity ?? 0.13) * (1 - pulse);
        ctx.setLineDash(i % 2 ? [3, 5] : []);
        ctx.beginPath();
        ctx.arc(fx, fy, base + pulse * base * 2.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (cfg.nodePath) {
      ctx.save();
      ctx.strokeStyle = cfg.lineColor || '#111';
      ctx.fillStyle = cfg.lineColor || '#111';
      ctx.globalAlpha = Math.min(1, Number(cfg.lineOpacity ?? 0.17) * 3.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = 7;
      for (let i = 0; i < n; i++) {
        const px = w * (0.12 + (i / (n - 1)) * 0.78);
        const py = h * (0.2 + _vnoise(i * 0.7, 0, t * 0.02, (Number(cfg.seed) || 0) + 5) * 0.6);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const px = w * (0.12 + (i / (n - 1)) * 0.78);
        const py = h * (0.2 + _vnoise(i * 0.7, 0, t * 0.02, (Number(cfg.seed) || 0) + 5) * 0.6);
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        i % 2 ? ctx.fill() : ctx.stroke();
      }
      ctx.restore();
    }
    if (cfg.ticks) {
      ctx.save();
      ctx.strokeStyle = cfg.lineColor || '#111';
      ctx.globalAlpha = Math.min(1, Number(cfg.lineOpacity ?? 0.17) * 2.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 24; x < w - 24; x += 14) {
        const long = (x / 14) % 5 === 0;
        ctx.moveTo(x, h - 18); ctx.lineTo(x, h - 18 - (long ? 10 : 5));
      }
      for (let y = 24; y < h - 24; y += 14) {
        const long = (y / 14) % 5 === 0;
        ctx.moveTo(w - 18, y); ctx.lineTo(w - 18 - (long ? 10 : 5), y);
      }
      ctx.stroke();
      ctx.restore();
    }
  };

  // One glyph per cell, chosen from a ramp by field density. Reuses the same
  // noise field as the contours, so the two modes share all the machinery.
  const renderAscii = (t) => {
    sampleField(t);
    offCtx.clearRect(0, 0, bufW, bufH);
    const ramp = (cfg.asciiRamp && cfg.asciiRamp.length ? cfg.asciiRamp : ' .:-=+*#%@');
    const last = ramp.length - 1;
    const px = Math.max(6, cell * 1.5);
    offCtx.font = px + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    offCtx.textBaseline = 'top';
    offCtx.fillStyle = cfg.lineColor || '#111111';
    offCtx.globalAlpha = Number(cfg.lineOpacity ?? 0.17);
    for (let j = 0; j < rows; j++) {
      const y = j * cell;
      for (let i = 0; i < cols; i++) {
        const v = field[j * cols + i];
        const ch = ramp[_clamp(Math.floor(v * ramp.length), 0, last) | 0];
        if (ch === ' ') continue;
        offCtx.fillText(ch, i * cell, y);
      }
    }
    offCtx.globalAlpha = 1;
  };

  const renderBuffer = (t) => {
    if (cfg.mode === 'ascii') return renderAscii(t);
    sampleField(t);
    offCtx.clearRect(0, 0, bufW, bufH);
    offCtx.lineJoin = 'round';
    offCtx.lineCap = 'round';
    offCtx.strokeStyle = cfg.lineColor || '#111111';
    const levels = _clamp(Number(cfg.levels) || 12, 2, 40) | 0;
    const major = Math.max(0, Number(cfg.majorEvery) || 0);
    const lw = Number(cfg.lineWidth) || 1;
    for (let k = 0; k < levels; k++) {
      const lvl = 0.18 + (k / (levels - 1 || 1)) * 0.64;
      const isMajor = major > 0 && k % major === 0;
      offCtx.globalAlpha = isMajor ? Number(cfg.majorOpacity ?? 0.34) : Number(cfg.lineOpacity ?? 0.17);
      offCtx.lineWidth = lw * (isMajor ? 1.7 : 1);
      contour(offCtx, lvl);
    }
    offCtx.globalAlpha = 1;
    chrome(offCtx, t);
  };

  // Copy each client's slice of the shared buffer. Clients that are
  // scrolled out of view are skipped entirely.
  const blit = () => {
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    clients.forEach((ctx, cv) => {
      const r = cv.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      if (r.bottom < -64 || r.top > vh + 64 || r.right < -64 || r.left > vw + 64) return;
      // Only touch .width/.height when they actually change — assigning
      // either one reallocates the backing store and clears the canvas.
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const k = bufW / vw;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(off, r.left * k, r.top * k, r.width * k, r.height * k, 0, 0, w, h);
    });
  };

  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!cfg || clients.size === 0) return;
    const moving = cfg.animate && !reduced && !document.hidden;
    if (!moving && !needsField) { return; }
    if (now - last < (cfg.mode === 'ascii' ? ASCII_FRAME : MIN_FRAME)) return;
    last = now;
    ensureBuffer();
    renderBuffer(moving ? (now - t0) / 1000 : 0);
    blit();
    needsField = false;
  };

  const start = () => {
    if (running) return;
    running = true;
    t0 = performance.now();
    last = 0;
    reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onResize = () => { needsField = true; };

  return {
    setConfig(next) {
      cfg = next;
      needsField = true;
    },
    add(cv) {
      if (!cv || clients.has(cv)) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      clients.set(cv, ctx);
      if (clients.size === 1) {
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onResize, { passive: true });
        start();
      }
      needsField = true;
    },
    remove(cv) {
      clients.delete(cv);
      if (clients.size === 0) {
        stop();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onResize);
        // Release the buffer so an idle tab holds nothing.
        if (off) { off.width = 0; off.height = 0; }
        off = null; offCtx = null; field = null;
        bufW = bufH = cols = rows = 0;
      }
    },
    // exposed for tests
    _stats: () => ({ clients: clients.size, cols, rows, bufW, bufH, fieldLen: field ? field.length : 0 })
  };
})();

const TopoField = ({ cfg, fixed = false }) => {
  const ref = useRef(null);

  // Config changes never tear down the loop — the engine just reads the
  // newest object. (Re-creating the effect on every slider tick was what
  // made the first version thrash.)
  useEffect(() => { TopoEngine.setConfig(cfg); }, [cfg]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    TopoEngine.add(cv);
    return () => TopoEngine.remove(cv);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`${fixed ? 'fixed' : 'absolute'} inset-0 w-full h-full pointer-events-none`}
      style={{ zIndex: -1 }}
    />
  );
};

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
const GalleriaLightbox = ({ payload, cfg, onClose, onPrev, onNext, total, ascii }) => {
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

      {ascii?.enabled && (
        <AsciiTexture seed={91} ramp={ascii.ramp} size={ascii.size} speed={ascii.speed} animate={ascii.animate}
                      color={ascii.inkOnDark} opacity={(ascii.opacityDark ?? 0.06) * 0.7} className="fixed" mask={ascii.mask} clear={ascii.clear} />
      )}

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
          <img loading="lazy" decoding="async" src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover"
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
              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
                   style={{ color: accent, borderTop: i ? `1px solid ${accent}55` : 'none' }}>
                <span className="min-w-0 break-words">{row}</span>
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
                  <div key={m.id} className="flex gap-2 min-w-0"><span className="opacity-60 shrink-0">{m.label}</span><span className="font-bold truncate">{fill(m.value)}</span></div>
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
/* ============================================================
   EDITORIAL GALLERIA VIEWER
   The alternative to the scrapbook lightbox: a dark photo-essay
   spread. A circular medallion carries the title and standfirst;
   the clicked plate and its neighbours cascade across the right
   as overlapping cards with caption blocks tucked under them.

   Switch between this and the scrapbook in Admin > Lightbox.
   ============================================================ */
const EditorialLightbox = ({ payload, cfg, items, onClose, onPrev, onNext, onJump, ascii }) => {
  if (!payload) return null;
  const { item, index } = payload;
  const paper = cfg.edPaper || '#e8e3d5';
  const ink = cfg.edInk || '#16150f';
  const accent = cfg.edAccent || '#e8552a';
  const total = items.length;

  // The cascade: the active plate plus the next few, fanned out.
  const cascade = Array.from({ length: Math.min(4, total) })
    .map((_, k) => ({ it: items[(index + k) % total], i: (index + k) % total, k }));

  return (
    <div className="fixed inset-0 z-[85] overflow-y-auto hide-scrollbar"
         style={{ background: ink, animation: 'backdropIn 320ms ease-out both' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      {/* drafting grid + frame */}
      {ascii?.enabled
        ? <AsciiTexture seed={61} ramp={ascii.ramp} size={ascii.size} speed={ascii.speed} animate={ascii.animate}
                        color={ascii.inkOnDark} opacity={ascii.opacityDark} className="fixed" mask={ascii.mask} clear={ascii.clear} />
        : <div className="fixed inset-0 ed-grid pointer-events-none" style={{ color: paper }} />}
      <div className="fixed inset-3 md:inset-6 border pointer-events-none" style={{ borderColor: `${paper}1f` }} />

      <div className="relative min-h-full px-5 md:px-12 py-6 md:py-10 flex flex-col">

        {/* ---------- HEADER ---------- */}
        <div className="flex items-start justify-between gap-6 shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.32em] mb-1" style={{ color: `${paper}66` }}>
              {cfg.edKicker}
            </p>
            <p className="font-serif text-lg md:text-2xl leading-none" style={{ color: paper }}>
              {cfg.edMasthead}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden md:block font-mono text-[9px] uppercase tracking-[0.28em]" style={{ color: `${paper}55` }}>
              {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            <button onClick={onClose} aria-label="Close" className="ed-arrow w-10 h-10 slide-press"
                    style={{ color: paper }}><X size={16} /></button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-6 items-center flex-1 py-8 md:py-12">

          {/* ---------- MEDALLION ---------- */}
          <div className="relative flex items-center justify-center anim-rise">
            {/* the ring */}
            <span aria-hidden="true"
                  className="absolute rounded-full pointer-events-none hidden sm:block"
                  style={{
                    width: 'min(74vw, 460px)', height: 'min(74vw, 460px)',
                    border: `1px solid ${paper}30`,
                    animation: 'edRingIn 900ms var(--ease-out-expo) both'
                  }} />
            <span aria-hidden="true"
                  className="absolute rounded-full pointer-events-none hidden sm:block"
                  style={{
                    width: 'min(84vw, 540px)', height: 'min(84vw, 540px)',
                    border: `1px solid ${paper}14`,
                    animation: 'edRingIn 1100ms var(--ease-out-expo) 120ms both'
                  }} />

            <div className="relative max-w-[360px] text-center sm:text-left px-2">
              <h2 className="font-serif uppercase leading-[1.06] text-2xl md:text-[2.1rem] tracking-tight mb-2"
                  style={{ color: paper, animation: 'edFadeUp 700ms var(--ease-out-expo) 160ms both' }}>
                {item.title || cfg.edFallbackTitle}
              </h2>
              <p className="font-serif italic text-sm mb-5" style={{ color: `${paper}80`, animation: 'edFadeUp 700ms var(--ease-out-expo) 240ms both' }}>
                {item.date ? `By — ${cfg.edByline}, ${item.date}` : `By — ${cfg.edByline}`}
              </p>

              {/* drop cap standfirst */}
              {(item.caption || cfg.edStandfirst) && (
                <p className="user-copy font-serif text-[12.5px] leading-[1.75] ed-dropcap text-left"
                   style={{ color: `${paper}b0`, animation: 'edFadeUp 700ms var(--ease-out-expo) 320ms both' }}>
                  {item.caption || cfg.edStandfirst}
                </p>
              )}

              <button onClick={onNext} aria-label="Next plate"
                      className="ed-arrow w-12 h-12 mt-6 slide-press"
                      style={{ color: paper, animation: 'edFadeUp 700ms var(--ease-out-expo) 400ms both' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* ---------- CASCADE ---------- */}
          <div className="relative min-h-[340px] md:min-h-[420px]">
            <div className="mb-4 max-w-[280px]">
              <EdLabel color={`${paper}70`} right={cfg.edSectionYears}>{cfg.edSectionLabel}</EdLabel>
            </div>

            <div className="relative flex items-start">
              {cascade.map(({ it, i, k }) => (
                <button
                  key={`${it.id}-${k}`}
                  onClick={() => (k === 0 ? null : onJump(i))}
                  className="group relative shrink-0 text-left transition-transform duration-500"
                  style={{
                    marginLeft: k === 0 ? 0 : -34,
                    zIndex: 10 - k,
                    transform: `translateY(${k * 16}px) rotate(${(k % 2 ? 1 : -1) * k * 0.7}deg)`,
                    animation: `edCardIn 760ms var(--ease-out-expo) ${180 + k * 110}ms both`,
                    cursor: k === 0 ? 'default' : 'pointer',
                    opacity: k === 0 ? 1 : 0.82
                  }}>
                  <div className="relative overflow-hidden"
                       style={{ width: k === 0 ? 168 : 140, background: paper, padding: 7, boxShadow: `0 18px 40px ${ink}cc` }}>
                    <img loading="lazy" decoding="async" src={it.image} alt=""
                         className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                         style={{ height: k === 0 ? 190 : 158, filter: 'grayscale(1) contrast(1.05)' }} />
                  </div>
                  {/* caption slip */}
                  <div className="relative -mt-1 ed-notch px-2.5 py-2 max-w-[168px]"
                       style={{ background: paper, color: ink }}>
                    <p className="font-serif text-[10px] leading-tight break-words">{it.title || cfg.edFallbackTitle}</p>
                    <p className="font-mono text-[7px] uppercase tracking-[0.2em] mt-1 opacity-60">{it.date || '—'}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* secondary section marker, as on the reference spread */}
            <div className="mt-10 flex items-center gap-4 max-w-[320px]">
              <div className="min-w-0 flex-1">
                <EdLabel color={`${paper}55`}>{cfg.edSectionLabel2}</EdLabel>
              </div>
              <button onClick={onPrev} aria-label="Previous plate" className="ed-arrow w-9 h-9 shrink-0 slide-press" style={{ color: `${paper}99` }}>
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* ---------- FOOTER ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-4 shrink-0 pt-4"
             style={{ borderTop: `1px solid ${paper}1a` }}>
          <div className="flex flex-wrap gap-4 font-mono text-[9px] uppercase tracking-[0.22em]" style={{ color: `${paper}55` }}>
            {(cfg.edFooterLinks || '').split(',').map((l, i) => l.trim() && (
              <span key={i} className="hover:opacity-100 transition-opacity">{l.trim()}</span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {items.map((_, i) => (
              <button key={i} onClick={() => onJump(i)} aria-label={`Plate ${i + 1}`}
                      className="transition-all duration-300"
                      style={{
                        width: i === index ? 18 : 5, height: 5,
                        background: i === index ? accent : `${paper}33`
                      }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   useInView
   Every ambient animation below is suspended while its box is
   scrolled out of view, so three decorative pieces on one page
   cost nothing when you aren't looking at them.
   ============================================================ */
const useInView = (ref, rootMargin = '200px') => {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return seen;
};

/* ============================================================
   TEXT ORBIT
   A word repeated at many depths, circling a figure. Each word is
   an arm rotating about the centre with a counter-rotating label
   so the type stays upright — pure CSS transforms, no JS per
   frame, and the whole field freezes when off-screen.
   ============================================================ */
// A human silhouette drawn as one closed path in a shifted-weight stance
// (hip out, opposite knee soft, one arm swung clear of the body). Blurred it
// reads as a photographed figure rather than a drawing, and it ships as ~1KB
// of path data instead of an image.
const FIGURE_PATH = "M212 18 C248 18 264 46 260 86 C258 106 252 120 244 130 C242 138 241 144 240 150 C276 157 306 174 318 200 C332 228 344 268 350 310 C356 350 356 392 352 424 C350 442 345 456 337 464 C329 457 325 444 324 427 C321 392 318 352 312 314 C305 276 296 242 286 216 C280 246 276 294 274 334 C272 362 279 392 284 422 C290 470 285 530 278 580 C272 640 267 702 265 762 C264 800 267 840 271 864 C273 876 261 883 242 881 C228 879 223 869 223 852 C225 802 228 744 226 702 C224 652 219 602 215 560 L204 560 C199 602 193 652 189 702 C186 748 187 802 188 852 C188 870 181 880 166 882 C147 884 138 876 141 864 C147 839 151 799 150 761 C148 701 141 640 137 580 C131 530 127 470 133 422 C138 392 143 362 141 334 C139 294 136 246 131 216 C124 242 118 274 115 310 C113 348 115 388 111 420 C109 436 105 448 98 456 C91 448 87 436 85 418 C80 386 78 346 80 308 C82 266 90 224 102 198 C114 174 146 157 182 150 C181 144 180 138 178 130 C170 120 164 106 162 86 C158 46 176 18 212 18 Z";

const TextOrbit = ({ cfg }) => {
  const hostRef = useRef(null);
  const live = useInView(hostRef);
  const word = cfg.word || 'POISK';
  const count = Math.max(8, Math.min(320, Number(cfg.count) || 170));
  // Only a slice of the field actually orbits; the rest is static type, which
  // costs a single paint. That is how the field gets this dense and still
  // idles at zero CPU.
  // Density is free (static type), motion is not — so the animated subset is
  // capped at 160 regardless of how high the copy count is pushed.
  const moving = Math.max(0, Math.min(count, 160, Number(cfg.moving) ?? 80));
  const speed = Math.max(0.1, Number(cfg.speed) || 1);

  const motes = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    i,
    orbits: i < moving,
    r: 8 + seededRand(i, 41) * 46,
    x: seededRand(i, 61) * 100,
    y: seededRand(i, 62) * 100,
    size: 7 + Math.pow(seededRand(i, 42), 1.7) * 21,
    dur: (30 + seededRand(i, 43) * 60) / speed,
    start: seededRand(i, 44) * 360,
    rev: seededRand(i, 45) > 0.55,
    opacity: 0.1 + Math.pow(seededRand(i, 46), 1.3) * 0.9,
    blur: seededRand(i, 47) > 0.66 ? (0.5 + seededRand(i, 48) * 2.4) : 0,
    bold: seededRand(i, 49) > 0.62,
    squash: 0.8 + seededRand(i, 50) * 0.36
  })), [count, moving, speed]);

  const wordStyle = (m) => ({
    fontSize: m.size + 'px',
    fontWeight: m.bold ? 700 : 400,
    color: cfg.wordColor || '#111111',
    opacity: m.opacity,
    filter: m.blur ? 'blur(' + m.blur + 'px)' : 'none',
    letterSpacing: '0.06em'
  });

  return (
    <div ref={hostRef}
         className={'relative w-full overflow-hidden select-none ' + (live ? 'orbit-live' : '')}
         style={{
           aspectRatio: cfg.ratio || '4 / 5',
           maxHeight: 640,
           background: 'linear-gradient(160deg, ' + (cfg.bgTop || '#ededed') + ' 0%, ' + (cfg.bgBottom || '#b4b4b4') + ' 100%)'
         }}>

      {/* ---- THE FIGURE ---- */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
        {cfg.image ? (
          <img loading="lazy" decoding="async" src={cfg.image} alt=""
               className="h-[88%] w-auto object-contain"
               style={{ filter: 'grayscale(1) contrast(1.1) blur(' + (cfg.figureBlur ?? 12) + 'px)', opacity: cfg.figureOpacity ?? 0.95 }} />
        ) : (
          <svg viewBox="0 0 440 910" preserveAspectRatio="xMidYMax meet" className="h-[92%] w-auto"
               style={{ filter: 'blur(' + (cfg.figureBlur ?? 12) + 'px)', opacity: cfg.figureOpacity ?? 0.94 }}>
            <g transform="rotate(-2.5 220 455)">
              <path d={FIGURE_PATH} fill={cfg.figureColor || '#0d0d0d'} />
            </g>
          </svg>
        )}
      </div>

      {/* ---- STATIC FIELD (the bulk of the density) ---- */}
      <div className="absolute inset-0">
        {motes.filter(m => !m.orbits).map(m => (
          <span key={m.i} className="absolute font-mono whitespace-nowrap"
                style={{ left: m.x + '%', top: m.y + '%', transform: 'translate(-50%,-50%)', ...wordStyle(m) }}>
            {word}
          </span>
        ))}
      </div>

      {/* ---- ORBITING TYPE ---- */}
      <div className="absolute inset-0">
        {motes.filter(m => m.orbits).map(m => (
          <div key={m.i} className="orbit-arm absolute left-1/2 top-1/2"
               style={{ '--dur': m.dur + 's', '--start': m.start + 'deg', animationDirection: m.rev ? 'reverse' : 'normal', transform: 'scaleY(' + m.squash + ')' }}>
            <div style={{ transform: 'translateX(' + m.r + 'vmin)' }}>
              <span className="orbit-word block font-mono whitespace-nowrap"
                    style={{ '--dur': m.dur + 's', animationDirection: m.rev ? 'reverse' : 'normal', ...wordStyle(m) }}>
                {word}
              </span>
            </div>
          </div>
        ))}
      </div>

      {cfg.caption && (
        <p className="absolute bottom-4 left-5 font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: cfg.wordColor || '#111' }}>{cfg.caption}</p>
      )}
    </div>
  );
};

/* ============================================================
   TEXT DISC
   A pressed disc with the credits set around concentric rings.
   Rings are split across three stacked <svg> layers so the spin
   is three composited element transforms instead of one transform
   per ring — the difference between smooth and stuttering once
   there is real text on the paths.
   ============================================================ */
const TextDisc = ({ cfg }) => {
  const hostRef = useRef(null);
  const live = useInView(hostRef);
  const S = 600, C = S / 2;
  const ringCount = Math.max(3, Math.min(16, Number(cfg.rings) || 11));
  const speed = Math.max(0.1, Number(cfg.speed) || 1);
  const words = (cfg.text || '').trim();

  // Chop the text into per-ring runs, longest ring first (outermost
  // circumference holds the most characters).
  const rings = useMemo(() => {
    const outer = Number(cfg.outerRadius) || 268;
    const inner = Number(cfg.innerRadius) || 88;
    const step = (outer - inner) / Math.max(1, ringCount - 1);
    const radii = Array.from({ length: ringCount }, (_, i) => outer - i * step);
    const totalChars = radii.reduce((sum, r) => sum + Math.floor((2 * Math.PI * r) / ((Number(cfg.fontSize) || 11) * 0.58)), 0);
    const src = words.length ? words.repeat(Math.max(1, Math.ceil(totalChars / words.length))) : '';
    let cursor = 0;
    return radii.map((r, i) => {
      const cap = Math.floor((2 * Math.PI * r) / ((Number(cfg.fontSize) || 11) * 0.58));
      const slice = src.slice(cursor, cursor + cap);
      cursor += cap;
      return { i, r, text: slice, layer: i % 3 };
    });
  }, [words, ringCount, cfg.outerRadius, cfg.innerRadius, cfg.fontSize]);

  const arc = (r) => `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - 0.01} ${C - r} A ${r} ${r} 0 1 1 ${C} ${C - r}`;

  return (
    <div ref={hostRef} className="relative w-full flex items-center justify-center overflow-hidden"
         style={{ background: cfg.bg || '#050505', aspectRatio: '1 / 1', maxHeight: 620 }}>
      <div className="relative w-full h-full max-w-[620px] max-h-[620px]">

        {/* disc body */}
        <div className="absolute rounded-full"
             style={{
               inset: '6%',
               background: `radial-gradient(circle at 38% 30%, ${cfg.disc || '#141414'}, #050505 78%)`,
               boxShadow: `inset 0 0 60px rgba(0,0,0,0.9), 0 0 0 1px ${cfg.ink || '#ffffff'}14`
             }} />

        {/* three counter-rotating layers */}
        {[0, 1, 2].map(layer => (
          <svg key={layer} viewBox={`0 0 ${S} ${S}`}
               className={`absolute inset-0 w-full h-full ${live ? 'disc-layer' : ''}`}
               style={{
                 '--dur': `${(46 + layer * 26) / speed}s`,
                 animationDirection: layer === 1 ? 'reverse' : 'normal'
               }}>
            <defs>
              {rings.filter(r => r.layer === layer).map(r => (
                <path key={r.i} id={`tdisc-${cfg.uid || 'a'}-${r.i}`} d={arc(r.r)} fill="none" />
              ))}
            </defs>
            {rings.filter(r => r.layer === layer).map(r => (
              <text key={r.i} fill={cfg.ink || '#ffffff'}
                    fontSize={Number(cfg.fontSize) || 11}
                    fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    letterSpacing="0.5">
                <textPath href={`#tdisc-${cfg.uid || 'a'}-${r.i}`} startOffset="0%">{r.text}</textPath>
              </text>
            ))}
          </svg>
        ))}

        {/* centre hole */}
        <div className="absolute rounded-full"
             style={{
               inset: '43.5%',
               background: cfg.bg || '#050505',
               boxShadow: `0 0 0 1px ${cfg.ink || '#ffffff'}22, inset 0 0 0 10px ${cfg.disc || '#141414'}`
             }} />
        <div className="absolute rounded-full" style={{ inset: '47.5%', background: cfg.bg || '#050505', boxShadow: `0 0 0 1px ${cfg.ink || '#ffffff'}33` }} />

        {cfg.mark && (
          <span className="absolute bottom-[14%] right-[16%] font-serif italic text-lg" style={{ color: cfg.ink || '#fff' }}>{cfg.mark}</span>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   FILE CABINET
   Files stand vertically in the drawer. Pull one and it lifts out
   into a layered spread — folder page, excerpt card, receipt slip.
   Only the opened file mounts its documents, so a drawer of thirty
   costs the same as a drawer of three.
   ============================================================ */
const FileCabinet = ({ cfg, files, openId, onOpen, ascii }) => {
  const active = files.find(f => f.id === openId) || null;
  const ink = cfg.ink || '#f2f2f2';
  const drawer = cfg.drawer || '#1f42e0';
  // Each paper surface gets its own generated character field, seeded off the
  // file so two documents never share a pattern.
  const Tex = ({ s: seed, tone = 'light' }) => (ascii?.enabled ? (
    <AsciiTexture seed={seed} ramp={ascii.ramp} size={ascii.size} speed={ascii.speed} animate={ascii.animate}
                  mask={ascii.mask} clear={ascii.clear}
                  color={tone === 'dark' ? ascii.inkOnDark : ascii.inkOnLight}
                  opacity={tone === 'dark' ? ascii.opacityDark : ascii.opacityLight} />
  ) : null);

  return (
    <div className="relative w-full overflow-hidden" style={{ background: cfg.shell || '#0b0b0b' }}>
      <Tex s={3} tone="dark" />

      {/* ---- HEADER ---- */}
      <div className="px-5 md:px-10 pt-8 pb-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-3" style={{ color: ink + '66' }}>{cfg.breadcrumb}</p>
            <h3 className="font-serif leading-[0.95] text-4xl md:text-6xl break-words" style={{ color: ink }}>
              {active ? active.title : cfg.title}
            </h3>
          </div>
          <div className="font-mono text-[9px] leading-relaxed tracking-[0.1em] max-w-[220px] shrink-0" style={{ color: ink + '77' }}>
            <p className="whitespace-pre-line break-words">{active ? (active.note || cfg.note) : cfg.note}</p>
            <p className="mt-3">{active ? active.date : cfg.date}</p>
          </div>
        </div>
      </div>

      {/* ---- DRAWER ---- */}
      <div className="relative px-4 md:px-8 py-8" style={{ background: drawer }}>

        {/*
          Layout note: this used to position the excerpt and receipt
          absolutely over the page, which covered body text the moment an
          entry ran long. Everything below is in normal flow — a grid with
          the page in one column and the loose material in the other — so no
          amount of admin-entered text can collide. The only overlap left is
          a deliberate 14px tuck into the page's own padding, which contains
          no text at any breakpoint.
        */}
        <div className="grid lg:grid-cols-[auto_minmax(0,1fr)] gap-5 lg:gap-6 items-start">

          {/* ---- SPINE RAIL ---- */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[560px] hide-scrollbar pb-1 lg:pb-0 shrink-0">
            {files.map((f, i) => {
              const open = f.id === openId;
              return (
                <button key={f.id} onClick={() => onOpen(open ? null : f.id)} title={f.title}
                        className="cab-spine relative shrink-0 flex items-center justify-center"
                        style={{
                          background: f.tabColor || '#c8281e',
                          width: 42, height: 168,
                          '--d': i,
                          // Always readable against the drawer, whatever colour
                          // the spine is set to in the admin panel.
                          outline: open ? '2px solid ' + ink : '1px solid rgba(0,0,0,0.35)',
                          outlineOffset: open ? '2px' : '0',
                          boxShadow: open
                            ? '0 12px 26px rgba(0,0,0,0.45)'
                            : '0 4px 12px rgba(0,0,0,0.3)',
                          transform: 'translateY(' + (open ? -10 : 0) + 'px)'
                        }}>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] whitespace-nowrap overflow-hidden"
                        style={{ writingMode: 'vertical-rl', color: f.tabInk || '#fff', maxHeight: 148 }}>
                    {f.tab || f.title}
                  </span>
                </button>
              );
            })}
            {files.length === 0 && (
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] py-6" style={{ color: ink + '99' }}>Drawer empty</p>
            )}
          </div>

          {/* ---- THE PULLED FILE ---- */}
          <div className="min-w-0">
            {!active ? (
              <div className="min-h-[220px] md:min-h-[320px] flex items-center justify-center"
                   style={{ border: '1px dashed ' + ink + '44' }}>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-center px-4" style={{ color: ink + '99' }}>{cfg.emptyHint}</p>
              </div>
            ) : (
              <div key={active.id} className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-0 items-start">

                {/* folder page — text column, never overlapped */}
                <div className="cab-page relative z-10 overflow-hidden p-5 md:p-8 pl-10 md:pl-14 lg:pr-12"
                     style={{ background: cfg.paper || '#f4f1e6', animation: 'cabPage 620ms var(--ease-out-expo) both' }}>
                  <Tex s={active.id} />
                  {[18, 46, 74].map(t => (
                    <span key={t} className="absolute left-4 md:left-6 w-2.5 h-2.5 rounded-full" style={{ top: t + '%', background: drawer }} />
                  ))}

                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h4 className="font-serif italic text-2xl md:text-4xl min-w-0 break-words" style={{ color: '#141414' }}>{active.headline}</h4>
                    <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-2 py-1 shrink-0 whitespace-nowrap"
                          style={{ border: '1px solid #3a3ad0', color: '#3a3ad0' }}>{active.fileNo}</span>
                  </div>

                  {active.margin && (
                    <p className="font-mono text-[7.5px] leading-relaxed uppercase tracking-[0.08em] mb-4 max-w-[240px] p-2 break-words"
                       style={{ border: '1px solid #1414141f', color: '#141414aa' }}>{active.margin}</p>
                  )}

                  <p className="user-copy font-serif text-[12px] md:text-[13.5px] leading-[1.7]" style={{ color: '#1a1a1a' }}>{active.body}</p>
                </div>

                {/* loose material — own column, tucked 14px under the page edge */}
                <div className="relative z-20 flex flex-col gap-4 mt-4 lg:mt-10 lg:-ml-3.5">
                  {active.excerptBody && (
                    <div className="cab-card relative overflow-hidden p-4 md:p-5"
                         style={{ background: active.excerptColor || '#f0a8b0', animation: 'cabCard 700ms var(--ease-out-expo) 140ms both', boxShadow: '0 10px 26px rgba(0,0,0,0.28)' }}>
                      <Tex s={active.id + 7} />
                      <h5 className="font-serif italic text-xl md:text-2xl mb-2 break-words" style={{ color: '#141414' }}>{active.excerptTitle}</h5>
                      <p className="user-copy font-serif text-[11px] leading-[1.65]" style={{ color: '#1a1a1a' }}>{active.excerptBody}</p>
                    </div>
                  )}

                  {active.receipt && (
                    <div className="cab-slip relative overflow-hidden p-3 md:p-4 self-start w-full max-w-[280px]"
                         style={{
                           background: active.receiptColor || '#f2d64b',
                           animation: 'cabSlip 760ms var(--ease-out-expo) 260ms both',
                           clipPath: 'polygon(0 2%, 100% 0, 99% 97%, 62% 100%, 30% 96%, 0 100%)',
                           boxShadow: '0 10px 24px rgba(0,0,0,0.3)'
                         }}>
                      <Tex s={active.id + 13} />
                      <p className="relative user-copy font-mono text-[8px] leading-[1.8] uppercase tracking-[0.06em] break-words" style={{ color: '#3a2f10' }}>{active.receipt}</p>
                      <div className="mt-2 pt-1 font-serif italic text-[11px] break-words" style={{ borderTop: '1px solid #3a2f1055', color: '#3a2f10' }}>{active.signature}</div>
                    </div>
                  )}

                  {(active.sideTabs || []).length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {active.sideTabs.map((t, i) => (
                        <span key={i} className="cab-tab px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] break-words"
                              style={{ background: t.color || '#c8281e', color: '#fff', border: '1px solid rgba(0,0,0,0.3)', animation: 'cabTab 560ms var(--ease-out-expo) ' + (300 + i * 90) + 'ms both' }}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 md:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="font-mono text-[8px] uppercase tracking-[0.28em]" style={{ color: ink + '55' }}>{cfg.footer}</p>
        {active && (
          <button onClick={() => onOpen(null)} className="font-mono text-[9px] uppercase tracking-[0.2em] px-3 py-1.5 slide-press"
                  style={{ color: ink, border: '1px solid ' + ink + '33' }}>File it back</button>
        )}
      </div>
    </div>
  );
};

const PoemDeck = ({ deck, poems, onOpen }) => {
  const fg = deck.fg || '#e8e8e8';
  const lineCol = deck.line || '#6b6b6b';
  const hi = deck.highlight || '#ffffff';
  const hiInk = deck.highlightInk || '#0a0a0a';
  const slotCount = Math.max(1, Math.min(30, Number(deck.slotCount) || 14));
  // Every duration below is derived from the seeded generator and divided
  // by this, so one control speeds up or slows the whole rack.
  const spd = Math.max(0.1, Number(deck.motionSpeed) || 1);
  const moving = deck.motion !== false;

  // Slot chips: deterministic scatter down the left third, each with its
  // own drift vector, blink rate and phase so nothing beats in unison.
  const slots = useMemo(() => Array.from({ length: slotCount }).map((_, i) => ({
    id: i,
    label: `${deck.slotPrefix || 'SLOT_'}${String(i + 1).padStart(2, '0')}`,
    x: 2 + seededRand(i, 1) * 26,
    y: 14 + (i / slotCount) * 68 + (seededRand(i, 2) - 0.5) * 7,
    dx: (seededRand(i, 11) - 0.5) * 7,          // px of lateral drift
    dy: (seededRand(i, 12) - 0.5) * 6,
    drift: (5200 + seededRand(i, 13) * 5200) / spd,
    driftDelay: seededRand(i, 14) * -6000,
    blink: (1400 + seededRand(i, 15) * 2600) / spd,
    blinkDelay: seededRand(i, 16) * -3000
  })), [slotCount, deck.slotPrefix, spd]);

  // Waveform bars carry two seeded heights and animate between them, so
  // each meter reads as live signal rather than a frozen screenshot.
  const waves = useMemo(() => Array.from({ length: Math.max(1, Number(deck.waveRows) || 4) }).map((_, r) =>
    Array.from({ length: 70 }).map((_, c) => {
      const k = r * 100 + c;
      const a = 0.12 + seededRand(k, 3) * 0.88;
      const b = 0.12 + seededRand(k, 4) * 0.88;
      return {
        s0: a, s1: b,
        dur: (420 + seededRand(k, 5) * 900) / spd,
        delay: seededRand(k, 6) * -1600
      };
    })
  ), [deck.waveRows, spd]);

  const rowY = (i) => (poems.length ? (100 / poems.length) * (i + 0.5) : 50);

  return (
    <div className={`w-full relative overflow-hidden border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise ${moving ? 'deck-motion' : ''}`}
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
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] px-3 py-1 flex items-center gap-2" style={{ border: `1px solid ${lineCol}`, color: lineCol }}>
            <span className="deck-led w-1.5 h-1.5 rounded-full" style={{ background: fg, '--ld': '1900ms', '--ldl': '0ms' }} />
            {poems.length} verses
          </span>
        </div>

        <div className="relative min-h-[200px] md:min-h-[560px]">

          {/* ---------- SCAN SWEEP ---------- */}
          {deck.scanline && (
            <div className="deck-scan absolute inset-x-0 h-24 pointer-events-none hidden md:block"
                 style={{ '--scd': `${9000 / spd}ms`, background: `linear-gradient(to bottom, transparent, ${fg}12, transparent)` }} />
          )}

          {/* ---------- CABLE LAYER ---------- */}
          {deck.showCables && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {poems.map((p, i) => {
                const s = slots[i % slots.length];
                const s2 = slots[(i * 3 + 5) % slots.length];
                const ty = rowY(i);
                const path = `${s.x + 9},${s.y} ${34 + (i % 4) * 2},${s.y} ${41},${ty} ${44},${ty}`;
                const path2 = `${s2.x + 9},${s2.y} ${30},${(s2.y + ty) / 2} ${44},${ty}`;
                return (
                  <g key={p.id}>
                    <polyline points={path} fill="none" stroke={lineCol} strokeWidth="0.18" vectorEffect="non-scaling-stroke"
                              className={deck.animate ? 'deck-cable' : ''} style={{ animationDelay: `${i * 60}ms` }} />
                    {/* signal pulse riding the cable toward the index */}
                    {deck.pulses && (
                      <polyline points={path} fill="none" stroke={fg} strokeWidth="0.5" vectorEffect="non-scaling-stroke"
                                className="deck-pulse" style={{ '--pd': `${(2600 + seededRand(i, 21) * 3200) / spd}ms`, animationDelay: `${seededRand(i, 22) * -4000}ms` }} />
                    )}
                    {i % 3 === 0 && (
                      <polyline points={path2} fill="none" stroke={lineCol} strokeWidth="0.12" opacity="0.55" vectorEffect="non-scaling-stroke"
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
              <div key={s.id} className="deck-slot absolute flex items-center gap-1.5 anim-fade stagger-child"
                   style={{
                     left: `${s.x}%`, top: `${s.y}%`, '--d': i,
                     '--dx': `${s.dx}px`, '--dy': `${s.dy}px`,
                     '--sd': `${s.drift}ms`, '--sdl': `${s.driftDelay}ms`,
                     transform: 'translateY(-50%)'
                   }}>
                <span className="flex items-center gap-1 px-1 py-[3px]" style={{ border: `1px solid ${lineCol}` }}>
                  <span className={`block w-3 h-[7px] ${deck.slotBlink ? 'deck-led' : ''}`}
                        style={{ background: fg, '--ld': `${s.blink}ms`, '--ldl': `${s.blinkDelay}ms` }} />
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
                      {row.map((b, c) => (
                        <span key={c}
                              className={`flex-1 h-full ${deck.liveWave ? 'deck-bar' : ''}`}
                              style={{
                                background: fg, opacity: 0.85, transformOrigin: 'bottom',
                                transform: `scaleY(${b.s0})`,
                                '--s0': b.s0, '--s1': b.s1,
                                '--bd': `${b.dur}ms`, '--bdl': `${b.delay}ms`
                              }} />
                      ))}
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
            {/* needle sweeping the averaging window */}
            <div className="relative h-6 mt-2 overflow-hidden" style={{ borderTop: `1px solid ${lineCol}55`, borderBottom: `1px solid ${lineCol}55` }}>
              <span className="deck-needle absolute top-0 bottom-0 w-[1px]" style={{ background: fg, '--nd': `${7000 / spd}ms` }} />
            </div>
            <p className="font-mono text-[7px] tracking-[0.2em] mt-2" style={{ color: lineCol }}>{deck.totalLabel}</p>
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
                {/* playhead: the dots light in sequence down the index */}
                <span className="hidden md:block deck-tick w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: fg, '--td': `${(poems.length * 620) / spd}ms`, '--tdl': `${(i * 620) / spd}ms` }} />
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
            <span className="deck-led w-3 h-3 rounded-full" style={{ background: fg, '--ld': `${2400 / spd}ms`, '--ldl': '0ms' }} />
            <span className="deck-led w-2 h-2" style={{ background: fg, '--ld': `${3100 / spd}ms`, '--ldl': '-800ms' }} />
            <span className="deck-led w-2 h-2" style={{ background: fg, '--ld': `${1700 / spd}ms`, '--ldl': '-1500ms' }} />
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
   ASCII TEXTURE
   A generated character field used as the surface of modals and
   of the documents inside the folder.

   Cheap by construction: the whole field is ONE text node written
   straight to the DOM. No element per character, no React re-render
   per frame — animating it is a single textContent assignment a few
   times a second. A 110x64 field is 7,040 glyphs for the cost of
   one <pre>.
   ============================================================ */
const AsciiTexture = ({
  seed = 1, ramp, size = 11, color = '#111111', opacity = 0.08,
  animate = false, speed = 1, className = '',
  mask = 'edges', clear = 45
}) => {
  const ref = useRef(null);
  // The grid is derived from the element's real size rather than fixed, so
  // the field always fills its container. A fixed cols/rows produced a
  // character block of one size that sat in the top-left corner of anything
  // larger than it.
  const [grid, setGrid] = useState({ cols: 80, rows: 40, px: size });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const MAX_CELLS = 26000;   // ceiling: a 4K panel would otherwise ask for ~100k

    // Measure the font's real advance width rather than assuming one.
    // Assuming 0.6em when the rendered face is nearer 0.55 under-generates
    // the grid and leaves a bare strip down the right-hand side.
    const advanceRatio = (px) => {
      try {
        const probe = document.createElement('span');
        probe.textContent = 'M'.repeat(100);
        probe.style.cssText =
          `position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;` +
          `font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
          `font-size:${px}px;letter-spacing:0;line-height:1;`;
        document.body.appendChild(probe);
        const wCh = probe.getBoundingClientRect().width / 100;
        probe.remove();
        // Guard against a zero/absurd reading (headless, font not ready).
        if (wCh > px * 0.3 && wCh < px * 1.2) return wCh / px;
      } catch (_) {}
      return 0.6;
    };

    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width || el.offsetWidth || window.innerWidth);
      const h = Math.max(1, r.height || el.offsetHeight || window.innerHeight);

      let px = Math.max(4, Number(size) || 11);
      const CH_RATIO = advanceRatio(px);
      // +2 columns and +1 row of slack: overflow is clipped anyway, and a
      // slight overshoot is invisible where a shortfall is not.
      let cols = Math.ceil(w / (px * CH_RATIO)) + 2;
      let rows = Math.ceil(h / px) + 1;

      // Too many cells for one text node — grow the glyphs instead of
      // cropping, so coverage stays complete either way. Loops because the
      // ceil()+1 on each axis can nudge the result back over the cap.
      let guard = 0;
      while (cols * rows > MAX_CELLS && guard++ < 6) {
        px = px * Math.sqrt((cols * rows) / MAX_CELLS) * 1.02;
        cols = Math.ceil(w / (px * advanceRatio(px))) + 2;
        rows = Math.ceil(h / px) + 1;
      }
      setGrid(g => (g.cols === cols && g.rows === rows && g.px === px) ? g : { cols, rows, px });
    };

    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [size]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { cols, rows } = grid;
    const chars = (ramp && ramp.length ? ramp : ' .:-=+*#%@');
    const last = chars.length - 1;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const build = (t) => {
      let out = '';
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          // x is scaled by the glyph aspect so the noise reads as round
          // rather than stretched horizontally.
          const v = _fbm(i * 0.055 * 0.58, j * 0.055, t, 2, seed);
          out += chars[Math.min(last, Math.max(0, Math.floor(v * chars.length)))];
        }
        out += '\n';
      }
      el.textContent = out;
    };

    build(0);
    if (!animate || reduced) return;

    // Deliberately slow: ASCII reads better stepping than sliding, and
    // 5fps keeps this free even with several panels open at once.
    let raf = 0, last_t = 0, start = performance.now(), stopped = false;
    const loop = (now) => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (now - last_t < 200 / speed) return;
      last_t = now;
      build(((now - start) / 1000) * 0.09 * speed);
    };
    raf = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [seed, ramp, animate, speed, grid]);

  /* LEGIBILITY MASK
     A character field behind body copy is the fastest way to make text
     unreadable, so by default the texture is masked out of the middle of
     the panel — where the words are — and only survives around the
     perimeter. clear is the percentage of the centre kept completely
     free of glyphs. Set mask='full' to texture edge to edge. */
  const maskImage = useMemo(() => {
    if (mask === 'full') return undefined;
    const c = Math.max(0, Math.min(90, Number(clear) || 0));
    if (mask === 'top') {
      return `linear-gradient(to bottom, #000 0%, transparent ${c}%, transparent 100%)`;
    }
    return `radial-gradient(125% 105% at 50% 50%, transparent 0%, transparent ${c}%, #000 100%)`;
  }, [mask, clear]);

  return (
    <pre ref={ref} aria-hidden="true"
         className={`absolute inset-0 pointer-events-none select-none overflow-hidden m-0 ${className}`}
         style={{
           fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
           fontSize: `${grid.px}px`,
           lineHeight: 1,
           letterSpacing: 0,
           color,
           opacity,
           whiteSpace: 'pre',
           userSelect: 'none',
           maskImage,
           WebkitMaskImage: maskImage
         }} />
  );
};

// Convenience wrapper: the texture plus whatever sits on top of it.
const AsciiSurface = ({ cfg, seed = 1, tone = 'dark', children, className = '', style = {} }) => (
  <div className={`relative ${className}`} style={style}>
    {cfg?.enabled && (
      <AsciiTexture
        seed={seed}
        ramp={cfg.ramp}
        size={cfg.size}
        speed={cfg.speed}
        animate={cfg.animate}
        color={tone === 'dark' ? (cfg.inkOnDark || '#ffffff') : (cfg.inkOnLight || '#111111')}
        opacity={tone === 'dark' ? (cfg.opacityDark ?? 0.06) : (cfg.opacityLight ?? 0.09)}
      mask={asciiCfg.mask} clear={asciiCfg.clear} />
    )}
    <div className="relative">{children}</div>
  </div>
);

/* ============================================================
   NOTION-STYLE INLINE PARSER
   Sticky notes accept the block syntax people already know from
   Notion. Parsed once per note into React elements — no dangerous
   HTML injection anywhere, since every node is constructed rather
   than assigned as innerHTML.
   ============================================================ */
const notionInline = (text, key = 'i') => {
  const out = [];
  // bold, italic, code, strike, link — matched in one pass so nesting
  // can't produce overlapping ranges.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m, n = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${n++}`;
    if (t.startsWith('**') || t.startsWith('__')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k} className="px-1 py-0.5 rounded text-[0.9em]" style={{ background: 'rgba(0,0,0,0.07)', fontFamily: 'ui-monospace, Menlo, monospace' }}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('~~')) out.push(<s key={k}>{t.slice(2, -2)}</s>);
    else if (t.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      const href = mm[2];
      const safe = /^https?:\/\//i.test(href) ? href : '#';
      out.push(<a key={k} href={safe} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{mm[1]}</a>);
    }
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const NotionText = ({ text = '', className = '' }) => {
  const blocks = useMemo(() => {
    const lines = String(text).split('\n');
    const nodes = [];
    let list = null, listType = null;

    const flush = () => {
      if (!list) return;
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      nodes.push(
        <Tag key={`l${nodes.length}`} className={`${listType === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 my-1 space-y-0.5`}>
          {list}
        </Tag>
      );
      list = null; listType = null;
    };

    lines.forEach((raw, i) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) { flush(); return; }

      let m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
        flush();
        const lvl = m[1].length;
        const size = lvl === 1 ? 'text-[15px]' : lvl === 2 ? 'text-[13.5px]' : 'text-[12.5px]';
        nodes.push(<p key={i} className={`font-bold ${size} mt-1.5 mb-0.5 leading-snug`}>{notionInline(m[2], i)}</p>);
      } else if (/^(---|\*\*\*)$/.test(line.trim())) {
        flush();
        nodes.push(<hr key={i} className="my-2 border-0 border-t" style={{ borderColor: 'rgba(0,0,0,0.18)' }} />);
      } else if ((m = /^>\s?(.*)$/.exec(line))) {
        flush();
        nodes.push(<blockquote key={i} className="pl-2.5 my-1 italic" style={{ borderLeft: '2px solid rgba(0,0,0,0.3)' }}>{notionInline(m[1], i)}</blockquote>);
      } else if ((m = /^\[([ xX])\]\s+(.*)$/.exec(line))) {
        flush();
        const done = m[1].toLowerCase() === 'x';
        nodes.push(
          <p key={i} className="flex items-start gap-1.5 my-0.5">
            <span className="mt-[3px] w-3 h-3 shrink-0 flex items-center justify-center text-[8px] rounded-[3px]"
                  style={{ border: '1.5px solid rgba(0,0,0,0.45)', background: done ? 'rgba(0,0,0,0.75)' : 'transparent', color: '#fff' }}>
              {done ? '✓' : ''}
            </span>
            <span className={done ? 'line-through opacity-55' : ''}>{notionInline(m[2], i)}</span>
          </p>
        );
      } else if ((m = /^[-*+]\s+(.*)$/.exec(line))) {
        if (listType !== 'ul') { flush(); listType = 'ul'; list = []; }
        list.push(<li key={i}>{notionInline(m[1], i)}</li>);
      } else if ((m = /^\d+[.)]\s+(.*)$/.exec(line))) {
        if (listType !== 'ol') { flush(); listType = 'ol'; list = []; }
        list.push(<li key={i}>{notionInline(m[1], i)}</li>);
      } else {
        flush();
        nodes.push(<p key={i} className="my-0.5">{notionInline(line, i)}</p>);
      }
    });
    flush();
    return nodes;
  }, [text]);

  return <div className={className}>{blocks}</div>;
};

/* ============================================================
   LANDING PAGE
   The door. Two ways in: the archive proper, or the community
   center. Warm paper panel over black, with the banded stripes
   running out from behind the card.
   ============================================================ */
const LandingPage = ({ cfg, ascii, onEnterSite, onEnterCommunity }) => {
  const stripes = cfg.stripes || ['#d9a441', '#c8742b', '#b8422a', '#8f2320'];

  return (
    <div data-cc-scroll className="fixed inset-0 z-[70] overflow-y-auto hide-scrollbar" style={{ background: cfg.outer || '#0d0b09' }}>

      <div className="relative min-h-full p-3 md:p-5 flex flex-col">
        <div className="relative flex-1 flex flex-col overflow-hidden rounded-2xl"
             style={{ background: cfg.paper || '#efece2', animation: 'landIn 760ms var(--ease-out-expo) both' }}>

          {/* The field belongs to the cream panel and nothing else. It is
              absolutely positioned inside this overflow-hidden box, so it
              cannot bleed onto the frame or over the cards. Full coverage by
              default — the headline sits on its own layer above it. */}
          {ascii?.enabled && cfg.asciiBg !== false && (
            <AsciiTexture seed={137} ramp={ascii.ramp} size={cfg.asciiSize ?? 11} speed={cfg.asciiSpeed ?? 1.6}
                          animate
                          mask={cfg.asciiMask || 'full'} clear={cfg.asciiClear ?? 30}
                          color={cfg.asciiInkLight || ascii.inkOnLight}
                          opacity={cfg.asciiOpacityLight ?? 0.34} />
          )}

          {/* --- top bar --- */}
          <div className="relative z-20 flex items-center px-5 md:px-7 py-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center font-serif text-sm"
                    style={{ background: cfg.markBg || '#161310', color: cfg.markInk || '#efece2' }}>
                {(cfg.wordmark || 'I').charAt(0)}
              </span>
              <span className="font-sans font-bold tracking-tight text-lg min-w-0 break-words" style={{ color: '#161310' }}>
                {cfg.wordmark}
              </span>
            </div>
          </div>

          {/* --- centre --- */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-16 md:py-24">
            <div className="relative max-w-xl w-full flex flex-col items-center">
              {/* A soft clearing under the copy: the field stays edge to edge
                  visually, but fades right where the words are, so strength
                  and legibility stop competing. */}
              {ascii?.enabled && cfg.asciiBg !== false && (
                <span aria-hidden="true" className="absolute pointer-events-none"
                      style={{
                        left: '-16%', right: '-16%', top: '-46%', bottom: '-46%',
                        background: `radial-gradient(56% 50% at 50% 50%, ${cfg.paper || '#efece2'} 0%, ${cfg.paper || '#efece2'}e0 44%, transparent 76%)`
                      }} />
              )}
              <h1 className="relative font-sans font-bold text-3xl md:text-[2.6rem] tracking-tight text-center mb-3 break-words"
                  style={{ color: cfg.titleInk || '#161310', animation: 'landUp 700ms var(--ease-out-expo) 120ms both' }}>
                {cfg.title}
              </h1>
              <p className="relative font-sans text-sm md:text-[15px] text-center max-w-md leading-relaxed break-words"
                 style={{ color: cfg.subtitleInk || '#3a352d', animation: 'landUp 700ms var(--ease-out-expo) 200ms both' }}>
                {cfg.subtitle}
              </p>
            </div>
          </div>

          {/* --- stripe bands + the choice --- */}
          <div className="relative">
            {/* bands run edge to edge, interrupted by the card */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex flex-col pointer-events-none"
                 style={{ animation: 'landBands 900ms var(--ease-out-expo) 260ms both' }}>
              {stripes.map((c, i) => (
                <span key={i} style={{ background: c, height: 'clamp(14px, 2.4vw, 22px)' }} />
              ))}
            </div>

            <div className="relative z-10 flex justify-center px-4 pb-2">
              <div className="w-full max-w-[420px] rounded-[18px] p-1.5 grid sm:grid-cols-2 gap-1.5"
                   style={{ background: cfg.paper || '#efece2', border: `2.5px solid ${cfg.cardBorder || '#161310'}`,
                            animation: 'landCard 780ms var(--ease-out-expo) 340ms both' }}>
                <button onClick={onEnterSite}
                        className="land-choice text-left rounded-[13px] p-3.5 min-w-0"
                        style={{ background: cfg.primaryBg || '#161310', color: cfg.primaryInk || '#efece2' }}>
                  <GitBranch size={17} className="mb-6 opacity-90" />
                  <p className="font-sans font-semibold text-[12.5px] leading-tight break-words">{cfg.primaryTitle}</p>
                  <p className="font-sans text-[10.5px] mt-0.5 opacity-55 leading-snug break-words">{cfg.primarySub}</p>
                </button>

                <button onClick={onEnterCommunity}
                        className="land-choice text-left rounded-[13px] p-3.5 min-w-0"
                        style={{ background: cfg.secondaryBg || '#e4e0d3', color: cfg.secondaryInk || '#161310' }}>
                  <UserPlus size={17} className="mb-6 opacity-70" />
                  <p className="font-sans font-semibold text-[12.5px] leading-tight break-words">{cfg.secondaryTitle}</p>
                  <p className="font-sans text-[10.5px] mt-0.5 opacity-55 leading-snug break-words">{cfg.secondarySub}</p>
                </button>
              </div>
            </div>
          </div>

          {/* --- footnote --- */}
          <div className="relative z-10 flex items-center justify-center gap-1.5 py-4 px-5">
            <span className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center text-[8px]"
                  style={{ border: '1px solid #b5ae9f', color: '#b5ae9f' }}>i</span>
            <p className="font-sans text-[10.5px] text-center break-words" style={{ color: cfg.subtitleInk || '#3a352d', opacity: 0.72 }}>{cfg.footnote}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   COMMUNITY BOARD
   Anyone may pin a note, anonymously. Notes accept Notion block
   syntax and scatter across the board at seeded angles so the
   arrangement looks hand-pinned but stays stable between visits.
   ============================================================ */
const CommunityBoard = ({ cfg, notes, onPost, posting }) => {
  const hostRef = useRef(null);
  const live = useInView(hostRef, '120px');
  const [draft, setDraft] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(0);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);

  const palette = cfg.noteColors || ['#f3ede1', '#e8dcc8', '#dfe6da', '#efdcd5', '#e3e0ea'];
  const max = Math.max(200, Number(cfg.maxLength) || 600);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    onPost({ text: body.slice(0, max), author: name.trim().slice(0, 40), color: palette[color % palette.length] });
    setDraft(''); setName(''); setOpen(false); setPreview(false);
  };

  return (
    <section ref={hostRef} className="relative w-full overflow-hidden"
             style={{ background: cfg.bg || '#d9cfbc', minHeight: '100vh' }}>

      {/* frame */}
      <div className="absolute inset-3 md:inset-6 pointer-events-none" style={{ border: `1px solid ${cfg.ink || '#2b2620'}33` }} />

      <div className="relative px-5 md:px-12 py-14 md:py-20">

        {/* ---- masthead ---- */}
        <div className="flex flex-wrap items-start justify-between gap-6 mb-10">
          <div className={`flex items-start gap-4 min-w-0 ${live ? 'cc-up' : 'opacity-0'}`}>
            <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-serif text-[11px]"
                  style={{ background: cfg.seal || '#b4402f', color: '#fff' }}>{cfg.sealMark || '印'}</span>
            <p className="font-serif text-lg leading-[1.35] shrink-0 hidden md:block"
               style={{ color: cfg.ink || '#2b2620', writingMode: 'vertical-rl' }}>{cfg.verticalTitle}</p>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl md:text-4xl leading-tight tracking-wide break-words" style={{ color: cfg.ink || '#2b2620' }}>
                {cfg.title}
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] mt-2 break-words" style={{ color: `${cfg.ink || '#2b2620'}99` }}>
                {cfg.kicker}
              </p>
            </div>
          </div>

          <div className={`flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.15em] min-w-0 ${live ? 'cc-up' : 'opacity-0'}`}
               style={{ color: `${cfg.ink || '#2b2620'}88`, animationDelay: '80ms' }}>
            {(cfg.navLinks || '').split(',').filter(Boolean).map((l, i) => (
              <span key={i} className="break-words">{l.trim()}/</span>
            ))}
          </div>
        </div>

        {/* ---- intro + pin button ---- */}
        <div className="grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-8 mb-10">
          <div className={live ? 'cc-up' : 'opacity-0'} style={{ animationDelay: '140ms' }}>
            <p className="font-serif text-sm leading-[1.75] cc-dropcap break-words" style={{ color: `${cfg.ink || '#2b2620'}cc` }}>
              {cfg.blurb}
            </p>
            <button onClick={() => setOpen(v => !v)}
                    className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] px-4 py-2.5 slide-press"
                    style={{ background: cfg.ink || '#2b2620', color: cfg.bg || '#d9cfbc' }}>
              <Plus size={13} /> {open ? 'Close' : (cfg.pinLabel || 'Pin a note')}
            </button>
          </div>

          {/* ---- composer ---- */}
          {open && (
            <div className="cc-pop p-4 md:p-5 min-w-0" style={{ background: palette[color % palette.length], border: `1px solid ${cfg.ink || '#2b2620'}44`, boxShadow: '0 14px 34px rgba(0,0,0,0.16)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em]" style={{ color: `${cfg.ink}99` }}>
                  Notion syntax: **bold** *italic* `code` # heading - list [ ] todo &gt; quote
                </p>
                <div className="flex gap-1.5 shrink-0">
                  {palette.map((c, i) => (
                    <button key={i} onClick={() => setColor(i)} aria-label={`Colour ${i + 1}`}
                            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                            style={{ background: c, outline: color === i ? `2px solid ${cfg.ink}` : `1px solid ${cfg.ink}33`, outlineOffset: 1 }} />
                  ))}
                </div>
              </div>

              {preview ? (
                <div className="min-h-[120px] font-sans text-[12.5px] leading-[1.6] p-2" style={{ color: cfg.ink }}>
                  <NotionText text={draft || '_Nothing yet._'} />
                </div>
              ) : (
                <textarea value={draft} onChange={e => setDraft(e.target.value.slice(0, max))} rows={5}
                          placeholder={cfg.placeholder}
                          className="w-full bg-transparent outline-none resize-y font-sans text-[12.5px] leading-[1.6] p-2"
                          style={{ color: cfg.ink, border: `1px dashed ${cfg.ink}33` }} />
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="name (optional)"
                       className="flex-1 min-w-[130px] bg-transparent outline-none font-mono text-[11px] px-2 py-1.5"
                       style={{ color: cfg.ink, borderBottom: `1px solid ${cfg.ink}33` }} />
                <span className="font-mono text-[9px] tabular-nums shrink-0" style={{ color: `${cfg.ink}66` }}>{draft.length}/{max}</span>
                <button onClick={() => setPreview(p => !p)} className="font-mono text-[9px] uppercase tracking-[0.18em] px-3 py-2 shrink-0"
                        style={{ border: `1px solid ${cfg.ink}44`, color: cfg.ink }}>{preview ? 'Write' : 'Preview'}</button>
                <button onClick={submit} disabled={!draft.trim() || posting}
                        className="font-mono text-[9px] uppercase tracking-[0.18em] px-4 py-2 slide-press shrink-0 disabled:opacity-40"
                        style={{ background: cfg.ink, color: cfg.bg }}>{posting ? 'Pinning…' : 'Pin it'}</button>
              </div>
            </div>
          )}
        </div>

        {/* ---- section markers ---- */}
        <div className="flex flex-wrap gap-10 md:gap-16 mb-6">
          {[[cfg.sectionA, cfg.sectionAYears], [cfg.sectionB, cfg.sectionBYears]].map(([label, years], i) => (
            label ? (
              <div key={i} className={live ? 'cc-up' : 'opacity-0'} style={{ animationDelay: `${200 + i * 70}ms` }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] leading-snug whitespace-pre-line break-words" style={{ color: cfg.ink }}>{label}</p>
                <p className="font-mono text-[11px] tracking-[0.15em] mt-1" style={{ color: `${cfg.ink}aa` }}>{years}</p>
                <span className="inline-block mt-2 text-sm" style={{ color: cfg.ink }}>→</span>
              </div>
            ) : null
          ))}
        </div>

        {/* ---- the board ---- */}
        {notes.length === 0 ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] py-16 text-center" style={{ color: `${cfg.ink}77` }}>
            {cfg.emptyText}
          </p>
        ) : (
          <div className="cc-masonry">
            {notes.map((n, i) => (
              <article key={n.id ?? i}
                       className={`cc-note ${live ? 'cc-pop' : 'opacity-0'}`}
                       style={{
                         background: n.color || palette[i % palette.length],
                         '--rot': `${(seededRand(i, 77) - 0.5) * 3.4}deg`,
                         animationDelay: `${Math.min(i, 14) * 55}ms`,
                         border: `1px solid ${cfg.ink}22`
                       }}>
                <NotionText text={n.text} className="font-sans text-[12.5px] leading-[1.6] break-words" />
                <div className="flex items-baseline justify-between gap-3 mt-3 pt-2" style={{ borderTop: `1px solid ${cfg.ink}1f` }}>
                  <span className="font-serif italic text-[11.5px] min-w-0 break-words" style={{ color: `${cfg.ink}bb` }}>
                    {n.author?.trim() ? n.author : (cfg.anonName || 'anonymous')}
                  </span>
                  <span className="font-mono text-[8.5px] uppercase tracking-[0.15em] shrink-0" style={{ color: `${cfg.ink}77` }}>
                    {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

/* ============================================================
   SONG OF THE DAY
   A translucent coloured record, half out of frame, its label
   carrying the day's track listing.
   ============================================================ */
const SongOfDay = ({ cfg }) => {
  const hostRef = useRef(null);
  const live = useInView(hostRef, '120px');
  const vinyl = cfg.vinylColor || '#1f5fd0';
  const tracks = cfg.tracks || [];
  const uid = cfg.uid || 'sotd';

  return (
    <section ref={hostRef} className="relative w-full overflow-hidden flex items-center"
             style={{ background: cfg.bg || '#0d0d0f', minHeight: '100vh' }}>

      {/* ---- left rail ---- */}
      <div className={`relative z-20 w-full max-w-[300px] shrink-0 pl-6 md:pl-14 pr-4 ${live ? 'cc-up' : 'opacity-0'}`}>
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-7"
              style={{ background: '#141414', border: '1px solid #ffffff22' }}>
          <Disc3 size={19} style={{ color: '#fff' }} />
        </span>
        <h2 className="font-sans font-bold uppercase leading-[1.15] text-xl md:text-2xl tracking-tight break-words" style={{ color: '#f2f2f2' }}>
          {cfg.heading}
        </h2>
        <p className="font-mono text-[10px] leading-relaxed uppercase tracking-[0.12em] mt-5 break-words" style={{ color: '#ffffff66' }}>
          {cfg.blurb}
        </p>
        {cfg.link && (
          <a href={/^https?:\/\//i.test(cfg.link) ? cfg.link : undefined} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 mt-6 font-mono text-[10px] uppercase tracking-[0.2em] px-4 py-2.5 slide-press"
             style={{ border: '1px solid #ffffff33', color: '#f2f2f2' }}>
            <Play size={12} /> {cfg.linkLabel || 'Listen'}
          </a>
        )}
      </div>

      {/*
        THE RECORD
        Photographic reference has three things a plain radial gradient
        cannot give you, so each is built explicitly:
          1. a hard, near-white specular sweep (the photo peaks at ~#becddd,
             not a lighter tint of the vinyl colour)
          2. thousands of fine grooves, which is a repeating conic pattern
             rather than a handful of rings
          3. the disc running off the right edge, so it reads as a close-up
        Sized past the viewport and pushed right, exactly like the plate.
      */}
      <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${live ? 'cc-vinyl' : 'opacity-0'}`}
           style={{ right: '-18%', width: 'min(150vh, 1180px)', aspectRatio: '1/1' }}>

        <div className={`relative w-full h-full rounded-full overflow-hidden ${cfg.spin ? 'cc-spin' : ''}`}
             style={{ boxShadow: `0 0 140px ${vinyl}33` }}>

          {/* A supplied photo wins outright — CSS can approximate a pressed
              record convincingly but cannot reproduce real refraction. */}
          {cfg.vinylImage && (
            <img loading="lazy" decoding="async" src={cfg.vinylImage} alt=""
                 className="absolute inset-0 w-full h-full object-cover rounded-full" />
          )}

          {!cfg.vinylImage && <>
          {/* base body — deep at the rim, brighter toward the upper left */}
          <div className="absolute inset-0 rounded-full"
               style={{ background: `radial-gradient(circle at 38% 30%, ${vinyl} 0%, ${vinyl}dd 38%, ${vinyl}99 62%, ${vinyl}55 82%, ${vinyl}22 100%)` }} />

          {/* translucency — light pooling through the disc from behind */}
          <div className="absolute inset-0 rounded-full"
               style={{ background: `radial-gradient(circle at 62% 74%, ${vinyl}cc 0%, transparent 46%)`, mixBlendMode: 'screen' }} />

          {/* grooves: fine concentric rings, dense enough to read as vinyl */}
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.055) 0 1px, rgba(0,0,0,0.075) 1px 2.5px)',
                 mixBlendMode: 'overlay'
               }} />

          {/* land between groove bands */}
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 14px, rgba(0,0,0,0.05) 14px 30px)',
                 mixBlendMode: 'soft-light'
               }} />

          {/* THE SHEEN — hard, near-white, swept across the lower left.
              This is the single biggest thing missing from a gradient-only
              record; the reference blows out to almost white here. */}
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: `conic-gradient(from 190deg at 50% 50%,
                   transparent 0deg, rgba(214,228,246,0.00) 18deg,
                   rgba(214,228,246,0.55) 34deg, rgba(236,244,255,0.88) 43deg,
                   rgba(214,228,246,0.50) 52deg, rgba(214,228,246,0.00) 70deg,
                   transparent 300deg,
                   rgba(190,210,240,0.22) 330deg, transparent 360deg)`,
                 filter: 'blur(6px)'
               }} />

          {/* a second, tighter glint riding the same arc */}
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: `conic-gradient(from 196deg at 50% 50%,
                   transparent 30deg, rgba(255,255,255,0.75) 41deg, transparent 50deg)`,
                 filter: 'blur(2px)', mixBlendMode: 'screen'
               }} />

          {/* rim darkening so the edge turns away from the light */}
          <div className="absolute inset-0 rounded-full"
               style={{ background: 'radial-gradient(circle at 50% 50%, transparent 62%, rgba(0,0,0,0.5) 92%, rgba(0,0,0,0.75) 100%)' }} />

          </>}

          {/* outer edge highlight */}
          <div className="absolute inset-0 rounded-full"
               style={{ boxShadow: `inset 0 0 0 1px ${vinyl}88, inset 0 0 26px rgba(0,0,0,0.55)` }} />
        </div>

        {/* ---------- LABEL (does not spin with the disc) ---------- */}
        <div className="absolute rounded-full overflow-hidden flex flex-col"
             style={{ inset: '31%', background: cfg.labelBg || '#0a0a12', boxShadow: '0 0 0 1px rgba(255,255,255,0.14), 0 0 34px rgba(0,0,0,0.6)' }}>
          {cfg.labelImage && (
            <img loading="lazy" decoding="async" src={cfg.labelImage} alt=""
                 className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.5 }} />
          )}

          <div className="relative flex-1 flex flex-col px-[8%] pt-[9%] pb-[7%] min-w-0">
            <p className="font-serif tracking-[0.42em] text-center uppercase leading-none break-words"
               style={{ color: '#fff', fontSize: 'clamp(9px, 1.5vw, 19px)' }}>{cfg.albumTitle}</p>
            <p className="font-mono text-center uppercase tracking-[0.3em] mt-[2%] break-words"
               style={{ color: '#ffffff66', fontSize: 'clamp(4px, 0.62vw, 8px)' }}>{cfg.albumSub}</p>

            <div className="flex items-end justify-between gap-3 mt-[7%]">
              <span className="font-mono uppercase tracking-[0.08em] whitespace-pre-line shrink-0"
                    style={{ color: '#ffffff88', fontSize: 'clamp(4px, 0.58vw, 7px)', lineHeight: 1.5 }}>{cfg.catalogue}</span>
              <span className="font-sans font-bold text-right whitespace-pre-line shrink-0"
                    style={{ color: '#fff', fontSize: 'clamp(5px, 0.82vw, 11px)', lineHeight: 1.25 }}>{cfg.side}</span>
            </div>

            <ol className="mt-[5%] flex-1 overflow-hidden">
              {tracks.slice(0, 6).map((t, i) => (
                <li key={t.id ?? i} className="flex items-baseline gap-[2.5%] min-w-0 mb-[2.6%]">
                  <span className="font-sans font-bold tabular-nums shrink-0 text-right"
                        style={{ color: '#fff', fontSize: 'clamp(4.5px, 0.72vw, 9px)', width: '7%' }}>{i + 1}.</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans font-bold uppercase truncate leading-tight"
                          style={{ color: '#fff', fontSize: 'clamp(4.5px, 0.72vw, 9px)' }}>{t.title}</span>
                    {t.credit && (
                      <span className="block font-mono uppercase truncate leading-tight"
                            style={{ color: '#ffffff4d', fontSize: 'clamp(3px, 0.45vw, 5.5px)' }}>{t.credit}</span>
                    )}
                  </span>
                  <span className="font-sans tabular-nums shrink-0"
                        style={{ color: '#fff', fontSize: 'clamp(4.5px, 0.72vw, 9px)' }}>{t.length}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* spindle */}
          <div className="absolute rounded-full"
               style={{ inset: '46.5%', background: cfg.bg || '#0d0d0f', boxShadow: '0 0 0 1px rgba(255,255,255,0.2)' }} />
        </div>
      </div>
    </section>
  );
};

/* ============================================================
   VOTING POLL
   Drag each column to say how you think it should be split, then
   submit. The figure above each column is the running average of
   everyone's submissions; while you are dragging it shows your own.
   ============================================================ */
const VotePoll = ({ cfg, options, tally, onSubmit, voted }) => {
  const hostRef = useRef(null);
  const live = useInView(hostRef, '120px');
  const [mine, setMine] = useState(null);
  const [dragging, setDragging] = useState(null);

  const opts = options || [];
  const editing = mine !== null;

  const averages = useMemo(() => {
    const out = {};
    opts.forEach(o => {
      const t = tally?.[o.id];
      out[o.id] = t && t.n ? Math.round(t.sum / t.n) : Number(o.seed ?? 0);
    });
    return out;
  }, [opts, tally]);

  const shown = (id) => (editing ? (mine[id] ?? 0) : averages[id] ?? 0);
  const begin = () => { if (!mine) setMine(Object.fromEntries(opts.map(o => [o.id, averages[o.id] ?? 0]))); };

  const setFromPointer = (id, clientY, el) => {
    const r = el.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(100, ((r.bottom - clientY) / r.height) * 100)));
    setMine(m => ({ ...(m || {}), [id]: pct }));
  };

  const down = (e, id) => {
    if (voted) return;
    begin();
    setDragging(id);
    setFromPointer(id, e.clientY, e.currentTarget);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const move = (e, id) => { if (dragging === id) setFromPointer(id, e.clientY, e.currentTarget); };
  const up = (e) => { setDragging(null); try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {} };

  // Keyboard equivalent — dragging alone would leave this unusable
  // for anyone not using a mouse.
  const key = (e, id) => {
    if (voted) return;
    const step = e.shiftKey ? 10 : 1;
    let d = 0;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') d = step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') d = -step;
    else return;
    e.preventDefault();
    begin();
    setMine(m => {
      const base = m || Object.fromEntries(opts.map(o => [o.id, averages[o.id] ?? 0]));
      return { ...base, [id]: Math.max(0, Math.min(100, (base[id] ?? 0) + d)) };
    });
  };

  return (
    <section ref={hostRef} className="relative w-full flex flex-col"
             style={{ background: cfg.paper || '#efe9dc', minHeight: '100vh' }}>

      <div className={`flex-1 grid md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] ${live ? 'cc-panel' : 'opacity-0'}`}>

        {/* ---- left: the ask ---- */}
        <div className="relative flex flex-col justify-between p-8 md:p-12 min-w-0">
          <div />
          <div className="min-w-0 py-8">
            <h2 className="font-sans font-bold tracking-tight mb-5 break-words"
                style={{ color: '#1a1a1a', fontSize: 'clamp(2.6rem, 6vw, 4.4rem)', lineHeight: 0.95 }}>
              {cfg.heading}
            </h2>
            <p className="font-sans text-[12px] md:text-[13px] leading-[1.7] max-w-[280px] break-words" style={{ color: '#6d675d' }}>
              {voted ? (cfg.thanks || 'Thanks — your vote is in.') : cfg.blurb}
            </p>
          </div>

          <button onClick={() => { if (!voted && mine) onSubmit(mine); }}
                  disabled={voted || !mine}
                  className="inline-flex items-center gap-3 font-sans slide-press disabled:opacity-40 min-w-0 self-start"
                  style={{ color: '#1a1a1a' }}>
            <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-lg"
                  style={{ background: cfg.submitColor || '#2f6fdb', color: '#fff' }}>→</span>
            <span className="break-words text-[15px] md:text-base">
              {voted ? (cfg.votedLabel || 'Vote submitted') : (cfg.submitLabel || 'Submit vote')}
            </span>
          </button>
        </div>

        {/* ---- right: the columns ---- */}
        <div className="grid min-w-0" style={{ gridTemplateColumns: `repeat(${Math.max(1, opts.length)}, minmax(0, 1fr))` }}>
          {opts.map((o, i) => {
            const v = shown(o.id);
            return (
              <div key={o.id}
                   role="slider"
                   tabIndex={voted ? -1 : 0}
                   aria-label={o.label}
                   aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}
                   onPointerDown={e => down(e, o.id)}
                   onPointerMove={e => move(e, o.id)}
                   onPointerUp={up}
                   onPointerCancel={up}
                   onKeyDown={e => key(e, o.id)}
                   className={`relative flex flex-col min-w-0 select-none outline-none ${voted ? '' : 'cursor-ns-resize focus-visible:ring-2'}`}
                   style={{ borderLeft: '1px dashed rgba(0,0,0,0.18)', touchAction: 'none' }}>

                <div className="p-3 md:p-5 min-w-0">
                  <p className="font-sans text-[10px] md:text-[11px] leading-tight break-words mb-1" style={{ color: '#6d675d' }}>{o.label}</p>
                  <p className="font-sans font-medium tabular-nums" style={{ color: '#1a1a1a', fontSize: 'clamp(1.1rem, 2.2vw, 1.7rem)' }}>{v}%</p>
                </div>

                <div className="relative flex-1">
                  <div className="absolute inset-x-0 bottom-0 cc-bar" style={{ height: `${v}%`, background: o.color || '#8a8a8a' }}>
                    {dragging === o.id && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-mono text-[10px]"
                            style={{ background: '#111', color: '#fff' }}>↕</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ============================================================
   COMMUNITY CENTER
   The four panels, stacked. Each reveals itself on scroll.
   ============================================================ */
const CommunityCenter = ({
  cfg, board, notes, onPostNote, postingNote,
  song, poll, pollOptions, pollTally, onVote, hasVoted, onExit
}) => {
  const heroRef = useRef(null);
  const heroSeen = useInView(heroRef, '0px');

  return (
    <div data-cc-scroll className="fixed inset-0 z-[65] overflow-y-auto hide-scrollbar" style={{ background: cfg.heroBg || '#faf7ed' }}>

      {/* ---- persistent exit ---- */}
      <button onClick={onExit}
              className="fixed top-4 left-4 z-[68] flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] px-3 py-2 slide-press"
              style={{ background: '#161310', color: '#efece2' }}>
        <ChevronLeft size={13} /> {cfg.exitLabel || 'Back'}
      </button>

      {/* ================= HERO ================= */}
      <section ref={heroRef} className="relative w-full overflow-hidden flex flex-col items-center justify-center px-5"
               style={{ background: cfg.heroBg || '#faf7ed', minHeight: '100vh' }}>
        <div className="relative z-10 text-center max-w-3xl mx-auto pb-20">
          <h1 className={`font-serif leading-[1.05] tracking-tight mb-4 break-words ${heroSeen ? 'cc-title' : 'opacity-0'}`}
              style={{ color: cfg.heroInk || '#12100c', fontSize: 'clamp(2.1rem, 7vw, 4.6rem)' }}>
            {cfg.heroPre}{' '}
            <em className="italic">{cfg.heroItalic}</em>{' '}
            {cfg.heroPost}
          </h1>
          <p className={`font-sans text-sm md:text-[15px] leading-[1.6] max-w-md mx-auto break-words ${heroSeen ? 'cc-up' : 'opacity-0'}`}
             style={{ color: cfg.heroInk || '#12100c', animationDelay: '220ms' }}>
            {cfg.heroSub}
          </p>
        </div>

        {/* the figure — corner set in Admin > Community */}
        {!!cfg.heroImage && (() => {
          const pos = cfg.heroImagePos || 'left';
          const edge = pos === 'center'
            ? { left: '50%', transform: 'translateX(-50%)' }
            : pos === 'right'
              ? { right: 'clamp(3%, 7vw, 12%)' }
              : { left: 'clamp(3%, 7vw, 12%)' };
          return (
            <img loading="lazy" decoding="async" src={cfg.heroImage} alt=""
                 className={`absolute bottom-0 pointer-events-none select-none ${heroSeen ? 'cc-fig' : 'opacity-0'}`}
                 style={{ ...edge, height: `clamp(170px, ${cfg.heroImageSize || 34}vh, 460px)`, width: 'auto' }} />
          );
        })()}

        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 ${heroSeen ? 'cc-up' : 'opacity-0'}`}
             style={{ animationDelay: '420ms' }}>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: `${cfg.heroInk || '#12100c'}77` }}>
            {cfg.scrollHint || 'scroll'}
          </span>
          <span className="cc-scroll-dot w-[1px] h-7" style={{ background: `${cfg.heroInk || '#12100c'}44` }} />
        </div>
      </section>

      {/* ================= BOARD ================= */}
      {board.enabled && (
        <CommunityBoard cfg={board} notes={notes} onPost={onPostNote} posting={postingNote} />
      )}

      {/* ================= SONG OF THE DAY ================= */}
      {song.enabled && <SongOfDay cfg={song} />}

      {/* ================= POLL ================= */}
      {poll.enabled && (
        <VotePoll cfg={poll} options={pollOptions} tally={pollTally} onSubmit={onVote} voted={hasVoted} />
      )}

      {/* ---- foot ---- */}
      <footer className="px-6 py-10 flex flex-wrap items-center justify-between gap-4"
              style={{ background: cfg.footBg || '#12100c' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.28em] break-words" style={{ color: '#ffffff55' }}>{cfg.footNote}</p>
        <button onClick={onExit} className="font-mono text-[9px] uppercase tracking-[0.2em] px-4 py-2 slide-press shrink-0"
                style={{ border: '1px solid #ffffff33', color: '#fff' }}>{cfg.exitLabel || 'Back'}</button>
      </footer>
    </div>
  );
};

/* ============================================================
   EDITORIAL CHROME
   Shared furniture for the restyled modals. Pulled from the
   reference sheets: hairline rules instead of heavy borders,
   dotted leader lines, diamond markers, corner registration
   brackets, notched panel corners, halftone fills, serif display
   over monospace micro-labels.

   Every modal keeps the elements it already had — this only
   changes the chrome they sit in.
   ============================================================ */
const ED = {
  ink:    '#16150f',
  ink2:   '#201f18',
  paper:  '#ece8dc',
  paper2: '#f5f2e9',
  orange: '#e8552a',
  mustard:'#f0c53c',
  moss:   '#2b2e26'
};

// Corner registration brackets, as on the feature cards.
const EdCorners = ({ color = 'currentColor', size = 14, inset = 8, weight = 1 }) => (
  <>
    {[
      { top: inset, left: inset, bt: 1, bl: 1 },
      { top: inset, right: inset, bt: 1, br: 1 },
      { bottom: inset, left: inset, bb: 1, bl: 1 },
      { bottom: inset, right: inset, bb: 1, br: 1 }
    ].map((p, i) => (
      <span key={i} aria-hidden="true" className="absolute pointer-events-none"
            style={{
              width: size, height: size,
              top: p.top, left: p.left, right: p.right, bottom: p.bottom,
              borderTop: p.bt ? `${weight}px solid ${color}` : 'none',
              borderBottom: p.bb ? `${weight}px solid ${color}` : 'none',
              borderLeft: p.bl ? `${weight}px solid ${color}` : 'none',
              borderRight: p.br ? `${weight}px solid ${color}` : 'none'
            }} />
    ))}
  </>
);

// "◆ Label ··········" — the running header used throughout the sheets.
const EdLabel = ({ children, color = 'currentColor', right = null, className = '' }) => (
  <div className={`flex items-center gap-2 min-w-0 ${className}`} style={{ color }}>
    <span className="shrink-0 text-[8px] leading-none">◆</span>
    <span className="font-mono text-[9px] uppercase tracking-[0.28em] shrink-0 truncate">{children}</span>
    <span className="ed-leader flex-1" />
    {right && <span className="font-mono text-[9px] uppercase tracking-[0.28em] shrink-0">{right}</span>}
  </div>
);

/* ============================================================
   ICE'S SECRET CORNER
   A music player that isn't in the navigation. It opens either from
   a small unlabelled glyph tucked into the poem overlay / journal
   footer, or by typing the passphrase anywhere on the site.

   Tracks are managed in Admin > Secret. Audio is expected to live in
   Supabase Storage (or any direct URL) — audio is far too large to
   embed as base64 the way images were.
   ============================================================ */
/* ============================================================
   ICE'S SECRET CORNER
   A gramophone parlour, not a nav item. Left half is a turntable:
   the record spins while playing and the tonearm swings onto it.
   Right half is the library — numbered rows, durations, hearts.

   It opens from a faint glyph in a poem, or by typing the
   passphrase anywhere on the site. Tracks live in Admin > Secret.
   ============================================================ */
/* ============================================================
   ICE'S SECRET CORNER
   A gramophone in a dark room. The platter is a real disc in 3D
   (perspective + rotateX), the tonearm swings down onto it, and
   changing track physically swaps the record: the old one lifts
   away and the new one drops onto the spindle.

   Opens from a faint glyph in a poem, or by typing the
   passphrase anywhere. Tracks live in Admin > Secret.
   ============================================================ */
const SecretCorner = ({ cfg, tracks, onClose, ascii }) => {
  const audioRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [loop, setLoop] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [favs, setFavs] = useState(() => {
    // The visitor's own hearts, kept locally — never touches the admin list.
    try { return JSON.parse(localStorage.getItem('secret_favs') || '[]'); } catch { return []; }
  });
  const [favOnly, setFavOnly] = useState(false);
  const [err, setErr] = useState(null);

  const bg    = cfg.bgColor    || '#15100c';
  const brass = cfg.brass      || '#c9a86a';
  const text  = cfg.textColor  || '#ece0c8';
  const muted = cfg.mutedColor || '#8d7a5c';
  const tilt  = Number(cfg.platterTilt ?? 56);

  const all = tracks || [];
  const list = favOnly ? all.filter(t => favs.includes(t.id)) : all;
  const track = all[idx] || null;

  useEffect(() => { setProgress(0); setErr(null); }, [idx]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { try { localStorage.setItem('secret_favs', JSON.stringify(favs)); } catch {} }, [favs]);

  // Changing record: arm lifts, old disc pulls off, new disc drops in.
  const swapTimer = useRef(null);
  const selectTrack = (next) => {
    if (next === idx) return;
    setPlaying(false);
    setSwapping(true);
    clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => { setIdx(next); setSwapping(false); }, 340);
  };
  useEffect(() => () => clearTimeout(swapTimer.current), []);

  const toggleFav = (id) => setFavs(f => f.includes(id) ? f.filter(x => x !== id) : [...f, id]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a || !track?.src) { setErr('No audio on this track yet.'); return; }
    try {
      if (a.paused) { await a.play(); setPlaying(true); }
      else { a.pause(); setPlaying(false); }
    } catch { setErr('Could not play this track.'); setPlaying(false); }
  };

  const go = (delta) => { if (all.length) selectTrack((idx + delta + all.length) % all.length); };

  const seek = (e) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * duration;
  };

  const fmt = (t) => !t || !isFinite(t) ? '0:00' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const pct = duration ? (progress / duration) * 100 : 0;

  // Turned brass key with a raised rim, as on the plinth.
  const Key = ({ onClick, label, size = 46, lit = false, children }) => (
    <button onClick={onClick} aria-label={label} title={label}
            className="sc-key shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: size, height: size,
              color: lit ? '#2b1d10' : `${brass}dd`,
              background: lit
                ? `radial-gradient(circle at 36% 26%, #f0dcae, ${brass} 62%, #8d6f42)`
                : `radial-gradient(circle at 36% 26%, ${brass}33, ${brass}16 55%, ${brass}0a)`,
              border: `1px solid ${brass}${lit ? 'cc' : '3d'}`,
              boxShadow: lit
                ? `inset 0 1px 2px rgba(255,246,222,0.65), inset 0 -2px 4px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.55)`
                : `inset 0 1px 1px ${brass}22, inset 0 -2px 4px rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.5)`
            }}>
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-2 sm:p-4 md:p-6"
         style={{ background: '#080503f7', animation: 'backdropIn 320ms ease-out both' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <div className="relative w-full max-w-5xl overflow-hidden anim-sheet"
           style={{
             background: `radial-gradient(120% 100% at 24% -10%, #3a2a1c 0%, ${bg} 46%, #0b0806 100%)`,
             border: `1px solid ${brass}33`,
             boxShadow: '0 40px 120px rgba(0,0,0,0.85)'
           }}>

        {ascii?.enabled && (
          <AsciiTexture seed={51} ramp={ascii.ramp} size={ascii.size} speed={ascii.speed} animate={ascii.animate}
                        color={ascii.inkOnDark} opacity={ascii.opacityDark} mask={ascii.mask} clear={ascii.clear} />
        )}

        <button onClick={onClose} aria-label="Close"
                className="absolute top-3 right-3 z-40 w-8 h-8 rounded-full flex items-center justify-center slide-press"
                style={{ color: `${brass}cc`, border: `1px solid ${brass}3d`, background: '#0000004d' }}><X size={14} /></button>

        <div className="relative grid md:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)]">

          {/* ==================== PLATTER ==================== */}
          <div className="relative overflow-hidden min-h-[470px] md:min-h-[540px]">

            {/* the deck plate the record sits on */}
            <div className="absolute pointer-events-none"
                 style={{
                   left: '-34%', top: '-34%', width: '134%', height: '120%',
                   background: 'radial-gradient(closest-side, rgba(70,52,34,0.55), rgba(20,14,10,0) 72%)'
                 }} />

            {/* --- RECORD (perspective stack: swap > tilt > spin) --- */}
            {/* Sized to overrun the pane and crop against the left edge,
                the way the record does on the reference deck. */}
            <div className="absolute"
                 style={{ left: '34%', top: '38%', transform: 'translate(-50%, -50%)', perspective: '1400px' }}>
              <div key={track ? track.id : 'none'}
                   className="sc-disc-swap"
                   style={{ animation: swapping ? 'discOut 340ms var(--ease-mech) forwards' : 'discIn 620ms var(--ease-out-expo) both' }}>
                <div style={{ transform: `rotateX(${tilt}deg)`, transformStyle: 'preserve-3d' }}>
                  <div className={`relative rounded-full ${playing && !swapping ? 'sc-spin' : ''}`}
                       style={{
                         width: 'min(112vw, 660px)', height: 'min(112vw, 660px)',
                         background: `
                           repeating-radial-gradient(circle at 50% 50%, rgba(255,236,200,0.055) 0 1px, rgba(0,0,0,0) 1px 3px),
                           radial-gradient(circle at 50% 50%, #221d18 0 27%, rgba(0,0,0,0) 27%),
                           radial-gradient(circle at 38% 30%, #332c25 0%, #16120e 58%, #0a0806 100%)
                         `,
                         boxShadow: '0 0 0 1px rgba(201,168,106,0.16), 0 30px 60px rgba(0,0,0,0.8)'
                       }}>
                    {/* centre label — this is what changes with the track */}
                    <div className="absolute rounded-full overflow-hidden"
                         style={{ inset: '36%', border: `1px solid ${brass}3d`, background: track?.cover ? '#000' : `${brass}1c` }}>
                      {track?.cover
                        ? <img loading="lazy" decoding="async" src={track.cover} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ color: `${brass}77` }}>
                            <Disc3 size={20} />
                            <span className="font-mono text-[6px] uppercase tracking-[0.2em]">{(track?.artist || '').slice(0, 14)}</span>
                          </div>}
                    </div>
                    {/* spindle */}
                    <div className="absolute rounded-full" style={{ inset: '48.6%', background: '#0b0806', boxShadow: `0 0 0 1px ${brass}55` }} />
                    {/* specular sweep across the grooves */}
                    <div className="absolute inset-0 rounded-full pointer-events-none"
                         style={{ background: `linear-gradient(122deg, transparent 30%, ${brass}22 44%, ${brass}0d 52%, transparent 62%)` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* --- TONEARM --- */}
            {/* Pivot sits over the top-right of the platter; the arm swings
                down-left so the headshell lands in the groove. */}
            <div className="absolute pointer-events-none hidden sm:block z-20"
                 style={{ left: '88%', top: '2%' }}>
              <div style={{
                     transformOrigin: '50% 10px',
                     /* rotate() is clockwise, so POSITIVE swings the stylus left,
                        onto the disc. Parked at -12deg the tip clears the outer
                        edge; at +10deg it sits in the outer groove. */
                     transform: `rotate(${playing && !swapping ? 10 : -12}deg)`,
                     transition: 'transform 1100ms var(--ease-out-expo)'
                   }}>
                {/* counterweight + pivot */}
                <div className="relative mx-auto" style={{ width: 26 }}>
                  <div style={{ width: 26, height: 12, borderRadius: 4, background: `linear-gradient(180deg, #e2cb9a, ${brass} 55%, #7d6236)`, boxShadow: '0 3px 8px rgba(0,0,0,0.6)' }} />
                  <div className="mx-auto" style={{ width: 15, height: 15, borderRadius: 15, marginTop: -3, background: `radial-gradient(circle at 34% 30%, #f0dcae, ${brass} 60%, #6f5730)`, boxShadow: '0 3px 10px rgba(0,0,0,0.65)' }} />
                </div>
                {/* arm tube */}
                <div className="mx-auto" style={{ width: 4, height: 186, background: `linear-gradient(90deg, #8d6f42, ${brass} 40%, #f0dcae 52%, ${brass} 64%, #6f5730)`, boxShadow: '2px 0 8px rgba(0,0,0,0.6)' }} />
                {/* headshell */}
                <div className="mx-auto" style={{ width: 17, height: 22, marginTop: -1, background: `linear-gradient(180deg, ${brass}, #7d6236)`, clipPath: 'polygon(12% 0,88% 0,66% 100%,34% 100%)', boxShadow: '0 4px 10px rgba(0,0,0,0.7)' }} />
                <div className="mx-auto" style={{ width: 3, height: 7, background: '#e8dcc0' }} />
              </div>
            </div>

            {/* --- CONTROLS, overlaid bottom-left --- */}
            <div className="absolute inset-x-0 bottom-0 px-6 pb-6 pt-16"
                 style={{ background: 'linear-gradient(to top, rgba(8,5,3,0.94) 42%, rgba(8,5,3,0) 100%)' }}>
              <div className="max-w-[330px] mx-auto text-center">
                <p className="font-serif text-[17px] md:text-xl leading-tight break-words" style={{ color: text }}>
                  {track?.title || '—'}
                </p>
                <p className="font-mono text-[10px] tracking-[0.16em] mt-1 break-words" style={{ color: muted }}>
                  {track?.artist || ''}
                </p>

                <div className="flex items-center gap-3 mt-4">
                  <span className="font-mono text-[9px] tabular-nums shrink-0" style={{ color: muted }}>{fmt(progress)}</span>
                  <div onClick={seek} className="relative flex-1 h-[2px] cursor-pointer" style={{ background: `${brass}2e` }}>
                    <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: `${brass}dd` }} />
                    <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                          style={{ left: `${pct}%`, width: 10, height: 10, background: `radial-gradient(circle at 36% 30%, #f0dcae, ${brass})`, boxShadow: '0 2px 6px rgba(0,0,0,0.7)' }} />
                  </div>
                  <span className="font-mono text-[9px] tabular-nums shrink-0" style={{ color: muted }}>{track?.length || fmt(duration)}</span>
                </div>

                <div className="flex items-center justify-center gap-2.5 sm:gap-3 mt-5">
                  <Key onClick={() => track && toggleFav(track.id)} label="Favourite" size={40} lit={!!track && favs.includes(track.id)}>
                    <Star size={15} fill={track && favs.includes(track.id) ? 'currentColor' : 'none'} strokeWidth={1.5} />
                  </Key>
                  <Key onClick={() => go(-1)} label="Previous" size={42}><ChevronLeft size={17} strokeWidth={1.8} /></Key>
                  <Key onClick={toggle} label={playing ? 'Pause' : 'Play'} size={54} lit>
                    {playing
                      ? <span className="block w-3 h-3.5" style={{ borderLeft: '3.5px solid currentColor', borderRight: '3.5px solid currentColor' }} />
                      : <Play size={17} fill="currentColor" strokeWidth={1} />}
                  </Key>
                  <Key onClick={() => go(1)} label="Next" size={42}><ChevronRight size={17} strokeWidth={1.8} /></Key>
                  <Key onClick={() => setLoop(v => !v)} label="Repeat" size={40} lit={loop}><RotateCcw size={15} strokeWidth={1.5} /></Key>
                </div>

                <div className="flex items-center gap-2 mt-4 justify-center">
                  <Radio size={10} className="shrink-0" style={{ color: muted }} />
                  <input type="range" min="0" max="1" step="0.02" value={volume} aria-label="Volume"
                         onChange={e => setVolume(parseFloat(e.target.value))}
                         className="w-28 h-[2px] cursor-pointer" style={{ accentColor: brass }} />
                </div>

                {err && <p className="font-mono text-[9px] uppercase tracking-[0.15em] mt-3" style={{ color: '#e8552a' }}>{err}</p>}
              </div>
            </div>
          </div>

          {/* ==================== LIBRARY ==================== */}
          <div className="relative flex flex-col min-w-0 pt-5"
               style={{ borderLeft: `1px solid ${brass}1f`, background: 'rgba(0,0,0,0.22)' }}>

            <div className="flex items-center justify-between gap-3 pl-5 pr-14 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* gramophone horn */}
                <svg width="26" height="20" viewBox="0 0 26 20" fill="none" className="shrink-0" style={{ color: brass }}>
                  <path d="M14 2c5 0 10 3.4 10 7s-5 6-10 6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  <path d="M14 2v13" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M13 8.5 4 14.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  <circle cx="3" cy="15.4" r="2.1" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
                <p className="font-serif text-[17px] leading-tight min-w-0 break-words" style={{ color: text }}>{cfg.title}</p>
              </div>
              <button onClick={() => setFavOnly(v => !v)}
                      className="font-mono text-[10px] tracking-[0.12em] shrink-0 transition-colors"
                      style={{ color: favOnly ? brass : muted }}>
                {cfg.favLabel}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar max-h-[38vh] md:max-h-[430px] px-5 pb-2">
              {list.length === 0 && (
                <p className="py-10 text-center font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: muted }}>
                  {favOnly ? 'Nothing hearted yet.' : 'The shelf is empty.'}
                </p>
              )}
              {list.map((t) => {
                const realIdx = all.indexOf(t);
                const active = realIdx === idx;
                return (
                  <div key={t.id}
                       className="sc-row group flex items-center gap-3 py-2.5 cursor-pointer"
                       onClick={() => selectTrack(realIdx)}>
                    <span className="font-mono text-[11px] tabular-nums w-3.5 shrink-0"
                          style={{ color: active ? brass : `${muted}aa` }}>{realIdx + 1}</span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[12.5px] min-w-0 break-words transition-colors"
                              style={{ color: active ? '#fff6e2' : `${text}cc` }}>{t.title || 'Untitled'}</span>
                        {active && playing && (
                          <span className="flex items-end gap-[2px] h-2.5 shrink-0">
                            {[0,1,2].map(k => <span key={k} className="w-[2px] sc-eq" style={{ background: brass, '--eqd': `${420 + k * 160}ms` }} />)}
                          </span>
                        )}
                      </span>
                      <span className="block font-mono text-[9px] tracking-[0.1em] truncate mt-0.5" style={{ color: `${muted}cc` }}>
                        {t.artist || '—'}
                      </span>
                    </span>

                    <span className="font-mono text-[11px] tabular-nums shrink-0" style={{ color: `${muted}dd` }}>{t.length || ''}</span>

                    <button onClick={(e) => { e.stopPropagation(); toggleFav(t.id); }}
                            aria-label="Favourite" className="shrink-0 transition-transform hover:scale-110"
                            style={{ color: favs.includes(t.id) ? brass : `${muted}55` }}>
                      <Star size={14} fill={favs.includes(t.id) ? 'currentColor' : 'none'} strokeWidth={1.4} />
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="px-5 py-3 font-mono text-[8px] uppercase tracking-[0.3em] text-center shrink-0"
               style={{ color: `${muted}88` }}>
              {cfg.footer}
            </p>
          </div>
        </div>

        <audio
          ref={audioRef}
          src={track?.src || undefined}
          preload="none"
          loop={loop}
          onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
          onEnded={() => { if (!loop) { cfg.autoAdvance ? go(1) : setPlaying(false); } }}
          onError={() => { setErr('Track unavailable.'); setPlaying(false); }}
        />
      </div>
    </div>
  );
};

/* ============================================================
   POEM OVERLAY — staggered slabs across a full-bleed image.
   Offsets are seeded-random per line (re-rollable) or pinned per
   line from the admin panel.
   ============================================================ */
const PoemOverlay = ({ poem, shuffle, onClose, onShuffle, onSecret, ascii }) => {
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

      {/* Character field sits over the plate at half strength — these
          surfaces already carry a photograph, so full opacity fights it. */}
      {ascii?.enabled && (
        <AsciiTexture seed={81} ramp={ascii.ramp} size={ascii.size} speed={ascii.speed} animate={ascii.animate}
                      color={ascii.inkOnDark} opacity={(ascii.opacityDark ?? 0.06) * 0.6} className="z-[5]" mask={ascii.mask} clear={ascii.clear} />
      )}

      {/* BACKDROP IMAGE */}
      {poem.image && (
        <img loading="lazy" decoding="async" src={poem.image} alt="" className="absolute inset-0 w-full h-full object-cover"
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
        <p className="font-mono text-[8px] md:text-[10px] uppercase tracking-[0.2em] mt-1 opacity-70" style={{ color: ink }}>
          {poem.footnote}
          {onSecret && (
            /* Not labelled, not announced. If you notice it, it's yours. */
            <button onClick={(e) => { e.stopPropagation(); onSecret(); }}
                    aria-label="" tabIndex={-1}
                    className="ml-2 align-middle opacity-25 hover:opacity-90 transition-opacity cursor-pointer"
                    style={{ color: ink }}>❉</button>
          )}
        </p>
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

const GALLERIA_STYLES = [
  { id: 'scrapbook', label: 'Scrapbook', hint: 'Duotone plate, decals slam in' },
  { id: 'editorial', label: 'Editorial', hint: 'Dark photo-essay spread, cascading plates' }
];

const defaultLightbox = {
  enabled: true,
  style: 'scrapbook',      // which viewer opens on a galleria click
  // --- editorial viewer ---
  edPaper: "#e8e3d5",
  edInk: "#16150f",
  edAccent: "#e8552a",
  edKicker: "ARCHIVE / PLATE",
  edMasthead: "Galleria",
  edByline: "ice",
  edFallbackTitle: "Untitled Plate",
  edStandfirst: "A running record of things worth keeping. Each plate carries its own date and note; the rest is left where it fell.",
  edSectionLabel: "MEDIA AND PRESS",
  edSectionYears: "1949—2020",
  edSectionLabel2: "PHOTO GALLERY",
  edFooterLinks: "Instagram, Pinterest, Contact",
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
  // procedural motion
  motion: true,
  motionSpeed: 1,
  pulses: true,
  liveWave: true,
  scanline: true,
  slotBlink: true,
  footerLeft: "© 2026 ARCHIVE™\nDETROITUNDERGROUND.NET",
  footerMid: "277 GRATIOT AVE, SUITE 100 · A0G04\nDETROIT, MI 48226",
  animate: true
};

const defaultOrbit = {
  enabled: true,
  heading: "Search",
  kicker: "ambient // field",
  word: "ПОИСК",
  count: 170,
  moving: 80,
  speed: 1,
  ratio: "4 / 5",
  bgTop: "#ededed",
  bgBottom: "#b4b4b4",
  wordColor: "#111111",
  figureColor: "#0d0d0d",
  figureBlur: 12,
  figureOpacity: 0.92,
  image: "",            // upload a cut-out to replace the drawn figure
  caption: ""
};

const defaultDisc = {
  enabled: true,
  heading: "Pressing",
  kicker: "ambient // disc",
  rings: 11,
  speed: 1,
  fontSize: 11,
  outerRadius: 268,
  innerRadius: 88,
  bg: "#050505",
  disc: "#141414",
  ink: "#ffffff",
  mark: "",
  text: "THIS RECORD WAS PRESSED IN A SMALL ROOM WITH THE WINDOW OPEN · EVERY TAKE KEPT THE SOUND OF THE STREET · NOTHING HERE WAS PLAYED TWICE THE SAME WAY · "
};

const defaultCabinet = {
  enabled: true,
  title: "Unindexed Materials",
  breadcrumb: "Systems / Recovered Entries",
  note: "Filed without origin.\nReferenced frequently,\nyet seldom cited in full.",
  date: "Mar 18, 1966",
  emptyHint: "Pull a file from the drawer",
  footer: "Systems. Archive exploration",
  shell: "#0b0b0b",
  drawer: "#1f42e0",
  paper: "#f4f1e6",
  ink: "#f2f2f2"
};

const defaultFiles = [
  {
    id: 1, title: "Fragment 17B", tab: "Varnell Collection", tabColor: "#c8281e", tabInk: "#ffffff",
    fileNo: "File №02", date: "Mar 18, 1966", headline: "Unverified",
    note: "Filed without origin.\nReferenced frequently,\nyet seldom cited in full.",
    margin: "Not dated. Referent unknown. Possible correlation to Entry 9D, though this remains speculative.",
    body: "There are signs of use: annotations, omissions, the pressure of someone else's urgency. No conclusion is evident, but the document resists being closed. It remains held in transit, not as an answer but as evidence of asking.",
    excerptTitle: "Excerpt A", excerptColor: "#f0a8b0",
    excerptBody: "The material arrives already altered — a trace shaped more by its journey than its point of departure. Interpretation loops back on itself, forming layers of intent and silence. Margins offer no certainty, only suggestion.",
    receipt: "TO: Elias Varnell\nDATE: Apr 11, 1966\n18 Obscura Lane, Sector A\nNew Cartesia, 0027-A", receiptColor: "#f2d64b",
    signature: "E. Varnell",
    sideTabs: [{ label: "Varnell Collection", color: "#c8281e" }, { label: "Peripheral Entry", color: "#123ad6" }]
  },
  {
    id: 2, title: "Entry 9D", tab: "Peripheral Entry", tabColor: "#123ad6", tabInk: "#ffffff",
    fileNo: "File №07", date: "Nov 02, 1964", headline: "Partial",
    note: "Recovered incomplete.\nTwo pages missing,\nnumbering unbroken.",
    margin: "Pagination continuous despite loss. Suggests removal was deliberate rather than accidental.",
    body: "What survives reads as the middle of an argument. The opening is gone and the conclusion was never filed, but the reasoning in between is unusually careful — the work of someone expecting to be read closely, and much later.",
    excerptTitle: "Excerpt B", excerptColor: "#c9d8b0",
    excerptBody: "A record kept honestly will contradict itself. That is not a fault in the record; it is the shape of a thing observed over time by someone who kept changing their mind.",
    receipt: "REF: 9D / PARTIAL\nLOGGED: Nov 02, 1964\nHELD: Cabinet 3, Drawer 2", receiptColor: "#e8cf7a",
    signature: "—",
    sideTabs: [{ label: "Peripheral Entry", color: "#123ad6" }]
  },
  {
    id: 3, title: "Note on Method", tab: "Working Notes", tabColor: "#e8a33d", tabInk: "#161616",
    fileNo: "File №11", date: "Jul 30, 1969", headline: "Working",
    note: "Not for circulation.\nKept with the drafts\nrather than the results.",
    margin: "Handwritten. Ink matches the annotations in Fragment 17B.",
    body: "The method was never written down properly because it kept changing. What is here is a description of habits: where to begin when nothing is labelled, what to do with a page that refuses to fit, and when to stop looking.",
    excerptTitle: "Excerpt C", excerptColor: "#dcd2ee",
    excerptBody: "Begin with what is out of place. The misfiled page tells you more about the system than the thousand pages sitting quietly where they belong.",
    receipt: "WORKING NOTES\nNOT INDEXED\nRETAIN WITH DRAFTS", receiptColor: "#f2d64b",
    signature: "unsigned",
    sideTabs: [{ label: "Working Notes", color: "#e8a33d" }]
  }
];

// The community-center figure, cut out of her paper background and
// embedded so the page has no external dependency.
const CC_FIGURE = "data:image/webp;base64,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";

const defaultLanding = {
  enabled: true,
  wordmark: "Ice",
  asciiBg: true,
  asciiSpeed: 1.6,
  asciiSize: 11,
  asciiOpacityLight: 0.34,  // on the cream panel
  asciiMask: "full",        // full | edges — 'edges' clears the middle
  asciiClear: 30,           // only used when asciiMask is 'edges'
  asciiInkLight: "",        // blank inherits from Ambient
  title: "Welcome to the archive.",
  subtitle: "Two doors. One leads to everything I've made and kept; the other to a room where you can leave something of your own.",
  primaryTitle: "Enter the archive",
  primarySub: "Projects, galleria, journals",
  secondaryTitle: "Community center",
  secondarySub: "Leave a note, vote, listen",
  footnote: "Nothing here asks you to sign in.",
  outer: "#0d0b09",
  paper: "#efece2",
  markBg: "#161310",
  markInk: "#efece2",
  cardBorder: "#161310",
  primaryBg: "#161310",
  primaryInk: "#efece2",
  secondaryBg: "#e4e0d3",
  secondaryInk: "#161310",
  stripes: ["#d9a441", "#c8742b", "#b8422a", "#8f2320"]
};

const defaultCommunity = {
  heroPre: "The",
  heroItalic: "community",
  heroPost: "center",
  heroSub: "Welcome to the center. Maybe you want a part in my life, but really this is just where I like to mess around and find out.",
  heroBg: "#faf7ed",
  heroInk: "#12100c",
  heroImage: CC_FIGURE,
  heroImagePos: "right",    // left | right | center
  heroImageSize: 34,        // % of viewport height
  scrollHint: "scroll",
  exitLabel: "Back",
  footBg: "#12100c",
  footNote: "The community center // open to anyone"
};

const defaultBoard = {
  enabled: true,
  title: "THE COMMUNITY BOARD",
  verticalTitle: "掲示板",
  kicker: "Anonymous // unmoderated // yours",
  sealMark: "印",
  blurb: "Pin anything. A thought, a recommendation, a complaint about the weather. Notes take Notion syntax, so you can format them properly.",
  pinLabel: "Pin a note",
  placeholder: "# A heading\n\nSomething **worth** saying.\n\n- a list\n- of things\n\n[ ] a box to tick",
  emptyText: "The board is empty. Be the first.",
  anonName: "anonymous",
  navLinks: "Home, About, Board, Contact",
  sectionA: "NOTES\nAND ASIDES",
  sectionAYears: "open call",
  sectionB: "PINNED\nBY VISITORS",
  sectionBYears: "unmoderated",
  bg: "#d9cfbc",
  ink: "#2b2620",
  seal: "#b4402f",
  maxLength: 600,
  noteColors: ["#f3ede1", "#e8dcc8", "#dfe6da", "#efdcd5", "#e3e0ea"]
};

const defaultSong = {
  enabled: true,
  heading: "SONG OF THE DAY",
  blurb: "Changed whenever something gets stuck in my head. No skipping.",
  bg: "#0d0d0f",
  vinylColor: "#1f5fd0",
  labelBg: "#0a0a12",
  labelImage: "",
  vinylImage: "",          // drop in a real render/photo for full realism
  albumTitle: "INNER BEAUTY",
  albumSub: "produced // played // pressed",
  catalogue: "RB1-27450\n33 1/3 RPM",
  side: "Record 1\nSide 1",
  link: "",
  linkLabel: "Listen",
  spin: true,
  tracks: [
    { id: 1, title: "West End Blues", credit: "Recorded 1928 · remastered", length: "3:01" },
    { id: 2, title: "Cantaloupe Island", credit: "Blue Note · 1964", length: "3:21" },
    { id: 3, title: "Flamenco Sketches", credit: "Columbia · 1959", length: "3:08" },
    { id: 4, title: "Sidewinder", credit: "Blue Note · 1963", length: "3:02" }
  ]
};

const defaultPoll = {
  enabled: true,
  heading: "Vote",
  blurb: "This is how it currently sits. Think you could do better? Drag each column as you see fit, then submit.",
  thanks: "Thanks — your vote is counted. The figures above are everyone's average.",
  submitLabel: "Submit vote",
  votedLabel: "Vote submitted",
  bg: "#2e211c",
  paper: "#efe9dc",
  accent: "#d9432f",
  submitColor: "#2f6fdb"
};

const defaultPollOptions = [
  { id: 1, label: "Men",     color: "#3f6fd0", seed: 10 },
  { id: 2, label: "Women",   color: "#d9432f", seed: 20 },
  { id: 3, label: "Places",  color: "#b9b2a4", seed: 5  },
  { id: 4, label: "Plants",  color: "#8fbf3f", seed: 25 },
  { id: 5, label: "Animals", color: "#efc63f", seed: 25 },
  { id: 6, label: "Other",   color: "#6b6459", seed: 15 }
];

const defaultAscii = {
  enabled: true,
  ramp: " .:-=+*#%@",
  size: 11,
  animate: true,
  speed: 1,
  inkOnLight: "#111111",
  inkOnDark: "#ffffff",
  // Deliberately low. These sit behind body copy; the texture is meant to
  // be felt at the edge of vision, not read.
  opacityLight: 0.07,
  opacityDark: 0.05,
  mask: "edges",   // 'edges' keeps the middle clear for text | 'full' | 'top'
  clear: 45        // % of the centre left completely free of glyphs
};

const defaultSecret = {
  enabled: true,
  title: "ice's secret corner",
  kicker: "unlisted // playing quietly",
  footer: "for no one in particular",
  favLabel: "favourites",
  // gramophone parlour palette
  bgColor: "#15100c",      // cabinet
  brass: "#c9a86a",        // tonearm, keys, accents
  textColor: "#ece0c8",
  mutedColor: "#8d7a5c",
  platterTilt: 56,         // degrees of perspective on the record
  passphrase: "ice",       // type this anywhere to open
  showGlyph: true,         // faint trigger in the poem overlay + journal
  autoAdvance: true
};

const defaultSecretTracks = [
  { id: 1, title: "untitled loop", artist: "unknown", length: "3:21", src: "", cover: "", note: "the one I put on when the room gets too quiet." }
];

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
  { id: 'secret',      label: 'Secret' },
  { id: 'ambient',     label: 'Ambient' },
  { id: 'system',      label: 'System' },
  { id: 'blogs',       label: 'Blogs' },
  { id: 'journals',    label: 'Journals' },
  { id: 'socials',     label: 'Socials' },
  { id: 'messages',    label: 'Messages' },
  { id: 'settings',    label: 'Settings' },
  { id: 'access_logs', label: 'Access Logs' },
];

const defaultSettings = {
  wip: { intro: false, portfolio: false, galleria: false, system: false, blog: false, socials: false, blank: false },
  // Replaces the old blueprint gridlines everywhere .bg-blueprint was used.
  backdrop: {
    mode: "topo",         // 'topo' contours | 'ascii' | 'grid' | 'image'
    asciiRamp: " .:-=+*#%@",
    asciiSize: 14,        // px per glyph cell
    // --- generated topographic field ---
    lineColor: "#111111",
    lineOpacity: 0.17,
    lineWidth: 1,
    levels: 12,           // number of contour rings
    detail: 14,           // px per sample cell — lower = finer, heavier
    scale: 0.5,           // terrain frequency (lower = broader landforms)
    octaves: 2,           // fbm roughness
    seed: 7,
    driftX: 0.5,          // lateral migration
    driftY: -0.2,
    morph: 0.35,          // how fast the terrain reshapes
    animate: true,
    majorEvery: 4,        // every Nth contour drawn heavier
    majorOpacity: 0.34,
    rings: true,          // pulsing focal rings
    ringColor: "#ff5722",
    ringOpacity: 0.13,
    nodePath: true,       // surveyed node polyline
    ticks: true,          // edge rulers
    globalLayer: true,    // also paint behind the whole page
    // --- image mode (optional alternative) ---
    image: "",
    size: "cover",
    position: "center",
    opacity: 0.5,
    blend: "multiply",
    grayscale: 0,
    // --- shared ---
    keepGrid: false,      // keep the old gridlines on top
    useTint: false,
    tint: "#e9e9e6"
  }
};

// Older saved payloads predate the boot/rack config, so merge defaults in on
// load rather than scattering fallbacks through the render tree.
const mergeAbout = (saved) => ({ ...defaultAbout, ...(saved || {}), boot: { ...defaultAbout.boot, ...((saved || {}).boot || {}) } });
const mergeSystem = (saved) => ({ ...defaultSystem, ...(saved || {}), cables: (saved || {}).cables || defaultSystem.cables });
const mergeSettings = (saved) => ({ ...defaultSettings, ...(saved || {}), wip: { ...defaultSettings.wip, ...((saved || {}).wip || {}) }, backdrop: { ...defaultSettings.backdrop, ...((saved || {}).backdrop || {}) } });
const mergeLightbox = (saved) => ({ ...defaultLightbox, ...(saved || {}), stickers: (saved || {}).stickers || defaultLightbox.stickers, metaRows: (saved || {}).metaRows || defaultLightbox.metaRows });
const mergeLanding = (saved) => ({ ...defaultLanding, ...(saved || {}), stripes: (saved || {}).stripes || defaultLanding.stripes });
const mergeCommunity = (saved) => {
  const merged = { ...defaultCommunity, ...(saved || {}) };
  // A config saved before the figure shipped carries heroImage: "", which
  // would otherwise beat the built-in default. Blank means "unset", not
  // "deliberately empty" — clearing it properly is done with the Remove
  // button in the panel, which writes null.
  if (merged.heroImage === '' || merged.heroImage === undefined) merged.heroImage = defaultCommunity.heroImage;
  if (merged.heroImage === null) merged.heroImage = '';
  return merged;
};
const mergeBoard = (saved) => ({ ...defaultBoard, ...(saved || {}), noteColors: (saved || {}).noteColors || defaultBoard.noteColors });
const mergeSong = (saved) => ({ ...defaultSong, ...(saved || {}), tracks: (saved || {}).tracks || defaultSong.tracks });
const mergePoll = (saved) => ({ ...defaultPoll, ...(saved || {}) });
const mergeAscii = (saved) => ({ ...defaultAscii, ...(saved || {}) });
const mergeOrbit = (saved) => ({ ...defaultOrbit, ...(saved || {}) });
const mergeDisc = (saved) => ({ ...defaultDisc, ...(saved || {}) });
const mergeCabinet = (saved) => ({ ...defaultCabinet, ...(saved || {}) });
const mergeSecret = (saved) => ({ ...defaultSecret, ...(saved || {}) });
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
  const [secretCfg, setSecretCfg] = useState(defaultSecret);
  const [secretTracks, setSecretTracks] = useState(defaultSecretTracks);
  const [secretOpen, setSecretOpen] = useState(false);
  const [asciiCfg, setAsciiCfg] = useState(defaultAscii);

  /* ---- landing + community center ---- */
  // 'landing' | 'site' | 'community'. Persisted for the session only, so a
  // refresh returns to the door but an in-page reload does not.
  const [route, setRoute] = useState(() => {
    try { return sessionStorage.getItem('cc_route') || 'landing'; } catch { return 'landing'; }
  });
  const [landingCfg, setLandingCfg] = useState(defaultLanding);
  const [communityCfg, setCommunityCfg] = useState(defaultCommunity);
  const [boardCfg, setBoardCfg] = useState(defaultBoard);
  const [songCfg, setSongCfg] = useState(defaultSong);
  const [pollCfg, setPollCfg] = useState(defaultPoll);
  const [pollOptions, setPollOptions] = useState(defaultPollOptions);
  const [boardNotes, setBoardNotes] = useState([]);
  const [postingNote, setPostingNote] = useState(false);
  const [ccEdit, setCcEdit] = useState(false);
  const [pollTally, setPollTally] = useState({});
  const [hasVoted, setHasVoted] = useState(() => {
    try { return !!localStorage.getItem('cc_voted'); } catch { return false; }
  });
  const [orbitCfg, setOrbitCfg] = useState(defaultOrbit);
  const [discCfg, setDiscCfg] = useState(defaultDisc);
  const [cabinetCfg, setCabinetCfg] = useState(defaultCabinet);
  const [cabinetFiles, setCabinetFiles] = useState(defaultFiles);
  const [openFile, setOpenFile] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
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

  /* The passphrase. Typing it anywhere on the site (outside a text
     field) opens the corner. Keeps a rolling buffer only as long as the
     phrase itself, so it costs nothing. */
  const keyBuf = useRef('');
  useEffect(() => {
    const phrase = (secretCfg.passphrase || '').toLowerCase();
    if (!secretCfg.enabled || !phrase) return;
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.length !== 1) return;
      keyBuf.current = (keyBuf.current + e.key.toLowerCase()).slice(-phrase.length);
      if (keyBuf.current === phrase) { keyBuf.current = ''; setSecretOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [secretCfg.enabled, secretCfg.passphrase]);

  // Deferred fetches. Each runs at most once, the first time the tab that
  // needs it is opened. Keeps ~2 round trips and an unbounded row count off
  // the critical path.
  const fetchedMessages = useRef(false);
  const fetchedLogs = useRef(false);

  const ensureMessages = useCallback(async () => {
    if (!supabase || fetchedMessages.current) return;
    fetchedMessages.current = true;
    try {
      const { data } = await supabase
        .from('playground_messages').select('*')
        .order('created_at', { ascending: false }).limit(200);
      if (data) setGuestMessages(data);
    } catch (e) { console.error('messages load failed', e); }
  }, []);

  const ensureAccessLogs = useCallback(async () => {
    if (!supabase || fetchedLogs.current) return;
    fetchedLogs.current = true;
    try {
      const { data } = await supabase
        .from('journal_access_logs').select('*')
        .order('created_at', { ascending: false }).limit(200);
      if (data) setAccessLogs(data);
    } catch (e) { /* table may not exist; non-fatal */ }
  }, []);

  useEffect(() => { if (activeTab === 'blank') ensureMessages(); }, [activeTab, ensureMessages]);
  useEffect(() => { if (isAdmin && adminTab === 'access_logs') ensureAccessLogs(); }, [isAdmin, adminTab, ensureAccessLogs]);
  useEffect(() => { if (isAdmin && adminTab === 'messages') ensureMessages(); }, [isAdmin, adminTab, ensureMessages]);

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
            if (parsed.secret) setSecretCfg(mergeSecret(parsed.secret));
            if (parsed.secret_tracks) setSecretTracks(parsed.secret_tracks);
            if (parsed.ascii) setAsciiCfg(mergeAscii(parsed.ascii));
            if (parsed.landing) setLandingCfg(mergeLanding(parsed.landing));
            if (parsed.community) setCommunityCfg(mergeCommunity(parsed.community));
            if (parsed.board) setBoardCfg(mergeBoard(parsed.board));
            if (parsed.song) setSongCfg(mergeSong(parsed.song));
            if (parsed.poll) setPollCfg(mergePoll(parsed.poll));
            if (parsed.poll_options) setPollOptions(parsed.poll_options);
            if (parsed.orbit) setOrbitCfg(mergeOrbit(parsed.orbit));
            if (parsed.disc) setDiscCfg(mergeDisc(parsed.disc));
            if (parsed.cabinet) setCabinetCfg(mergeCabinet(parsed.cabinet));
            if (parsed.cabinet_files) setCabinetFiles(parsed.cabinet_files);
            if (parsed.access_logs) setAccessLogs(parsed.access_logs);
          } catch(e) { console.error("Failed to parse local data", e); }
        }
        setIsLoading(false);
        return;
      }

      // 2. SUPABASE DB LOAD (If configured)
      try {
        // Session and content are independent, so they go out together
        // instead of costing two serial round trips. Guest messages and
        // access logs are NOT fetched here — they belong to the sandbox
        // and admin tabs, and are loaded on demand (see ensureMessages /
        // ensureAccessLogs) so they never delay first paint.
        const [authRes, siteRes] = await Promise.all([
          supabase.auth.getSession(),
          supabase.from('site_data').select('section,data')
        ]);

        if (authRes?.data?.session) setIsAdmin(true);
        const siteData = siteRes?.data;
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
          const sc = siteData.find(d => d.section === 'secret');
          const st = siteData.find(d => d.section === 'secret_tracks');
          const ax = siteData.find(d => d.section === 'ascii');
          const ld = siteData.find(d => d.section === 'landing');
          const cm = siteData.find(d => d.section === 'community');
          const bd = siteData.find(d => d.section === 'board');
          const sg = siteData.find(d => d.section === 'song');
          const po = siteData.find(d => d.section === 'poll');
          const pop = siteData.find(d => d.section === 'poll_options');
          const ob = siteData.find(d => d.section === 'orbit');
          const dc = siteData.find(d => d.section === 'disc');
          const cb = siteData.find(d => d.section === 'cabinet');
          const cf = siteData.find(d => d.section === 'cabinet_files');
          
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
          if (sc) setSecretCfg(mergeSecret(sc.data));
          if (st) setSecretTracks(st.data);
          if (ax) setAsciiCfg(mergeAscii(ax.data));
          if (ld) setLandingCfg(mergeLanding(ld.data));
          if (cm) setCommunityCfg(mergeCommunity(cm.data));
          if (bd) setBoardCfg(mergeBoard(bd.data));
          if (sg) setSongCfg(mergeSong(sg.data));
          if (po) setPollCfg(mergePoll(po.data));
          if (pop) setPollOptions(pop.data);
          if (ob) setOrbitCfg(mergeOrbit(ob.data));
          if (dc) setDiscCfg(mergeDisc(dc.data));
          if (cb) setCabinetCfg(mergeCabinet(cb.data));
          if (cf) setCabinetFiles(cf.data);
        }

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

  /* ------------------------------------------------------------------
     IMAGE INTAKE
     Previously this stored the raw file as a base64 data URL straight
     into the JSONB row. Base64 inflates bytes by ~33%, and every one of
     those images was then re-fetched on every page load and re-uploaded
     on every save — a handful of photos was megabytes on the critical
     path.

     Now: downscale + re-encode in the browser first (a 2MB phone photo
     lands around 120-180KB), then, if a Supabase Storage bucket is
     reachable, upload the file and keep only its URL in the row. If
     Storage isn't set up, we fall back to the compressed data URL, which
     is still an order of magnitude smaller than before.
     ------------------------------------------------------------------ */
  const MEDIA_BUCKET = 'media';
  const storageOK = useRef(null); // null = untested, false = unavailable

  const compressImage = (file, maxEdge = 1600, quality = 0.82) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      // WebP where the browser supports it, JPEG otherwise. PNGs with
      // transparency keep their alpha channel via WebP.
      const webp = cv.toDataURL('image/webp', quality);
      const dataUrl = webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/jpeg', quality);
      cv.toBlob(
        (blob) => resolve({ dataUrl, blob, type: dataUrl.slice(5, dataUrl.indexOf(';')) }),
        dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });

  const handleImageUpload = async (e, callback) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast("That doesn't look like an image."); return; }
    if (file.size > 1024 * 1024 * 12) { showToast("Please choose an image smaller than 12MB."); return; }
    // Let the same file be picked again later
    const input = e.target;

    try {
      const { dataUrl, blob, type } = await compressImage(file);

      if (supabase && storageOK.current !== false && blob) {
        try {
          const ext = type === 'image/webp' ? 'webp' : 'jpg';
          const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error } = await supabase.storage.from(MEDIA_BUCKET)
            .upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
          if (error) throw error;
          const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
          if (data?.publicUrl) {
            storageOK.current = true;
            callback(data.publicUrl);
            input.value = '';
            return;
          }
        } catch (err) {
          // Bucket missing or not public — stop trying for this session.
          storageOK.current = false;
          console.warn(`Supabase Storage unavailable (bucket "${MEDIA_BUCKET}"), embedding compressed image instead.`, err?.message || err);
        }
      }

      callback(dataUrl);
      input.value = '';
    } catch (err) {
      console.error(err);
      showToast("Couldn't process that image.");
    }
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
        secret: secretCfg,
        secret_tracks: secretTracks,
        ascii: asciiCfg,
        landing: landingCfg,
        community: communityCfg,
        board: boardCfg,
        song: songCfg,
        poll: pollCfg,
        poll_options: pollOptions,
        orbit: orbitCfg,
        disc: discCfg,
        cabinet: cabinetCfg,
        cabinet_files: cabinetFiles,
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
      { section: 'poems', data: poems },
      { section: 'secret', data: secretCfg },
      { section: 'secret_tracks', data: secretTracks },
      { section: 'ascii', data: asciiCfg },
      { section: 'landing', data: landingCfg },
      { section: 'community', data: communityCfg },
      { section: 'board', data: boardCfg },
      { section: 'song', data: songCfg },
      { section: 'poll', data: pollCfg },
      { section: 'poll_options', data: pollOptions },
      { section: 'orbit', data: orbitCfg },
      { section: 'disc', data: discCfg },
      { section: 'cabinet', data: cabinetCfg },
      { section: 'cabinet_files', data: cabinetFiles }
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
    secret_tracks: [secretTracks, setSecretTracks],
    cabinet_files: [cabinetFiles, setCabinetFiles],
    poll_options: [pollOptions, setPollOptions],
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

  const goPrevPlate = () => setActiveGalleriaImage(p => {
    if (!p || !galleriaData.length) return p;
    const n = (p.index - 1 + galleriaData.length) % galleriaData.length;
    return { item: galleriaData[n], index: n };
  });
  const goNextPlate = () => setActiveGalleriaImage(p => {
    if (!p || !galleriaData.length) return p;
    const n = (p.index + 1) % galleriaData.length;
    return { item: galleriaData[n], index: n };
  });

  /* ---------- SECRET CORNER WRITERS ---------- */
  const setSecret = (patch) => setSecretCfg(c => ({ ...c, ...patch }));
  const updateTrack = (id, patch) => setSecretTracks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
  const addTrack = () => setSecretTracks(ts => [...ts, { id: Date.now(), title: "", artist: "", length: "", src: "", cover: "", note: "" }]);

  // Audio always goes to Storage — a song as base64 would be several MB
  // inside a row that is fetched on every single page load.
  const handleAudioUpload = async (e, callback) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;
    if (!supabase) { showToast("Connect Supabase to upload audio, or paste a URL."); input.value = ''; return; }
    if (file.size > 1024 * 1024 * 25) { showToast("Audio must be under 25MB."); input.value = ''; return; }
    showToast("Uploading track…");
    try {
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      const path = `audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type || 'audio/mpeg', cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('no public url');
      callback(data.publicUrl);
      showToast("Track uploaded.", 'success');
    } catch (err) {
      console.error(err);
      showToast(`Upload failed — create a public "${MEDIA_BUCKET}" bucket, or paste a direct URL.`);
    }
    input.value = '';
  };

  /* ==================================================================
     COMMUNITY DATA — notes and votes
     These are written by visitors, not by the admin, so they live in
     their own tables rather than the site_data blob. If Supabase isn't
     configured they fall back to localStorage, which keeps the feature
     working locally even though it is then per-browser.
     ================================================================== */
  const NOTES_KEY = 'cc_notes_local';
  const VOTES_KEY = 'cc_votes_local';
  const fetchedCommunity = useRef(false);

  const readLocal = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
  const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const tallyFrom = useCallback((rows) => {
    const out = {};
    (rows || []).forEach(r => {
      const id = r.option_id;
      if (id === undefined || id === null) return;
      if (!out[id]) out[id] = { sum: 0, n: 0 };
      out[id].sum += Number(r.value) || 0;
      out[id].n += 1;
    });
    return out;
  }, []);

  const loadCommunity = useCallback(async () => {
    if (fetchedCommunity.current) return;
    fetchedCommunity.current = true;

    if (!supabase) {
      setBoardNotes(readLocal(NOTES_KEY));
      setPollTally(tallyFrom(readLocal(VOTES_KEY)));
      return;
    }
    try {
      const [notesRes, votesRes] = await Promise.all([
        supabase.from('community_notes').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('community_votes').select('option_id,value')
      ]);
      setBoardNotes(notesRes?.data || readLocal(NOTES_KEY));
      setPollTally(tallyFrom(votesRes?.data || readLocal(VOTES_KEY)));
    } catch (e) {
      // Tables may not exist yet — fall back rather than breaking the page.
      console.warn('community tables unavailable, using local storage', e?.message || e);
      setBoardNotes(readLocal(NOTES_KEY));
      setPollTally(tallyFrom(readLocal(VOTES_KEY)));
    }
  }, [tallyFrom]);

  useEffect(() => { if (route === 'community') loadCommunity(); }, [route, loadCommunity]);

  const postNote = async ({ text, author, color }) => {
    if (!text?.trim()) return;
    setPostingNote(true);
    const row = {
      id: `local-${Date.now()}`,
      text: text.trim(),
      author: (author || '').trim(),
      color,
      created_at: new Date().toISOString()
    };
    // Optimistic: the note appears immediately, then reconciles.
    setBoardNotes(prev => [row, ...prev]);

    if (supabase) {
      try {
        const { data, error } = await supabase.from('community_notes')
          .insert([{ text: row.text, author: row.author, color: row.color }]).select();
        if (error) throw error;
        if (data?.[0]) setBoardNotes(prev => [data[0], ...prev.filter(n => n.id !== row.id)]);
        showToast('Pinned to the board.', 'success');
        setPostingNote(false);
        return;
      } catch (e) {
        console.warn('note insert failed, keeping locally', e?.message || e);
      }
    }
    const local = [row, ...readLocal(NOTES_KEY)].slice(0, 200);
    writeLocal(NOTES_KEY, local);
    showToast('Pinned locally.', 'success');
    setPostingNote(false);
  };

  const castVote = async (distribution) => {
    const rows = Object.entries(distribution || {}).map(([option_id, value]) => ({
      option_id: isNaN(Number(option_id)) ? option_id : Number(option_id),
      value: Math.max(0, Math.min(100, Number(value) || 0))
    }));
    if (!rows.length) return;

    // Reflect the new vote in the running average straight away.
    setPollTally(prev => {
      const next = { ...prev };
      rows.forEach(r => {
        const cur = next[r.option_id] || { sum: 0, n: 0 };
        next[r.option_id] = { sum: cur.sum + r.value, n: cur.n + 1 };
      });
      return next;
    });
    setHasVoted(true);
    try { localStorage.setItem('cc_voted', '1'); } catch {}

    if (supabase) {
      try {
        const { error } = await supabase.from('community_votes').insert(rows);
        if (error) throw error;
        showToast('Vote counted.', 'success');
        return;
      } catch (e) {
        console.warn('vote insert failed, keeping locally', e?.message || e);
      }
    }
    writeLocal(VOTES_KEY, [...readLocal(VOTES_KEY), ...rows]);
    showToast('Vote saved locally.', 'success');
  };

  const goRoute = (r) => {
    setRoute(r);
    try { sessionStorage.setItem('cc_route', r); } catch {}
    // The landing and community views are their own scroll containers, so
    // reset both the window and (after paint) the overlay itself.
    try { window.scrollTo(0, 0); } catch {}
    requestAnimationFrame(() => {
      document.querySelector('[data-cc-scroll]')?.scrollTo?.({ top: 0 });
    });
  };

  /* ---------- COMMUNITY WRITERS (admin) ---------- */
  const setLanding = (patch) => setLandingCfg(c => ({ ...c, ...patch }));
  const setCommunity = (patch) => setCommunityCfg(c => ({ ...c, ...patch }));
  const setBoard = (patch) => setBoardCfg(c => ({ ...c, ...patch }));
  const setSong = (patch) => setSongCfg(c => ({ ...c, ...patch }));
  const setPoll = (patch) => setPollCfg(c => ({ ...c, ...patch }));
  const updateSongTrack = (id, patch) => setSongCfg(c => ({ ...c, tracks: (c.tracks || []).map(t => t.id === id ? { ...t, ...patch } : t) }));
  const addSongTrack = () => setSongCfg(c => ({ ...c, tracks: [...(c.tracks || []), { id: Date.now(), title: '', credit: '', length: '' }] }));
  const removeSongTrack = (id) => setSongCfg(c => ({ ...c, tracks: (c.tracks || []).filter(t => t.id !== id) }));
  const updatePollOption = (id, patch) => setPollOptions(os => os.map(o => o.id === id ? { ...o, ...patch } : o));
  const addPollOption = () => setPollOptions(os => [...os, { id: Date.now(), label: 'New option', color: '#8a8a8a', seed: 0 }]);

  const deleteNote = async (id) => {
    setBoardNotes(prev => prev.filter(n => n.id !== id));
    if (supabase && !String(id).startsWith('local-')) {
      try { await supabase.from('community_notes').delete().eq('id', id); } catch (e) { console.warn(e); }
    }
    writeLocal(NOTES_KEY, readLocal(NOTES_KEY).filter(n => n.id !== id));
  };

  const resetVotes = async () => {
    setPollTally({});
    setHasVoted(false);
    try { localStorage.removeItem('cc_voted'); } catch {}
    writeLocal(VOTES_KEY, []);
    if (supabase) {
      try { await supabase.from('community_votes').delete().neq('option_id', '___none___'); } catch (e) { console.warn(e); }
    }
    showToast('Votes cleared.', 'success');
  };

  /* ---------- AMBIENT WRITERS ---------- */
  const setAscii = (patch) => setAsciiCfg(c => ({ ...c, ...patch }));
  const setOrbit = (patch) => setOrbitCfg(c => ({ ...c, ...patch }));
  const setDisc = (patch) => setDiscCfg(c => ({ ...c, ...patch }));
  const setCabinet = (patch) => setCabinetCfg(c => ({ ...c, ...patch }));
  const updateFile = (id, patch) => setCabinetFiles(fs => fs.map(f => f.id === id ? { ...f, ...patch } : f));
  const addFile = () => {
    const id = Date.now();
    setCabinetFiles(fs => [...fs, {
      id, title: "New File", tab: "Unfiled", tabColor: "#c8281e", tabInk: "#ffffff",
      fileNo: "File №--", date: "", headline: "Untitled", note: "", margin: "",
      body: "", excerptTitle: "Excerpt", excerptColor: "#f0a8b0", excerptBody: "",
      receipt: "", receiptColor: "#f2d64b", signature: "", sideTabs: []
    }]);
    setExpandedFile(id);
  };

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
    if (listType === 'secret_tracks') setSecretTracks(secretTracks.filter(t => t.id !== id));
    if (listType === 'cabinet_files') setCabinetFiles(cabinetFiles.filter(f => f.id !== id));
    if (listType === 'poll_options') setPollOptions(pollOptions.filter(o => o.id !== id));
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
  }, [aboutData, projects, blogs, socials, galleriaData, systemData, siteSettings, journalEntries, playlists, lightboxConfig, poemDeck, poems, secretCfg, secretTracks, asciiCfg, landingCfg, communityCfg, boardCfg, songCfg, pollCfg, pollOptions, orbitCfg, discCfg, cabinetCfg, cabinetFiles, isLoading]);

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
        if (secretOpen) return setSecretOpen(false);
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
    const locked = !!(selectedItem || showLogin || pendingJournal || activeJournal || activeGalleriaImage || activePoem || secretOpen || route === 'landing' || route === 'community');
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedItem, showLogin, pendingJournal, activeJournal, activeGalleriaImage, activePoem, secretOpen, route]);

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
  const backdropCfg = useMemo(
    () => ({ ...defaultSettings.backdrop, ...(siteSettings.backdrop || {}) }),
    [siteSettings.backdrop]
  );

  const backdropVars = useMemo(() => {
    const bd = backdropCfg;
    const grid = 'linear-gradient(rgba(17,17,17,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.08) 1px, transparent 1px)';
    const hasImg = bd.mode === 'image' && !!bd.image;
    const showGrid = bd.mode === 'grid' || bd.keepGrid;
    const repeating = bd.size === 'repeat';
    // Tint rides along as a flat gradient layer so a panel's own bg-white /
    // bg-[#e5e5e5] class survives when the tint is switched off.
    const layers = [
      bd.useTint ? `linear-gradient(${bd.tint || 'transparent'}, ${bd.tint || 'transparent'})` : null,
      showGrid ? grid : null
    ].filter(Boolean).join(', ') || 'none';
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
  }, [backdropCfg]);

  // One merged object so every consumer (canvas + CSS vars) agrees.
  const topoOn = backdropCfg.mode === 'topo' || backdropCfg.mode === 'ascii';

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
                      <span className="min-w-0 break-words">{line}</span>
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
                          <img loading="lazy" decoding="async" src={aboutData.introImage} alt="Intro" className="w-full grayscale img-reveal" />
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
                            <img loading="lazy" decoding="async" src={friend.image} alt={friend.name} className="w-full h-full object-cover grayscale img-reveal" />
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
                                <img loading="lazy" decoding="async" src={interest.image} alt={interest.title} className="w-full aspect-video object-cover grayscale img-reveal" />
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
                          <div className="flex justify-between items-start px-4 py-2 bg-[#111] border-b-[2px] border-[#222] gap-3">
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] min-w-0 break-all" style={{ color: bootAccent }}>
                              {archive}/{slug}/
                            </span>
                            <span className="font-mono text-[9px] text-white/35 whitespace-nowrap shrink-0">{items.length} items</span>
                          </div>
                          <div className="p-3 md:p-4 font-mono text-[10px] md:text-[11px]">
                            <p className="text-white/30 mb-2">total {items.length * 4}</p>
                            {items.map((item, i) => (
                              /* The permission/size/index columns stay fixed and the title
                                 takes the remaining width and wraps — long track names used
                                 to be clipped to an ellipsis with no way to read them. */
                              <div key={i} className="flex gap-3 items-baseline hover:bg-white/5 px-1 -mx-1 transition-colors group">
                                <span className="text-white/25 hidden sm:inline shrink-0">-rw-r--r--</span>
                                <span className="text-white/25 hidden md:inline w-8 text-right shrink-0">{4 + i}k</span>
                                <span className="text-white/40 w-6 text-right shrink-0">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-white/90 min-w-0 flex-1 break-words group-hover:text-[#dfff00] transition-colors">{item}</span>
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
                {topoOn && <TopoField cfg={backdropCfg} />}
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
              {topoOn && <TopoField cfg={backdropCfg} />}
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
                            <img loading="lazy" decoding="async" src={img.image} className="h-full w-auto max-w-none grayscale group-hover:grayscale-0 transition-all duration-[600ms] block" alt="galleria" />
                            
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

            {/* ===== AMBIENT BOXES (under galleria, above the audio section) ===== */}
            {(orbitCfg.enabled || discCfg.enabled) && (
              <div className="w-full grid lg:grid-cols-2 gap-6">
                {orbitCfg.enabled && (
                  <div className="anim-rise min-w-0">
                    <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-3 mb-4 gap-3">
                      <h3 className="text-2xl md:text-3xl font-serif text-[#111] tracking-tight min-w-0 break-words">{orbitCfg.heading}</h3>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500 shrink-0">{orbitCfg.kicker}</span>
                    </div>
                    <div className="border-[2px] border-[#111] shadow-[8px_8px_0px_#111] overflow-hidden">
                      <TextOrbit cfg={orbitCfg} />
                    </div>
                  </div>
                )}
                {discCfg.enabled && (
                  <div className="anim-rise min-w-0">
                    <div className="flex justify-between items-end border-b-[2px] border-[#111] pb-3 mb-4 gap-3">
                      <h3 className="text-2xl md:text-3xl font-serif text-[#111] tracking-tight min-w-0 break-words">{discCfg.heading}</h3>
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-500 shrink-0">{discCfg.kicker}</span>
                    </div>
                    <div className="border-[2px] border-[#111] shadow-[8px_8px_0px_#111] overflow-hidden">
                      <TextDisc cfg={discCfg} />
                    </div>
                  </div>
                )}
              </div>
            )}

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
                            {pl.image && <img loading="lazy" decoding="async" src={pl.image} alt={pl.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 text-transparent" />}
                            {/* CSS Gradient dynamically bound to the configured hex color */}
                            <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(to bottom, transparent 10%, ${pl.color || '#333'} 100%)` }}></div>
                         </div>
                         
                         {/* Text Content Area */}
                         <div className="px-8 pb-8 pt-0 flex-1 flex flex-col relative z-10">
                            {/* Title & Genre Tag */}
                            <div className="flex justify-between items-center mb-4 gap-4">
                               <h3 className="font-sans font-bold text-2xl tracking-tight min-w-0 break-words">{pl.title}</h3>
                               {pl.genre && <span className="font-sans text-[11px] font-bold tracking-wider bg-black/40 px-3 py-1.5 rounded-full shrink-0">{pl.genre}</span>}
                            </div>
                            
                            {/* Description */}
                            {/* Not clamped: the playlist card has no detail view, so
                                anything hidden here would be unreachable entirely. */}
                            <p className="font-sans text-sm text-white/70 leading-relaxed mb-6 flex-1 break-words">{pl.description}</p>
                            
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

            {/* ===== RECOVERED FILES ===== */}
            {cabinetCfg.enabled && (
              <div className="w-full mt-10 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] overflow-hidden anim-rise">
                <FileCabinet
                  cfg={cabinetCfg}
                  files={cabinetFiles}
                  openId={openFile}
                  onOpen={setOpenFile}
                  ascii={asciiCfg}
                />
              </div>
            )}
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
                                     <img loading="lazy" decoding="async" src={post.coverImage} className={`w-full h-full object-cover grayscale img-reveal ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'img-duotone' : ''}`} alt="cover"/>
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
                                     <span title={album.title} className="font-mono text-xs font-bold uppercase tracking-widest text-[#111] truncate w-full pl-3 group-hover:text-[#ff5722] transition-colors">{album.title}</span>
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
                                <img loading="lazy" decoding="async" src={post.coverImage} className={`w-full h-[60%] object-cover transition-transform duration-700 group-hover:scale-105 ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'img-duotone opacity-80' : ''}`} alt={post.title} />
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
                                 <img loading="lazy" decoding="async" src={post.coverImage} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${post.imageEffect === 'duotone' || post.imageEffect === 'both' ? 'mix-blend-multiply grayscale contrast-[1.2]' : ''}`} alt={post.title} />
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
                    {topoOn && <TopoField cfg={backdropCfg} />}
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
                      {social.image ? <img loading="lazy" decoding="async" src={social.image} alt={social.name} className="w-full h-full object-cover grayscale img-reveal" /> : <span className="font-mono text-[#111] text-xs font-bold">MISSING_IMG</span>}
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
                                    <img loading="lazy" decoding="async" src={block.image} className="w-full h-32 object-cover border-[2px] border-[#111] mb-2" alt="block"/>
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
                        <img loading="lazy" decoding="async" src={editingItem.image} alt="preview" className="w-full h-28 object-cover border-[2px] border-[#111] grayscale" />
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
                        <p className="font-mono text-sm text-gray-600">Fills every surface that used to show blueprint gridlines — galleria stage, project sheets, journal body, sandbox — plus the page behind the window.</p>
                      </div>
                      <div className="flex gap-2">
                        {[['topo','Contours'],['ascii','ASCII'],['grid','Gridlines'],['image','Image']].map(([m, label]) => (
                          <button key={m} onClick={() => setBackdrop({ mode: m })}
                                  className={`font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-[#111] slide-press ${backdropCfg.mode === m ? 'bg-[#111] text-[#dfff00]' : 'bg-white'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8">
                      <div className="space-y-6">

                         {/* ===== TOPO MODE ===== */}
                         {backdropCfg.mode === 'topo' && (
                           <>
                             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Line Colour</label>
                                  <div className="flex gap-2">
                                    <input type="color" value={backdropCfg.lineColor} onChange={e => setBackdrop({ lineColor: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                                    <input value={backdropCfg.lineColor} onChange={e => setBackdrop({ lineColor: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Line Opacity ({Math.round(backdropCfg.lineOpacity * 100)}%)</label>
                                  <input type="range" min="0.02" max="1" step="0.02" value={backdropCfg.lineOpacity} onChange={e => setBackdrop({ lineOpacity: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Line Weight ({backdropCfg.lineWidth}px)</label>
                                  <input type="range" min="0.4" max="3" step="0.1" value={backdropCfg.lineWidth} onChange={e => setBackdrop({ lineWidth: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Contour Count ({backdropCfg.levels})</label>
                                  <input type="range" min="3" max="40" value={backdropCfg.levels} onChange={e => setBackdrop({ levels: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                             </div>

                             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t-[2px] border-[#111] pt-5">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Detail ({backdropCfg.detail}px cells)</label>
                                  <input type="range" min="8" max="48" value={backdropCfg.detail} onChange={e => setBackdrop({ detail: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                  <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400 mt-1">Lower = smoother curves, more CPU</p>
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Terrain Scale ({backdropCfg.scale}×)</label>
                                  <input type="range" min="0.2" max="3" step="0.1" value={backdropCfg.scale} onChange={e => setBackdrop({ scale: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Roughness ({backdropCfg.octaves} oct)</label>
                                  <input type="range" min="1" max="5" value={backdropCfg.octaves} onChange={e => setBackdrop({ octaves: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Seed</label>
                                  <div className="flex gap-2">
                                    <input type="number" value={backdropCfg.seed} onChange={e => setBackdrop({ seed: parseInt(e.target.value) || 0 })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    <button onClick={() => setBackdrop({ seed: Math.floor(Math.random() * 999) })} title="New terrain" className="p-2.5 bg-white border-[2px] border-[#111] hover:bg-[#dfff00] transition-colors"><RotateCcw size={14}/></button>
                                  </div>
                                </div>
                             </div>

                             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t-[2px] border-[#111] pt-5">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Drift X ({backdropCfg.driftX})</label>
                                  <input type="range" min="-3" max="3" step="0.1" value={backdropCfg.driftX} onChange={e => setBackdrop({ driftX: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Drift Y ({backdropCfg.driftY})</label>
                                  <input type="range" min="-3" max="3" step="0.1" value={backdropCfg.driftY} onChange={e => setBackdrop({ driftY: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Morph ({backdropCfg.morph})</label>
                                  <input type="range" min="0" max="2" step="0.05" value={backdropCfg.morph} onChange={e => setBackdrop({ morph: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Index Line Every ({backdropCfg.majorEvery || 'off'})</label>
                                  <input type="range" min="0" max="8" value={backdropCfg.majorEvery} onChange={e => setBackdrop({ majorEvery: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                             </div>

                             <div className="flex flex-wrap items-center gap-3 border-t-[2px] border-[#111] pt-5">
                                {[['animate','Animate'],['rings','Focal Rings'],['nodePath','Node Path'],['ticks','Edge Rulers'],['globalLayer','Behind Page'],['keepGrid','Keep Gridlines']].map(([k, label]) => (
                                  <label key={k} className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${backdropCfg[k] ? 'bg-[#dfff00]' : 'bg-white'}`}>
                                    <input type="checkbox" className="hidden" checked={!!backdropCfg[k]} onChange={e => setBackdrop({ [k]: e.target.checked })} />
                                    {backdropCfg[k] ? <Check size={14}/> : <X size={14}/>} {label}
                                  </label>
                                ))}
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold uppercase text-gray-500">Ring</span>
                                  <input type="color" value={backdropCfg.ringColor} onChange={e => setBackdrop({ ringColor: e.target.value })} className="w-12 h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                                </div>
                             </div>
                           </>
                         )}

                         {/* ===== ASCII MODE ===== */}
                         {backdropCfg.mode === 'ascii' && (
                           <>
                             <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Glyph Colour</label>
                                  <div className="flex gap-2">
                                    <input type="color" value={backdropCfg.lineColor} onChange={e => setBackdrop({ lineColor: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                                    <input value={backdropCfg.lineColor} onChange={e => setBackdrop({ lineColor: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Opacity ({Math.round(backdropCfg.lineOpacity * 100)}%)</label>
                                  <input type="range" min="0.02" max="1" step="0.02" value={backdropCfg.lineOpacity} onChange={e => setBackdrop({ lineOpacity: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Glyph Size ({backdropCfg.asciiSize}px)</label>
                                  <input type="range" min="8" max="40" value={backdropCfg.asciiSize} onChange={e => setBackdrop({ asciiSize: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Seed</label>
                                  <div className="flex gap-2">
                                    <input type="number" value={backdropCfg.seed} onChange={e => setBackdrop({ seed: parseInt(e.target.value) || 0 })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                    <button onClick={() => setBackdrop({ seed: Math.floor(Math.random() * 999) })} title="New field" className="p-2.5 bg-white border-[2px] border-[#111] hover:bg-[#dfff00] transition-colors"><RotateCcw size={14}/></button>
                                  </div>
                                </div>
                             </div>
                             <div>
                               <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Character Ramp — sparse to dense</label>
                               <input value={backdropCfg.asciiRamp} onChange={e => setBackdrop({ asciiRamp: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                               <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400 mt-1">Leading spaces stay blank. Try ".:-=+*#%@" or "01" or "░▒▓█"</p>
                             </div>
                             <div className="grid sm:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Field Scale ({backdropCfg.scale}×)</label>
                                  <input type="range" min="0.2" max="3" step="0.1" value={backdropCfg.scale} onChange={e => setBackdrop({ scale: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Drift X ({backdropCfg.driftX})</label>
                                  <input type="range" min="-3" max="3" step="0.1" value={backdropCfg.driftX} onChange={e => setBackdrop({ driftX: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Morph ({backdropCfg.morph})</label>
                                  <input type="range" min="0" max="2" step="0.05" value={backdropCfg.morph} onChange={e => setBackdrop({ morph: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                                </div>
                             </div>
                             <label className={`inline-flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${backdropCfg.animate ? 'bg-[#dfff00]' : 'bg-white'}`}>
                               <input type="checkbox" className="hidden" checked={!!backdropCfg.animate} onChange={e => setBackdrop({ animate: e.target.checked })} />
                               {backdropCfg.animate ? <Check size={14}/> : <X size={14}/>} Animate
                             </label>
                           </>
                         )}

                         {/* ===== IMAGE MODE ===== */}
                         {backdropCfg.mode === 'image' && (
                           <>
                             <div>
                               <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Backdrop Image</label>
                               <div className="flex">
                                 <input value={backdropCfg.image || ''} onChange={e => setBackdrop({ image: e.target.value })} placeholder="https://… or upload" className="flex-1 p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                                 <label className="cursor-pointer bg-[#111] text-white px-6 flex items-center font-bold font-mono text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111]">
                                   <Upload size={16} className="mr-2"/> UPLOAD
                                   <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setBackdrop({ image: b }))} />
                                 </label>
                               </div>
                             </div>
                             <div className="grid sm:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Fit</label>
                                  <select value={backdropCfg.size} onChange={e => setBackdrop({ size: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                    <option value="cover">Cover</option><option value="contain">Contain</option><option value="repeat">Tile</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Position</label>
                                  <select value={backdropCfg.position} onChange={e => setBackdrop({ position: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                    {['center','top','bottom','left','right','top left','top right','bottom left','bottom right'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Blend</label>
                                  <select value={backdropCfg.blend} onChange={e => setBackdrop({ blend: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs uppercase bg-white outline-none">
                                    {['normal','multiply','luminosity','overlay','soft-light','darken'].map(v => <option key={v} value={v}>{v}</option>)}
                                  </select>
                                </div>
                             </div>
                             <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Opacity ({Math.round((backdropCfg.opacity ?? 1) * 100)}%)</label>
                                  <input type="range" min="0" max="1" step="0.05" value={backdropCfg.opacity ?? 1} onChange={e => setBackdrop({ opacity: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                                </div>
                                <div>
                                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Grayscale ({backdropCfg.grayscale ?? 0}%)</label>
                                  <input type="range" min="0" max="100" value={backdropCfg.grayscale ?? 0} onChange={e => setBackdrop({ grayscale: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-10" />
                                </div>
                             </div>
                             <label className={`inline-flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${backdropCfg.keepGrid ? 'bg-[#dfff00]' : 'bg-white'}`}>
                               <input type="checkbox" className="hidden" checked={!!backdropCfg.keepGrid} onChange={e => setBackdrop({ keepGrid: e.target.checked })} />
                               {backdropCfg.keepGrid ? <Check size={14}/> : <X size={14}/>} Keep gridlines on top
                             </label>
                           </>
                         )}

                         {backdropCfg.mode === 'grid' && (
                           <p className="font-mono text-xs text-gray-500 uppercase tracking-[0.15em] border-[2px] border-dashed border-[#111]/40 p-6">Original blueprint gridlines. No generated layer.</p>
                         )}

                         <div className="flex flex-wrap items-center gap-4 border-t-[2px] border-[#111] pt-5">
                            <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${backdropCfg.useTint ? 'bg-[#dfff00]' : 'bg-white'}`}>
                              <input type="checkbox" className="hidden" checked={!!backdropCfg.useTint} onChange={e => setBackdrop({ useTint: e.target.checked })} />
                              {backdropCfg.useTint ? <Check size={14}/> : <X size={14}/>} Panel tint
                            </label>
                            <input type="color" value={backdropCfg.tint || '#e9e9e6'} onChange={e => setBackdrop({ tint: e.target.value })} className="w-12 h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                            <button onClick={() => setBackdrop({ ...defaultSettings.backdrop })} className="font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 bg-white border-[2px] border-[#111] slide-press flex items-center gap-2"><RotateCcw size={14}/> Reset</button>
                         </div>
                      </div>

                      {/* live preview of the exact treatment */}
                      <div>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Preview</p>
                        <div className="h-[300px] border-[2px] border-[#111] bg-white bg-blueprint relative overflow-hidden" style={backdropVars}>
                           {topoOn && <TopoField cfg={backdropCfg} />}
                           <div className="absolute inset-6 border-[2px] border-[#111] bg-white/70 flex items-center justify-center">
                              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#111]">Panel content</span>
                           </div>
                        </div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400 mt-2">Contours are drawn live on a canvas — nothing is stored as an image.</p>
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
                        <img loading="lazy" decoding="async" src={friend.image || 'https://placehold.co/100x100'} className="w-16 h-16 border-[2px] border-[#111] object-cover grayscale" alt="prev"/>
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
                        <img loading="lazy" decoding="async" src={interest.image || 'https://placehold.co/300x200'} className="w-full md:w-48 h-32 object-cover border-[2px] border-[#111]" alt="prev"/>
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
                       <img loading="lazy" decoding="async" src={item.image} className="w-full aspect-square object-cover border-[2px] border-[#111] mb-2 grayscale group-hover:grayscale-0 transition-all" alt="gal_prev"/>
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
                          ? <img loading="lazy" decoding="async" src={pl.image} alt="" className="w-10 h-10 object-cover border-[2px] border-[#111] grayscale shrink-0" />
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
                          ? <img loading="lazy" decoding="async" src={thumb} alt="" className="w-12 h-12 object-cover border-[2px] border-[#111] grayscale shrink-0" />
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
                {/* ---------- WHICH VIEWER OPENS ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="border-b-[2px] border-[#111] pb-4 mb-6">
                    <h3 className="font-serif text-3xl mb-1">Click Behaviour</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">What opens when a galleria plate is clicked.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {GALLERIA_STYLES.map(st => (
                      <button key={st.id} onClick={() => setLB({ style: st.id })}
                              className={`text-left p-5 border-[2px] border-[#111] slide-press transition-colors ${lightboxConfig.style === st.id ? 'bg-[#111] text-[#dfff00]' : 'bg-[#f4f4f0] hover:bg-[#dfff00]'}`}>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-mono font-bold text-sm uppercase tracking-widest">{st.label}</span>
                          {lightboxConfig.style === st.id && <Check size={16}/>}
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] opacity-70">{st.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ---------- EDITORIAL COPY ---------- */}
                {lightboxConfig.style === 'editorial' && (
                  <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                    <h3 className="font-serif text-3xl mb-1">Editorial Spread</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 border-b-[2px] border-[#111] pb-4">
                      Plate titles, dates and captions come from the Galleria tab. These set the surrounding furniture.
                    </p>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {[['edMasthead','Masthead'],['edKicker','Kicker'],['edByline','Byline'],['edSectionLabel','Section Label'],['edSectionYears','Section Years'],['edSectionLabel2','Second Section'],['edFallbackTitle','Fallback Plate Title'],['edFooterLinks','Footer Links (comma separated)']].map(([k, label]) => (
                        <div key={k}>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                          <input value={lightboxConfig[k] || ''} onChange={e => setLB({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                        </div>
                      ))}
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Standfirst (used when a plate has no caption)</label>
                        <textarea value={lightboxConfig.edStandfirst || ''} rows={3} onChange={e => setLB({ edStandfirst: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                      </div>
                      {[['edPaper','Paper'],['edInk','Ink'],['edAccent','Accent']].map(([k, label]) => (
                        <div key={k}>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                          <div className="flex gap-2">
                            <input type="color" value={lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                            <input value={lightboxConfig[k]} onChange={e => setLB({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ---------- SCRAPBOOK PREVIEW (drag decals) ---------- */}
                <div className={`bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise ${lightboxConfig.style === 'editorial' ? 'opacity-55' : ''}`}>
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
                    <img loading="lazy" decoding="async" src={galleriaData[0]?.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&q=80'} alt=""
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
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Motion Speed ({poemDeck.motionSpeed}×)</label>
                      <input type="range" min="0.2" max="4" step="0.1" value={poemDeck.motionSpeed ?? 1} onChange={e => setDeck({ motionSpeed: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-12" />
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
                    {[['showWaveform','Waveform'],['showCables','Cables'],['showCropMarks','Crop Marks'],['showBarcode','Barcode'],['animate','Draw-in Cables'],['motion','Live Motion'],['pulses','Signal Pulses'],['liveWave','Live Meters'],['scanline','Scan Sweep'],['slotBlink','Slot LEDs']].map(([k, label]) => (
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
                              ? <img loading="lazy" decoding="async" src={p.image} alt="" className="w-11 h-11 object-cover border-[2px] border-[#111] grayscale shrink-0" />
                              : <div className="w-11 h-11 border-[2px] border-dashed border-[#111]/40 shrink-0 flex items-center justify-center"><ImageIcon size={14} className="text-gray-400"/></div>}
                            <div className="min-w-0 flex-1">
                              <p title={p.title} className="font-mono font-bold text-sm truncate">{p.title}</p>
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

            {/* ============================================================
                SECRET CORNER — the unlisted music player
                ============================================================ */}
            {adminTab === 'secret' && (
              <div className="space-y-10">
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">{secretCfg.title || "Secret Corner"}</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Unlisted. Opens by typing the passphrase anywhere, or via the faint glyph in a poem.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setSecretOpen(true)} className="bg-white px-4 py-2.5 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 slide-press"><Play size={14}/> Preview</button>
                      <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${secretCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!secretCfg.enabled} onChange={e => setSecret({ enabled: e.target.checked })} />
                        {secretCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {secretCfg.enabled ? 'Live' : 'Off'}
                      </label>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[['title','Title'],['kicker','Kicker'],['footer','Footer Line'],['favLabel','Favourites Button'],['passphrase','Passphrase (type to open)']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <input value={secretCfg[k] || ''} onChange={e => setSecret({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                      </div>
                    ))}
                    {[['brass','Brass'],['bgColor','Cabinet'],['textColor','Text'],['mutedColor','Muted Text']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" value={secretCfg[k]} onChange={e => setSecret({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                          <input value={secretCfg[k]} onChange={e => setSecret({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">
                      Platter Tilt ({secretCfg.platterTilt ?? 56}° — 0 is flat-on, 70 is nearly edge-on)
                    </label>
                    <input type="range" min="0" max="72" value={secretCfg.platterTilt ?? 56}
                           onChange={e => setSecret({ platterTilt: parseInt(e.target.value) })}
                           className="w-full max-w-md accent-[#ff5722] h-11" />
                  </div>
                  <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t-[2px] border-[#111]">
                    {[['showGlyph','Glyph in poems'],['autoAdvance','Auto-advance']].map(([k, label]) => (
                      <label key={k} className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${secretCfg[k] ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!secretCfg[k]} onChange={e => setSecret({ [k]: e.target.checked })} />
                        {secretCfg[k] ? <Check size={14}/> : <X size={14}/>} {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* ---------- TRACKS ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">Tracks</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{secretTracks.length} in the shelf</p>
                    </div>
                    <button onClick={addTrack} className="bg-[#111] text-[#dfff00] px-6 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 slide-press shrink-0"><Plus size={18}/> Add Track</button>
                  </div>

                  <div className="bg-[#f4f4f0] border-[2px] border-[#111] p-4 mb-6 font-mono text-[10px] leading-relaxed text-gray-600">
                    <strong className="uppercase tracking-widest">Audio hosting:</strong> upload writes to your Supabase Storage bucket
                    <span className="px-1 bg-[#dfff00] border border-[#111] mx-1">media</span>
                    and stores only the URL. Audio files are far too large to embed the way images were, so if the bucket
                    isn't set up the upload will fail and you'll need to paste a direct URL instead.
                  </div>

                  {secretTracks.length === 0 && (
                    <div className="border-[2px] border-dashed border-[#111]/40 p-10 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Shelf is empty.</div>
                  )}

                  <div className="space-y-3">
                    {secretTracks.map((t, i) => {
                      const pendingDel = confirmDelete && confirmDelete.listType === 'secret_tracks' && confirmDelete.id === t.id;
                      return (
                        <div key={t.id} style={{ '--d': i }} className="bg-[#f4f4f0] border-[2px] border-[#111] p-4 anim-rise stagger-child">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="flex flex-col shrink-0">
                              <button disabled={i === 0} onClick={() => moveListItem('secret_tracks', i, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▲</button>
                              <button disabled={i === secretTracks.length - 1} onClick={() => moveListItem('secret_tracks', i, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▼</button>
                            </div>
                            <span className="font-mono text-[10px] text-gray-400 w-5 shrink-0 pt-2">{String(i + 1).padStart(2, '0')}</span>
                            {t.cover
                              ? <img loading="lazy" decoding="async" src={t.cover} alt="" className="w-12 h-12 object-cover border-[2px] border-[#111] shrink-0" />
                              : <div className="w-12 h-12 border-[2px] border-dashed border-[#111]/40 shrink-0 flex items-center justify-center"><Disc3 size={16} className="text-gray-400"/></div>}
                            <div className="min-w-0 flex-1 grid sm:grid-cols-[1fr_1fr_80px] gap-2">
                              <input value={t.title || ''} placeholder="Title" onChange={e => updateTrack(t.id, { title: e.target.value })} className="w-full min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                              <input value={t.artist || ''} placeholder="Artist" onChange={e => updateTrack(t.id, { artist: e.target.value })} className="w-full min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                              <input value={t.length || ''} placeholder="3:21" onChange={e => updateTrack(t.id, { length: e.target.value })} title="Printed duration" className="w-full min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                            </div>
                            {pendingDel ? (
                              <div className="flex gap-1 shrink-0 anim-fade">
                                <button onClick={() => handleDeleteItem('secret_tracks', t.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Confirm</button>
                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Keep</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete({ listType: 'secret_tracks', id: t.id })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors shrink-0"><Trash2 size={16}/></button>
                            )}
                          </div>

                          <div className="grid md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Audio URL</label>
                              <div className="flex">
                                <input value={t.src || ''} placeholder="https://…" onChange={e => updateTrack(t.id, { src: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center font-mono font-bold text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111] shrink-0">
                                  <Upload size={14}/>
                                  <input type="file" className="hidden" accept="audio/*" onChange={e => handleAudioUpload(e, url => updateTrack(t.id, { src: url }))} />
                                </label>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Cover Image</label>
                              <div className="flex">
                                <input value={t.cover || ''} placeholder="https://…" onChange={e => updateTrack(t.id, { cover: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                                <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center font-mono font-bold text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111] shrink-0">
                                  <Upload size={14}/>
                                  <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, url => updateTrack(t.id, { cover: url }))} />
                                </label>
                              </div>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[9px] font-mono font-bold uppercase text-gray-500 mb-1 block">Why you love it (shown under the title)</label>
                              <textarea value={t.note || ''} rows={2} onChange={e => updateTrack(t.id, { note: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00] resize-y" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================
                AMBIENT — orbit, disc, file cabinet
                ============================================================ */}
            {adminTab === 'ambient' && (
              <div className="space-y-10">

                {/* ---------- MODAL SURFACES ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">Modal Surfaces</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        Generated ASCII behind every modal and the documents inside the folder.
                      </p>
                    </div>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press shrink-0 ${asciiCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!asciiCfg.enabled} onChange={e => setAscii({ enabled: e.target.checked })} />
                      {asciiCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {asciiCfg.enabled ? 'On' : 'Off'}
                    </label>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-8">
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Character Ramp — sparse to dense</label>
                        <input value={asciiCfg.ramp} onChange={e => setAscii({ ramp: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                        <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400 mt-1">Leading spaces stay blank. Try ".:-=+*#%@" or "01" or "░▒▓█"</p>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Glyph Size ({asciiCfg.size}px)</label>
                          <input type="range" min="6" max="24" value={asciiCfg.size} onChange={e => setAscii({ size: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">On Light ({Math.round(asciiCfg.opacityLight * 100)}%)</label>
                          <input type="range" min="0" max="0.4" step="0.01" value={asciiCfg.opacityLight} onChange={e => setAscii({ opacityLight: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">On Dark ({Math.round(asciiCfg.opacityDark * 100)}%)</label>
                          <input type="range" min="0" max="0.4" step="0.01" value={asciiCfg.opacityDark} onChange={e => setAscii({ opacityDark: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-3 gap-4 border-t-[2px] border-[#111] pt-5">
                        {[['inkOnLight','Ink on Light'],['inkOnDark','Ink on Dark']].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                            <div className="flex gap-2">
                              <input type="color" value={asciiCfg[k]} onChange={e => setAscii({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                              <input value={asciiCfg[k]} onChange={e => setAscii({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                            </div>
                          </div>
                        ))}
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Drift Speed ({asciiCfg.speed}×)</label>
                          <input type="range" min="0.2" max="4" step="0.1" value={asciiCfg.speed} onChange={e => setAscii({ speed: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                      </div>

                      <label className={`inline-flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${asciiCfg.animate ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!asciiCfg.animate} onChange={e => setAscii({ animate: e.target.checked })} />
                        {asciiCfg.animate ? <Check size={14}/> : <X size={14}/>} Drift (5fps — stepping, not sliding)
                      </label>
                    </div>

                    <div className="space-y-3">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Readability check</p>
                      <div className="relative h-[190px] overflow-hidden border-[2px] border-[#111]" style={{ background: ED.paper }}>
                        {asciiCfg.enabled && <AsciiTexture seed={5} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed} animate={asciiCfg.animate} color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight} mask={asciiCfg.mask} clear={asciiCfg.clear} />}
                        <div className="relative p-4">
                          <p className="font-serif italic text-xl mb-2" style={{ color: ED.ink }}>Unverified</p>
                          <p className="font-serif text-[11.5px] leading-[1.7]" style={{ color: '#1a1a1a' }}>
                            There are signs of use: annotations, omissions, the pressure of someone else's urgency. No conclusion is evident, but the document resists being closed.
                          </p>
                        </div>
                      </div>
                      <div className="relative h-[190px] overflow-hidden border-[2px] border-[#111]" style={{ background: '#15100c' }}>
                        {asciiCfg.enabled && <AsciiTexture seed={9} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed} animate={asciiCfg.animate} color={asciiCfg.inkOnDark} opacity={asciiCfg.opacityDark} mask={asciiCfg.mask} clear={asciiCfg.clear} />}
                        <div className="relative p-4">
                          <p className="font-serif italic text-xl mb-2" style={{ color: '#ece0c8' }}>Dark surface</p>
                          <p className="font-mono text-[10px] leading-[1.8] uppercase tracking-[0.12em]" style={{ color: '#9c8560' }}>
                            To: Elias Varnell — Apr 11, 1966 — 18 Obscura Lane, Sector A, New Cartesia 0027-A
                          </p>
                        </div>
                      </div>
                      <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400">
                        If you can't read this copy comfortably, drop the opacity or raise the clear area.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ---------- TEXT ORBIT ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">Text Orbit</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">A word circling a figure. Sits under the galleria.</p>
                    </div>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press shrink-0 ${orbitCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!orbitCfg.enabled} onChange={e => setOrbit({ enabled: e.target.checked })} />
                      {orbitCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {orbitCfg.enabled ? 'Live' : 'Off'}
                    </label>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-8">
                    <div className="space-y-5">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[['word','Word'],['heading','Heading'],['kicker','Kicker'],['caption','Caption (optional)']].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                            <input value={orbitCfg[k] || ''} onChange={e => setOrbit({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Copies ({orbitCfg.count})</label>
                          <input type="range" min="20" max="320" value={orbitCfg.count} onChange={e => setOrbit({ count: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Of those, moving ({Math.min(orbitCfg.moving ?? 80, orbitCfg.count)})</label>
                          <input type="range" min="0" max="160" value={orbitCfg.moving ?? 80} onChange={e => setOrbit({ moving: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                          <p className="font-mono text-[8px] uppercase tracking-[0.15em] text-gray-400 mt-1">The rest are static — free to add</p>
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Speed ({orbitCfg.speed}×)</label>
                          <input type="range" min="0.2" max="4" step="0.1" value={orbitCfg.speed} onChange={e => setOrbit({ speed: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Figure Blur ({orbitCfg.figureBlur}px)</label>
                          <input type="range" min="0" max="40" value={orbitCfg.figureBlur} onChange={e => setOrbit({ figureBlur: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t-[2px] border-[#111] pt-5">
                        {[['bgTop','BG Top'],['bgBottom','BG Bottom'],['wordColor','Word'],['figureColor','Figure']].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                            <div className="flex gap-2">
                              <input type="color" value={orbitCfg[k]} onChange={e => setOrbit({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                              <input value={orbitCfg[k]} onChange={e => setOrbit({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t-[2px] border-[#111] pt-5">
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Figure Image (optional — replaces the drawn silhouette)</label>
                        <div className="flex">
                          <input value={orbitCfg.image || ''} placeholder="https://… or upload a cut-out" onChange={e => setOrbit({ image: e.target.value })} className="flex-1 min-w-0 p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                          <label className="cursor-pointer bg-[#111] text-white px-5 flex items-center font-mono font-bold text-xs hover:bg-[#ff5722] transition-colors border-[2px] border-l-0 border-[#111] shrink-0">
                            <Upload size={14}/>
                            <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, url => setOrbit({ image: url }))} />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Preview</p>
                      <div className="border-[2px] border-[#111] overflow-hidden"><TextOrbit cfg={orbitCfg} /></div>
                    </div>
                  </div>
                </div>

                {/* ---------- TEXT DISC ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">Text Disc</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Your words set around spinning rings.</p>
                    </div>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press shrink-0 ${discCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!discCfg.enabled} onChange={e => setDisc({ enabled: e.target.checked })} />
                      {discCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {discCfg.enabled ? 'Live' : 'Off'}
                    </label>
                  </div>

                  <div className="grid lg:grid-cols-[minmax(0,1fr)_260px] gap-8">
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Ring Text — repeats to fill every ring</label>
                        <textarea value={discCfg.text || ''} rows={5} onChange={e => setDisc({ text: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00] resize-y" />
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[['heading','Heading'],['kicker','Kicker'],['mark','Corner Mark']].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                            <input value={discCfg[k] || ''} onChange={e => setDisc({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Rings ({discCfg.rings})</label>
                          <input type="range" min="3" max="16" value={discCfg.rings} onChange={e => setDisc({ rings: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Type Size ({discCfg.fontSize}px)</label>
                          <input type="range" min="6" max="20" value={discCfg.fontSize} onChange={e => setDisc({ fontSize: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                        <div>
                          <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Speed ({discCfg.speed}×)</label>
                          <input type="range" min="0.2" max="4" step="0.1" value={discCfg.speed} onChange={e => setDisc({ speed: parseFloat(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4 border-t-[2px] border-[#111] pt-5">
                        {[['bg','Background'],['disc','Disc'],['ink','Type']].map(([k, label]) => (
                          <div key={k}>
                            <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                            <div className="flex gap-2">
                              <input type="color" value={discCfg[k]} onChange={e => setDisc({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                              <input value={discCfg[k]} onChange={e => setDisc({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Preview</p>
                      <div className="border-[2px] border-[#111] overflow-hidden"><TextDisc cfg={{ ...discCfg, uid: 'admin' }} /></div>
                    </div>
                  </div>
                </div>

                {/* ---------- FILE CABINET ---------- */}
                <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-3xl mb-1">Recovered Files</h3>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">The drawer under the Systems panel. {cabinetFiles.length} filed.</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={addFile} className="bg-[#111] text-[#dfff00] px-5 py-2.5 border-[2px] border-[#111] font-mono font-bold uppercase tracking-widest flex items-center gap-2 slide-press"><Plus size={16}/> File</button>
                      <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${cabinetCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                        <input type="checkbox" className="hidden" checked={!!cabinetCfg.enabled} onChange={e => setCabinet({ enabled: e.target.checked })} />
                        {cabinetCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {cabinetCfg.enabled ? 'Live' : 'Off'}
                      </label>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[['title','Drawer Title'],['breadcrumb','Breadcrumb'],['date','Date'],['emptyHint','Empty Hint'],['footer','Footer']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <input value={cabinetCfg[k] || ''} onChange={e => setCabinet({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                      </div>
                    ))}
                    {[['drawer','Drawer'],['shell','Shell'],['paper','Paper']].map(([k, label]) => (
                      <div key={k}>
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                        <div className="flex gap-2">
                          <input type="color" value={cabinetCfg[k]} onChange={e => setCabinet({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                          <input value={cabinetCfg[k]} onChange={e => setCabinet({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        </div>
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Header Note</label>
                      <textarea value={cabinetCfg.note || ''} rows={3} onChange={e => setCabinet({ note: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00] resize-y" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {cabinetFiles.map((f, i) => {
                      const open = expandedFile === f.id;
                      const pend = confirmDelete && confirmDelete.listType === 'cabinet_files' && confirmDelete.id === f.id;
                      return (
                        <div key={f.id} style={{ '--d': i }} className="border-[2px] border-[#111] anim-rise stagger-child">
                          <div className="flex flex-wrap items-center gap-3 bg-[#f4f4f0] p-3">
                            <div className="flex flex-col shrink-0">
                              <button disabled={i === 0} onClick={() => moveListItem('cabinet_files', i, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▲</button>
                              <button disabled={i === cabinetFiles.length - 1} onClick={() => moveListItem('cabinet_files', i, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▼</button>
                            </div>
                            <span className="w-4 h-9 shrink-0" style={{ background: f.tabColor }} />
                            <div className="min-w-0 flex-1">
                              <p title={f.title} className="font-mono font-bold text-sm truncate">{f.title}</p>
                              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 truncate">{f.tab} · {f.fileNo}</p>
                            </div>
                            <button onClick={() => setExpandedFile(open ? null : f.id)} className="p-2 bg-[#dfff00] border-[2px] border-[#111] hover:bg-[#111] hover:text-white transition-colors shrink-0"><Edit2 size={16}/></button>
                            {pend ? (
                              <div className="flex gap-1 shrink-0 anim-fade">
                                <button onClick={() => handleDeleteItem('cabinet_files', f.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Confirm</button>
                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Keep</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete({ listType: 'cabinet_files', id: f.id })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors shrink-0"><Trash2 size={16}/></button>
                            )}
                          </div>

                          {open && (
                            <div className="p-4 md:p-6 bg-white border-t-[2px] border-[#111] space-y-4 anim-fade">
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {[['title','Title'],['tab','Spine Label'],['fileNo','File No.'],['headline','Page Headline'],['date','Date'],['excerptTitle','Excerpt Title'],['signature','Signature']].map(([k, label]) => (
                                  <div key={k}>
                                    <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">{label}</label>
                                    <input value={f[k] || ''} onChange={e => updateFile(f.id, { [k]: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                                  </div>
                                ))}
                                {[['tabColor','Spine'],['excerptColor','Excerpt Card'],['receiptColor','Receipt']].map(([k, label]) => (
                                  <div key={k}>
                                    <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">{label}</label>
                                    <input type="color" value={f[k] || '#cccccc'} onChange={e => updateFile(f.id, { [k]: e.target.value })} className="w-full h-10 border-[2px] border-[#111] p-0 cursor-pointer" />
                                  </div>
                                ))}
                              </div>
                              {[['body','Page Body'],['excerptBody','Excerpt Body'],['margin','Margin Note'],['receipt','Receipt Lines'],['note','Header Note']].map(([k, label]) => (
                                <div key={k}>
                                  <label className="text-[10px] font-mono font-bold uppercase text-gray-500 mb-1.5 block">{label}</label>
                                  <textarea value={f[k] || ''} rows={k === 'body' || k === 'excerptBody' ? 3 : 2} onChange={e => updateFile(f.id, { [k]: e.target.value })} className="w-full p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00] resize-y" />
                                </div>
                              ))}
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
                             <img loading="lazy" decoding="async" src={msg.message} alt="drawing" className="w-full border-[2px] border-[#111]" />
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
           .bg-blueprint used to hard-code gridlines. It is now just a
           host: it isolates a stacking context so a <TopoField> canvas
           (or, in image mode, the ::before photo layer) can sit at
           z-index -1 — above the panel's own background colour, below
           its content. Gridlines only appear in grid mode or when
           "keep gridlines" is on.
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

        /* ============================================================
           TEXT OVERFLOW
           Nothing in the file set a wrapping rule, so any unbroken run —
           a pasted URL, a long title, a hashtag, CJK without spaces —
           pushed straight through its container and got clipped by the
           parent's overflow-hidden.

           break-word (not anywhere) is deliberate: it only breaks a
           word when that word genuinely cannot fit, so normal prose is
           untouched and only the pathological cases are wrapped.
           ============================================================ */
        p, h1, h2, h3, h4, h5, h6,
        li, span, td, th, blockquote, label, button, a, div.prose {
          overflow-wrap: break-word;
        }
        textarea, input { overflow-wrap: break-word; }

        /* A flex item defaults to min-width:auto, which refuses to shrink
           below its content — the usual reason a truncate/ellipsis child
           overflows its row instead of clipping. */
        .flex > .truncate,
        .flex > .min-w-0,
        .flex-1.truncate { min-width: 0; }

        /* Modals: never let a tall body escape the viewport. */
        .modal-scroll {
          max-height: calc(100vh - 2rem);
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        @media (min-width: 768px) {
          .modal-scroll { max-height: calc(100vh - 4rem); }
        }

        /* Preserve author line breaks in user-written copy without
           letting a single long token blow the box out. */
        .user-copy {
          white-space: pre-wrap;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        /* ============================================================
           EDITORIAL CHROME
           ============================================================ */
        :root {
          --ed-ink: #16150f;
          --ed-paper: #ece8dc;
          --ed-orange: #e8552a;
          --ed-mustard: #f0c53c;
        }

        /* dotted leader that stretches to fill a row */
        .ed-leader {
          height: 1px;
          min-width: 12px;
          align-self: center;
          background-image: radial-gradient(currentColor 0.6px, transparent 0.7px);
          background-size: 4px 1px;
          background-repeat: repeat-x;
          opacity: 0.5;
        }

        /* halftone wash, as on the orange plate */
        .ed-halftone {
          background-image: radial-gradient(rgba(0,0,0,0.22) 0.9px, transparent 1px);
          background-size: 4px 4px;
        }

        /* faint drafting grid behind panels */
        .ed-grid {
          background-image:
            linear-gradient(currentColor 1px, transparent 1px),
            linear-gradient(90deg, currentColor 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: 0.045;
        }

        /* clipped corner on info panels */
        .ed-notch   { clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%); }
        .ed-notch-l { clip-path: polygon(0 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px)); }

        /* vertical dot separator, as between the card captions */
        .ed-dots-v {
          background-image: radial-gradient(currentColor 0.9px, transparent 1px);
          background-size: 3px 6px;
          background-repeat: repeat-y;
          opacity: 0.55;
        }

        .ed-rule { border-color: rgba(236,232,220,0.18); }
        .ed-rule-d { border-color: rgba(22,21,15,0.22); }

        /* index numerals sitting in a card's top-right */
        .ed-index { font-variant-numeric: tabular-nums; letter-spacing: 0.18em; }

        /* circled arrow button */
        .ed-arrow {
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 9999px; border: 1px solid currentColor;
          transition: background 220ms var(--ease-out-expo), color 220ms var(--ease-out-expo), transform 220ms var(--ease-out-expo);
        }
        .ed-arrow:hover { transform: translateX(3px); }

        /* --- Editorial galleria ---------------------------------------- */
        @keyframes edRingIn  { from { opacity: 0; transform: scale(0.86); } to { opacity: 1; transform: none; } }
        @keyframes edFadeUp  { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes edCardIn  { from { opacity: 0; transform: translateY(40px) rotate(-3deg); } to { opacity: 1; } }
        .ed-dropcap::first-letter {
          float: left;
          font-size: 2.9em;
          line-height: 0.82;
          padding: 0.06em 0.14em 0 0;
          font-family: Georgia, 'Times New Roman', serif;
        }

        /* ============================================================
           AMBIENT PIECES — orbit, disc, cabinet
           All motion is CSS transform only (compositor-friendly) and
           every keyframe is gated behind an in-view class, so a piece
           that is scrolled past stops costing anything at all.
           ============================================================ */
        @keyframes orbitArm     { from { transform: rotate(var(--start,0deg)); } to { transform: rotate(calc(var(--start,0deg) + 360deg)); } }
        @keyframes orbitCounter { from { transform: rotate(calc(var(--start,0deg) * -1)); } to { transform: rotate(calc((var(--start,0deg) + 360deg) * -1)); } }
        .orbit-arm  { width: 0; height: 0; }
        .orbit-live .orbit-arm  { animation: orbitArm var(--dur, 40s) linear infinite; }
        .orbit-live .orbit-word { animation: orbitCounter var(--dur, 40s) linear infinite; }

        @keyframes discRot { to { transform: rotate(360deg); } }
        .disc-layer { animation: discRot var(--dur, 60s) linear infinite; transform-origin: 50% 50%; will-change: transform; }

        .cab-spine {
          transition: transform 420ms var(--ease-out-expo), filter 260ms ease;
          animation: cabSpine 460ms var(--ease-out-expo) both;
          animation-delay: calc(var(--d, 0) * 45ms);
        }
        .cab-spine:hover { transform: translateY(-9px) !important; filter: brightness(1.12); }
        @keyframes cabSpine { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; } }
        @keyframes cabPage  { from { opacity: 0; transform: translateY(30px) rotate(-0.6deg); } to { opacity: 1; transform: none; } }
        @keyframes cabCard  { from { opacity: 0; transform: translate(-22px, 34px) rotate(-1.6deg); } to { opacity: 1; transform: none; } }
        @keyframes cabSlip  { from { opacity: 0; transform: translateY(30px) rotate(4deg) scale(0.94); } to { opacity: 1; transform: rotate(-1.5deg); } }
        @keyframes cabTab   { from { opacity: 0; transform: translateX(26px); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .orbit-live .orbit-arm, .orbit-live .orbit-word, .disc-layer { animation: none; }
          .cab-spine, .cab-page, .cab-card, .cab-slip, .cab-tab { animation: none !important; }
        }

        /* ============================================================
           LANDING + COMMUNITY CENTER
           ============================================================ */
        @keyframes ccDrawer { from { transform: translateX(100%); } to { transform: none; } }
        @keyframes landIn    { from { opacity: 0; transform: scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes landUp    { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes landBands { from { opacity: 0; clip-path: inset(0 50% 0 50%); } to { opacity: 1; clip-path: inset(0 0 0 0); } }
        @keyframes landCard  { from { opacity: 0; transform: translateY(22px) scale(0.97); } to { opacity: 1; transform: none; } }
        .land-choice { transition: transform 260ms var(--ease-out-expo), filter 260ms ease; }
        .land-choice:hover  { transform: translateY(-3px); filter: brightness(1.08); }
        .land-choice:active { transform: translateY(0); transition-duration: 90ms; }

        @keyframes ccUp    { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
        @keyframes ccTitle { from { opacity: 0; transform: translateY(30px); letter-spacing: 0.06em; } to { opacity: 1; transform: none; letter-spacing: -0.01em; } }
        @keyframes ccPop   { from { opacity: 0; transform: translateY(24px) rotate(0deg) scale(0.96); } to { opacity: 1; transform: rotate(var(--rot, 0deg)); } }
        @keyframes ccPanel { from { opacity: 0; transform: translateY(40px) scale(0.98); } to { opacity: 1; transform: none; } }
        @keyframes ccFig   { from { opacity: 0; transform: translateY(30px) rotate(-3deg); } to { opacity: 1; transform: none; } }
        @keyframes ccVinyl { from { opacity: 0; transform: translateX(70px) rotate(-14deg); } to { opacity: 1; transform: none; } }
        @keyframes ccDot   { 0%, 100% { transform: scaleY(0.35); transform-origin: top; opacity: 0.4; } 50% { transform: scaleY(1); opacity: 1; } }

        .cc-up    { animation: ccUp 760ms var(--ease-out-expo) both; }
        .cc-title { animation: ccTitle 900ms var(--ease-out-expo) both; }
        .cc-pop   { animation: ccPop 640ms var(--ease-out-expo) both; }
        .cc-panel { animation: ccPanel 820ms var(--ease-out-expo) both; }
        .cc-fig   { animation: ccFig 1000ms var(--ease-out-expo) 300ms both; }
        .cc-vinyl { animation: ccVinyl 1100ms var(--ease-out-expo) both; }
        .cc-spin  { animation: scSpin 14s linear infinite; }
        .cc-scroll-dot { animation: ccDot 1.9s ease-in-out infinite; }
        .cc-bar   { transition: height 140ms linear; }

        /* the board: a real masonry column flow, so notes of different
           lengths pack without leaving holes and nothing overlaps */
        .cc-masonry { column-count: 1; column-gap: 16px; }
        @media (min-width: 640px)  { .cc-masonry { column-count: 2; } }
        @media (min-width: 1024px) { .cc-masonry { column-count: 3; } }
        @media (min-width: 1440px) { .cc-masonry { column-count: 4; } }
        .cc-note {
          break-inside: avoid;
          -webkit-column-break-inside: avoid;
          display: block;
          margin-bottom: 16px;
          padding: 14px 15px;
          transform: rotate(var(--rot, 0deg));
          box-shadow: 0 8px 22px rgba(0,0,0,0.13);
          transition: transform 300ms var(--ease-out-expo), box-shadow 300ms ease;
        }
        .cc-note:hover { transform: rotate(0deg) translateY(-3px); box-shadow: 0 14px 30px rgba(0,0,0,0.2); }

        .cc-dropcap::first-letter {
          float: left; font-size: 2.7em; line-height: 0.84;
          padding: 0.05em 0.12em 0 0; font-family: Georgia, 'Times New Roman', serif;
        }

        @media (prefers-reduced-motion: reduce) {
          .cc-up, .cc-title, .cc-pop, .cc-panel, .cc-fig, .cc-vinyl, .cc-spin, .cc-scroll-dot { animation: none !important; opacity: 1 !important; }
        }

        /* --- Secret corner --------------------------------------------- */
        @keyframes scSpin { to { transform: rotate(360deg); } }
        .sc-spin { animation: scSpin 5.4s linear infinite; will-change: transform; }
        /* changing record: the old disc lifts off, the new one drops on */
        @keyframes discIn  { 0% { opacity: 0; transform: translateY(-46px) scale(0.9); } 100% { opacity: 1; transform: none; } }
        @keyframes discOut { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(34px) scale(0.93); } }
        @keyframes scEq { 0%, 100% { height: 20%; } 50% { height: 100%; } }
        .sc-eq { animation: scEq var(--eqd, 500ms) ease-in-out infinite; }
        .sc-row:hover .sc-eq { opacity: 1; }
        .sc-row:hover { opacity: 1; }
        .sc-key:active { transform: translateY(1px) scale(0.96); }
        @media (prefers-reduced-motion: reduce) {
          .sc-spin, .sc-eq { animation: none; }
        }

        /* --- Poem deck ------------------------------------------------- */
        /* The whole rack runs on seeded CSS animations: durations, delays
           and drift vectors come from the generator as custom properties,
           so nothing beats in unison and the browser composites it all
           without a single JS frame. */
        @keyframes cableDraw  { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
        .deck-cable { stroke-dasharray: 400; animation: cableDraw 1400ms var(--ease-out-expo) both; }

        /* signal pulses travelling slot -> index row */
        @keyframes dashFlow { to { stroke-dashoffset: -240; } }
        .deck-motion .deck-pulse {
          stroke-dasharray: 2 34;
          opacity: 0.85;
          animation: dashFlow var(--pd, 3s) linear infinite;
        }
        .deck-pulse { opacity: 0; }

        /* live meters: scaleY between two seeded heights */
        @keyframes barBob { from { transform: scaleY(var(--s0, 0.4)); } to { transform: scaleY(var(--s1, 0.8)); } }
        .deck-motion .deck-bar {
          animation: barBob var(--bd, 800ms) ease-in-out var(--bdl, 0ms) infinite alternate;
          will-change: transform;
        }

        /* slot LEDs and status dots */
        @keyframes ledFade { 0%, 100% { opacity: 1; } 50% { opacity: 0.14; } }
        .deck-motion .deck-led { animation: ledFade var(--ld, 2s) ease-in-out var(--ldl, 0ms) infinite; }

        /* the slot field breathes rather than sitting frozen */
        @keyframes slotDrift {
          from { transform: translate(0, -50%); }
          to   { transform: translate(var(--dx, 0px), calc(-50% + var(--dy, 0px))); }
        }
        .deck-motion .deck-slot { animation: slotDrift var(--sd, 8s) ease-in-out var(--sdl, 0ms) infinite alternate; }

        /* sweep across the diagram */
        @keyframes deckScan {
          0%   { transform: translateY(-15%); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(560%); opacity: 0; }
        }
        .deck-motion .deck-scan { animation: deckScan var(--scd, 9s) linear infinite; }

        /* averaging needle */
        @keyframes needleSweep { from { left: 0%; } to { left: 100%; } }
        .deck-motion .deck-needle { animation: needleSweep var(--nd, 7s) ease-in-out infinite alternate; }
        .deck-needle { left: 0; opacity: 0.7; }

        /* playhead running down the index */
        @keyframes tickPulse { 0%, 82%, 100% { opacity: 0.28; transform: scale(1); } 88% { opacity: 1; transform: scale(1.9); } }
        .deck-motion .deck-tick { animation: tickPulse var(--td, 4s) ease-in-out var(--tdl, 0ms) infinite; }

        @media (prefers-reduced-motion: reduce) {
          .deck-motion .deck-pulse,
          .deck-motion .deck-bar,
          .deck-motion .deck-led,
          .deck-motion .deck-slot,
          .deck-motion .deck-scan,
          .deck-motion .deck-needle,
          .deck-motion .deck-tick { animation: none; }
          .deck-motion .deck-pulse { opacity: 0; }
        }
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

      {/* ================= THE DOOR ================= */}
      {route === 'landing' && landingCfg.enabled && (
        <LandingPage
          cfg={landingCfg}
          ascii={asciiCfg}
          onEnterSite={() => goRoute('site')}
          onEnterCommunity={() => goRoute('community')}
        />
      )}

      {/* ================= COMMUNITY CENTER ================= */}
      {route === 'community' && isAdmin && (
        <>
          {/* Edits happen here rather than in the main admin panel, so you
              can see the page change behind the drawer as you type. */}
          <button onClick={() => setCcEdit(v => !v)}
                  className="fixed bottom-5 right-5 z-[80] flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] slide-press"
                  style={{ background: ccEdit ? '#ff5722' : '#161310', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
            {ccEdit ? <X size={14}/> : <Edit2 size={14}/>} {ccEdit ? 'Close' : 'Edit page'}
          </button>

          {ccEdit && (
            <div className="fixed inset-y-0 right-0 z-[79] w-full max-w-[560px] overflow-y-auto hide-scrollbar"
                 style={{ background: '#e8e8e3', borderLeft: '2px solid #111', boxShadow: '-18px 0 50px rgba(0,0,0,0.35)', animation: 'ccDrawer 420ms var(--ease-out-expo) both' }}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b-[2px] border-[#111]" style={{ background: '#111' }}>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#dfff00]">Editing</p>
                  <p className="font-serif text-xl text-white leading-tight truncate">The community center</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => saveAllToCloud(null)} disabled={!isDirty || isSaving}
                          className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest slide-press disabled:opacity-40"
                          style={{ background: isDirty ? '#dfff00' : '#333', color: isDirty ? '#111' : '#888' }}>
                    {isSaving ? 'Saving…' : isDirty ? 'Deploy' : 'Saved'}
                  </button>
                  <button onClick={() => setCcEdit(false)} className="p-2 text-white/70 hover:text-white"><X size={18}/></button>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-8 pb-24">

              {/* ---------- LANDING ---------- */}
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111] anim-rise">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-3xl mb-1">The Door</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">First screen. Left card enters the archive, right card the community center.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setCcEdit(false); goRoute('landing'); }} className="bg-white px-4 py-2.5 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press">Preview</button>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${landingCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!landingCfg.enabled} onChange={e => setLanding({ enabled: e.target.checked })} />
                      {landingCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {landingCfg.enabled ? 'On' : 'Skipped'}
                    </label>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[['wordmark','Wordmark'],['title','Headline'],['primaryTitle','Left Card Title'],['primarySub','Left Card Sub'],['secondaryTitle','Right Card Title'],['secondarySub','Right Card Sub'],['footnote','Footnote']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input value={landingCfg[k] || ''} onChange={e => setLanding({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                    </div>
                  ))}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Subtitle</label>
                    <textarea value={landingCfg.subtitle || ''} rows={2} onChange={e => setLanding({ subtitle: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t-[2px] border-[#111]">
                  {[['outer','Outer'],['paper','Panel'],['titleInk','Headline'],['subtitleInk','Subtitle'],['primaryBg','Left Card'],['secondaryBg','Right Card'],['markBg','Mark'],['cardBorder','Card Border']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input type="color" value={landingCfg[k]} onChange={e => setLanding({ [k]: e.target.value })} className="w-full h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <div className="flex flex-wrap items-end gap-4 mb-5">
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${landingCfg.asciiBg !== false ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={landingCfg.asciiBg !== false} onChange={e => setLanding({ asciiBg: e.target.checked })} />
                      {landingCfg.asciiBg !== false ? <Check size={14}/> : <X size={14}/>} Animated ASCII
                    </label>
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-gray-400 flex-1 min-w-[180px] leading-relaxed">
                      Sits on the cream panel only. Ramp comes from Ambient → Modal Surfaces.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Strength ({Math.round((landingCfg.asciiOpacityLight ?? 0.34) * 100)}%)</label>
                      <input type="range" min="0" max="1" step="0.02" value={landingCfg.asciiOpacityLight ?? 0.34}
                             onChange={e => setLanding({ asciiOpacityLight: parseFloat(e.target.value) })}
                             className="w-full accent-[#ff5722] h-11" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Glyph Size ({landingCfg.asciiSize ?? 11}px)</label>
                      <input type="range" min="5" max="24" value={landingCfg.asciiSize ?? 11}
                             onChange={e => setLanding({ asciiSize: parseInt(e.target.value) })}
                             className="w-full accent-[#ff5722] h-11" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Drift Speed ({landingCfg.asciiSpeed ?? 1.6}×)</label>
                      <input type="range" min="0.3" max="5" step="0.1" value={landingCfg.asciiSpeed ?? 1.6}
                             onChange={e => setLanding({ asciiSpeed: parseFloat(e.target.value) })}
                             className="w-full accent-[#ff5722] h-11" />
                    </div>
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Glyph Colour</label>
                      <div className="flex gap-2">
                        <input type="color" value={landingCfg.asciiInkLight || asciiCfg.inkOnLight} onChange={e => setLanding({ asciiInkLight: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                        <button onClick={() => setLanding({ asciiInkLight: '' })} className="flex-1 min-w-0 font-mono text-[9px] font-bold uppercase tracking-widest px-2 border-[2px] border-[#111] bg-white slide-press">Inherit</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-4 mt-4">
                    <div>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Coverage</label>
                      <div className="flex gap-2">
                        {[['full','Edge to edge'],['edges','Clear centre']].map(([m, label]) => (
                          <button key={m} onClick={() => setLanding({ asciiMask: m })}
                                  className={`font-mono text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 border-[2px] border-[#111] slide-press ${(landingCfg.asciiMask || 'full') === m ? 'bg-[#111] text-[#dfff00]' : 'bg-white'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(landingCfg.asciiMask || 'full') === 'edges' && (
                      <div className="min-w-[170px] flex-1">
                        <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Clear Centre ({landingCfg.asciiClear ?? 30}%)</label>
                        <input type="range" min="0" max="70" value={landingCfg.asciiClear ?? 30}
                               onChange={e => setLanding({ asciiClear: parseInt(e.target.value) })}
                               className="w-full accent-[#ff5722] h-11" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Stripe Bands</label>
                  <div className="flex flex-wrap gap-2">
                    {(landingCfg.stripes || []).map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input type="color" value={c} onChange={e => {
                          const next = [...landingCfg.stripes]; next[i] = e.target.value; setLanding({ stripes: next });
                        }} className="w-14 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                        <button onClick={() => setLanding({ stripes: landingCfg.stripes.filter((_, j) => j !== i) })}
                                className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111]"><Trash2 size={12}/></button>
                      </div>
                    ))}
                    <button onClick={() => setLanding({ stripes: [...(landingCfg.stripes || []), '#b8422a'] })}
                            className="px-4 h-11 bg-[#111] text-[#dfff00] border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press">+ Band</button>
                  </div>
                </div>
              </div>

              {/* ---------- HERO ---------- */}
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-3xl mb-1">Center — Opening</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">The title splits into three parts so the middle word can be italic.</p>
                  </div>
                  <button onClick={() => setCcEdit(false)} className="bg-white px-4 py-2.5 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press shrink-0">Preview</button>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[['heroPre','Title — first'],['heroItalic','Title — italic'],['heroPost','Title — last'],['scrollHint','Scroll Hint'],['exitLabel','Back Label'],['footNote','Footer Note']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input value={communityCfg[k] || ''} onChange={e => setCommunity({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                    </div>
                  ))}
                  <div className="sm:col-span-3">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Subtitle</label>
                    <textarea value={communityCfg.heroSub || ''} rows={2} onChange={e => setCommunity({ heroSub: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Figure Corner</label>
                    <div className="flex gap-2">
                      {['left','center','right'].map(p => (
                        <button key={p} onClick={() => setCommunity({ heroImagePos: p })}
                                className={`flex-1 font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-3 border-[2px] border-[#111] slide-press ${(communityCfg.heroImagePos || 'left') === p ? 'bg-[#111] text-[#dfff00]' : 'bg-white'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Figure Size ({communityCfg.heroImageSize || 34}vh)</label>
                    <input type="range" min="14" max="70" value={communityCfg.heroImageSize || 34}
                           onChange={e => setCommunity({ heroImageSize: parseInt(e.target.value) })}
                           className="w-full accent-[#ff5722] h-11" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Figure Image</label>
                    <div className="flex items-start gap-3">
                      {communityCfg.heroImage
                        ? <img src={communityCfg.heroImage} alt="" className="w-16 h-20 object-contain shrink-0 border-[2px] border-[#111] bg-white" />
                        : <div className="w-16 h-20 shrink-0 border-[2px] border-dashed border-[#111]/40 flex items-center justify-center"><ImageIcon size={16} className="text-gray-400"/></div>}
                      <div className="min-w-0 flex-1">
                        <div className="flex">
                          <input value={communityCfg.heroImage?.startsWith('data:') ? '(embedded illustration)' : (communityCfg.heroImage || '')}
                                 readOnly={communityCfg.heroImage?.startsWith('data:')}
                                 placeholder="https://… or upload a cut-out PNG"
                                 onChange={e => setCommunity({ heroImage: e.target.value })}
                                 className="flex-1 min-w-0 p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                          <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center border-[2px] border-l-0 border-[#111] shrink-0 hover:bg-[#ff5722] transition-colors">
                            <Upload size={14}/><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, url => setCommunity({ heroImage: url }))} />
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button onClick={() => setCommunity({ heroImage: defaultCommunity.heroImage })}
                                  className="font-mono text-[9px] font-bold uppercase tracking-widest px-3 py-2 bg-white border-[2px] border-[#111] slide-press">Restore default</button>
                          <button onClick={() => setCommunity({ heroImage: null })}
                                  className="font-mono text-[9px] font-bold uppercase tracking-widest px-3 py-2 bg-white border-[2px] border-[#111] slide-press">Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {[['heroBg','Background'],['heroInk','Ink']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input type="color" value={communityCfg[k]} onChange={e => setCommunity({ [k]: e.target.value })} className="w-full h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------- BOARD ---------- */}
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-3xl mb-1">Community Board</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">{boardNotes.length} notes pinned · anyone can post, no account</p>
                  </div>
                  <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press shrink-0 ${boardCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                    <input type="checkbox" className="hidden" checked={!!boardCfg.enabled} onChange={e => setBoard({ enabled: e.target.checked })} />
                    {boardCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {boardCfg.enabled ? 'On' : 'Off'}
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[['title','Board Title'],['verticalTitle','Vertical Title'],['sealMark','Seal Glyph'],['kicker','Kicker'],['pinLabel','Pin Button'],['anonName','Anonymous Name'],['navLinks','Nav Links (comma separated)'],['sectionA','Marker A'],['sectionAYears','Marker A Sub'],['sectionB','Marker B'],['sectionBYears','Marker B Sub'],['emptyText','Empty Message']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input value={boardCfg[k] || ''} onChange={e => setBoard({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Blurb</label>
                    <textarea value={boardCfg.blurb || ''} rows={3} onChange={e => setBoard({ blurb: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Max Note Length ({boardCfg.maxLength})</label>
                    <input type="range" min="200" max="2000" step="50" value={boardCfg.maxLength} onChange={e => setBoard({ maxLength: parseInt(e.target.value) })} className="w-full accent-[#ff5722] h-11" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Composer Placeholder</label>
                    <textarea value={boardCfg.placeholder || ''} rows={3} onChange={e => setBoard({ placeholder: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  {[['bg','Board'],['ink','Ink'],['seal','Seal']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input type="color" value={boardCfg[k]} onChange={e => setBoard({ [k]: e.target.value })} className="w-full h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Note Colours</label>
                  <div className="flex flex-wrap gap-2">
                    {(boardCfg.noteColors || []).map((c, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input type="color" value={c} onChange={e => { const n = [...boardCfg.noteColors]; n[i] = e.target.value; setBoard({ noteColors: n }); }} className="w-14 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                        <button onClick={() => setBoard({ noteColors: boardCfg.noteColors.filter((_, j) => j !== i) })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111]"><Trash2 size={12}/></button>
                      </div>
                    ))}
                    <button onClick={() => setBoard({ noteColors: [...(boardCfg.noteColors || []), '#f3ede1'] })} className="px-4 h-11 bg-[#111] text-[#dfff00] border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press">+ Colour</button>
                  </div>
                </div>

                {/* moderation */}
                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">Pinned notes — remove anything you don't want up</p>
                  {boardNotes.length === 0 ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400 py-6 text-center border-[2px] border-dashed border-[#111]/30">Nothing pinned yet</p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto">
                      {boardNotes.map(n => (
                        <div key={n.id} className="flex items-start gap-3 p-3 bg-[#f4f4f0] border-[2px] border-[#111]">
                          <span className="w-4 h-10 shrink-0" style={{ background: n.color || '#e8dcc8' }} />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[11px] leading-snug break-words whitespace-pre-wrap">{String(n.text).slice(0, 220)}{String(n.text).length > 220 ? '…' : ''}</p>
                            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500 mt-1 break-words">
                              {n.author?.trim() || boardCfg.anonName} · {n.created_at ? new Date(n.created_at).toLocaleString() : 'just now'}
                            </p>
                          </div>
                          <button onClick={() => deleteNote(n.id)} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] hover:bg-[#111] transition-colors shrink-0"><Trash2 size={14}/></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ---------- SONG OF THE DAY ---------- */}
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-3xl mb-1">Song of the Day</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">The record label carries the listing. Yours to change.</p>
                  </div>
                  <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press shrink-0 ${songCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                    <input type="checkbox" className="hidden" checked={!!songCfg.enabled} onChange={e => setSong({ enabled: e.target.checked })} />
                    {songCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {songCfg.enabled ? 'On' : 'Off'}
                  </label>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[['heading','Section Heading'],['albumTitle','Label Title'],['albumSub','Label Sub'],['catalogue','Catalogue (line breaks ok)'],['side','Side (line breaks ok)'],['linkLabel','Link Label'],['link','Link URL']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input value={songCfg[k] || ''} onChange={e => setSong({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Blurb</label>
                    <textarea value={songCfg.blurb || ''} rows={2} onChange={e => setSong({ blurb: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 p-4 bg-[#f4f4f0] border-[2px] border-[#111]">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Record Photo — overrides the drawn record entirely</label>
                    <div className="flex">
                      <input value={songCfg.vinylImage || ''} placeholder="Leave empty to use the generated record"
                             onChange={e => setSong({ vinylImage: e.target.value })}
                             className="flex-1 min-w-0 p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                      <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center border-[2px] border-l-0 border-[#111] shrink-0 hover:bg-[#ff5722] transition-colors">
                        <Upload size={14}/><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, url => setSong({ vinylImage: url }))} />
                      </label>
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-gray-500 mt-2 leading-relaxed">
                      Use a square, transparent-cornered PNG of a record. The label, spin and glow still work on top of it.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Label Art (optional)</label>
                    <div className="flex">
                      <input value={songCfg.labelImage || ''} onChange={e => setSong({ labelImage: e.target.value })} className="flex-1 min-w-0 p-3 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                      <label className="cursor-pointer bg-[#111] text-white px-4 flex items-center border-[2px] border-l-0 border-[#111] shrink-0 hover:bg-[#ff5722] transition-colors">
                        <Upload size={14}/><input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, url => setSong({ labelImage: url }))} />
                      </label>
                    </div>
                  </div>
                  {[['vinylColor','Vinyl'],['bg','Background'],['labelBg','Label']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <div className="flex gap-2">
                        <input type="color" value={songCfg[k]} onChange={e => setSong({ [k]: e.target.value })} className="w-12 h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                        <input value={songCfg[k]} onChange={e => setSong({ [k]: e.target.value })} className="flex-1 min-w-0 p-2.5 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                      </div>
                    </div>
                  ))}
                  <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press self-end ${songCfg.spin ? 'bg-[#dfff00]' : 'bg-white'}`}>
                    <input type="checkbox" className="hidden" checked={!!songCfg.spin} onChange={e => setSong({ spin: e.target.checked })} />
                    {songCfg.spin ? <Check size={14}/> : <X size={14}/>} Spin the record
                  </label>
                </div>

                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Track listing — first 6 print on the label</p>
                    <button onClick={addSongTrack} className="bg-[#111] text-[#dfff00] px-4 py-2 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press shrink-0">+ Track</button>
                  </div>
                  <div className="space-y-2">
                    {(songCfg.tracks || []).map((t, i) => (
                      <div key={t.id} className="flex flex-wrap items-center gap-2 p-2 bg-[#f4f4f0] border-[2px] border-[#111]">
                        <span className="font-mono text-[10px] w-5 text-center shrink-0">{i + 1}</span>
                        <input value={t.title || ''} placeholder="Title" onChange={e => updateSongTrack(t.id, { title: e.target.value })} className="flex-1 min-w-[130px] p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        <input value={t.credit || ''} placeholder="Credit" onChange={e => updateSongTrack(t.id, { credit: e.target.value })} className="flex-1 min-w-[130px] p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        <input value={t.length || ''} placeholder="3:21" onChange={e => updateSongTrack(t.id, { length: e.target.value })} className="w-[70px] p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                        <button onClick={() => removeSongTrack(t.id)} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] shrink-0"><Trash2 size={14}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ---------- POLL ---------- */}
              <div className="bg-white p-6 md:p-8 border-[2px] border-[#111] shadow-[8px_8px_0px_#111]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-[2px] border-[#111] pb-4 mb-6 gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-3xl mb-1">Voting Poll</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">Visitors drag the columns and submit. Figures shown are everyone's average.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={resetVotes} className="bg-white px-4 py-2.5 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press flex items-center gap-2"><RotateCcw size={13}/> Clear votes</button>
                    <label className={`flex items-center gap-2 px-4 py-2.5 border-[2px] border-[#111] font-mono text-[10px] font-bold uppercase tracking-widest cursor-pointer slide-press ${pollCfg.enabled ? 'bg-[#dfff00]' : 'bg-white'}`}>
                      <input type="checkbox" className="hidden" checked={!!pollCfg.enabled} onChange={e => setPoll({ enabled: e.target.checked })} />
                      {pollCfg.enabled ? <Eye size={14}/> : <EyeOff size={14}/>} {pollCfg.enabled ? 'On' : 'Off'}
                    </label>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[['heading','Heading'],['submitLabel','Submit Label'],['votedLabel','After Voting']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input value={pollCfg[k] || ''} onChange={e => setPoll({ [k]: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00]" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Question / Blurb</label>
                    <textarea value={pollCfg.blurb || ''} rows={3} onChange={e => setPoll({ blurb: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  <div>
                    <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">Thanks Message</label>
                    <textarea value={pollCfg.thanks || ''} rows={3} onChange={e => setPoll({ thanks: e.target.value })} className="w-full p-3 border-[2px] border-[#111] font-mono text-sm outline-none focus:bg-[#dfff00] resize-y" />
                  </div>
                  {[['bg','Backdrop'],['paper','Panel'],['accent','Corner Mark'],['submitColor','Submit']].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs font-mono font-bold uppercase text-gray-500 mb-2 block">{label}</label>
                      <input type="color" value={pollCfg[k]} onChange={e => setPoll({ [k]: e.target.value })} className="w-full h-11 border-[2px] border-[#111] p-0 cursor-pointer" />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t-[2px] border-[#111]">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Options — these become the columns</p>
                    <button onClick={addPollOption} className="bg-[#111] text-[#dfff00] px-4 py-2 border-[2px] border-[#111] font-mono font-bold text-[10px] uppercase tracking-widest slide-press shrink-0">+ Option</button>
                  </div>
                  <div className="space-y-2">
                    {pollOptions.map((o, i) => {
                      const t = pollTally[o.id];
                      const avg = t && t.n ? Math.round(t.sum / t.n) : (o.seed ?? 0);
                      const pend = confirmDelete && confirmDelete.listType === 'poll_options' && confirmDelete.id === o.id;
                      return (
                        <div key={o.id} className="flex flex-wrap items-center gap-2 p-2 bg-[#f4f4f0] border-[2px] border-[#111]">
                          <div className="flex flex-col shrink-0">
                            <button disabled={i === 0} onClick={() => moveListItem('poll_options', i, -1)} className="px-1.5 py-0.5 border-[2px] border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▲</button>
                            <button disabled={i === pollOptions.length - 1} onClick={() => moveListItem('poll_options', i, 1)} className="px-1.5 py-0.5 border-[2px] border-t-0 border-[#111] bg-white hover:bg-[#dfff00] disabled:opacity-25 text-[10px] leading-none">▼</button>
                          </div>
                          <input type="color" value={o.color} onChange={e => updatePollOption(o.id, { color: e.target.value })} className="w-11 h-10 border-[2px] border-[#111] p-0 cursor-pointer shrink-0" />
                          <input value={o.label || ''} placeholder="Label" onChange={e => updatePollOption(o.id, { label: e.target.value })} className="flex-1 min-w-[130px] p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-[9px] uppercase text-gray-500">start</span>
                            <input type="number" min="0" max="100" value={o.seed ?? 0} onChange={e => updatePollOption(o.id, { seed: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} className="w-[62px] p-2 border-[2px] border-[#111] font-mono text-xs outline-none focus:bg-[#dfff00]" />
                          </div>
                          <span className="font-mono text-[10px] px-2 py-1 bg-[#dfff00] border-[2px] border-[#111] shrink-0 tabular-nums">
                            {avg}% · {t?.n || 0} votes
                          </span>
                          {pend ? (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleDeleteItem('poll_options', o.id)} className="px-3 py-2 bg-[#ff5722] text-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 bg-white border-[2px] border-[#111] font-bold text-[10px] uppercase">Keep</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDelete({ listType: 'poll_options', id: o.id })} className="p-2 bg-[#ff5722] text-white border-[2px] border-[#111] shrink-0"><Trash2 size={14}/></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              </div>
            </div>
          )}
        </>
      )}

      {route === 'community' && (
        <CommunityCenter
          cfg={communityCfg}
          board={boardCfg}
          notes={boardNotes}
          onPostNote={postNote}
          postingNote={postingNote}
          song={songCfg}
          poll={pollCfg}
          pollOptions={pollOptions}
          pollTally={pollTally}
          onVote={castVote}
          hasVoted={hasVoted}
          onExit={() => goRoute('landing')}
        />
      )}

      <div className="min-h-screen bg-[#e8e8e3] p-4 md:p-8 flex items-center justify-center relative isolate transition-all duration-1000"
           style={backdropVars}>

        {/* Procedural terrain behind the entire page */}
        {topoOn && backdropCfg.globalLayer && <TopoField cfg={backdropCfg} fixed />}

        {/* GLOBAL TOAST NOTIFICATION */}
        {toast && (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="fixed top-8 left-1/2 z-[100] pl-4 pr-6 py-3 ed-notch font-mono uppercase tracking-[0.2em] text-[10px] md:text-[11px] flex items-center gap-3 max-w-[90vw] overflow-hidden"
            style={{
              background: ED.paper,
              color: ED.ink,
              border: `1px solid ${ED.ink}`,
              animation: `${toast.leaving ? 'toastOut 300ms var(--ease-mech) forwards' : 'toastIn 620ms var(--ease-out-expo) both'}`
            }}
          >
            {asciiCfg.enabled && (
              /* a short strip rather than a full field — the toast is only a
                 few lines tall, so a 60x6 grid is all that is ever visible */
              <AsciiTexture seed={101} ramp={asciiCfg.ramp} size={asciiCfg.size} animate={false}
                            color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight}
                            mask="full" />
            )}
            <span className="relative z-10 w-7 h-7 shrink-0 flex items-center justify-center"
                  style={{
                    background: toast.type === 'error' ? ED.orange : toast.type === 'success' ? ED.mustard : ED.ink,
                    color: toast.type === 'info' ? ED.paper : ED.ink
                  }}>
              {toast.type === 'error' ? <AlertTriangle size={14}/> : toast.type === 'success' ? <Check size={14}/> : <Terminal size={14}/>}
            </span>
            <span className="relative z-10 min-w-0 break-words">{toast.msg}</span>
          </div>
        )}

       {/* === GALLERIA VIEWER (style chosen in Admin > Lightbox) === */}
       {lightboxConfig.style === 'editorial' ? (
         <EditorialLightbox
            payload={activeGalleriaImage}
            cfg={lightboxConfig}
            items={galleriaData}
            onClose={() => setActiveGalleriaImage(null)}
            onPrev={goPrevPlate}
            onNext={goNextPlate}
            onJump={(n) => setActiveGalleriaImage({ item: galleriaData[n], index: n })}
            ascii={asciiCfg}
         />
       ) : (
         <GalleriaLightbox
            payload={activeGalleriaImage}
            cfg={lightboxConfig}
            total={galleriaData.length}
            onClose={() => setActiveGalleriaImage(null)}
            onPrev={goPrevPlate}
            onNext={goNextPlate}
            ascii={asciiCfg}
         />
       )}

       {/* === ICE'S SECRET CORNER === */}
       {secretOpen && secretCfg.enabled && (
         <SecretCorner cfg={secretCfg} tracks={secretTracks} ascii={asciiCfg} onClose={() => setSecretOpen(false)} />
       )}

       {/* === POEM OVERLAY === */}
       <PoemOverlay
          poem={activePoem}
          shuffle={poemShuffle}
          onClose={() => setActivePoem(null)}
          onShuffle={() => setPoemShuffle(s => s + 1)}
          onSecret={secretCfg.enabled && secretCfg.showGlyph ? () => setSecretOpen(true) : null}
          ascii={asciiCfg}
       />

       {/* === NEW: TICKET GATE OVERLAY === */}
       {pendingJournal && (
          <div className="fixed inset-0 z-[70] bg-[#111]/80 backdrop-blur-md flex items-center justify-center p-4"
               style={{ animation: 'backdropIn 300ms ease-out both' }}
               onClick={(e) => { if (e.target === e.currentTarget) { setPendingJournal(null); setVisitorName(''); } }}>
             <div className="w-[300px] max-h-[calc(100vh-2rem)] overflow-y-auto hide-scrollbar p-4 flex flex-col relative ed-notch"
                  style={{ background: ED.orange, border: `1px solid ${ED.ink}`, animation: 'ticketIn 720ms var(--ease-out-expo) both' }}>
                <div className="absolute inset-0 ed-halftone pointer-events-none opacity-60" />
                {asciiCfg.enabled && <AsciiTexture seed={31} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed} animate={asciiCfg.animate} color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight} mask={asciiCfg.mask} clear={asciiCfg.clear} />}
                
                <button onClick={() => {setPendingJournal(null); setIsTicketValidating(false); setVisitorName('');}} aria-label="Close" className="ed-arrow absolute top-3 right-3 w-8 h-8 z-50 slide-press" style={{ color: ED.ink }}><X size={14}/></button>

                <div className="relative z-10 mb-3 pr-10"><EdLabel color={`${ED.ink}aa`} right="001">Admit one</EdLabel></div>

                {/* Top Image Box */}
                <div className="w-full h-[200px] overflow-hidden relative z-10" style={{ border: `1px solid ${ED.ink}`, background: ED.paper }}>
                   <img loading="lazy" decoding="async" src={pendingJournal.image} className="w-full h-full object-cover grayscale mix-blend-multiply opacity-80" alt="Ticket Art" />
                   
                   {/* Decorative holes */}
                   <EdCorners color={ED.ink} inset={6} size={10} />
                </div>

                {/* Middle Date/Title */}
                <div className="mt-6 px-1 flex justify-between items-start font-mono font-bold text-sm pb-2 relative z-10" style={{ color: ED.ink, borderBottom: `1px solid ${ED.ink}55` }}>
                   <span>{new Date().getDate().toString().padStart(2, '0')}</span>
                   <div className="flex flex-col items-end">
                      <span>{(new Date().getMonth()+1).toString().padStart(2, '0')}</span>
                      <span className="text-[8px] opacity-70 mt-1">{new Date().getFullYear()}</span>
                   </div>
                </div>
                <h2 className="text-5xl font-serif text-center mt-2 tracking-tight relative z-10" style={{ color: ED.ink }}>archive</h2>

                {/* Perforation */}
                <div className="w-full my-6 relative z-10 flex items-center gap-2">
                   <span className="ed-leader flex-1" style={{ color: ED.ink }} />
                   <span className="text-[8px] leading-none" style={{ color: ED.ink }}>◆</span>
                   <span className="ed-leader flex-1" style={{ color: ED.ink }} />
                </div>

                {/* Bottom Form */}
                <div className="flex-1 flex flex-col px-1 relative z-10">
                   <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2 font-mono font-bold text-[9px] uppercase tracking-[0.25em]" style={{ color: ED.ink }}><span className="text-[7px]">◆</span> TICKET</div>
                      <div className="w-16 h-5" style={{ background: ED.ink, backgroundImage: `repeating-linear-gradient(90deg, ${ED.orange}, ${ED.orange} 1px, transparent 1px, transparent 3px)` }}></div>
                   </div>
                   
                   <form onSubmit={submitJournalAccess} className="mt-auto">
                      <input 
                         required
                         autoFocus
                         disabled={isTicketValidating}
                         value={visitorName} 
                         onChange={e=>setVisitorName(e.target.value)} 
                         placeholder="ENTER IDENTIFICATION" 
                         style={{ borderBottom: `1px solid ${ED.ink}` }}
                         className="w-full bg-transparent placeholder:opacity-55 font-mono text-sm font-bold outline-none py-2 mb-6 focus:bg-white/20 transition-colors disabled:opacity-50" 
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
                  {/* back to the door */}
                  <button onClick={() => goRoute('landing')} title="Back to the entrance"
                          className="relative px-4 py-2 rounded-full border-[2px] border-[#111] font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#111] slide-press flex-shrink-0 bg-white text-[#111] hover:bg-[#dfff00] flex items-center gap-1.5">
                    <ChevronLeft size={12} /> Door
                  </button>
                  <button onClick={() => goRoute('community')} title="Community center"
                          className="relative px-4 py-2 rounded-full border-[2px] border-[#111] font-mono text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-[2px_2px_0px_#111] slide-press flex-shrink-0 bg-white text-[#111] hover:bg-[#dfff00]">
                    Center
                  </button>
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
              {topoOn && <TopoField cfg={backdropCfg} />}
              
              {isAdmin && siteSettings?.wip?.[activeTab] && activeTab !== 'admin' && (
                <div className="absolute top-0 left-0 w-full bg-[#ff5722] text-white text-center py-1.5 font-mono font-bold text-[10px] uppercase tracking-widest z-50 border-b-[2px] border-[#111]">
                  ADMIN OVERRIDE: MODULE HIDDEN FROM PUBLIC (WIP ACTIVE)
                </div>
              )}

              {/* === NEW: JOURNALING TAB OVERLAY === */}
              {activeJournal && (
                <div className="absolute inset-0 z-[60] bg-[#f0ebd8] flex flex-col overflow-y-auto font-sans hide-scrollbar" style={{ animation: 'sheetIn 620ms var(--ease-out-expo) both' }}>
                   {asciiCfg.enabled && (
                     <AsciiTexture seed={71} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed}
                                   animate={asciiCfg.animate} color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight}
                                   className="fixed" mask={asciiCfg.mask} clear={asciiCfg.clear} />
                   )}
                   
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
                                 <img loading="lazy" decoding="async" src={activeEntry.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105" alt="Journal cover" />
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
            style={{ background: `${ED.ink}e0`, animation: 'backdropIn 320ms ease-out both' }}
          >
            <div className="fixed inset-0 ed-grid pointer-events-none" style={{ color: ED.paper }} />
            
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
                                if (block.type === 'image') return <img loading="lazy" decoding="async" key={idx} src={block.content} alt="review visual" className="w-full border-[2px] border-[#111] shadow-[4px_4px_0px_#111] my-6 grayscale hover:grayscale-0 transition-all" />;
                                return null;
                              })}
                          </div>

                          <div className="absolute -bottom-8 -right-8 w-28 h-28 md:w-40 md:h-40 bg-[#dfff00] shadow-[8px_8px_0px_#111] rotate-[4deg] p-2 border-[2px] border-[#111] flex flex-col transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)] hover:rotate-0 hover:scale-105 z-30 anim-stamp" style={{ animationDelay: '1.1s' }}>
                             <Pin size={28} fill="#ff5722" className="absolute -top-4 left-1/2 -translate-x-1/2 text-[#111] z-10" />
                             {selectedItem.coverImage ? (
                                <img loading="lazy" decoding="async" src={selectedItem.coverImage} className="w-full h-full object-cover border-[2px] border-[#111]" alt="Album Art" />
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
              <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto relative anim-sheet hide-scrollbar"
                   style={{ background: ED.paper, color: ED.ink, border: `1px solid ${ED.ink}` }}>
                {asciiCfg.enabled && <AsciiTexture seed={41} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed} animate={asciiCfg.animate} color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight} mask={asciiCfg.mask} clear={asciiCfg.clear} />}
                <EdCorners color={ED.ink} inset={12} size={14} />
                <button aria-label="Close" onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-50 bg-[#111] text-white p-3 border-[2px] border-[#111] hover:bg-[#ff5722] transition-colors slide-press"><X size={20} /></button>
                
                {itemType === 'project' && (
                  <div className="relative">
                    
                    {selectedItem.type === 'gallery' ? (
                      <div className="w-full bg-blueprint border-b-[4px] border-[#111] min-h-[75vh] relative overflow-hidden p-8">
                        {topoOn && <TopoField cfg={backdropCfg} />}
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
                      selectedItem.image && <img loading="lazy" decoding="async" src={selectedItem.image} className="w-full h-96 object-cover border-b-[4px] border-[#111] grayscale" alt="cover" />
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
                            if (block.type === 'image') return <img loading="lazy" decoding="async" key={idx} src={block.content} alt="blog content" className="w-full border-[2px] border-[#111] shadow-[8px_8px_0px_#111] my-12 grayscale hover:grayscale-0 transition-all" />;
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
               style={{ background: `${ED.ink}e6`, animation: 'backdropIn 280ms ease-out both' }}
               onClick={(e) => { if (e.target === e.currentTarget) setShowLogin(false); }}>
            <div className="fixed inset-0 ed-grid pointer-events-none" style={{ color: ED.paper }} />
            <div className="relative w-full max-w-md anim-sheet modal-scroll overflow-hidden"
                 style={{ background: ED.paper, color: ED.ink, border: `1px solid ${ED.ink}` }}>
              {asciiCfg.enabled && <AsciiTexture seed={21} ramp={asciiCfg.ramp} size={asciiCfg.size} speed={asciiCfg.speed} animate={asciiCfg.animate} color={asciiCfg.inkOnLight} opacity={asciiCfg.opacityLight} mask={asciiCfg.mask} clear={asciiCfg.clear} />}
              <EdCorners color={ED.ink} inset={10} size={13} />

              {/* running header */}
              <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
                <div className="min-w-0 flex-1"><EdLabel color={`${ED.ink}99`} right="001">Restricted</EdLabel></div>
                <button onClick={() => setShowLogin(false)} aria-label="Close" className="ed-arrow w-8 h-8 shrink-0 slide-press" style={{ color: ED.ink }}><X size={14}/></button>
              </div>

              <div className="px-8 pb-8 pt-2">
                <div className="mb-7">
                  <div className="w-11 h-11 flex items-center justify-center mb-4"
                       style={{ background: ED.orange, color: ED.paper }}><Lock size={20} /></div>
                  <h2 className="text-4xl font-serif leading-none mb-1" style={{ color: ED.ink }}>Admin override</h2>
                  <p className="font-mono text-[9px] uppercase tracking-[0.28em]" style={{ color: `${ED.ink}77` }}>
                    {supabase ? 'Credentialed access' : 'Local fallback mode'}
                  </p>
                </div>
              <form onSubmit={handleLogin} className="space-y-4">
                {/* In local fallback mode there is no account, so email is optional */}
                <input type="email" required={!!supabase} autoComplete="username" placeholder={supabase ? "IDENTIFICATION" : "IDENTIFICATION (OPTIONAL)"} value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                       className="w-full px-0 py-3 bg-transparent font-mono text-sm outline-none transition-colors placeholder:opacity-45"
                       style={{ color: ED.ink, borderBottom: `1px solid ${ED.ink}44` }} />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="PASSCODE" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
                         className="w-full px-0 py-3 pr-10 bg-transparent font-mono text-sm outline-none transition-colors placeholder:opacity-45"
                         style={{ color: ED.ink, borderBottom: `1px solid ${ED.ink}44` }} />
                  <button type="button" aria-label={showPassword ? 'Hide passcode' : 'Show passcode'} onClick={() => setShowPassword(v => !v)} className="absolute right-0 top-1/2 -translate-y-1/2 p-1 transition-opacity opacity-55 hover:opacity-100" style={{ color: ED.ink }}>
                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                <button disabled={isLoading} type="submit"
                        className="w-full font-mono font-bold uppercase tracking-[0.25em] text-[11px] py-4 mt-6 ed-notch slide-press disabled:opacity-50 transition-colors"
                        style={{ background: ED.ink, color: ED.paper }}>
                  {isLoading ? 'AUTHENTICATING…' : 'Initialize access'}
                </button>
              </form>

              <div className="px-8 pb-5">
                <div className="ed-leader w-full" style={{ color: ED.ink }} />
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}