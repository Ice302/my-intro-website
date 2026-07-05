import React, { useState, useEffect } from 'react';
import { Pin, X, Lock, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, ArrowLeft, LogOut, Upload, ChevronUp, ChevronDown, MessageSquare, Star, Send } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- INITIALIZE SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const defaultProjects = [];
const defaultBlogs = [];

const defaultAbout = {
  introText: "Hellooo, the name is Vinz!\nYou can call me Ice^^",
  introImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
  notepadText: "This year, I decided to focus on building things I love. I wasn't able to launch many projects, but I did build a few amazing ones.",
  myspace: [{ id: 1, name: "Dirk", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" }],
  interests: [{ id: 1, title: "Anime", desc: "Anime is great...", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80" }],
  obsessions: [{ id: 1, category: "Top 10 Anime", items: ["Frieren", "Tanya"] }]
};

const defaultSocials = [
  { id: 1, name: 'GitHub', url: 'https://github.com', image: 'https://placehold.co/400x400/991b1b/fff?text=G' },
  { id: 2, name: 'Email', url: 'mailto:test@test.com', image: 'https://placehold.co/400x400/991b1b/fff?text=E' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // App Data States
  const [projects, setProjects] = useState(defaultProjects);
  const [blogs, setBlogs] = useState(defaultBlogs);
  const [aboutData, setAboutData] = useState(defaultAbout);
  const [socials, setSocials] = useState(defaultSocials);
  
  // Playground / Guestbook States
  const [guestMessages, setGuestMessages] = useState([]);
  const [newGuestMessage, setNewGuestMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Interaction States
  const [selectedItem, setSelectedItem] = useState(null); 
  const [itemType, setItemType] = useState(null); 
  
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

      // Fetch Site Data
      const { data: siteData } = await supabase.from('site_data').select('*');
      if (siteData && siteData.length > 0) {
        const p = siteData.find(d => d.section === 'projects');
        const b = siteData.find(d => d.section === 'blogs');
        const a = siteData.find(d => d.section === 'about');
        const s = siteData.find(d => d.section === 'socials');
        
        if (p) setProjects(p.data);
        if (b) setBlogs(b.data);
        if (a) setAboutData(a.data);
        if (s) setSocials(s.data);
      }

      // Fetch Playground Anonymous Messages
      const { data: messages } = await supabase.from('playground_messages').select('*').order('created_at', { ascending: false });
      if (messages) setGuestMessages(messages);

      setIsLoading(false);
    }
    loadDataAndAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
    setIsLoading(false);
    if (error) {
      alert("Login Failed: " + error.message);
    } else {
      setIsAdmin(true);
      setShowLogin(false);
      setActiveTab('admin');
      setPasswordInput(""); setEmailInput("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setActiveTab('intro');
  };

  const openModal = (item, type) => {
    setSelectedItem(item);
    setItemType(type);
  };

  // Base64 Image Uploader Helper
  const handleImageUpload = (e, callback) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 2) { // 2MB limit warning
      alert("Please choose an image smaller than 2MB for better performance.");
      return;
    }
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
      { section: 'socials', data: socials }
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
    if (!newGuestMessage.trim()) return;
    setIsSendingMessage(true);
    const { data, error } = await supabase.from('playground_messages').insert([{ message: newGuestMessage }]).select();
    if (!error && data) {
      setGuestMessages([data[0], ...guestMessages]);
      setNewGuestMessage("");
      alert("Note sent anonymously!");
    }
    setIsSendingMessage(false);
  };

  const deleteMessage = async (id) => {
    if (window.confirm("Delete this note?")) {
      await supabase.from('playground_messages').delete().eq('id', id);
      setGuestMessages(guestMessages.filter(m => m.id !== id));
    }
  };

  const moveBlock = (index, direction) => {
    const newBlocks = [...editingItem.blocks];
    if (direction === 'up' && index > 0) {
      [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    } else if (direction === 'down' && index < newBlocks.length - 1) {
      [newBlocks[index + 1], newBlocks[index]] = [newBlocks[index], newBlocks[index + 1]];
    }
    setEditingItem({ ...editingItem, blocks: newBlocks });
  };

  const tabs = [
    { id: 'intro', label: 'Intro' },
    { id: 'portfolio', label: 'Portfolio' },
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
          <div className="flex flex-col lg:flex-row gap-8 items-start min-h-full pb-16 relative">
            <div className="flex-1 w-full space-y-16 min-w-0">
              
              <div>
                <h1 className="text-4xl md:text-5xl font-elegant text-[#991b1b] mb-6"><span className="italic font-light">My</span> Introduction</h1>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="whitespace-pre-wrap font-sans text-lg text-gray-800 leading-relaxed flex-1">{aboutData.introText}</div>
                  {aboutData.introImage && (
                    <div className="w-full md:w-64 shrink-0 rotate-1 hover:rotate-0 transition-transform">
                      <img src={aboutData.introImage} alt="Intro" className="w-full rounded shadow-md border border-yellow-600/30" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">People I like</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  {aboutData.myspace.map((friend, i) => (
                    <div key={friend.id} className="group">
                      <p className="text-sm font-handwriting text-red-800 mb-1 text-xl">{i+1}. {friend.name}</p>
                      <img src={friend.image} alt={friend.name} className="w-full aspect-square object-cover rounded-sm shadow-sm border border-yellow-600/30 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">Interests</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {aboutData.interests.map((interest) => (
                    <div key={interest.id}>
                      <h3 className="font-elegant font-bold text-gray-900 mb-2 truncate" title={interest.title}>{interest.title}</h3>
                      <img src={interest.image} alt={interest.title} className="w-full aspect-[4/3] object-cover rounded-sm shadow-sm border border-yellow-600/30 mb-3" />
                      <p className="text-sm text-gray-700 leading-relaxed font-sans line-clamp-3" title={interest.desc}>{interest.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">
                  Obsessions <span className="text-lg font-handwriting text-red-800/60 font-normal ml-2">(Top 10s)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {aboutData.obsessions.map((obs) => (
                    <div key={obs.id} className="bg-[#e4d467] shadow-[inset_3px_3px_6px_rgba(0,0,0,0.1),_inset_-3px_-3px_6px_rgba(255,255,255,0.4)] p-5 rounded-2xl border border-yellow-600/20">
                      <h3 className="font-bold font-sans text-gray-900 mb-3 text-lg border-b border-gray-900/10 pb-2 truncate">{obs.category}</h3>
                      <ol className="list-decimal list-inside text-sm text-gray-800 space-y-1.5 font-sans">
                        {obs.items.map((item, i) => (
                          <li key={i} className="leading-snug pl-1 marker:text-red-800/70 marker:font-bold truncate" title={item}>{item}</li>
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
              <div className="bg-[#fefce8] p-6 pt-10 rounded shadow-md rotate-2 transition-transform hover:rotate-0 duration-300 relative overflow-hidden min-h-[16rem] border border-yellow-200">
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(transparent 95%, #fca5a5 95%)', backgroundSize: '100% 1.8rem' }}></div>
                <p className="font-handwriting text-xl text-red-800/90 leading-[1.8rem] relative z-10 break-words">
                  {aboutData.notepadText || "Write a note in the admin panel!"}
                </p>
                <div className="text-right text-red-800/60 mt-2 font-handwriting text-lg relative z-10">✧.*</div>
              </div>
            </div>
          </div>
        );

      // --- 2. PORTFOLIO PAGE ---
      case 'portfolio':
        return (
          <div className="min-h-full pb-16">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-8"><span className="italic font-light">All</span> Projects</h1>
            {projects.length === 0 ? (
              <p className="text-xl font-handwriting text-gray-600 text-center mt-20">In the future, there will be something here...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {projects.map((item) => (
                  <div key={item.id} onClick={() => openModal(item, 'project')} className="group cursor-pointer">
                    <div className="rounded-xl overflow-hidden shadow-lg mb-2 border border-yellow-600/20 group-hover:-translate-y-1 transition-transform bg-white">
                      {item.image ? <img src={item.image} alt={item.title} className="w-full h-40 object-cover" /> : <div className="w-full h-40 bg-gray-200 flex items-center justify-center text-gray-400"><ImageIcon/></div>}
                    </div>
                    <h3 className="font-elegant font-bold text-gray-900 leading-tight text-sm">{item.title}</h3>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      // --- 3. BLOG PAGE ---
      case 'blog':
        return (
          <div className="min-h-full pb-16 max-w-4xl mx-auto">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-8 text-center"><span className="italic font-light">My</span> Thoughts</h1>
            {blogs.length === 0 ? (
              <p className="text-xl font-handwriting text-gray-600 text-center mt-20">In the future, there will be something here...</p>
            ) : (
              <div className="space-y-6">
                {blogs.map((post) => (
                  <div key={post.id} onClick={() => openModal(post, 'blog')} className="bg-white/40 flex flex-col md:flex-row overflow-hidden rounded-xl border border-yellow-600/20 shadow-sm hover:bg-white/60 transition-colors cursor-pointer group">
                    {post.coverImage && (
                      <div className="w-full md:w-1/3 h-48 md:h-auto shrink-0 overflow-hidden">
                        <img src={post.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="cover"/>
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-handwriting text-red-700 text-xl">{post.date}</p>
                        {post.rating && (
                          <div className="flex text-yellow-500">
                            {[...Array(Number(post.rating))].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                          </div>
                        )}
                      </div>
                      <h2 className="font-elegant text-2xl font-bold mb-2 text-gray-900 group-hover:text-red-700 transition-colors">{post.title}</h2>
                      {post.category && <span className="text-xs font-bold uppercase tracking-wider text-red-800 bg-red-100 px-2 py-1 rounded w-fit mb-3">{post.category}</span>}
                      <p className="font-sans text-gray-800 text-sm line-clamp-3">{post.excerpt}</p>
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
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-4 text-center">Anonymous Notes</h1>
            <p className="text-gray-700 mb-8 font-sans text-center max-w-md">Leave a message, a drawing of text, or whatever is on your mind. It's completely anonymous.</p>
            
            <form onSubmit={sendAnonymousMessage} className="w-full max-w-xl bg-white/40 p-6 rounded-2xl shadow-sm border border-yellow-600/30 backdrop-blur-sm relative z-10">
              <textarea 
                required
                value={newGuestMessage}
                onChange={(e) => setNewGuestMessage(e.target.value)}
                placeholder="Write something cool here..."
                className="w-full h-32 p-4 rounded-xl border border-yellow-600/20 bg-white/70 focus:bg-white outline-none font-handwriting text-2xl text-gray-800 resize-none mb-4"
              />
              <button disabled={isSendingMessage} type="submit" className="w-full bg-red-800 text-white font-bold py-3 rounded-xl hover:bg-red-900 transition-colors flex items-center justify-center gap-2">
                {isSendingMessage ? 'Sending...' : <><Send size={18}/> Send Note</>}
              </button>
            </form>
          </div>
        );

      // --- 5. SOCIALS ---
      case 'socials':
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-12"><span className="italic font-light">Where to</span> Find Me</h1>
            {socials.length === 0 ? (
              <p className="text-xl font-handwriting text-gray-600 text-center">Links coming soon...</p>
            ) : (
              <div className="flex gap-8 flex-wrap justify-center">
                {socials.map((social) => (
                  <a key={social.id} href={social.url} target="_blank" rel="noopener noreferrer" className="bg-[#fefce8] p-4 pb-12 rounded shadow-md border border-gray-200 rotate-[-2deg] hover:rotate-0 hover:-translate-y-2 transition-all cursor-pointer w-40 text-center relative block">
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/50 shadow-sm rounded-sm backdrop-blur-sm -rotate-2"></div>
                    <div className="w-full h-32 bg-gray-200 mb-4 rounded-sm overflow-hidden flex items-center justify-center">
                      {social.image ? <img src={social.image} alt={social.name} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-400">Icon</span>}
                    </div>
                    <span className="font-handwriting text-2xl text-gray-800">{social.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );

      // --- 6. ADMIN DASHBOARD ---
      case 'admin':
        if (!isAdmin) return null;
        
        // EDITOR MODAL FOR LISTS
        if (editingItem) {
          return (
            <div className="max-w-4xl mx-auto bg-white/50 p-6 rounded-xl border border-yellow-600/30 shadow-lg mb-16">
              <button onClick={() => setEditingItem(null)} className="flex items-center gap-2 text-gray-600 hover:text-red-800 font-bold mb-6"><ArrowLeft size={20} /> Back</button>
              
              <form onSubmit={(e) => handleListSave(e, adminTab)} className="space-y-4 font-sans">
                {/* PROJECT EDITOR */}
                {adminTab === 'projects' && (
                  <>
                    <input required placeholder="Project Title" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 text-xl font-bold rounded border border-gray-300 bg-white" />
                    <div className="flex gap-4">
                      <input placeholder="Year" value={editingItem.year || ''} onChange={e => setEditingItem({...editingItem, year: e.target.value})} className="w-1/3 p-2 rounded border border-gray-300 bg-white" />
                      <input placeholder="Tech / Author" value={editingItem.author || ''} onChange={e => setEditingItem({...editingItem, author: e.target.value})} className="w-2/3 p-2 rounded border border-gray-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Cover Image</label>
                      <div className="flex gap-2">
                        <input placeholder="Image URL (or upload)" value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white" />
                        <label className="cursor-pointer bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2">
                          <Upload size={16}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                        </label>
                      </div>
                      {editingItem.image && <img src={editingItem.image} alt="preview" className="mt-2 h-20 rounded" />}
                    </div>
                    <textarea required placeholder="Project Description..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-40" />
                  </>
                )}

                {/* BLOG EDITOR */}
                {adminTab === 'blogs' && (
                  <>
                    <input required placeholder="Blog Title" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 text-xl font-bold rounded border border-gray-300 bg-white" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <input required placeholder="Date" value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="p-2 rounded border border-gray-300 bg-white" />
                      <input placeholder="Category" value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="p-2 rounded border border-gray-300 bg-white" />
                      <input placeholder="Tags (comma separated)" value={editingItem.tags || ''} onChange={e => setEditingItem({...editingItem, tags: e.target.value})} className="p-2 rounded border border-gray-300 bg-white" />
                      <select value={editingItem.rating || ''} onChange={e => setEditingItem({...editingItem, rating: e.target.value})} className="p-2 rounded border border-gray-300 bg-white">
                        <option value="">No Rating</option>
                        {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Stars</option>)}
                      </select>
                    </div>
                    <textarea required placeholder="Short Excerpt" value={editingItem.excerpt || ''} onChange={e => setEditingItem({...editingItem, excerpt: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-20" />
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Cover Image</label>
                      <div className="flex gap-2">
                        <input placeholder="Cover Image URL (or upload)" value={editingItem.coverImage || ''} onChange={e => setEditingItem({...editingItem, coverImage: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white" />
                        <label className="cursor-pointer bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2">
                          <Upload size={16}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, coverImage: base64}))} />
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-100/50 rounded-lg border border-gray-300 mt-6">
                      <h3 className="font-bold text-gray-800 mb-4">Content Blocks</h3>
                      <div className="space-y-4 mb-4">
                        {(editingItem.blocks || []).map((block, idx) => (
                          <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded shadow-sm border border-gray-200 group">
                            
                            <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => moveBlock(idx, 'up')} className="p-1 hover:bg-gray-100 rounded"><ChevronUp size={16}/></button>
                              <button type="button" onClick={() => moveBlock(idx, 'down')} className="p-1 hover:bg-gray-100 rounded"><ChevronDown size={16}/></button>
                            </div>

                            <div className="flex-1">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">{block.type}</span>
                              
                              {block.type === 'text' && (
                                <textarea value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="w-full p-2 border border-gray-200 rounded min-h-[100px]" placeholder="Write paragraph..." />
                              )}
                              
                              {(block.type === 'quote' || block.type === 'pullquote' || block.type === 'imageDescription') && (
                                <input value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="w-full p-2 border border-gray-200 rounded" placeholder={`Enter ${block.type} text...`} />
                              )}

                              {block.type === 'image' && (
                                <div>
                                  <div className="flex gap-2 mb-2">
                                    <input value={block.content} onChange={(e) => { const n = [...editingItem.blocks]; n[idx].content = e.target.value; setEditingItem({...editingItem, blocks: n}); }} className="flex-1 p-2 border border-gray-200 rounded" placeholder="Image URL or Upload..." />
                                    <label className="cursor-pointer bg-gray-100 px-3 py-2 rounded border border-gray-300 hover:bg-gray-200"><Upload size={16}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => { const n = [...editingItem.blocks]; n[idx].content = base64; setEditingItem({...editingItem, blocks: n}); })} /></label>
                                  </div>
                                  {block.content && <img src={block.content} alt="Preview" className="h-20 object-cover rounded" />}
                                </div>
                              )}
                            </div>
                            
                            <button type="button" onClick={() => { const n = [...editingItem.blocks]; n.splice(idx, 1); setEditingItem({...editingItem, blocks: n}); }} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'text', content: ''}]})} className="bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Text</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'image', content: ''}]})} className="bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Image</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'quote', content: ''}]})} className="bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Quote</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'pullquote', content: ''}]})} className="bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Pullquote</button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks||[]), {type: 'imageDescription', content: ''}]})} className="bg-white border border-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Img Desc.</button>
                      </div>
                    </div>
                  </>
                )}

                {/* SOCIALS EDITOR */}
                {adminTab === 'socials' && (
                  <>
                    <input required placeholder="Platform Name (e.g. Instagram)" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 font-bold rounded border border-gray-300 bg-white" />
                    <input required placeholder="Link URL" value={editingItem.url || ''} onChange={e => setEditingItem({...editingItem, url: e.target.value})} className="w-full p-3 rounded border border-gray-300 bg-white" />
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Icon/Image</label>
                      <div className="flex gap-2">
                        <input placeholder="Image URL (or upload)" value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="flex-1 p-2 rounded border border-gray-300 bg-white" />
                        <label className="cursor-pointer bg-gray-200 px-4 py-2 rounded font-bold hover:bg-gray-300 flex items-center gap-2">
                          <Upload size={16}/> Upload <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (base64) => setEditingItem({...editingItem, image: base64}))} />
                        </label>
                      </div>
                      {editingItem.image && <img src={editingItem.image} alt="preview" className="mt-2 h-16 w-16 object-cover rounded bg-white p-1 border border-gray-200" />}
                    </div>
                  </>
                )}
                
                <button type="submit" className="w-full bg-red-800 text-white p-4 rounded font-bold hover:bg-red-900 transition-colors">Done Editing</button>
              </form>
            </div>
          );
        }

        // MAIN DASHBOARD
        return (
          <div className="min-h-full pb-32 font-sans relative">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-elegant text-[#991b1b]">Admin Dashboard</h1>
              <button onClick={handleLogout} className="flex items-center gap-2 text-red-700 bg-red-100 px-4 py-2 rounded-lg font-bold hover:bg-red-200"><LogOut size={18}/> Logout</button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto mb-8 border-b border-gray-300 pb-2">
              {['about', 'projects', 'blogs', 'socials', 'messages'].map(tab => (
                <button key={tab} onClick={() => setAdminTab(tab)} className={`font-bold capitalize px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap ${adminTab === tab ? 'bg-red-800 text-white' : 'bg-white/50 text-gray-700 hover:bg-white'}`}>
                  Manage {tab}
                </button>
              ))}
            </div>

            {/* ABOUT PAGE SETTINGS */}
            {adminTab === 'about' && (
              <div className="bg-white/50 p-6 rounded-xl border border-yellow-600/30 space-y-10">
                {/* Intro & Notepad */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-gray-800 border-b border-gray-300 pb-1">1. Main Intro</h3>
                    <textarea value={aboutData.introText} onChange={e => setAboutData({...aboutData, introText: e.target.value})} className="w-full p-3 border border-gray-300 rounded h-32 mb-2 bg-white" />
                    <div className="flex gap-2">
                      <input placeholder="Intro Image URL" value={aboutData.introImage} onChange={e => setAboutData({...aboutData, introImage: e.target.value})} className="flex-1 p-2 border border-gray-300 rounded bg-white text-sm" />
                      <label className="cursor-pointer bg-gray-200 px-3 rounded hover:bg-gray-300 flex items-center"><Upload size={16}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => setAboutData({...aboutData, introImage: b}))} /></label>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-gray-800 border-b border-gray-300 pb-1">2. Sticky Notepad</h3>
                    <textarea 
                      maxLength={150} 
                      value={aboutData.notepadText} 
                      onChange={e => setAboutData({...aboutData, notepadText: e.target.value})} 
                      className="w-full p-3 border border-gray-300 rounded h-32 bg-[#fefce8] font-handwriting text-xl resize-none" 
                      placeholder="Write a short note here..."
                    />
                    <p className="text-right text-xs text-gray-500 font-bold">{aboutData.notepadText?.length || 0} / 150</p>
                  </div>
                </div>

                {/* People I Like */}
                <div>
                  <h3 className="font-bold text-lg mb-2 text-gray-800 border-b border-gray-300 pb-1">3. People I Like (Myspace)</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.myspace.map((friend, idx) => (
                      <div key={friend.id} className="bg-white p-3 border border-gray-200 rounded flex gap-2 items-center">
                        <img src={friend.image || 'https://placehold.co/100'} className="w-12 h-12 rounded object-cover" alt="prev"/>
                        <div className="flex-1 space-y-2">
                          <input value={friend.name} onChange={(e) => { const n = [...aboutData.myspace]; n[idx].name = e.target.value; setAboutData({...aboutData, myspace: n}); }} className="w-full p-1 border-b border-gray-200 text-sm font-bold outline-none" placeholder="Name" />
                          <div className="flex gap-1">
                             <input value={friend.image} onChange={(e) => { const n = [...aboutData.myspace]; n[idx].image = e.target.value; setAboutData({...aboutData, myspace: n}); }} className="flex-1 p-1 border-b border-gray-200 text-xs outline-none" placeholder="Image URL" />
                             <label className="cursor-pointer text-blue-600 hover:text-blue-800 p-1"><Upload size={14}/><input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => { const n = [...aboutData.myspace]; n[idx].image = b; setAboutData({...aboutData, myspace: n}); })} /></label>
                          </div>
                        </div>
                        <button onClick={() => setAboutData({...aboutData, myspace: aboutData.myspace.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setAboutData({...aboutData, myspace: [...aboutData.myspace, { id: Date.now(), name: "New Person", image: "" }]})} className="bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Add Person</button>
                </div>

                {/* Interests */}
                <div>
                  <h3 className="font-bold text-lg mb-2 text-gray-800 border-b border-gray-300 pb-1">4. Interests</h3>
                  <div className="space-y-4 mb-4">
                    {aboutData.interests.map((interest, idx) => (
                      <div key={interest.id} className="bg-white p-4 border border-gray-200 rounded flex flex-col md:flex-row gap-4">
                        <img src={interest.image || 'https://placehold.co/300x200'} className="w-full md:w-32 h-24 object-cover rounded" alt="prev"/>
                        <div className="flex-1 space-y-2">
                          <input value={interest.title} onChange={(e) => { const n = [...aboutData.interests]; n[idx].title = e.target.value; setAboutData({...aboutData, interests: n}); }} className="w-full p-2 border border-gray-200 rounded font-bold text-sm" placeholder="Title" />
                          <div className="flex gap-2">
                            <input value={interest.image} onChange={(e) => { const n = [...aboutData.interests]; n[idx].image = e.target.value; setAboutData({...aboutData, interests: n}); }} className="flex-1 p-2 border border-gray-200 rounded text-xs" placeholder="Image URL" />
                            <label className="cursor-pointer bg-gray-100 px-2 rounded hover:bg-gray-200 flex items-center text-xs"><Upload size={14}/> <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, (b) => { const n = [...aboutData.interests]; n[idx].image = b; setAboutData({...aboutData, interests: n}); })} /></label>
                          </div>
                          <textarea value={interest.desc} onChange={(e) => { const n = [...aboutData.interests]; n[idx].desc = e.target.value; setAboutData({...aboutData, interests: n}); }} className="w-full p-2 border border-gray-200 rounded text-xs h-16" placeholder="Description" />
                        </div>
                        <button onClick={() => setAboutData({...aboutData, interests: aboutData.interests.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded h-fit"><Trash2 size={20}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setAboutData({...aboutData, interests: [...aboutData.interests, { id: Date.now(), title: "New", desc: "", image: "" }]})} className="bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Add Interest</button>
                </div>

                {/* Obsessions */}
                <div>
                  <h3 className="font-bold text-lg mb-2 text-gray-800 border-b border-gray-300 pb-1">5. Obsessions (Top Lists)</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.obsessions.map((obs, idx) => (
                      <div key={obs.id} className="bg-white p-4 border border-gray-200 rounded relative group">
                        <button onClick={() => setAboutData({...aboutData, obsessions: aboutData.obsessions.filter((_, i) => i !== idx)})} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        <input value={obs.category} onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].category = e.target.value; setAboutData({...aboutData, obsessions: n}); }} className="font-bold w-full p-2 mb-2 border-b border-gray-200 pr-8" placeholder="List Title" />
                        <textarea value={obs.items.join('\n')} onChange={(e) => { const n = [...aboutData.obsessions]; n[idx].items = e.target.value.split('\n'); setAboutData({...aboutData, obsessions: n}); }} className="w-full p-2 border border-gray-200 rounded h-32 text-sm font-mono" placeholder="Items (one per line)" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setAboutData({...aboutData, obsessions: [...aboutData.obsessions, { id: Date.now(), category: "New List", items: [] }]})} className="bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 flex items-center gap-1">+ Add List</button>
                </div>
              </div>
            )}

            {/* LIST MANAGERS (Projects, Blogs, Socials) */}
            {(adminTab === 'projects' || adminTab === 'blogs' || adminTab === 'socials') && (
              <div>
                <button onClick={() => setEditingItem(adminTab === 'blogs' ? {blocks: []} : {})} className="bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-800 shadow mb-4"><Plus size={18} /> Add New {adminTab.slice(0,-1)}</button>
                <div className="space-y-3">
                  {(adminTab === 'projects' ? projects : adminTab === 'blogs' ? blogs : socials).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/70 p-4 rounded-lg border border-yellow-600/30 shadow-sm">
                      <div className="flex items-center gap-4">
                        {(item.image || item.coverImage) && <img src={item.image || item.coverImage} className="w-12 h-12 object-cover rounded" alt="thumb"/>}
                        <span className="font-bold text-gray-800 text-lg">{item.title || item.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingItem(item)} className="p-2 text-blue-700 hover:bg-blue-100 rounded transition-colors"><Edit2 size={18} /></button>
                        <button onClick={() => {
                          if (window.confirm("Delete this?")) {
                            if (adminTab === 'projects') setProjects(projects.filter(p => p.id !== item.id));
                            if (adminTab === 'blogs') setBlogs(blogs.filter(b => b.id !== item.id));
                            if (adminTab === 'socials') setSocials(socials.filter(s => s.id !== item.id));
                          }
                        }} className="p-2 text-red-700 hover:bg-red-100 rounded transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MESSAGES / PLAYGROUND SETTINGS */}
            {adminTab === 'messages' && (
              <div className="bg-white/50 p-6 rounded-xl border border-yellow-600/30">
                <h3 className="font-bold text-xl text-gray-800 border-b border-gray-300 pb-2 mb-4">Playground Inbox</h3>
                {guestMessages.length === 0 ? <p className="text-gray-500 italic">No notes yet.</p> : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {guestMessages.map(msg => (
                      <div key={msg.id} className="bg-white p-4 rounded shadow-sm border border-gray-200 relative group">
                        <button onClick={() => deleteMessage(msg.id)} className="absolute top-2 right-2 text-red-400 hover:bg-red-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        <p className="font-handwriting text-xl text-gray-800 whitespace-pre-wrap pr-6">{msg.message}</p>
                        <p className="text-xs text-gray-400 mt-4 text-right">{new Date(msg.created_at).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FLOATING SAVE BUTTON */}
            <div className="fixed bottom-8 right-8 z-50">
              <button disabled={isSaving} onClick={saveAllToCloud} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 font-bold text-lg tracking-wide transition-transform hover:scale-105 disabled:opacity-50">
                <Save size={24}/> {isSaving ? 'Deploying...' : 'Deploy All Changes'}
              </button>
            </div>
          </div>
        );

    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');
        .font-handwriting { font-family: 'Caveat', cursive; }
        .font-elegant { font-family: 'Playfair Display', serif; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="min-h-screen bg-cover bg-center bg-fixed p-4 md:p-8 flex items-center justify-center relative"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041&auto=format&fit=crop')`, backgroundColor: '#2a4b3c' }}
      >
        {/* CHANGED: Swapped h-[90vh] for min-h-[90vh] to allow scaling on split screens */}
        <div className="w-full max-w-6xl relative z-10 flex flex-col min-h-[90vh] mt-4 md:mt-0">
          
          <div className="flex px-4 md:px-8 gap-1 md:gap-2 overflow-x-auto hide-scrollbar shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 md:px-8 py-3 rounded-t-2xl font-elegant text-lg md:text-xl transition-all whitespace-nowrap
                  ${activeTab === tab.id ? 'bg-[#EEDF7A] text-[#991b1b] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.2)] z-20 pb-5 -mb-2' : 'bg-[#DCCB5A] text-gray-700 hover:bg-[#E5D66C] z-10 pb-2 mt-2 opacity-90'}`}
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

              <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end text-red-900/60 pointer-events-none bg-gradient-to-t from-[#e4d467] via-[#e4d467]/90 to-transparent pt-12">
                <span className="font-sans font-bold tracking-widest text-sm">archive</span>
                <button onClick={() => setShowLogin(true)} className="pointer-events-auto font-sans text-lg tracking-[0.3em] hover:text-red-800 transition-colors" title="Secret Login">✧.* ♡ ✿</button>
                <span className="font-sans font-bold text-sm">2026</span>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS MODAL */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
            <div className="bg-[#fefce8] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-yellow-200">
              <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-10 bg-white/80 p-2 rounded-full hover:bg-red-100 text-gray-800 hover:text-red-800 transition-colors shadow"><X size={24} /></button>
              
              {itemType === 'project' && (
                <div>
                  {selectedItem.image && <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-64 md:h-96 object-cover" />}
                  <div className="p-8 md:p-12">
                    <h2 className="text-4xl font-elegant font-bold text-red-900 mb-2">{selectedItem.title}</h2>
                    <p className="font-mono text-gray-500 mb-8 border-b border-gray-200 pb-4">{selectedItem.author} • {selectedItem.year}</p>
                    <p className="font-sans text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedItem.content}</p>
                  </div>
                </div>
              )}

              {itemType === 'blog' && (
                <div>
                  {selectedItem.coverImage && <img src={selectedItem.coverImage} className="w-full h-64 md:h-96 object-cover" alt="cover"/>}
                  <div className="p-8 md:p-16">
                    <div className="flex justify-between items-end mb-2 border-b border-gray-200 pb-6">
                      <div>
                        <p className="font-handwriting text-2xl text-red-700 mb-2">{selectedItem.date}</p>
                        <h2 className="text-4xl md:text-5xl font-elegant font-bold text-gray-900">{selectedItem.title}</h2>
                      </div>
                      {selectedItem.rating && (
                        <div className="flex text-yellow-500 mb-2">
                          {[...Array(Number(selectedItem.rating))].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
                        </div>
                      )}
                    </div>
                    {selectedItem.category && <span className="text-sm font-bold uppercase tracking-wider text-red-800 bg-red-100 px-3 py-1 rounded w-fit my-4 block">{selectedItem.category}</span>}

                    <div className="space-y-8 mt-8">
                      {(selectedItem.blocks || []).map((block, idx) => (
                        <div key={idx}>
                          {block.type === 'text' && <p className="font-sans text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{block.content}</p>}
                          {block.type === 'image' && block.content && <img src={block.content} alt={`visual ${idx}`} className="w-full rounded-lg shadow-md" />}
                          {block.type === 'imageDescription' && <p className="text-sm text-center text-gray-500 italic mt-2">{block.content}</p>}
                          {block.type === 'quote' && <blockquote className="border-l-4 border-red-800 pl-4 py-2 font-sans text-xl text-gray-700 italic bg-red-50/50 rounded-r">{block.content}</blockquote>}
                          {block.type === 'pullquote' && <div className="text-3xl font-elegant text-center text-red-900 my-12 italic border-y border-red-900/10 py-8 px-4">{block.content}</div>}
                        </div>
                      ))}
                    </div>
                    
                    {selectedItem.tags && (
                      <div className="mt-16 pt-6 border-t border-gray-200 flex flex-wrap gap-2">
                        <span className="text-sm font-bold text-gray-400 uppercase mr-2">Tags:</span>
                        {selectedItem.tags.split(',').map((tag, i) => (
                          <span key={i} className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">#{tag.trim()}</span>
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
            <div className="bg-[#fefce8] p-8 rounded-xl shadow-2xl w-full max-w-sm border border-yellow-200 relative">
              <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-gray-500 hover:text-red-700"><X size={20}/></button>
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 bg-red-100 text-red-800 rounded-full flex items-center justify-center mb-3"><Lock size={24} /></div>
                <h2 className="text-2xl font-elegant font-bold text-gray-800">Admin Login</h2>
              </div>
              <form onSubmit={handleLogin} className="space-y-3">
                <input type="email" required placeholder="Admin Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 bg-white font-sans outline-none" />
                <input type="password" required placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 bg-white font-sans outline-none" />
                <button disabled={isLoading} type="submit" className="w-full bg-red-800 text-white font-bold p-3 rounded-lg hover:bg-red-900 transition-colors disabled:opacity-50">
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