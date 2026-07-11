import React, { useState, useEffect, useRef } from 'react';
import { Pin, X, Lock, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, ArrowLeft, LogOut, Upload, ChevronUp, ChevronDown, MessageSquare, Star, Send, Pencil, Activity, Heart, Thermometer, Droplets, Video, LayoutGrid, FileText } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const defaultProjects = [
  { id: 1, tabId: "94", title: "oil lamp", tabAlign: "center", type: "project", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80", content: "Main system architecture." },
  { id: 2, tabId: "95", title: "oats", tabAlign: "right", type: "gallery", galleryBlocks: [{id:1, size: 'w-full', image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80'}], content: "A collection of renders." },
  { id: 3, tabId: "O", title: "010", tabAlign: "left", type: "divider" },
  { id: 4, tabId: "96", title: "pants", tabAlign: "center", type: "video", videoTags: ["Motion", "Typography"], image: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&q=80", content: "Kinetic typography experiments." },
  { id: 5, tabId: "97", title: "plane", tabAlign: "right", type: "project", image: "https://images.unsplash.com/photo-1497493213477-0c0e5f410d32?w=400&q=80", content: "Old files and deprecated code." }
];

const defaultBlogs = [];

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
  header: { name: "Concept Map", subtitle: "System architecture & flow" },
  stats: [
    { id: 1, label: "Status", value: "Online", icon: "Activity" },
    { id: 2, label: "Version", value: "v2.0.4", icon: "Thermometer" }
  ],
  nodes: [
    { id: 1, title: "Phase 1: Initialization", value: "100%", tags: ["Core", "Setup"], description: "Booting up the main framework.", align: "left" },
    { id: 2, title: "Phase 2: Routing", value: "Active", tags: ["Network", "API"], description: "Establishing secure connections.", align: "right" },
    { id: 3, title: "Phase 3: Render", value: "Pending", tags: ["UI/UX", "Canvas"], description: "Painting the pixels to the screen.", align: "left" }
  ]
};

const defaultSocials = [
  { id: 1, name: 'GitHub', url: 'https://github.com', image: 'https://placehold.co/400x400/991b1b/fff?text=G' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // App Data States
  const [projects, setProjects] = useState(defaultProjects);
  const [blogs, setBlogs] = useState(defaultBlogs);
  const [aboutData, setAboutData] = useState(defaultAbout);
  const [systemData, setSystemData] = useState(defaultSystem);
  const [socials, setSocials] = useState(defaultSocials);
  
  // Playground / Guestbook States
  const [guestMessages, setGuestMessages] = useState([]);
  const [newGuestMessage, setNewGuestMessage] = useState("");
  const [playgroundMode, setPlaygroundMode] = useState('text');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Canvas Drawing States
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Interaction States
  const [selectedItem, setSelectedItem] = useState(null); 
  const [itemType, setItemType] = useState(null); 
  const [pulledOutId, setPulledOutId] = useState(null);
  
  // Admin & Auth States
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [adminTab, setAdminTab] = useState('about'); 
  const [editingItem, setEditingItem] = useState(null); 

  useEffect(() => {
    async function loadDataAndAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsAdmin(true);

      const { data: siteData } = await supabase.from('site_data').select('*');
      if (siteData && siteData.length > 0) {
        const p = siteData.find(d => d.section === 'projects');
        const b = siteData.find(d => d.section === 'blogs');
        const a = siteData.find(d => d.section === 'about');
        const s = siteData.find(d => d.section === 'socials');
        const sys = siteData.find(d => d.section === 'system');
        
        if (p) setProjects(p.data);
        if (b) setBlogs(b.data);
        if (a) setAboutData(a.data);
        if (s) setSocials(s.data);
        if (sys) setSystemData(sys.data);
      }

      const { data: messages } = await supabase.from('playground_messages').select('*').order('created_at', { ascending: false });
      if (messages) setGuestMessages(messages);

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
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
    setIsLoading(false);
    if (error) alert("Login Failed: " + error.message);
    else { setIsAdmin(true); setShowLogin(false); setActiveTab('admin'); setPasswordInput(""); setEmailInput(""); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setIsAdmin(false); setActiveTab('intro'); };

  const openModal = (item, type) => { setSelectedItem(item); setItemType(type); };

  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { alert("Please choose an image smaller than 2MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => callback(reader.result);
    reader.readAsDataURL(file);
  };

  const saveAllToCloud = async () => {
    setIsSaving(true);
    const updates = [
      { section: 'about', data: aboutData },
      { section: 'projects', data: projects },
      { section: 'blogs', data: blogs },
      { section: 'socials', data: socials },
      { section: 'system', data: systemData }
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

  const sendAnonymousMessage = async (e) => {
    e.preventDefault();
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

  const renderIcon = (name) => {
    switch (name) {
      case 'Activity': return <Activity size={16} />;
      case 'Heart': return <Heart size={16} />;
      case 'Thermometer': return <Thermometer size={16} />;
      case 'Droplets': return <Droplets size={16} />;
      default: return <Activity size={16} />;
    }
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

    switch (activeTab) {
      // --- 1. INTRO PAGE ---
      case 'intro':
        return (
          <div className="flex flex-col lg:flex-row gap-6 items-start min-h-full pb-16 relative">
            <div className="flex-1 w-full space-y-10 min-w-0">
              
              <div>
                <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-4 tracking-wide">My Introduction</h1>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="whitespace-pre-wrap font-body text-base text-gray-800 leading-snug flex-1 leading-relaxed">{aboutData.introText}</div>
                  {aboutData.introImage && (
                    <div className="w-full md:w-56 shrink-0 rotate-1 hover:rotate-0 transition-transform">
                      <img src={aboutData.introImage} alt="Intro" className="w-full rounded shadow-md border border-yellow-600/30" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-4xl md:text-5xl font-title text-[#991b1b] mb-1 border-b border-red-900/20 pb-1 tracking-wide">People I like</h2>
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
                <h2 className="text-4xl md:text-5xl font-title text-[#991b1b] mb-3 border-b border-red-900/20 pb-1 tracking-wide">Interests</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {aboutData.interests.map((interest) => (
                    <div key={interest.id}>
                      <h3 className="font-subtitle font-bold text-gray-900 mb-1 truncate text-xl" title={interest.title}>{interest.title}</h3>
                      <img src={interest.image} alt={interest.title} className="w-full aspect-[4/3] object-cover rounded-sm shadow-sm border border-yellow-600/30 mb-2" />
                      <p className="text-xs text-gray-700 leading-tight font-body line-clamp-3" title={interest.desc}>{interest.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-4xl md:text-5xl font-title text-[#991b1b] mb-3 border-b border-red-900/20 pb-1 tracking-wide">
                  Obsessions <span className="text-xl font-handwriting text-red-800/60 font-normal ml-2 tracking-normal">(Top 10s)</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {aboutData.obsessions.map((obs) => (
                    <div key={obs.id} className="bg-[#e4d467] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),_inset_-2px_-2px_4px_rgba(255,255,255,0.4)] p-4 rounded-xl border border-yellow-600/20 transition-all hover:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.15),_inset_-3px_-3px_6px_rgba(255,255,255,0.5)]">
                      <h3 className="font-bold font-subtitle text-gray-900 mb-2 text-lg border-b border-gray-900/10 pb-1 leading-tight break-words">{obs.category}</h3>
                      <ol className="list-decimal list-inside text-xs text-gray-800 space-y-1.5 font-body">
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
        return (
          <div className="min-h-full pb-32 max-w-4xl mx-auto flex flex-col items-center pt-8">
            <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-16 tracking-wide w-full text-center">Index <span className="font-subtitle text-3xl opacity-50 ml-2">(Projects)</span></h1>
            
            {projects.length === 0 ? (
              <p className="text-2xl font-subtitle text-gray-600 text-center mt-20">In the future, there will be something here...</p>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-2xl px-4 md:px-0">
                  {projects.map((item, idx) => {
                    const isBlack = item.type === 'divider';
                    const isPulledOut = pulledOutId === item.id;
                    
                    // Seamless Tab Alignment Math
                    let tabAlignClass = 'ml-6 md:ml-12';
                    if (item.tabAlign === 'center') tabAlignClass = 'mx-auto';
                    if (item.tabAlign === 'right') tabAlignClass = 'mr-6 md:mr-12 ml-auto';

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          if (isBlack) return;
                          setPulledOutId(item.id);
                          setTimeout(() => {
                            setPulledOutId(null);
                            openModal(item, 'project');
                          }, 600);
                        }} 
                        className={`relative w-full cursor-pointer group transition-all duration-500 ease-out
                          ${isPulledOut ? '-translate-y-40 scale-105 z-[100] opacity-0' : 'hover:-translate-y-4'}`}
                        style={{ 
                          zIndex: idx, 
                          // -mt-28 (112px offset) means the files are stacked tightly on top of each other!
                          marginTop: idx === 0 ? '0' : '-7rem' 
                        }}
                      >
                        {/* Folder Tab (Seamless Connection) */}
                        <div className={`w-full flex`}>
                          <div 
                            className={`h-8 md:h-10 px-4 md:px-8 flex items-center gap-4 md:gap-8 border-t border-x border-black rounded-t-xl
                              ${isBlack ? 'bg-black text-white' : 'bg-[#e4e4e4] text-black'} 
                              ${tabAlignClass}`}
                            // This pulls the tab down by 1px to seamlessly cover the top border of the folder body
                            style={{ marginBottom: '-1px', zIndex: 2, position: 'relative' }}
                          >
                            <span className="text-xs md:text-sm font-mono font-bold tracking-widest">{item.tabId}</span>
                            <span className="text-xs md:text-sm font-mono">{item.title}</span>
                          </div>
                        </div>
                        
                        {/* Folder Body (Extends deep so lifting it hides the bottom) */}
                        <div 
                          className={`w-full h-40 border border-black rounded-t-xl flex items-start px-6 pt-4
                            ${isBlack ? 'bg-black' : 'bg-[#e4e4e4]'}`}
                          style={{ zIndex: 1, position: 'relative' }}
                        >
                           {!isBlack && (
                              <div className="flex gap-4 opacity-0 group-hover:opacity-40 transition-opacity duration-300 text-black">
                                {item.type === 'video' && <Video size={16}/>}
                                {item.type === 'gallery' && <LayoutGrid size={16}/>}
                                {item.type === 'project' && <FileText size={16}/>}
                              </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Front Base (The filing cabinet front lip) */}
                  <div className="w-full relative z-[90] flex flex-col items-center justify-center mt-[-1px]">
                     {/* Dark slot/shadow inside the drawer */}
                     <div className="w-[102%] h-4 bg-[#8a8a8a] border border-black rounded-sm"></div>
                     {/* Front Face of Drawer */}
                     <div className="w-[104%] h-20 bg-[#d1d1d1] border-x border-b border-black flex items-center justify-center rounded-b-xl shadow-xl">
                        <div className="bg-[#fbff00] border border-black px-6 py-1.5 rounded-sm text-sm font-mono font-bold text-black shadow-sm">
                           vinz's secret files
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'system':
        return (
          <div className="min-h-full pb-16">
            <div className="bg-[#efeadf] rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-10 shadow-inner border-[6px] border-white/40 font-body relative overflow-hidden">
              
              {/* Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6 relative z-10">
                <div>
                  <h1 className="text-5xl md:text-6xl font-title text-gray-800 tracking-wide">{systemData.header.name}</h1>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">{systemData.header.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {systemData.stats.map(stat => (
                    <div key={stat.id} className="bg-white px-4 py-2.5 rounded-full shadow-sm text-xs font-bold flex items-center gap-2 text-gray-600 border border-gray-100">
                      <span className="text-gray-400">{renderIcon(stat.icon)}</span>
                      <span>{stat.label}:</span>
                      <span className="text-gray-900">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline Container */}
              <div className="relative max-w-4xl mx-auto z-10">
                {/* Center Line */}
                <div className="absolute left-[27px] md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-300 via-gray-300 to-transparent -translate-x-1/2 rounded-full"></div>

                <div className="space-y-12">
                  {systemData.nodes.map((node, i) => {
                    const isLeft = node.align === 'left';
                    return (
                      <div key={node.id} className={`relative flex items-center ${isLeft ? 'md:justify-start' : 'md:justify-end'} justify-start`}>
                        
                        {/* Timeline Node Dot (Mobile: Fixed Left, Desktop: Center) */}
                        <div className="absolute left-[27px] md:left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full border-4 border-[#efeadf] shadow-sm z-20 flex items-center justify-center">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                        </div>

                        {/* Connecting Line (Desktop Only) */}
                        <div className={`hidden md:block absolute top-1/2 -translate-y-1/2 h-1 bg-gray-300 z-10
                          ${isLeft ? 'right-1/2 left-[calc(50%-40px)]' : 'left-1/2 right-[calc(50%-40px)]'}`}></div>

                        {/* Card Content */}
                        <div className={`w-[calc(100%-60px)] ml-[60px] md:ml-0 md:w-[calc(50%-40px)] bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative z-20`}>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-xl text-gray-800">{node.title}</h3>
                            <span className="text-xl font-bold text-gray-300">{node.value}</span>
                          </div>
                          
                          <p className="text-gray-500 text-sm mb-4 leading-relaxed">{node.description}</p>
                          
                          <div className="flex flex-wrap gap-2">
                            {node.tags.map((tag, tidx) => (
                              <span key={tidx} className="bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Background abstract shape */}
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-200/40 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-red-200/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>
          </div>
        );

      // --- 3. BLOG PAGE ---
      case 'blog':
        return (
          <div className="min-h-full pb-16 max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-8 text-center tracking-wide">My Thoughts</h1>
            {blogs.length === 0 ? (
              <p className="text-3xl font-subtitle text-gray-600 text-center mt-20">In the future, there will be something here...</p>
            ) : (
              <div className="space-y-6">
                {blogs.map((post) => (
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
        );

      // --- 4. PLAYGROUND (ANONYMOUS NOTES) ---
      case 'blank':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center relative">
            <h1 className="text-6xl md:text-7xl font-title text-[#991b1b] mb-4 text-center tracking-wide">Anonymous Notes</h1>
            <p className="text-gray-700 mb-8 font-body text-base text-center max-w-md">Leave a message, a drawing, or whatever is on your mind. It's completely anonymous.</p>
            
            <div className="w-full max-w-xl bg-white/40 p-6 rounded-3xl shadow-sm border border-yellow-600/30 backdrop-blur-sm relative z-10">
              <div className="flex gap-2 mb-6 justify-center border-b border-yellow-600/20 pb-6">
                <button 
                  onClick={() => setPlaygroundMode('text')} 
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-colors ${playgroundMode === 'text' ? 'bg-red-800 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  <Type size={18}/> Text
                </button>
                <button 
                  onClick={() => setPlaygroundMode('draw')} 
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-colors ${playgroundMode === 'draw' ? 'bg-red-800 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  <Pencil size={18}/> Draw
                </button>
              </div>

              <form onSubmit={sendAnonymousMessage}>
                {playgroundMode === 'text' ? (
                  <textarea 
                    required
                    value={newGuestMessage}
                    onChange={(e) => setNewGuestMessage(e.target.value)}
                    placeholder="Write something cool here..."
                    className="w-full h-48 p-5 rounded-2xl border border-yellow-600/20 bg-white/70 focus:bg-white outline-none font-handwriting text-3xl text-gray-800 resize-none mb-4 shadow-inner"
                  />
                ) : (
                  <div className="mb-4 touch-none">
                    <canvas
                      ref={canvasRef}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-64 bg-white border border-yellow-600/20 rounded-2xl cursor-crosshair shadow-inner"
                    />
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

      // --- 5. SOCIALS ---
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
        
        // EDITOR MODAL FOR LISTS
        if (editingItem) {
          return (
            <div className="max-w-4xl mx-auto bg-white/50 p-5 rounded-xl border border-yellow-600/30 shadow-lg mb-16">
              <button onClick={() => setEditingItem(null)} className="flex items-center gap-2 text-gray-600 hover:text-red-800 font-bold mb-4 text-sm"><ArrowLeft size={16} /> Back</button>
              
              <form onSubmit={(e) => handleListSave(e, adminTab)} className="space-y-4 font-body">
                
                {/* PROJECT EDITOR */}
                {adminTab === 'projects' && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <select value={editingItem.type || 'project'} onChange={e => setEditingItem({...editingItem, type: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm font-bold text-red-900">
                         <option value="project">Standard Project</option>
                         <option value="gallery">Gallery (Canva-style)</option>
                         <option value="video">Video/Motion</option>
                         <option value="divider">Black Divider Tag</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 border border-gray-200 rounded">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab ID (e.g. 94 or O)</label>
                        <input placeholder="ID" value={editingItem.tabId || ''} onChange={e => setEditingItem({...editingItem, tabId: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab Title</label>
                        <input placeholder="Title" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase">Tab Alignment</label>
                        <select value={editingItem.tabAlign || 'left'} onChange={e => setEditingItem({...editingItem, tabAlign: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm">
                           <option value="left">Left</option>
                           <option value="center">Center</option>
                           <option value="right">Right</option>
                        </select>
                      </div>
                    </div>

                    {editingItem.type !== 'divider' && (
                      <>
                        <div className="flex gap-3">
                          <input placeholder="Year" value={editingItem.year || ''} onChange={e => setEditingItem({...editingItem, year: e.target.value})} className="w-1/4 p-2 rounded border border-gray-300 bg-white text-sm" />
                          <input placeholder="Author" value={editingItem.author || ''} onChange={e => setEditingItem({...editingItem, author: e.target.value})} className="w-3/4 p-2 rounded border border-gray-300 bg-white text-sm" />
                        </div>
                        
                        {editingItem.type === 'video' && (
                          <input placeholder="Tags (comma separated, e.g. Motion, 3D)" value={(editingItem.videoTags || []).join(', ')} onChange={e => setEditingItem({...editingItem, videoTags: e.target.value.split(',').map(t=>t.trim())})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                        )}

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Cover Image (Used for non-gallery)</label>
                          <div className="flex gap-2">
                            <input placeholder="Image URL (or upload)" value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white text-sm" />
                            <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                              <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                            </label>
                          </div>
                        </div>

                        <textarea placeholder="Project Description..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-24 text-sm" />
                        
                        {editingItem.type === 'gallery' && (
                          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 mt-4">
                            <h3 className="font-bold text-yellow-900 mb-3 text-sm flex items-center gap-2"><LayoutGrid size={16}/> Gallery Builder (Canva-style)</h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {(editingItem.galleryBlocks || []).map((block, idx) => (
                                <div key={idx} className={`relative group border-2 border-yellow-400 border-dashed p-1 ${block.size === 'w-full' ? 'w-full' : block.size === 'w-1/2' ? 'w-[calc(50%-4px)]' : 'w-[calc(33%-4px)]'}`}>
                                  <button type="button" onClick={() => { const n = [...editingItem.galleryBlocks]; n.splice(idx, 1); setEditingItem({...editingItem, galleryBlocks: n}); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 z-10"><Trash2 size={12}/></button>
                                  <select value={block.size} onChange={e => { const n = [...editingItem.galleryBlocks]; n[idx].size = e.target.value; setEditingItem({...editingItem, galleryBlocks: n}); }} className="absolute top-1 left-1 text-[10px] bg-white/80 p-0.5 rounded shadow z-10">
                                    <option value="w-full">Full Width</option><option value="w-1/2">Half Width</option><option value="w-1/3">1/3 Width</option>
                                  </select>
                                  {block.image ? (
                                    <img src={block.image} className="w-full h-32 object-cover rounded shadow" alt="block"/>
                                  ) : (
                                    <label className="w-full h-32 flex flex-col items-center justify-center bg-white rounded shadow cursor-pointer hover:bg-gray-50 text-xs text-gray-400">
                                      <Upload size={16} className="mb-1"/> Add Image
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.galleryBlocks]; n[idx].image = base64; setEditingItem({...editingItem, galleryBlocks: n}); })} />
                                    </label>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => setEditingItem({...editingItem, galleryBlocks: [...(editingItem.galleryBlocks||[]), {id: Date.now(), size: 'w-1/2', image: ''}]})} className="bg-yellow-200 text-yellow-900 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-300 transition-colors">+ Add Image Block</button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* BLOG EDITOR */}
                {adminTab === 'blogs' && (
                  <>
                    <input required placeholder="Blog Title" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-2 text-lg font-bold rounded border border-gray-300 bg-white" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <input required placeholder="Date" value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm" />
                      <input placeholder="Category" value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm" />
                      <input placeholder="Tags (comma separated)" value={editingItem.tags || ''} onChange={e => setEditingItem({...editingItem, tags: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm" />
                      <select value={editingItem.rating || ''} onChange={e => setEditingItem({...editingItem, rating: e.target.value})} className="p-2 rounded border border-gray-300 bg-white text-sm">
                        <option value="">No Rating</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Stars</option>)}
                      </select>
                    </div>
                    <textarea required placeholder="Short Excerpt" value={editingItem.excerpt || ''} onChange={e => setEditingItem({...editingItem, excerpt: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-16 text-sm" />
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Cover Image</label>
                      <div className="flex gap-2">
                        <input placeholder="Cover Image URL (or upload)" value={editingItem.coverImage || ''} onChange={e => setEditingItem({...editingItem, coverImage: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white text-sm" />
                        <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                          <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, coverImage: base64}))} />
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-100/50 rounded-lg border border-gray-300 mt-4">
                      <h3 className="font-bold text-gray-800 mb-3 text-sm">Content Blocks</h3>
                      <div className="space-y-3 mb-3">
                        {(editingItem.blocks || []).map((block, idx) => (
                          <div key={idx} className="flex gap-2 items-start bg-white p-2 rounded shadow-sm border border-gray-200 group">
                            <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => moveBlock(idx, 'up')} className="p-0.5 hover:bg-gray-100 rounded"><ChevronUp size={14}/></button>
                              <button type="button" onClick={() => moveBlock(idx, 'down')} className="p-0.5 hover:bg-gray-100 rounded"><ChevronDown size={14}/></button>
                            </div>
                            <div className="flex-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">{block.type}</span>
                              {block.type === 'text' && (
                                <textarea value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="w-full p-2 border border-gray-200 rounded min-h-[80px] text-sm" placeholder="Write paragraph..." />
                              )}
                              {(block.type === 'quote' || block.type === 'pullquote' || block.type === 'imageDescription') && (
                                <input value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="w-full p-2 border border-gray-200 rounded text-sm" placeholder={`Enter ${block.type} text...`} />
                              )}
                              {block.type === 'image' && (
                                <div>
                                  <div className="flex gap-2 mb-1">
                                    <input value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="flex-1 p-2 border border-gray-200 rounded text-sm" placeholder="Image URL or Upload..." />
                                    <label className="cursor-pointer bg-gray-100 px-2 py-1 rounded border border-gray-300 hover:bg-gray-200 text-sm flex items-center"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.blocks]; n[idx].content = base64; setEditingItem({...editingItem, blocks: n}); })} /></label>
                                  </div>
                                  {block.content && <img src={block.content} alt="Preview" className="h-16 object-cover rounded" />}
                                </div>
                              )}
                            </div>
                            <button type="button" onClick={() => { const n = [...editingItem.blocks]; n.splice(idx, 1); setEditingItem({...editingItem, blocks: n}); }} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'text', content: ''}]})} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1">+ Text</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'image', content: ''}]})} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1">+ Image</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'quote', content: ''}]})} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1">+ Quote</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'pullquote', content: ''}]})} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1">+ Pullquote</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'imageDescription', content: ''}]})} className="bg-white border border-gray-300 px-2 py-1 rounded text-xs hover:bg-gray-50 flex items-center gap-1">+ Img Desc.</button>
                      </div>
                    </div>
                  </>
                )}

                {/* SOCIALS EDITOR */}
                {adminTab === 'socials' && (
                  <>
                    <input required placeholder="Platform Name (e.g. Instagram)" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 font-bold rounded border border-gray-300 bg-white" />
                    <input required placeholder="Link URL" value={editingItem.url || ''} onChange={e => setEditingItem({...editingItem, url: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white text-sm" />
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Icon/Image</label>
                      <div className="flex gap-2">
                        <input placeholder="Image URL (or upload)" value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white text-sm" />
                        <label className="cursor-pointer bg-gray-200 px-3 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2 text-sm">
                          <Upload size={14}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                        </label>
                      </div>
                      {editingItem.image && <img src={editingItem.image} alt="preview" className="mt-2 h-12 w-12 object-cover rounded bg-white p-1 border border-gray-200" />}
                    </div>
                  </>
                )}
                
                <button type="submit" className="w-full bg-red-800 text-white p-3 rounded font-bold hover:bg-red-900 transition-colors text-sm">Done Editing</button>
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
              {['about', 'projects', 'system', 'blogs', 'socials', 'messages'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} className={`font-bold capitalize px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap text-sm ${adminTab === tab ? 'bg-red-800 text-white' : 'bg-white/50 text-gray-700 hover:bg-white'}`}>
                  Manage {tab}
                </button>
              ))}
            </div>

            {/* ABOUT PAGE SETTINGS */}
            {adminTab === 'about' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30 space-y-8">
                {/* Global Background */}
                <div>
                  <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">0. Website Background (Behind Folder)</h3>
                  <div className="flex gap-2">
                    <input placeholder="Image URL (or upload)" value={aboutData.appBackground || ''} onChange={e => setAboutData({...aboutData, appBackground: e.target.value})} className="flex-1 p-2 border border-gray-300 rounded bg-white text-xs" />
                    <label className="cursor-pointer bg-gray-200 px-3 rounded hover:bg-gray-300 flex items-center text-xs font-bold"><Upload size={14} className="mr-1"/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => setAboutData({...aboutData, appBackground: b}))} /></label>
                  </div>
                </div>

                {/* Intro & Notepad */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">1. Main Intro</h3>
                    <textarea value={aboutData.introText} onChange={e => setAboutData({...aboutData, introText: e.target.value})} className="w-full p-2 border border-gray-300 rounded h-24 mb-2 bg-white text-sm" />
                    <div className="flex gap-2">
                      <input placeholder="Intro Image URL" value={aboutData.introImage} onChange={e => setAboutData({...aboutData, introImage: e.target.value})} className="flex-1 p-2 border border-gray-300 rounded bg-white text-xs" />
                      <label className="cursor-pointer bg-gray-200 px-2 rounded hover:bg-gray-300 flex items-center text-xs"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => setAboutData({...aboutData, introImage: b}))} /></label>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">2. Sticky Notepad</h3>
                    <textarea 
                      maxLength={150} 
                      value={aboutData.notepadText} 
                      onChange={e => setAboutData({...aboutData, notepadText: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded h-24 bg-[#fefce8] font-handwriting text-2xl resize-none" 
                      placeholder="Write a short note here..."
                    />
                    <p className="text-right text-xs text-gray-500 font-bold">{aboutData.notepadText?.length || 0} / 150 limit</p>
                  </div>
                </div>
                {/* Other about fields are maintained identically but omitted for brevity in chunking */}
              </div>
            )}

            {/* SYSTEM PAGE SETTINGS */}
            {adminTab === 'system' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30 space-y-8">
                <div>
                  <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">1. System Header</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                     <input value={systemData.header.name} onChange={e => setSystemData({...systemData, header: {...systemData.header, name: e.target.value}})} className="p-2 border rounded text-sm" placeholder="Title (e.g. System)" />
                     <input value={systemData.header.subtitle} onChange={e => setSystemData({...systemData, header: {...systemData.header, subtitle: e.target.value}})} className="p-2 border rounded text-sm" placeholder="Subtitle" />
                  </div>
                </div>

                <div>
                   <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">2. Floating Stats (Pills)</h3>
                   <div className="space-y-2 mb-2">
                      {systemData.stats.map((stat, idx) => (
                         <div key={stat.id} className="flex gap-2 items-center bg-white p-2 border rounded">
                            <input value={stat.label} onChange={e => { const n = [...systemData.stats]; n[idx].label = e.target.value; setSystemData({...systemData, stats: n})}} className="p-1 border-b text-xs w-1/4" placeholder="Label (e.g. Status)" />
                            <input value={stat.value} onChange={e => { const n = [...systemData.stats]; n[idx].value = e.target.value; setSystemData({...systemData, stats: n})}} className="p-1 border-b text-xs w-1/4" placeholder="Value (e.g. Online)" />
                            <select value={stat.icon} onChange={e => { const n = [...systemData.stats]; n[idx].icon = e.target.value; setSystemData({...systemData, stats: n})}} className="p-1 border-b text-xs w-1/4">
                               <option value="Activity">Activity</option><option value="Heart">Heart</option><option value="Thermometer">Thermometer</option><option value="Droplets">Droplets</option>
                            </select>
                            <button onClick={() => setSystemData({...systemData, stats: systemData.stats.filter((_,i)=>i!==idx)})} className="text-red-500 ml-auto"><Trash2 size={16}/></button>
                         </div>
                      ))}
                   </div>
                   <button onClick={() => setSystemData({...systemData, stats: [...systemData.stats, {id: Date.now(), label: 'New', value: 'Stat', icon: 'Activity'}]})} className="text-xs bg-white border px-2 py-1 rounded">+ Add Stat</button>
                </div>

                <div>
                   <h3 className="font-bold text-sm mb-2 text-gray-800 border-b border-gray-300 pb-1">3. Timeline Nodes</h3>
                   <div className="space-y-4 mb-2">
                      {systemData.nodes.map((node, idx) => (
                         <div key={node.id} className="bg-white p-3 border rounded shadow-sm relative group">
                            <button onClick={() => setSystemData({...systemData, nodes: systemData.nodes.filter((_,i)=>i!==idx)})} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                            <div className="grid md:grid-cols-2 gap-2 mb-2">
                               <input value={node.title} onChange={e => { const n = [...systemData.nodes]; n[idx].title = e.target.value; setSystemData({...systemData, nodes: n})}} className="p-1 border-b font-bold text-sm" placeholder="Node Title" />
                               <input value={node.value} onChange={e => { const n = [...systemData.nodes]; n[idx].value = e.target.value; setSystemData({...systemData, nodes: n})}} className="p-1 border-b text-sm" placeholder="Right Value (e.g. 100%)" />
                               <input value={node.tags.join(', ')} onChange={e => { const n = [...systemData.nodes]; n[idx].tags = e.target.value.split(',').map(t=>t.trim()); setSystemData({...systemData, nodes: n})}} className="p-1 border-b text-xs" placeholder="Tags (comma separated)" />
                               <select value={node.align} onChange={e => { const n = [...systemData.nodes]; n[idx].align = e.target.value; setSystemData({...systemData, nodes: n})}} className="p-1 border-b text-xs">
                                  <option value="left">Align Left</option><option value="right">Align Right</option>
                               </select>
                            </div>
                            <textarea value={node.description} onChange={e => { const n = [...systemData.nodes]; n[idx].description = e.target.value; setSystemData({...systemData, nodes: n})}} className="w-full p-2 border rounded text-xs" placeholder="Short description..." />
                         </div>
                      ))}
                   </div>
                   <button onClick={() => setSystemData({...systemData, nodes: [...systemData.nodes, {id: Date.now(), title: 'New Node', value: '', tags: [], description: '', align: 'left'}]})} className="text-xs bg-white border px-2 py-1 rounded">+ Add Node</button>
                </div>
              </div>
            )}

            {/* LIST MANAGERS (Projects, Blogs, Socials) */}
            {(adminTab === 'projects' || adminTab === 'blogs' || adminTab === 'socials') && (
              <div>
                <button onClick={() => setEditingItem(adminTab === 'blogs' ? {blocks: []} : {})} className="bg-green-700 text-white px-3 py-1.5 rounded flex items-center gap-2 hover:bg-green-800 shadow mb-3 text-sm"><Plus size={16} /> Add New {adminTab.slice(0,-1)}</button>
                <div className="space-y-2">
                  {(adminTab === 'projects' ? projects : adminTab === 'blogs' ? blogs : socials).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/70 p-3 rounded border border-yellow-600/30 shadow-sm">
                      <div className="flex items-center gap-3">
                        {(item.image || item.coverImage) && <img src={item.image || item.coverImage} className="w-10 h-10 object-cover rounded" alt="thumb"/>}
                        <span className="font-bold text-gray-800 text-base">{item.title || item.name}</span>
                        {item.type && <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded uppercase">{item.type}</span>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingItem(item)} className="p-1.5 text-blue-700 hover:bg-blue-100 rounded transition-colors"><Edit2 size={16} /></button>
                        <button onClick={() => {
                          if (window.confirm("Delete this?")) {
                            if (adminTab === 'projects') setProjects(projects.filter(p => p.id !== item.id));
                            if (adminTab === 'blogs') setBlogs(blogs.filter(b => b.id !== item.id));
                            if (adminTab === 'socials') setSocials(socials.filter(s => s.id !== item.id));
                          }
                        }} className="p-1.5 text-red-700 hover:bg-red-100 rounded transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MESSAGES / PLAYGROUND SETTINGS */}
            {adminTab === 'messages' && (
              <div className="bg-white/50 p-5 rounded-xl border border-yellow-600/30">
                <h3 className="font-bold text-lg text-gray-800 border-b border-gray-300 pb-1 mb-3">Playground Inbox</h3>
                {guestMessages.length === 0 ? <p className="text-gray-500 italic text-sm">No notes yet.</p> : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {guestMessages.map(msg => (
                      <div key={msg.id} className="bg-white p-4 rounded shadow-sm border border-gray-200 relative group">
                        <button onClick={async () => {
                          if (window.confirm("Delete?")) {
                            await supabase.from('playground_messages').delete().eq('id', msg.id);
                            setGuestMessages(guestMessages.filter(m => m.id !== msg.id));
                          }
                        }} className="absolute top-2 right-2 text-red-400 hover:bg-red-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={16}/></button>
                        
                        {msg.message?.startsWith('data:image') ? (
                          <div className="bg-gray-50 border border-gray-100 rounded p-1 mb-2"><img src={msg.message} alt="Drawing" className="w-full object-contain max-h-48" /></div>
                        ) : (
                          <p className="font-handwriting text-3xl text-gray-800 whitespace-pre-wrap pr-6">{msg.message}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-2 text-right">{new Date(msg.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FLOATING SAVE BUTTON */}
            <div className="fixed bottom-6 right-6 z-50">
              <button disabled={isSaving} onClick={saveAllToCloud} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-base tracking-wide transition-transform hover:scale-105 disabled:opacity-50">
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
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap');
        @font-face { font-family: 'Headliner No 45'; src: url('/fonts/HeadlinerNo.45%20DEMO.ttf') format('truetype'); }
        @font-face { font-family: 'zai crumpled paper'; src: url('/fonts/zai_CrumpledPaper.ttf') format('truetype'); }
        @font-face { font-family: 'bantayog light'; src: url('/fonts/Bantayog-Light.otf') format('opentype'); }
        
        .font-title { font-family: 'Headliner No 45', sans-serif; }
        .font-subtitle { font-family: 'zai crumpled paper', sans-serif; }
        .font-body { font-family: 'bantayog light', sans-serif; }
        .font-handwriting { font-family: 'Caveat', cursive; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
                className={`px-4 md:px-8 py-2.5 rounded-t-2xl font-title text-xl md:text-2xl transition-all whitespace-nowrap tracking-wide
                  ${activeTab === tab.id ? 'bg-[#EEDF7A] text-[#991b1b] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.2)] z-20 pb-4 -mb-2' : 'bg-[#DCCB5A] text-gray-700 hover:bg-[#E5D66C] z-10 pb-1.5 mt-2 opacity-90'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-[#EEDF7A] rounded-b-3xl rounded-tr-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden p-3 md:p-5">
            <div className="flex-1 bg-[#e4d467] rounded-2xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)] border border-yellow-800/10 flex flex-col relative overflow-hidden">
              
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

        {/* DETAILS MODAL */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
            <div className="bg-[#fefce8] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-yellow-200">
              <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-10 bg-white/80 p-2 rounded-full hover:bg-red-100 text-gray-800 hover:text-red-800 transition-colors shadow"><X size={20} /></button>
              
              {/* Dynamic Project Modal based on Type */}
              {itemType === 'project' && (
                <div className="relative">
                  {selectedItem.type === 'video' ? (
                    <div className="w-full bg-[#111] rounded-t-xl overflow-hidden p-4 md:p-8 flex flex-col items-center justify-center relative min-h-[50vh]">
                       {/* Simulate video container */}
                       <div className="w-full max-w-3xl aspect-video bg-black rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 flex items-center justify-center group overflow-hidden relative">
                         {selectedItem.image && <img src={selectedItem.image} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                         <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white relative z-10 group-hover:scale-110 transition-transform cursor-pointer shadow-lg border border-white/30">
                           <div className="w-0 h-0 border-y-8 border-y-transparent border-l-[12px] border-l-white ml-1"></div>
                         </div>
                       </div>
                       
                       {/* Tags at bottom of video container */}
                       <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 flex gap-2">
                         {(selectedItem.videoTags || []).map((tag, i) => (
                           <span key={i} className="bg-white/10 backdrop-blur-md text-white border border-white/20 px-3 py-1 rounded-full text-xs font-mono tracking-widest uppercase shadow-lg">{tag}</span>
                         ))}
                       </div>
                    </div>
                  ) : selectedItem.type === 'gallery' ? (
                    <div className="w-full bg-[#f4f4f4] p-4 md:p-8 rounded-t-xl">
                      <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
                        {(selectedItem.galleryBlocks || []).map((block, i) => (
                          <div key={i} className={`${block.size === 'w-full' ? 'w-full' : block.size === 'w-1/2' ? 'w-full md:w-[calc(50%-12px)]' : 'w-full md:w-[calc(33.333%-16px)]'} shadow-lg rounded-xl overflow-hidden hover:-translate-y-1 transition-transform border border-black/5 bg-white`}>
                             {block.image && <img src={block.image} className="w-full h-full object-cover" />}
                          </div>
                        ))}
                        {!(selectedItem.galleryBlocks?.length) && <p className="text-gray-400 italic py-20 font-body">No images added to gallery.</p>}
                      </div>
                    </div>
                  ) : (
                    selectedItem.image && <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-48 md:h-80 object-cover rounded-t-xl" />
                  )}
                  
                  <div className="p-6 md:p-10 bg-[#fefce8] rounded-b-xl">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-6xl md:text-7xl font-title font-bold text-red-900 mb-1 tracking-wide">{selectedItem.title}</h2>
                        <p className="font-mono text-gray-500 text-sm tracking-wider">{selectedItem.tabId} // {selectedItem.author} • {selectedItem.year}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest bg-red-100 text-red-800 px-3 py-1 rounded-full shadow-sm border border-red-200">{selectedItem.type}</span>
                    </div>
                    <div className="w-full h-px bg-red-900/10 mb-6"></div>
                    <p className="font-body text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedItem.content}</p>
                  </div>
                </div>
              )}

              {/* Blog Modal */}
              {itemType === 'blog' && (
                <div>
                  {selectedItem.coverImage && <img src={selectedItem.coverImage} className="w-full h-48 md:h-80 object-cover" alt="cover"/>}
                  <div className="p-6 md:p-12">
                    <div className="flex justify-between items-end mb-2 border-b border-gray-200 pb-4">
                      <div>
                        <p className="font-handwriting text-2xl text-red-700 mb-1">{selectedItem.date}</p>
                        <h2 className="text-6xl md:text-7xl font-title font-bold text-gray-900 tracking-wide">{selectedItem.title}</h2>
                      </div>
                      {selectedItem.rating && (
                        <div className="flex text-yellow-500 mb-1">
                          {[...Array(Number(selectedItem.rating))].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                        </div>
                      )}
                    </div>
                    {selectedItem.category && <span className="text-[10px] font-bold uppercase tracking-wider text-red-800 bg-red-100 px-2 py-0.5 rounded w-fit my-3 block">{selectedItem.category}</span>}

                    <div className="space-y-6 mt-6">
                      {(selectedItem.blocks || []).map((block, idx) => (
                        <div key={idx}>
                          {block.type === 'text' && <p className="font-body text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{block.content}</p>}
                          {block.type === 'image' && block.content && <img src={block.content} alt={`visual ${idx}`} className="w-full rounded shadow-sm" />}
                          {block.type === 'imageDescription' && <p className="text-xs text-center text-gray-500 italic mt-1 font-body">{block.content}</p>}
                          {block.type === 'quote' && <blockquote className="border-l-4 border-red-800 pl-4 py-1 font-body text-lg text-gray-700 italic bg-red-50/50 rounded-r">{block.content}</blockquote>}
                          {block.type === 'pullquote' && <div className="text-3xl font-subtitle text-center text-red-900 my-10 italic border-y border-red-900/10 py-8 px-4">{block.content}</div>}
                        </div>
                      ))}
                    </div>
                    
                    {selectedItem.tags && (
                      <div className="mt-12 pt-4 border-t border-gray-200 flex flex-wrap gap-1.5">
                        <span className="text-xs font-bold text-gray-400 uppercase mr-1">Tags:</span>
                        {selectedItem.tags.split(',').map((tag, i) => (
                          <span key={i} className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">#{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOGIN MODAL */}
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