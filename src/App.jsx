import React, { useState, useEffect, useRef } from 'react';
import { Pin, X, Lock, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, ArrowLeft, LogOut, Upload, ChevronUp, ChevronDown, MessageSquare, Star, Send, Pencil, Activity, Heart, Thermometer, Droplets, Video, LayoutGrid, FileText, Search, Calendar, Cpu, Database, Network, Settings, GitBranch, Terminal, GripVertical } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

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
      className={`absolute shadow-xl border-4 border-white select-none transition-transform duration-200 ${isAdmin ? 'cursor-move hover:scale-[1.02] touch-none' : ''}`}
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

// --- DEFAULT DATA ---
const defaultProjects = [
  { id: 1, tabId: "94", title: "oil lamp", tabAlign: "center", type: "project", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80", content: "Main system architecture." },
  { id: 2, tabId: "95", title: "oats", tabAlign: "right", type: "gallery", galleryBlocks: [{id:1, w: 300, x: 50, y: 50, z: 1, image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80'}], content: "A collection of renders." },
  { id: 3, tabId: "O", title: "010", tabAlign: "left", type: "divider" },
  { id: 4, tabId: "96", title: "pants", tabAlign: "center", type: "video", videoTags: ["Motion", "Typography"], image: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", content: "Kinetic typography experiments." },
  { id: 5, tabId: "97", title: "plane", tabAlign: "right", type: "project", image: "https://images.unsplash.com/photo-1497493213477-0c0e5f410d32?w=400&q=80", content: "Old files and deprecated code." }
];

const defaultBlogs = [
  { id: 1, type: "regular", date: "Oct 12, 2026", title: "Finding peace in slower development cycles", excerpt: "Sometimes the best code is the code you write after stepping away from the screen for a while. In a world obsessed with shipping fast, I took a month to just plan my next architecture.", rating: 5, coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80", category: "Life" },
  { id: 2, type: "album", date: "Nov 01, 2026", title: "Blonde - Frank Ocean", excerpt: "A masterpiece of modern R&B that explores the duality of youth, nostalgia, and heartbreak. The minimalist production leaves so much room for emotional resonance.\n\nFavorite tracks: \n- Nikes\n- Ivy\n- White Ferrari", rating: 5, coverImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80", category: "Music" }
];

const defaultAbout = {
  appBackground: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041&auto=format&fit=crop",
  introText: "Hellooo, the name is Vinz!\nYou can call me Ice^^",
  introImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
  notepadText: "This year, I decided to focus on building things I love. I wasn't able to launch many projects, but I did build a few amazing ones.",
  myspace: [{ id: 1, name: "Dirk", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" }],
  interests: [{ id: 1, title: "Anime", desc: "Anime is great...", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80" }],
  obsessions: [{ id: 1, category: "Top 10 Anime", items: ["Frieren", "Tanya"] }]
};

const defaultSystem = {
  title: "Concept Map",
  navPills: ["Treatment Dynamics", "Visits", "Medications", "Labs", "Allergies"],
  profile: { name: "System Core", role: "Primary Node", image: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80" },
  stats: [
    { id: 1, label: "Heart Rate", value: "89", unit: "bpm" },
    { id: 2, label: "Pressure", value: "100/67", unit: "" },
    { id: 3, label: "Oxygen", value: "98", unit: "%" },
    { id: 4, label: "Temperature", value: "36.8", unit: "°C" }
  ],
  timeline: [
    {
      id: "col1", period: "Phase 1", subtitle: "Initialization",
      nodes: [
        { id: "n1", type: "pill", title: "Boot Sequence", value: "x2", icon: "Terminal" },
        { id: "n2", type: "card", title: "Memory Allocation", mainValue: "160/90", subValue: "Average: 120", chartType: "bar", icon: "Database" },
        { id: "n3", type: "card", title: "Core Temp", mainValue: "Normal", subValue: "Stable", chartType: "pulse", icon: "Thermometer" }
      ]
    },
    {
      id: "col2", period: "Phase 2", subtitle: "Execution",
      nodes: [
        { id: "n4", type: "pill", title: "Routing", value: "x3", icon: "Network" },
        { id: "n5", type: "card", title: "Data Stream", mainValue: "135/92", subValue: "Average: 130", chartType: "bar", icon: "Activity" }
      ]
    }
  ]
};

const defaultSocials = [
  { id: 1, name: 'GitHub', url: 'https://github.com', image: 'https://placehold.co/400x400/991b1b/fff?text=G' }
];

const defaultSettings = {
  wip: { intro: false, portfolio: false, system: false, blog: false, socials: false, blank: false }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [projects, setProjects] = useState(defaultProjects);
  const [blogs, setBlogs] = useState(defaultBlogs);
  const [aboutData, setAboutData] = useState(defaultAbout);
  const [systemData, setSystemData] = useState(defaultSystem);
  const [socials, setSocials] = useState(defaultSocials);
  const [siteSettings, setSiteSettings] = useState(defaultSettings);
  
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

  // Drag and Drop Ref States for Admin Panel
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleSortAboutList = (listName) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) return;
    
    const _aboutData = { ...aboutData };
    const list = [..._aboutData[listName]];
    const draggedItemContent = list.splice(dragItem.current, 1)[0];
    list.splice(dragOverItem.current, 0, draggedItemContent);
    
    dragItem.current = null;
    dragOverItem.current = null;
    setAboutData({ ..._aboutData, [listName]: list });
  };

  useEffect(() => {
    async function loadDataAndAuth() {
      if (!supabase) {
        console.warn("Supabase credentials not found. Running in local fallback mode.");
        setIsLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setIsAdmin(true);

        const { data: siteData } = await supabase.from('site_data').select('*');
        if (siteData && siteData.length > 0) {
          const p = siteData.find(d => d.section === 'projects');
          const b = siteData.find(d => d.section === 'blogs');
          const a = siteData.find(d => d.section === 'about');
          const s = siteData.find(d => d.section === 'socials');
          const sys = siteData.find(d => d.section === 'system');
          const set = siteData.find(d => d.section === 'settings');
          
          if (p) setProjects(p.data);
          if (b) setBlogs(b.data);
          if (a) setAboutData(a.data);
          if (s) setSocials(s.data);
          if (sys && sys.data.timeline) setSystemData(sys.data);
          if (set && set.data.wip) setSiteSettings(set.data);
        }

        const { data: messages } = await supabase.from('playground_messages').select('*').order('created_at', { ascending: false });
        if (messages) setGuestMessages(messages);
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
      ctx.strokeStyle = '#991b1b';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [playgroundMode]);

  const startDrawing = (e) => { e.preventDefault(); setIsDrawing(true); draw(e); };
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
    if (!supabase) return alert("Database not connected.");
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
    setIsLoading(false);
    if (error) alert("Login Failed: " + error.message);
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
    if (file.size > 1024 * 1024 * 2) { alert("Please choose an image smaller than 2MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result);
    reader.readAsDataURL(file);
  };

  const saveAllToCloud = async (overrideProjects = null) => {
    if (!supabase) return alert("Database not connected.");
    setIsSaving(true);
    const updates = [
      { section: 'about', data: aboutData },
      { section: 'projects', data: overrideProjects || projects },
      { section: 'blogs', data: blogs },
      { section: 'socials', data: socials },
      { section: 'system', data: systemData },
      { section: 'settings', data: siteSettings }
    ];
    const { error } = await supabase.from('site_data').upsert(updates);
    setIsSaving(false);
    if (error) alert("Error saving: " + error.message);
    else alert("Successfully deployed all changes to the cloud!");
  };

  const handleListSave = (e, listType) => {
    e.preventDefault();
    if (listType === 'projects') {
      const newList = editingItem.id ? projects.map(p => p.id === editingItem.id ? editingItem : p) : [...projects, { ...editingItem, id: Date.now() }];
      setProjects(newList);
    } else if (listType === 'blogs') {
      const newList = editingItem.id ? blogs.map(b => b.id === editingItem.id ? editingItem : b) : [...blogs, { ...editingItem, id: Date.now() }];
      setBlogs(newList);
    } else if (listType === 'socials') {
      const newList = editingItem.id ? socials.map(s => s.id === editingItem.id ? editingItem : s) : [...socials, { ...editingItem, id: Date.now() }];
      setSocials(newList);
    }
    setEditingItem(null);
  };

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
    alert("Gallery layout saved successfully!");
  };

  const sendAnonymousMessage = async (e) => {
    e.preventDefault();
    if (!supabase) return alert("Database not connected.");
    let payload = newGuestMessage;
    if (playgroundMode === 'draw' && canvasRef.current) payload = canvasRef.current.toDataURL(); 
    if (!payload.trim() || payload === 'data:,') return;

    setIsSendingMessage(true);
    const { data, error } = await supabase.from('playground_messages').insert([{ message: payload }]).select();
    if (!error && data) {
      setGuestMessages([data[0], ...guestMessages]);
      setNewGuestMessage("");
      if (playgroundMode === 'draw') {
        const ctx = canvasRef.current.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      alert("Note sent anonymously!");
    } else {
      alert("Error sending note: " + (error?.message || "Unknown error"));
    }
    setIsSendingMessage(false);
  };

  const tabs = [
    { id: 'intro', label: 'Intro' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'system', label: 'System' },
    { id: 'blog', label: 'Blog' },
    { id: 'socials', label: 'Socials' },
    { id: 'blank', label: 'Playground' },
  ];
  if (isAdmin) tabs.push({ id: 'admin', label: 'Admin Panel' });

  const renderContent = () => {
    if (isLoading && activeTab !== 'admin') {
      return <div className="h-full flex items-center justify-center text-red-900 font-bold font-mono">Loading...</div>;
    }

    // WORK IN PROGRESS (WIP) OVERRIDE
    if (siteSettings?.wip?.[activeTab] && activeTab !== 'admin') {
      if (!isAdmin) {
        return (
          <div className="min-h-full flex flex-col items-center justify-center text-center pb-20">
            <div className="w-24 h-24 mb-6 border-4 border-dashed border-red-800 rounded-full animate-[spin_3s_linear_infinite] flex items-center justify-center">
               <div className="w-16 h-16 bg-red-100 rounded-full"></div>
            </div>
            <h1 className="text-5xl md:text-6xl font-title text-[#991b1b] mb-4 tracking-wide">Work In Progress</h1>
            <p className="font-body text-gray-700 text-lg max-w-md">I am currently building this section. Please check back later for updates!</p>
          </div>
        );
      }
    }

    switch (activeTab) {
      case 'intro':
        return (
          <div className="flex flex-col lg:flex-row gap-6 items-start min-h-full pb-16 relative">
            <div className="flex-1 w-full space-y-10 min-w-0">
              <div>
                <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-4 tracking-wide">My Introduction</h1>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="whitespace-pre-wrap font-body text-base text-gray-800 flex-1 leading-normal">{aboutData.introText}</div>
                  {aboutData.introImage && (
                    <div className="w-full md:w-56 shrink-0 rotate-1 hover:rotate-0 transition-transform">
                      <img src={aboutData.introImage} alt="Intro" className="w-full rounded shadow-md border border-yellow-600/30" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-1 border-b border-red-900/20 pb-1 tracking-wide">People I like</h2>
                <p className="font-body text-xs text-gray-500 mb-3 italic">(Nickname-wise)(Photos are what i think of them :&gt;)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {aboutData.myspace.map((friend, i) => (
                    <div key={friend.id} className="group">
                      <p className="text-lg font-handwriting text-red-800 mb-1">{i+1}. {friend.name}</p>
                      <img src={friend.image} alt={friend.name} className="w-full aspect-square object-cover rounded-sm shadow-sm border border-yellow-600/30 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-3 border-b border-red-900/20 pb-1 tracking-wide">Interests</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {aboutData.interests.map((interest) => (
                    <div key={interest.id}>
                      <h3 className="font-subtitle font-bold text-gray-900 mb-1 truncate text-xl" title={interest.title}>{interest.title}</h3>
                      <img src={interest.image} alt={interest.title} className="w-full aspect-[4/3] object-cover rounded-sm shadow-sm border border-yellow-600/30 mb-2" />
                      <p className="text-xs text-gray-700 font-body leading-relaxed whitespace-pre-wrap">{interest.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-3 border-b border-red-900/20 pb-1 tracking-wide">
                  Obsessions <span className="text-xl font-handwriting text-red-800/60 font-normal ml-2 tracking-normal">(Top 10s)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {aboutData.obsessions.map((obs) => (
                    <div key={obs.id} className="bg-[#e4d467] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),_inset_-2px_-2px_4px_rgba(255,255,255,0.4)] p-4 rounded-xl border border-yellow-600/20 transition-all hover:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.15),_inset_-3px_-3px_6px_rgba(255,255,255,0.5)]">
                      <h3 className="font-bold font-subtitle text-gray-900 mb-2 text-lg border-b border-gray-900/10 pb-1 leading-tight break-words">{obs.category}</h3>
                      <ol className="list-decimal list-inside text-xs text-gray-800 space-y-1 font-body">
                        {obs.items.map((item, i) => (
                          <li key={i} className="leading-tight pl-1 marker:text-red-800/70 marker:font-bold break-words whitespace-normal" title={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full lg:w-72 shrink-0 mt-8 lg:mt-0 sticky top-8 z-20">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-red-700">
                <Pin size={32} fill="#b91c1c" className="drop-shadow-md rotate-12" />
              </div>
              <div className="bg-[#fefce8] p-5 pt-8 rounded shadow-md rotate-2 transition-transform hover:rotate-0 duration-300 relative overflow-hidden min-h-[16rem] border border-yellow-200">
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(transparent 95%, #fca5a5 95%)', backgroundSize: '100% 1.8rem' }}></div>
                <p className="font-handwriting text-2xl text-red-800/90 leading-[1.8rem] relative z-10 break-words">
                  {aboutData.notepadText || "Write a note in the admin panel!"}
                </p>
                <div className="text-right text-red-800/60 mt-2 font-handwriting text-xl relative z-10">✧.*</div>
              </div>
            </div>
          </div>
        );

      case 'portfolio':
        const containerHeightRem = 6 + projects.length * 1.6;
        return (
          <div className="min-h-full pb-16 flex flex-col items-center">
            
            <h1 className="text-5xl md:text-6xl font-title text-[#991b1b] mb-12 tracking-wide uppercase flex items-center gap-4 drop-shadow-sm">
              Index <span className="text-2xl md:text-3xl font-subtitle text-[#1a1a1a] lowercase tracking-normal mt-2">(Projects)</span>
            </h1>

            <div className="w-full max-w-4xl flex flex-col items-center relative z-20 mt-4">
              <div 
                className="w-[96%] relative overflow-hidden flex justify-center"
                style={{ height: `${containerHeightRem}rem`, minHeight: '14rem' }}
              >
                {/* 1. The Slanted Grey Background (Pure Trapezoid) */}
                <div 
                  className="absolute inset-0 bg-[#e8e8e8] z-0"
                  style={{ clipPath: 'polygon(10% 2.5rem, 90% 2.5rem, 98% 100%, 2% 100%)' }}
                ></div>

                {/* 2. The Perspective Lines (Tracing the Trapezoid exactly) */}
                <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" style={{ overflow: 'visible' }}>
                   <line x1="10%" y1="2.5rem" x2="90%" y2="2.5rem" stroke="#1a1a1a" strokeWidth="2" />
                   <line x1="10%" y1="2.5rem" x2="2%" y2="100%" stroke="#1a1a1a" strokeWidth="2" />
                   <line x1="90%" y1="2.5rem" x2="98%" y2="100%" stroke="#1a1a1a" strokeWidth="2" />
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
                  const folderBg = isBlack ? 'bg-[#1a1a1a]' : 'bg-[#f4f1e1]';
                  const textColor = isBlack ? 'text-[#f4f1e1]' : 'text-[#1a1a1a]';
                  const borderColor = 'border-[#1a1a1a]';

                  return (
                    <div 
                      key={item.id} 
                      onClick={() => openModal(item, 'project')}
                      className="absolute transition-transform duration-300 hover:-translate-y-2 cursor-pointer group select-none"
                      style={{ 
                        top: `${topPos}rem`,
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        zIndex: zIndex
                      }}
                    >
                      <div 
                        className={`absolute -top-[1.75rem] h-[2rem] w-[22%] min-w-[50px] ${folderBg} border-2 ${borderColor} border-b-0 rounded-t-[8px] flex items-center justify-between px-2 z-20`}
                        style={{ left: `${leftOffset}%` }}
                      >
                        <span className={`font-mono text-[9px] md:text-[11px] font-bold ${textColor}`}>
                          {isBlack ? item.title.charAt(0).toUpperCase() : (i+94).toString().padStart(3, '0')}
                        </span>
                        <div className={`w-[1px] h-[50%] ${isBlack ? 'bg-white/20' : 'bg-[#1a1a1a]/30'} mx-1 md:mx-2`}></div>
                        <span className={`font-mono text-[9px] md:text-[11px] font-bold truncate ${textColor} lowercase`}>
                          {isBlack ? (i+3).toString().padStart(3, '0') : item.title.split(' ')[0]}
                        </span>
                      </div>
                      <div 
                        className={`absolute -top-[2px] h-[4px] bg-transparent z-30 pointer-events-none flex justify-center`}
                        style={{ left: `${leftOffset}%`, width: '22%' }}
                      >
                         <div className={`w-[calc(100%-4px)] h-full ${folderBg}`}></div>
                      </div>
                      <div className={`w-full h-[24rem] ${folderBg} border-2 ${borderColor} rounded-t-[8px] relative z-10`}>
                         <div className="absolute top-0 left-0 w-full h-[1px] bg-white/40 rounded-t-[8px] pointer-events-none"></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="w-[100%] h-14 bg-[#d4d4d4] border-2 border-[#1a1a1a] border-b-[16px] rounded-sm z-50 flex items-center justify-center relative mt-[-2px]">
                 <div className="absolute bottom-[-16px] right-8 md:right-16 bg-[#fbf065] px-4 py-1.5 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] rotate-[-4deg] font-mono font-bold text-[10px] md:text-xs hover:rotate-0 transition-transform cursor-pointer z-50">
                   sam's secret files
                 </div>
              </div>

            </div>
          </div>
        );

      case 'system': {
        return (
          <div className="min-h-full pb-16 relative z-30 font-body">
            <div className="bg-[#f4f1e1] border-[4px] border-[#1a1a1a] shadow-[12px_12px_0px_#1a1a1a] relative w-full overflow-hidden flex flex-col h-[80vh] min-h-[700px]">
              <div className="bg-[#1a1a1a] text-[#f4f1e1] px-5 py-3 flex justify-between items-center border-b-[4px] border-[#1a1a1a] shrink-0 z-20 relative">
                 <div className="flex gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-[#ff5f56] border-[2px] border-[#1a1a1a] shadow-[2px_2px_0px_#000]"></div>
                    <div className="w-4 h-4 rounded-full bg-[#ffbd2e] border-[2px] border-[#1a1a1a] shadow-[2px_2px_0px_#000]"></div>
                    <div className="w-4 h-4 rounded-full bg-[#27c93f] border-[2px] border-[#1a1a1a] shadow-[2px_2px_0px_#000]"></div>
                 </div>
                 <h1 className="text-3xl font-title tracking-[0.2em] uppercase absolute left-1/2 -translate-x-1/2 mt-1">{systemData?.title || 'System Core'}</h1>
                 <div className="flex gap-2">
                    {(systemData?.navPills || []).slice(0, 2).map((nav, i) => (
                       <div key={i} className="hidden md:block bg-[#f4f1e1] text-[#1a1a1a] border-[2px] border-[#1a1a1a] px-3 py-1 font-bold text-xs uppercase tracking-widest shadow-[2px_2px_0px_#1a1a1a]">
                          {nav}
                       </div>
                    ))}
                 </div>
              </div>
            </div>
          </div>
        );
      }

      case 'blog':
        const regularBlogs = blogs.filter(b => b.type !== 'album');
        const albumBlogs = blogs.filter(b => b.type === 'album');

        return (
          <div className="min-h-full pb-16 max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-8 tracking-wide">My Thoughts</h1>
              {regularBlogs.length === 0 ? (
                <p className="text-xl font-subtitle text-gray-600 mt-10">No regular posts right now...</p>
              ) : (
                <div className="space-y-6">
                  {regularBlogs.map((post) => (
                    <div key={post.id} onClick={() => openModal(post, 'blog')} className="bg-white/40 flex flex-col md:flex-row overflow-hidden rounded-2xl border border-yellow-600/20 shadow-sm hover:bg-white/60 transition-colors cursor-pointer group">
                      {post.coverImage && (
                        <div className="w-full md:w-[40%] h-56 md:h-auto shrink-0 overflow-hidden relative">
                          <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="cover"/>
                          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                        </div>
                      )}
                      <div className="p-6 md:p-8 flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-handwriting text-red-700 text-2xl">{post.date}</p>
                          {post.rating && (
                            <div className="flex text-yellow-500">
                              {[...Array(Number(post.rating))].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                            </div>
                          )}
                        </div>
                        <h2 className="font-title text-4xl mb-2 text-gray-900 group-hover:text-red-700 transition-colors tracking-wide">{post.title}</h2>
                        {post.category && <span className="text-[10px] font-bold uppercase tracking-widest text-red-800 bg-red-100 px-2 py-1 rounded w-fit mb-3">{post.category}</span>}
                        <p className="font-body text-gray-700 text-base line-clamp-3 leading-relaxed">{post.excerpt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full lg:w-72 shrink-0 lg:mt-24">
              <h2 className="text-4xl font-title text-[#991b1b] mb-4 tracking-wide border-b border-red-900/20 pb-2">Vinyl Reviews</h2>
              <div className="bg-[#4a3629] p-4 rounded-xl shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)] flex flex-col-reverse gap-0.5 min-h-[300px] border-[6px] border-[#312219]">
                  {albumBlogs.length === 0 ? (
                    <p className="text-gray-400 font-body text-center text-sm py-10">Shelf is empty</p>
                  ) : albumBlogs.map(album => (
                      <div key={album.id} onClick={() => openModal(album, 'blog')} className="h-10 bg-gradient-to-r from-[#e3dac9] via-[#fff] to-[#e3dac9] rounded-sm shadow-[0_-2px_4px_rgba(0,0,0,0.3)] cursor-pointer hover:-translate-x-4 transition-transform flex items-center px-4 relative overflow-hidden group">
                         <div className="w-full h-[1px] bg-black/10 absolute top-1 left-0"></div>
                         <div className="w-full h-[1px] bg-black/10 absolute bottom-1 left-0"></div>
                         <span className="font-title text-sm tracking-widest text-black/80 truncate w-full group-hover:text-red-800 transition-colors">{album.title}</span>
                         <div className="absolute right-0 top-0 h-full w-4 bg-[#111] opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 1px, #222 1px, #222 2px)' }}></div>
                      </div>
                  ))}
              </div>
              <p className="text-xs font-body text-gray-600 mt-3 text-center italic">Click a spine to pull out the record.</p>
            </div>
          </div>
        );

      case 'blank':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center relative">
            <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-4 text-center tracking-wide">Anonymous Notes</h1>
            <p className="text-gray-700 mb-8 font-body text-base text-center max-w-md">Leave a message, a drawing, or whatever is on your mind. It's completely anonymous.</p>
            
            <div className="w-full max-w-xl bg-white/40 p-6 rounded-3xl shadow-sm border border-yellow-600/30 backdrop-blur-sm relative z-10">
              <div className="flex gap-2 mb-6 justify-center border-b border-yellow-600/20 pb-6">
                <button onClick={() => setPlaygroundMode('text')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-colors ${playgroundMode === 'text' ? 'bg-red-800 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}><Type size={18}/> Text</button>
                <button onClick={() => setPlaygroundMode('draw')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-colors ${playgroundMode === 'draw' ? 'bg-red-800 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}><Pencil size={18}/> Draw</button>
              </div>

              <form onSubmit={sendAnonymousMessage}>
                {playgroundMode === 'text' ? (
                  <textarea required value={newGuestMessage} onChange={(e) => setNewGuestMessage(e.target.value)} placeholder="Write something cool here..." className="w-full h-48 p-5 rounded-2xl border border-yellow-600/20 bg-white/70 focus:bg-white outline-none font-handwriting text-3xl text-gray-800 resize-none mb-4 shadow-inner" />
                ) : (
                  <div className="mb-4 touch-none">
                    <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-64 bg-white border border-yellow-600/20 rounded-2xl cursor-crosshair shadow-inner" />
                    <p className="text-xs text-gray-500 mt-3 text-center italic font-body">Draw inside the box. Use mouse or finger.</p>
                  </div>
                )}
                <button disabled={isSendingMessage} type="submit" className="w-full bg-red-800 text-white font-bold py-4 rounded-2xl hover:bg-red-900 transition-colors flex items-center justify-center gap-2 text-lg shadow-md">
                  {isSendingMessage ? 'Sending...' : <><Send size={20}/> Send Note</>}
                </button>
              </form>
            </div>
          </div>
        );

      case 'socials':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center">
            <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-12 tracking-wide">Where to Find Me</h1>
            {socials.length === 0 ? (
              <p className="text-2xl font-subtitle text-gray-600 text-center">Links coming soon...</p>
            ) : (
              <div className="flex gap-6 flex-wrap justify-center">
                {socials.map((social) => (
                  <a key={social.id} href={social.url} target="_blank" rel="noopener noreferrer" className="bg-[#fefce8] p-3 pb-10 rounded shadow-md border border-gray-200 rotate-[-2deg] hover:rotate-0 hover:-translate-y-2 transition-all cursor-pointer w-36 text-center relative block">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-1.5 bg-white/50 shadow-sm rounded-sm backdrop-blur-sm -rotate-2"></div>
                    <div className="w-full h-28 bg-gray-200 mb-3 rounded-sm overflow-hidden flex items-center justify-center">
                      {social.image ? <img src={social.image} alt={social.name} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-400 text-xs">Icon</span>}
                    </div>
                    <span className="font-handwriting text-2xl text-gray-800">{social.name}</span>
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
            <div className="max-w-4xl mx-auto bg-white/50 p-5 rounded-xl border border-yellow-600/30 shadow-lg mb-16">
              <button onClick={() => setEditingItem(null)} className="flex items-center gap-2 text-gray-600 hover:text-red-800 font-bold mb-4 text-sm"><ArrowLeft size={16} /> Back</button>
              
              <form onSubmit={(e) => handleListSave(e, adminTab)} className="space-y-4 font-body">
                
                {adminTab === 'projects' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <select value={editingItem.type || 'project'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm font-bold text-red-900">
                         <option value="project">Standard Project</option>
                         <option value="gallery">Gallery (Free-form Canvas)</option>
                         <option value="video">Video/Music Player</option>
                         <option value="custom">Custom Code (HTML/CSS)</option>
                         <option value="iframe">Embed URL (Iframe)</option>
                         <option value="divider">Black Divider Tag</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab ID</label>
                        <input value={editingItem.tabId || ''} onChange={e => setEditingItem({...editingItem, tabId: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab Title</label>
                        <input value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab Alignment</label>
                        <select value={editingItem.tabAlign || 'left'} onChange={e => setEditingItem({...editingItem, tabAlign: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm">
                           <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    {editingItem.type !== 'divider' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Cover Image / Video URL</label>
                          <div className="flex gap-2">
                            <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white text-sm" />
                            <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                              <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                            </label>
                          </div>
                        </div>

                        {editingItem.type === 'custom' ? (
                           <textarea placeholder="<style>...</style> <div>My Custom Code</div>" value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-gray-900 text-green-400 font-mono text-xs h-64" />
                        ) : editingItem.type === 'iframe' ? (
                           <input placeholder="https://example.com" value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                        ) : (
                           <textarea placeholder="Project Description..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-24 text-sm" />
                        )}
                        
                        {editingItem.type === 'gallery' && (
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mt-4">
                            <h3 className="font-bold text-yellow-900 mb-3 text-sm flex items-center gap-2"><LayoutGrid size={16}/> Gallery Image Setup</h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {(editingItem.galleryBlocks || []).map((block, idx) => (
                                <div key={idx} className="relative group border-2 border-yellow-400 border-dashed p-1 w-[calc(33%-4px)]">
                                  <button type="button" onClick={() => { const n = [...editingItem.galleryBlocks]; n.splice(idx, 1); setEditingItem({...editingItem, galleryBlocks: n}); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 z-10"><Trash2 size={12}/></button>
                                  {block.image ? (
                                    <img src={block.image} className="w-full h-32 object-cover rounded shadow" alt="block"/>
                                  ) : (
                                    <label className="w-full h-32 flex flex-col items-center justify-center bg-white rounded shadow cursor-pointer hover:bg-gray-50 text-xs text-gray-400">
                                      <Upload size={16} className="mb-1"/> Add Image
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.galleryBlocks]; n[idx].image = base64; setEditingItem({...editingItem, galleryBlocks: n}); })} />
                                    </label>
                                  )}
                                  <div className="mt-1 flex gap-1">
                                    <input type="number" placeholder="Width px" value={block.w || 250} onChange={e => { const n = [...editingItem.galleryBlocks]; n[idx].w = Number(e.target.value); setEditingItem({...editingItem, galleryBlocks: n}); }} className="w-full text-[10px] p-1 border rounded" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => setEditingItem({...editingItem, galleryBlocks: [...(editingItem.galleryBlocks||[]), {id: Date.now(), w: 250, x: Math.random()*100, y: Math.random()*100, z: 1, image: ''}]})} className="bg-yellow-200 text-yellow-900 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-300 transition-colors">+ Add Image</button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {adminTab === 'blogs' && (
                  <>
                    <div className="mb-4">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase">Review Type</label>
                       <select value={editingItem.type || 'regular'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="w-full p-2 rounded border bg-white text-sm font-bold text-red-900">
                           <option value="regular">Regular Blog Post</option>
                           <option value="album">Vinyl Album Review</option>
                       </select>
                    </div>

                    <div className="flex gap-4 mb-4">
                      <div className="w-1/3">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Date</label>
                        <input required value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="w-full p-2 rounded border bg-white text-sm" />
                      </div>
                      <div className="w-1/3">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Category</label>
                        <input value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-2 rounded border bg-white text-sm" />
                      </div>
                      <div className="w-1/3">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Star Rating (1-5)</label>
                        <input type="number" min="1" max="5" value={editingItem.rating || ''} onChange={e => setEditingItem({...editingItem, rating: e.target.value})} className="w-full p-2 rounded border bg-white text-sm" />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">
                         {editingItem.type === 'album' ? 'Album Art (Sticky Note Image)' : 'Cover Image'}
                      </label>
                      <div className="flex gap-2">
                         <input value={editingItem.coverImage || ''} onChange={e => setEditingItem({...editingItem, coverImage: e.target.value})} className="flex-1 p-2 rounded border bg-white text-sm" />
                         <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                           <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, coverImage: base64}))} />
                         </label>
                      </div>
                    </div>

                    <div className="mb-4">
                       <label className="block text-[10px] font-bold text-gray-500 uppercase">Review Body</label>
                       <textarea value={editingItem.excerpt || ''} onChange={e => setEditingItem({...editingItem, excerpt: e.target.value})} className="w-full p-2 rounded border bg-white min-h-[10rem] whitespace-pre-wrap text-sm" />
                    </div>
                  </>
                )}
                
                {adminTab === 'socials' && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Platform Name</label>
                        <input required value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 rounded border bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Profile URL</label>
                        <input required value={editingItem.url || ''} onChange={e => setEditingItem({...editingItem, url: e.target.value})} className="w-full p-2 rounded border bg-white text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase">Icon/Image</label>
                      <div className="flex gap-2">
                        <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border bg-white text-sm" />
                        <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                          <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                        </label>
                      </div>
                    </div>
                  </>
                )}
                
                <button type="submit" className="w-full bg-red-800 text-white p-3 rounded font-bold hover:bg-red-900 text-sm mt-4">Done Editing</button>
              </form>
            </div>
          );
        }

        return (
          <div className="min-h-full pb-32 font-body relative">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-5xl md:text-6xl font-title text-[#991b1b] tracking-wide">Admin Dashboard</h1>
              <button onClick={handleLogout} className="flex items-center gap-2 text-red-700 bg-red-100 px-3 py-1.5 rounded-lg font-bold hover:bg-red-200 text-sm"><LogOut size={16}/> Logout</button>
            </div>
            
            <div className="flex gap-1 overflow-x-auto mb-6 border-b border-gray-300 pb-1">
              {['about', 'projects', 'system', 'blogs', 'socials', 'messages', 'settings'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} className={`font-bold capitalize px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap text-sm ${adminTab === tab ? 'bg-red-800 text-white' : 'bg-white/50 text-gray-700 hover:bg-white'}`}>
                  Manage {tab}
                </button>
              ))}
            </div>

            {/* SETTINGS (WIP) */}
            {adminTab === 'settings' && (
              <div className="bg-white/50 p-6 rounded-xl border border-yellow-600/30 space-y-6">
                <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">Work in Progress (WIP) Controls</h3>
                <p className="text-sm text-gray-600 mb-4">Toggle these switches to hide pages from the public and display a "Work In Progress" screen instead. As an admin, you will always bypass this screen.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {['intro', 'portfolio', 'system', 'blog', 'socials', 'blank'].map(tab => (
                     <label key={tab} className={`flex items-center gap-2 cursor-pointer p-4 rounded-lg border-2 transition-colors ${siteSettings.wip?.[tab] ? 'bg-red-50 border-red-200 text-red-900' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <input type="checkbox" checked={!!siteSettings.wip?.[tab]} onChange={e => setSiteSettings({ ...siteSettings, wip: { ...siteSettings.wip, [tab]: e.target.checked } })} className="w-5 h-5 rounded text-red-600 border-gray-300 focus:ring-red-500" />
                        <span className="capitalize font-bold text-sm">Hide {tab === 'blank' ? 'Playground' : tab}</span>
                     </label>
                   ))}
                </div>
              </div>
            )}

            {/* SYSTEM SETTINGS */}
            {adminTab === 'system' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30 space-y-8">
                <div>
                  <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">1. System Settings</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">System Title</label>
                        <input value={systemData.title} onChange={e => setSystemData({...systemData, title: e.target.value})} className="w-full p-2 border rounded text-sm" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold uppercase text-gray-500">Nav Pills (Comma Separated)</label>
                        <input value={systemData.navPills.join(', ')} onChange={e => setSystemData({...systemData, navPills: e.target.value.split(',').map(s=>s.trim())})} className="w-full p-2 border rounded text-sm" />
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABOUT TAB SETTINGS */}
            {adminTab === 'about' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30 space-y-6">
                <div>
                  <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">Intro & Background</h3>
                  <textarea value={aboutData.introText} onChange={e => setAboutData({...aboutData, introText: e.target.value})} className="w-full p-2 border rounded h-24 text-sm mb-2" />
                  <div className="flex gap-2 mb-2">
                    <input value={aboutData.introImage} onChange={e => setAboutData({...aboutData, introImage: e.target.value})} className="flex-1 p-2 border rounded text-sm" placeholder="Intro Image URL" />
                    <label className="cursor-pointer bg-gray-200 px-2 rounded hover:bg-gray-300 flex items-center text-xs"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setAboutData({...aboutData, introImage: b}))} /></label>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input value={aboutData.appBackground} onChange={e => setAboutData({...aboutData, appBackground: e.target.value})} className="flex-1 p-2 border rounded text-sm" placeholder="App Background Image URL" />
                    <label className="cursor-pointer bg-gray-200 px-2 rounded hover:bg-gray-300 flex items-center text-xs"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, b => setAboutData({...aboutData, appBackground: b}))} /></label>
                  </div>
                  <textarea value={aboutData.notepadText} onChange={e => setAboutData({...aboutData, notepadText: e.target.value})} maxLength={120} className="w-full p-2 border rounded h-16 text-sm" placeholder="Sticky Note Text (Max 120 chars)" />
                </div>

                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">2. Myspace Ref</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.myspace.map((friend, idx) => (
                      <div 
                        key={friend.id} 
                        draggable
                        onDragStart={() => dragItem.current = idx}
                        onDragEnter={() => dragOverItem.current = idx}
                        onDragEnd={() => handleSortAboutList('myspace')}
                        onDragOver={(e) => e.preventDefault()}
                        className="bg-white p-3 border border-gray-200 rounded flex gap-2 items-center hover:border-gray-300 transition-colors"
                      >
                        <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1 -ml-2"><GripVertical size={16}/></div>
                        <img src={friend.image || 'https://placehold.co/100x100'} className="w-12 h-12 rounded object-cover" alt="prev"/>
                        <div className="flex-1 space-y-2">
                          <input 
                            value={friend.name} 
                            onChange={(e) => { const n = [...aboutData.myspace]; n[idx].name = e.target.value; setAboutData({...aboutData, myspace: n}); }}
                            className="w-full p-1 border-b border-gray-200 text-sm outline-none font-bold" placeholder="Friend Name"
                          />
                          <input 
                            value={friend.image} 
                            onChange={(e) => { const n = [...aboutData.myspace]; n[idx].image = e.target.value; setAboutData({...aboutData, myspace: n}); }}
                            className="w-full p-1 border-b border-gray-200 text-xs outline-none text-gray-500" placeholder="Image URL"
                          />
                        </div>
                        <button type="button" onClick={() => setAboutData({...aboutData, myspace: aboutData.myspace.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, myspace: [...aboutData.myspace, { id: Date.now(), name: "New Friend", image: "" }]})} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm"><Plus size={16}/> Add Myspace Friend</button>
                </div>

                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">3. Interests</h3>
                  <div className="space-y-4 mb-4">
                    {aboutData.interests.map((interest, idx) => (
                      <div 
                        key={interest.id} 
                        draggable
                        onDragStart={() => dragItem.current = idx}
                        onDragEnter={() => dragOverItem.current = idx}
                        onDragEnd={() => handleSortAboutList('interests')}
                        onDragOver={(e) => e.preventDefault()}
                        className="bg-white p-4 border border-gray-200 rounded flex flex-col md:flex-row gap-4 hover:border-gray-300 transition-colors relative"
                      >
                        <div className="absolute top-2 left-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 md:relative md:top-0 md:left-0 flex items-center"><GripVertical size={20}/></div>
                        <div className="w-full md:w-32 shrink-0 mt-4 md:mt-0">
                           <img src={interest.image || 'https://placehold.co/300x200'} className="w-full h-24 object-cover rounded" alt="prev"/>
                        </div>
                        <div className="flex-1 space-y-2">
                          <input 
                            value={interest.title} 
                            onChange={(e) => { const n = [...aboutData.interests]; n[idx].title = e.target.value; setAboutData({...aboutData, interests: n}); }}
                            className="w-full p-2 border border-gray-200 rounded font-bold outline-none" placeholder="Interest Title"
                          />
                          <input 
                            value={interest.image} 
                            onChange={(e) => { const n = [...aboutData.interests]; n[idx].image = e.target.value; setAboutData({...aboutData, interests: n}); }}
                            className="w-full p-2 border border-gray-200 rounded text-sm outline-none" placeholder="Image URL"
                          />
                          <textarea 
                            value={interest.desc} 
                            onChange={(e) => { const n = [...aboutData.interests]; n[idx].desc = e.target.value; setAboutData({...aboutData, interests: n}); }}
                            className="w-full p-2 border border-gray-200 rounded text-sm outline-none min-h-[5rem] whitespace-pre-wrap" placeholder="Description..."
                          />
                        </div>
                        <button type="button" onClick={() => setAboutData({...aboutData, interests: aboutData.interests.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded h-fit absolute top-2 right-2 md:relative md:top-0 md:right-0"><Trash2 size={20}/></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, interests: [...aboutData.interests, { id: Date.now(), title: "New Interest", desc: "", image: "" }]})} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm"><Plus size={16}/> Add Interest</button>
                </div>

                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">4. Obsessions (Top Lists)</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.obsessions.map((obs, idx) => (
                      <div 
                        key={obs.id} 
                        draggable
                        onDragStart={() => dragItem.current = idx}
                        onDragEnter={() => dragOverItem.current = idx}
                        onDragEnd={() => handleSortAboutList('obsessions')}
                        onDragOver={(e) => e.preventDefault()}
                        className="bg-white p-4 border border-gray-200 rounded shadow-sm relative group hover:border-gray-300 transition-colors"
                      >
                        <div className="absolute top-3 left-2 cursor-grab active:cursor-grabbing text-gray-400 opacity-50 hover:opacity-100"><GripVertical size={16}/></div>
                        <button type="button" onClick={() => setAboutData({...aboutData, obsessions: aboutData.obsessions.filter((_, i) => i !== idx)})} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        
                        <input 
                          value={obs.category} 
                          onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].category = e.target.value; setAboutData({...aboutData, obsessions: n}); }}
                          className="font-bold w-full p-2 mb-2 border-b border-gray-200 outline-none pr-8 pl-8"
                        />
                        <textarea 
                          value={obs.items.join('\n')}
                          onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].items = e.target.value.split('\n'); setAboutData({...aboutData, obsessions: n}); }}
                          className="w-full p-2 border border-gray-200 rounded h-40 text-sm text-gray-600 font-mono whitespace-pre-wrap"
                          placeholder="Enter items, one per line..."
                        />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setAboutData({...aboutData, obsessions: [...aboutData.obsessions, { id: Date.now(), category: "New List", items: ["Item 1"] }]})} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm"><Plus size={16}/> Add New List</button>
                </div>
              </div>
            )}

            {(adminTab === 'projects' || adminTab === 'blogs' || adminTab === 'socials') && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30">
                <div className="flex justify-between items-end mb-4 border-b border-gray-300 pb-2">
                  <h2 className="text-xl font-bold text-gray-800 capitalize">Manage {adminTab}</h2>
                  <button onClick={() => setEditingItem({})} className="bg-green-700 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 hover:bg-green-800"><Plus size={16} /> Add New</button>
                </div>
                <div className="space-y-2">
                  {(adminTab === 'projects' ? projects : adminTab === 'blogs' ? blogs : socials).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border border-gray-200">
                      <span className="font-bold text-sm">{item.title || item.name || 'Untitled'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingItem({ ...item, type: item.type || (adminTab === 'blogs' ? 'regular' : 'project') })} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                        <button onClick={() => {
                          if (adminTab === 'projects') setProjects(projects.filter(p => p.id !== item.id));
                          if (adminTab === 'blogs') setBlogs(blogs.filter(b => b.id !== item.id));
                          if (adminTab === 'socials') setSocials(socials.filter(s => s.id !== item.id));
                        }} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {adminTab === 'messages' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30">
                 <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-300 pb-2">Anonymous Notes Received</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {guestMessages.length === 0 ? <p className="text-sm text-gray-500">No notes yet.</p> : guestMessages.map(msg => (
                       <div key={msg.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                          <p className="text-[10px] text-gray-400 mb-2 uppercase font-bold">{new Date(msg.created_at).toLocaleString()}</p>
                          {msg.message.startsWith('data:image') ? (
                             <img src={msg.message} alt="drawing" className="w-full rounded border border-gray-200" />
                          ) : (
                             <p className="font-handwriting text-xl text-gray-800">{msg.message}</p>
                          )}
                       </div>
                    ))}
                 </div>
              </div>
            )}
            
            <div className="fixed bottom-6 right-6 z-50">
              <button disabled={isSaving} onClick={() => saveAllToCloud(null)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-base tracking-wide transition-transform hover:scale-105 disabled:opacity-50">
                <Save size={20}/> {isSaving ? 'Deploying...' : 'Deploy All Changes'}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @font-face { font-family: 'Headliner No 45'; src: url('/fonts/HeadlinerNo.45%20DEMO.ttf') format('truetype'); }
        @font-face { font-family: 'zai crumpled paper'; src: url('/fonts/zai_CrumpledPaper.ttf') format('truetype'); }
        @font-face { font-family: 'bantayog light'; src: url('/fonts/Bantayog-Light.otf') format('opentype'); }
        
        .font-title { font-family: 'Headliner No 45', sans-serif; }
        .font-subtitle { font-family: 'zai crumpled paper', sans-serif; }
        .font-body { font-family: 'bantayog light', sans-serif; }
        .font-handwriting { font-family: 'Caveat', cursive; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes slideOutVinyl {
            0% { transform: translateX(0) rotate(0deg); }
            100% { transform: translateX(45%) rotate(0deg); }
        }
        .animate-slide-vinyl {
            animation: slideOutVinyl 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
      `}} />

      <div className="min-h-screen bg-cover bg-center bg-fixed p-4 md:p-8 flex items-center justify-center relative transition-all duration-1000"
        style={{ backgroundImage: `url(${aboutData.appBackground || 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041'})`, backgroundColor: '#2a4b3c' }}
      >
        <div className="w-full max-w-6xl relative z-10 flex flex-col h-[90vh] mt-4 md:mt-0">
          
          <div className="flex px-4 md:px-8 gap-1 md:gap-2 overflow-x-auto hide-scrollbar shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 md:px-8 py-2.5 rounded-t-2xl font-title text-2xl transition-all whitespace-nowrap tracking-wide
                  ${activeTab === tab.id ? 'bg-[#EEDF7A] text-[#991b1b] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.2)] z-20 pb-4 -mb-2' : 'bg-[#DCCB5A] text-gray-700 hover:bg-[#E5D66C] z-10 pb-1.5 mt-2 opacity-90'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-[#EEDF7A] rounded-b-3xl rounded-tr-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden p-3 md:p-5">
            <div className="flex-1 bg-[#e4d467] rounded-2xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)] border border-yellow-800/10 flex flex-col relative overflow-hidden">
              
              {isAdmin && siteSettings?.wip?.[activeTab] && activeTab !== 'admin' && (
                <div className="absolute top-0 left-0 w-full bg-red-600 text-white text-center py-1 font-bold text-[10px] uppercase tracking-widest z-50">
                  Visible to Admin Only (WIP Mode is Active)
                </div>
              )}

              <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 hide-scrollbar relative">
                {renderContent()}
              </main>

              <div className="absolute bottom-0 left-0 w-full p-4 md:p-6 flex justify-between items-end text-red-900/60 pointer-events-none bg-gradient-to-t from-[#e4d467] via-[#e4d467]/90 to-transparent pt-12">
                <span className="font-body font-bold tracking-widest text-xs">archive</span>
                <button onClick={() => setShowLogin(true)} className="pointer-events-auto font-body text-base tracking-[0.3em] hover:text-red-800 transition-colors" title="Secret Login">✧.* ♡ ✿</button>
                <span className="font-body font-bold text-xs">2026</span>
              </div>
            </div>
          </div>
        </div>

        {}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
            {(() => {
              
              // 1. VINYL ALBUM MODAL
              if (itemType === 'blog' && selectedItem.type === 'album') {
                return (
                   <div className="w-full max-w-5xl h-[75vh] min-h-[500px] bg-[#eb5e28] rounded-xl shadow-2xl relative flex flex-col items-center justify-center overflow-hidden border-4 border-[#c74b1e]">
                      <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-50 text-white/70 hover:text-white transition-colors"><X size={24} /></button>
                      
                      <div className="relative flex items-center justify-center w-full max-w-2xl scale-[0.65] sm:scale-75 md:scale-100">
                          <div className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] z-10 animate-slide-vinyl">
                              <div className="w-full h-full rounded-full bg-[#111] animate-[spin_4s_linear_infinite] shadow-2xl border border-[#222]" style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, #111, #111 2px, #1a1a1a 3px, #1a1a1a 4px)' }}>
                                   <div className="absolute inset-0 m-auto w-1/3 h-1/3 rounded-full bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] flex items-center justify-center">
                                       <div className="w-2 h-2 rounded-full bg-black shadow-inner"></div>
                                   </div>
                              </div>
                          </div>

                          <div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px] bg-[#f4f1e1] shadow-[10px_0_25px_rgba(0,0,0,0.5)] z-20 relative p-6 md:p-8 flex flex-col border border-gray-200">
                              <h2 className="text-3xl md:text-5xl font-title text-gray-900 mb-2 leading-none">{selectedItem.title}</h2>
                              
                              <div className="flex text-yellow-600 mb-4 drop-shadow-sm">
                                  {[...Array(Number(selectedItem.rating || 5))].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                              </div>
                              
                              <div className="flex-1 overflow-y-auto font-body text-sm md:text-base text-gray-800 whitespace-pre-wrap hide-scrollbar">
                                  {selectedItem.excerpt}
                              </div>

                              <div className="absolute -bottom-6 -right-6 md:-bottom-8 md:-right-8 w-28 h-28 md:w-36 md:h-36 bg-[#fbf065] shadow-xl rotate-[-6deg] p-1.5 md:p-2 border border-yellow-400 flex flex-col transition-transform hover:rotate-0 hover:scale-105 duration-300">
                                 <Pin size={20} fill="#b91c1c" className="absolute -top-3 left-1/2 -translate-x-1/2 text-red-700 z-10 drop-shadow-md" />
                                 {selectedItem.coverImage ? (
                                    <img src={selectedItem.coverImage} className="w-full h-full object-cover shadow-inner" alt="Album Art" />
                                 ) : (
                                    <div className="w-full h-full border border-yellow-500/50 flex items-center justify-center text-xs text-yellow-700 font-bold text-center p-2">No Art</div>
                                 )}
                              </div>
                          </div>
                      </div>
                   </div>
                );
              }

              // 2. iOS VIDEO PLAYER MODAL
              if (selectedItem.type === 'video') {
                return (
                   <div className="bg-[#888888] rounded-[36px] p-6 md:p-10 w-full max-w-2xl mx-auto flex flex-col md:flex-row gap-6 md:gap-10 text-white font-sans select-none shadow-2xl relative">
                     <button onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 z-50 text-white/70 hover:text-white transition-colors"><X size={24} /></button>
                     
                     <div className="w-full md:w-72 aspect-square bg-black rounded-[24px] overflow-hidden shrink-0 shadow-inner flex items-center justify-center relative">
                       <video src={selectedItem.image} controls autoPlay loop className="absolute inset-0 w-full h-full object-cover" />
                     </div>
                     
                     <div className="flex-1 flex flex-col justify-center py-2">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-sm font-semibold tracking-wide">iPhone</span>
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                             <path d="M12 22L1 12H7V2H17V12H23L12 22Z" fill="currentColor" opacity="0.3"/>
                             <path d="M12 18L5 12H9V4H15V12H19L12 18Z" fill="currentColor"/>
                           </svg>
                        </div>
                        <h2 className="text-3xl font-bold leading-tight mb-1 tracking-tight truncate">{selectedItem.title}</h2>
                        <p className="text-lg font-medium opacity-80 mb-8 truncate">{selectedItem.author || 'Unknown Artist'} — {selectedItem.tabId || 'Album'}</p>
                        
                        <div className="flex items-center gap-3 text-xs mb-8 font-bold opacity-80">
                           <span>0:00</span>
                           <div className="flex-1 h-1.5 bg-white/30 rounded-full relative">
                              <div className="absolute left-0 top-0 h-full w-1/3 bg-white rounded-full">
                                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-sm"></div>
                              </div>
                           </div>
                           <span>3:14</span>
                        </div>
                        
                        <div className="flex justify-center gap-12 items-center px-4 mb-4">
                           <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
                           <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                           <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
                        </div>
                     </div>
                   </div>
                );
              }

              // 3. ALL OTHER STANDARD MODALS (Beige box)
              return (
                <div className="bg-[#fefce8] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-yellow-200">
                  <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-50 bg-white/80 p-2 rounded-full hover:bg-red-100 text-gray-800 transition-colors shadow-md"><X size={20} /></button>
                  
                  {itemType === 'project' && (
                    <div className="relative">
                      {selectedItem.type === 'gallery' ? (
                        <div className="w-full bg-[#f4f4f4] rounded-t-xl min-h-[70vh] relative overflow-hidden p-8 border-b border-gray-300">
                           {isAdmin && (
                             <div className="absolute top-4 left-4 z-50 flex gap-2">
                                <span className="bg-yellow-200 text-yellow-900 font-bold px-3 py-1.5 rounded shadow text-sm">Admin: Drag to move</span>
                                <button onClick={saveGalleryLayout} className="bg-green-600 text-white font-bold px-4 py-1.5 rounded shadow hover:bg-green-700 transition-colors text-sm">Save Layout</button>
                             </div>
                           )}
                           {modalGalleryBlocks.map((img) => (
                             <DraggableImage 
                               key={img.id} 
                               item={img} 
                               updateImage={updateModalGalleryImage} 
                               bringToFront={bringToFrontModalGallery} 
                               isAdmin={isAdmin}
                             />
                           ))}
                           <div className="absolute bottom-8 left-8 z-40 pointer-events-none">
                              <h2 className="text-6xl md:text-8xl font-title font-bold text-gray-900 drop-shadow-lg">{selectedItem.title}</h2>
                              <p className="font-mono text-gray-800 bg-white/70 px-3 py-1 rounded inline-block backdrop-blur-sm mt-2 font-bold shadow-sm">{selectedItem.tabId}</p>
                              {selectedItem.content && <p className="font-body text-gray-800 mt-2 max-w-sm bg-white/70 p-3 rounded backdrop-blur-sm shadow-sm">{selectedItem.content}</p>}
                           </div>
                        </div>
                      ) : selectedItem.type === 'custom' ? (
                        <div className="w-full bg-white rounded-t-xl overflow-hidden p-8" dangerouslySetInnerHTML={{ __html: selectedItem.content }} />
                      ) : selectedItem.type === 'iframe' ? (
                        <iframe src={selectedItem.content} className="w-full h-[60vh] bg-white rounded-t-xl border-0" title={selectedItem.title} />
                      ) : (
                        selectedItem.image && <img src={selectedItem.image} className="w-full h-80 object-cover rounded-t-xl" alt="cover" />
                      )}
                      
                      {selectedItem.type !== 'custom' && selectedItem.type !== 'iframe' && selectedItem.type !== 'gallery' && (
                        <div className="p-10 bg-[#fefce8] rounded-b-xl">
                          <h2 className="text-7xl font-title font-bold text-red-900 mb-1 tracking-wide">{selectedItem.title}</h2>
                          <p className="font-mono text-gray-500 mb-6 pb-6 border-b border-red-900/10">{selectedItem.tabId}</p>
                          <p className="font-body text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedItem.content}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {itemType === 'blog' && (
                    <div className="p-10 bg-[#fefce8] rounded-xl">
                        <h2 className="text-5xl font-title font-bold text-red-900 mb-1 tracking-wide">{selectedItem.title}</h2>
                        <p className="font-mono text-gray-500 mb-6 pb-6 border-b border-red-900/10">{selectedItem.date}</p>
                        <p className="font-body text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedItem.excerpt}</p>
                    </div>
                  )}
                </div>
              );

            })()}
          </div>
        )}

        {showLogin && !isAdmin && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#fefce8] p-6 rounded-xl shadow-2xl w-full max-w-sm border border-yellow-200 relative">
              <button onClick={() => setShowLogin(false)} className="absolute top-3 right-3 text-gray-500 hover:text-red-700"><X size={18}/></button>
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-10 h-10 bg-red-100 text-red-800 rounded-full flex items-center justify-center mb-2"><Lock size={20} /></div>
                <h2 className="text-4xl font-title font-bold text-gray-800 tracking-wide">Admin Login</h2>
              </div>
              <form onSubmit={handleLogin} className="space-y-2">
                <input type="email" required placeholder="Admin Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full p-2.5 rounded border border-gray-300 bg-white font-body text-sm outline-none" />
                <input type="password" required placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-2.5 rounded border border-gray-300 bg-white font-body text-sm outline-none" />
                <button disabled={isLoading} type="submit" className="w-full bg-red-800 text-white font-bold p-2.5 rounded hover:bg-red-900 transition-colors disabled:opacity-50 text-sm mt-2 font-body">
                  {isLoading ? 'Authenticating...' : 'Unlock Dashboard'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}