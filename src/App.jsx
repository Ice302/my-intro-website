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

const ADMIN_TABS = [
  { id: 'about',       label: 'About' },
  { id: 'projects',    label: 'Projects' },
  { id: 'galleria',    label: 'Galleria' },
  { id: 'system',      label: 'System' },
  { id: 'blogs',       label: 'Blogs' },
  { id: 'journals',    label: 'Journals' },
  { id: 'socials',     label: 'Socials' },
  { id: 'messages',    label: 'Messages' },
  { id: 'settings',    label: 'Settings' },
  { id: 'access_logs', label: 'Access Logs' },
];

const defaultSettings = {
  wip: { intro: false, portfolio: false, galleria: false, system: false, blog: false, socials: false, blank: false }
};

// Older saved payloads predate the boot/rack config, so merge defaults in on
// load rather than scattering fallbacks through the render tree.
const mergeAbout = (saved) => ({ ...defaultAbout, ...(saved || {}), boot: { ...defaultAbout.boot, ...((saved || {}).boot || {}) } });
const mergeSystem = (saved) => ({ ...defaultSystem, ...(saved || {}), cables: (saved || {}).cables || defaultSystem.cables });

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
  const [accessLogs, setAccessLogs] = useState([]); // NEW STATE FOR JOURNAL LOGS
  
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
            if (parsed.settings) setSiteSettings(parsed.settings);
            if (parsed.journals) setJournalEntries(parsed.journals);
            if (parsed.playlists) setPlaylists(parsed.playlists);
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
          
          if (p) setProjects(p.data);
          if (b) setBlogs(b.data);
          if (a) setAboutData(mergeAbout(a.data));
          if (s) setSocials(s.data);
          if (g) setGalleriaData(g.data);
          if (sys && sys.data?.timeline) setSystemData(mergeSystem(sys.data));
          if (set && set.data.wip) setSiteSettings(set.data);
          if (j) setJournalEntries(j.data);
          if (pl) setPlaylists(pl.data);
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
      { section: 'playlists', data: playlists }
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
  }, [aboutData, projects, blogs, socials, galleriaData, systemData, siteSettings, journalEntries, playlists, isLoading]);

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
    const locked = !!(selectedItem || showLogin || pendingJournal || activeJournal);
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedItem, showLogin, pendingJournal, activeJournal]);

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
                              /* INTERCEPT WITH TICKET GATE */
                              onClick={() => img.hasJournal && setPendingJournal(img)} 
                              style={{ '--i': i }}
                              className={`gal-item group ${img.hasJournal ? 'cursor-pointer' : 'cursor-default'}`}>
                            
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

        .bg-blueprint {
          background-image: linear-gradient(rgba(17,17,17,0.08) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(17,17,17,0.08) 1px, transparent 1px);
          background-size: 30px 30px;
        }

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

      <div className="min-h-screen bg-[#e8e8e3] p-4 md:p-8 flex items-center justify-center relative transition-all duration-1000">
        
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