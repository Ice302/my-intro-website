import React, { useState, useEffect } from 'react';
import { Pin, X, Lock, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type, ArrowLeft } from 'lucide-react';

// --- DEFAULT DATA (Fallback if localStorage is empty) ---

const defaultProjects = [
  { id: 1, title: "E-Commerce App", year: "(2024)", author: "React & Node", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=80", content: "A full-stack e-commerce platform built from scratch..." },
  { id: 2, title: "Task Manager", year: "(2023)", author: "TypeScript", image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&q=80", content: "A productivity app designed for small teams..." },
];

const defaultBlogs = [
  { 
    id: 1, 
    date: "Oct 12, 2025", 
    title: "Finding peace in slower development cycles", 
    excerpt: "Sometimes the best code is the code you write after stepping away...",
    blocks: [
      { type: 'text', content: "Sometimes the best code is the code you write after stepping away from the screen for a while. In a world obsessed with shipping fast, I took a month to just plan my next architecture." },
      { type: 'image', content: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80" },
      { type: 'text', content: "The result? Zero bugs in production and a much happier developer. Here is what I learned during that month of quiet." }
    ]
  },
];

const defaultAbout = {
  introText: "Hellooo, the name is Vinz!\n\nYou can call me Ice^^\n\nI am 16 years of age, born on April 16, 2008\n\nI am an Aries, and Intp-t (I don't believe fully in these)\n\nMy sexuality is AroAce (Not interested romantically or sexually)\n\n3 words about me?: Chaotic, Needy, Nerdy",
  introImage: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
  myspace: [
    { id: 1, name: "Dirk", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80" },
    { id: 2, name: "Renz", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80" },
    { id: 3, name: "Danes", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80" },
    { id: 4, name: "Chariz", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80" },
  ],
  interests: [
    { id: 1, title: "Anime", desc: "Anime has been a very integral bonding thing...", image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80" },
    { id: 2, title: "Music", desc: "This is one of my worse obsessions...", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80" },
    { id: 3, title: "Gaming", desc: "2020 me became a degen for this...", image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&q=80" },
    { id: 4, title: "Aviation", desc: "Aviation has always had a place in my heart...", image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=300&q=80" },
    { id: 5, title: "Cars", desc: "Exotic cars and even the largest and fastest...", image: "https://images.unsplash.com/photo-1503376760302-3c2a537f00f0?w=300&q=80" },
  ],
  obsessions: [
    { id: 1, category: "Top 10 Anime", items: ["Frieren", "Tanya", "Dangers in my heart", "Slime tensura", "Soukoku", "Bocchi the rock", "Aono Orchestra", "Apothecary Diaries", "Solo leveling", "Ranking of kings"] },
    { id: 2, category: "Top 10 Movies", items: ["Everything Everywhere all at once", "Mr. Fantastic Fox", "Dead Man's Chest", "Now you see me two", "Oblivion", "Pacific rim", "The kingdom of god", "Ford vs Ferrari", "Ready player one", "The intern"] },
    { id: 3, category: "Top 10 Songs", items: ["Godspeed / White Ferrari", "Sing about me, im dying of thirst", "Wilshire / Are we still friends?", "Sedated / Jackie and Wilson", "Love is just a feeling"] },
    { id: 4, category: "Top 10 Reads", items: ["Cherry Crush", "The guy she was interested in", "Cherry blossoms after winter", "Boyfriends", "One room TA"] },
  ]
};

const defaultPlayground = {
  title: "Blank Canvas",
  content: "This space is intentionally left blank. You can add anything you want here later!",
  image: ""
};

export default function App() {
  const [activeTab, setActiveTab] = useState('intro');
  
  // App Data States
  const [projects, setProjects] = useState(defaultProjects);
  const [blogs, setBlogs] = useState(defaultBlogs);
  const [aboutData, setAboutData] = useState(defaultAbout);
  const [playgroundData, setPlaygroundData] = useState(defaultPlayground);
  
  // Interaction States
  const [selectedItem, setSelectedItem] = useState(null); 
  const [itemType, setItemType] = useState(null); 
  
  // Admin States
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  // Admin Dash States
  const [adminTab, setAdminTab] = useState('about'); 
  const [editingItem, setEditingItem] = useState(null); 

  // Load from LocalStorage
  useEffect(() => {
    const savedProjects = localStorage.getItem('v_projects');
    const savedBlogs = localStorage.getItem('v_blogs');
    const savedAbout = localStorage.getItem('v_about');
    const savedPlayground = localStorage.getItem('v_playground');
    
    if (savedProjects) setProjects(JSON.parse(savedProjects));
    if (savedBlogs) setBlogs(JSON.parse(savedBlogs));
    if (savedAbout) setAboutData(JSON.parse(savedAbout));
    if (savedPlayground) setPlaygroundData(JSON.parse(savedPlayground));
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('v_projects', JSON.stringify(projects));
    localStorage.setItem('v_blogs', JSON.stringify(blogs));
    localStorage.setItem('v_about', JSON.stringify(aboutData));
    localStorage.setItem('v_playground', JSON.stringify(playgroundData));
  }, [projects, blogs, aboutData, playgroundData]);

  const tabs = [
    { id: 'intro', label: 'Intro' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'blog', label: 'Blog' },
    { id: 'socials', label: 'Socials' },
    { id: 'blank', label: 'Playground' },
  ];
  if (isAdmin) tabs.push({ id: 'admin', label: 'Admin Panel' });

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "admin123") {
      setIsAdmin(true);
      setShowLogin(false);
      setActiveTab('admin');
      setPasswordInput("");
    } else {
      alert("Incorrect Password");
    }
  };

  const openModal = (item, type) => {
    setSelectedItem(item);
    setItemType(type);
  };

  // --- ADMIN HANDLERS ---
  const saveProjectOrBlog = (e) => {
    e.preventDefault();
    if (adminTab === 'projects') {
      if (editingItem.id) setProjects(projects.map(p => p.id === editingItem.id ? editingItem : p));
      else setProjects([...projects, { ...editingItem, id: Date.now() }]);
    } else {
      if (editingItem.id) setBlogs(blogs.map(b => b.id === editingItem.id ? editingItem : b));
      else setBlogs([...blogs, { ...editingItem, id: Date.now() }]);
    }
    setEditingItem(null);
  };

  const deleteItem = (id, type) => {
    if (window.confirm("Are you sure?")) {
      if (type === 'project') setProjects(projects.filter(p => p.id !== id));
      if (type === 'blog') setBlogs(blogs.filter(b => b.id !== id));
    }
  };

  // --- RENDER CONTENT VIEWS ---
  const renderContent = () => {
    switch (activeTab) {
      
      // 1. THE CASCADING INTRO PAGE
      case 'intro':
        return (
          <div className="flex flex-col lg:flex-row gap-8 items-start min-h-full pb-16 relative">
            
            {/* Left Side: Cascading About Content */}
            <div className="flex-1 w-full space-y-16">
              
              {/* 1. Introduction Section */}
              <div>
                <h1 className="text-4xl md:text-5xl font-elegant text-[#991b1b] mb-6">
                  <span className="italic font-light">My</span> Introduction
                </h1>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="whitespace-pre-wrap font-sans text-lg text-gray-800 leading-relaxed flex-1">
                    {aboutData.introText}
                  </div>
                  {aboutData.introImage && (
                    <div className="w-full md:w-64 shrink-0 rotate-1 hover:rotate-0 transition-transform">
                      <img src={aboutData.introImage} alt="Intro" className="w-full rounded shadow-md border border-yellow-600/30" />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Myspace Ref Section */}
              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">Myspace ref.</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  {aboutData.myspace.map((friend, i) => (
                    <div key={friend.id} className="group">
                      <p className="text-sm font-handwriting text-red-800 mb-1 text-xl">{i+1}. {friend.name}</p>
                      <img src={friend.image} alt={friend.name} className="w-full aspect-square object-cover rounded-sm shadow-sm border border-yellow-600/30 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Interests Section */}
              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">Interests</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {aboutData.interests.map((interest) => (
                    <div key={interest.id}>
                      <h3 className="font-elegant font-bold text-gray-900 mb-2">{interest.title}</h3>
                      <img src={interest.image} alt={interest.title} className="w-full aspect-[4/3] object-cover rounded-sm shadow-sm border border-yellow-600/30 mb-3" />
                      <p className="text-sm text-gray-700 leading-relaxed font-sans">{interest.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Obsessions Section */}
              <div>
                <h2 className="text-3xl font-elegant text-[#991b1b] mb-6 border-b border-red-900/20 pb-2">
                  Obsessions <span className="text-lg font-handwriting text-red-800/60 font-normal ml-2">(Top 10s)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
                  {aboutData.obsessions.map((obs) => (
                    <div key={obs.id}>
                      <h3 className="font-bold font-sans text-gray-900 mb-3 text-lg border-b border-gray-900/10 pb-1">{obs.category}</h3>
                      <ol className="list-decimal list-inside text-sm text-gray-800 space-y-1.5 font-sans">
                        {obs.items.map((item, i) => (
                          <li key={i} className="leading-snug pl-1 marker:text-red-800/70 marker:font-bold">{item}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
              
            </div>

            {/* Right Side: Sticky Note (It uses position: sticky to scroll down with you!) */}
            <div className="w-full lg:w-72 shrink-0 mt-8 lg:mt-0 sticky top-8 z-20">
              {/* Push Pin */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 text-red-700">
                <Pin size={32} fill="#b91c1c" className="drop-shadow-md rotate-12" />
              </div>
              
              {/* Note Paper */}
              <div className="bg-[#fefce8] p-6 pt-10 rounded shadow-md rotate-2 transition-transform hover:rotate-0 duration-300 relative overflow-hidden h-64 border border-yellow-200">
                {/* Lined paper effect */}
                <div className="absolute inset-0 pointer-events-none" 
                     style={{ backgroundImage: 'linear-gradient(transparent 95%, #fca5a5 95%)', backgroundSize: '100% 1.8rem' }}>
                </div>
                
                {/* Handwritten text */}
                <p className="font-handwriting text-xl text-red-800/90 leading-[1.8rem] relative z-10">
                  This year, I decided to focus on building things I love. I wasn't able to launch many projects, but I did build a few amazing ones. I took my time with them, and I'm glad I did.
                </p>
                <div className="text-right text-red-800/60 mt-2 font-handwriting text-lg relative z-10">
                  ✧.*
                </div>
              </div>
            </div>
          </div>
        );

      // 2. PORTFOLIO PAGE
      case 'portfolio':
        return (
          <div className="min-h-full pb-16">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-8">
               <span className="italic font-light">All</span> Projects
            </h1>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {projects.map((item) => (
                <div key={item.id} onClick={() => openModal(item, 'project')} className="group cursor-pointer">
                  <div className="rounded-xl overflow-hidden shadow-lg mb-2 border border-yellow-600/20 group-hover:-translate-y-1 transition-transform">
                    <img src={item.image} alt={item.title} className="w-full h-40 object-cover" />
                  </div>
                  <h3 className="font-elegant font-bold text-gray-900 leading-tight text-sm">{item.title}</h3>
                </div>
              ))}
            </div>
          </div>
        );

      // 3. BLOG PAGE
      case 'blog':
        return (
          <div className="min-h-full pb-16 max-w-2xl mx-auto">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-8 text-center">
               <span className="italic font-light">My</span> Thoughts
            </h1>
            <div className="space-y-6">
              {blogs.map((post) => (
                <div key={post.id} onClick={() => openModal(post, 'blog')} className="bg-white/40 p-6 rounded-lg border border-yellow-600/20 shadow-sm hover:bg-white/60 transition-colors cursor-pointer group">
                  <p className="font-handwriting text-red-700 text-xl mb-1">{post.date}</p>
                  <h2 className="font-elegant text-2xl font-bold mb-2 text-gray-900 group-hover:text-red-700 transition-colors">{post.title}</h2>
                  <p className="font-sans text-gray-800 text-sm">{post.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        );

      // 4. ADMIN DASHBOARD
      case 'admin':
        if (!isAdmin) return null;
        
        if (editingItem) {
          return (
            <div className="max-w-4xl mx-auto bg-white/50 p-6 rounded-xl border border-yellow-600/30 shadow-lg mb-16">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => setEditingItem(null)} className="flex items-center gap-2 text-gray-600 hover:text-red-800 font-bold">
                  <ArrowLeft size={20} /> Back to List
                </button>
              </div>

              <form onSubmit={saveProjectOrBlog} className="space-y-4 font-sans">
                <input required placeholder="Title" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 text-xl font-bold rounded border border-gray-300 bg-white" />
                
                {adminTab === 'projects' ? (
                  <>
                    <div className="flex gap-4">
                      <input placeholder="Year (e.g., 2024)" value={editingItem.year || ''} onChange={e => setEditingItem({...editingItem, year: e.target.value})} className="w-1/3 p-2 rounded border border-gray-300 bg-white" />
                      <input placeholder="Tech / Author" value={editingItem.author || ''} onChange={e => setEditingItem({...editingItem, author: e.target.value})} className="w-2/3 p-2 rounded border border-gray-300 bg-white" />
                    </div>
                    <input required placeholder="Cover Image URL" value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white" />
                    <textarea required placeholder="Project Description..." value={editingItem.content || ''} onChange={e => setEditingItem({...editingItem, content: e.target.value})} className="w-full p-2 rounded border border-gray-300 bg-white h-40" />
                  </>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <input required placeholder="Date (e.g., Oct 12, 2026)" value={editingItem.date || ''} onChange={e => setEditingItem({...editingItem, date: e.target.value})} className="w-1/3 p-2 rounded border border-gray-300 bg-white" />
                      <input required placeholder="Short Excerpt (shows on main list)" value={editingItem.excerpt || ''} onChange={e => setEditingItem({...editingItem, excerpt: e.target.value})} className="w-2/3 p-2 rounded border border-gray-300 bg-white" />
                    </div>
                    
                    <div className="p-4 bg-gray-100/50 rounded-lg border border-gray-300">
                      <h3 className="font-bold text-gray-800 mb-4">Blog Content Builder</h3>
                      
                      <div className="space-y-4 mb-4">
                        {(editingItem.blocks || []).map((block, idx) => (
                          <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded shadow-sm border border-gray-200">
                            {block.type === 'text' ? (
                              <textarea 
                                value={block.content} 
                                onChange={(e) => {
                                  const newBlocks = [...editingItem.blocks];
                                  newBlocks[idx].content = e.target.value;
                                  setEditingItem({...editingItem, blocks: newBlocks});
                                }}
                                className="w-full p-2 border border-gray-200 rounded min-h-[100px]" 
                                placeholder="Write your paragraph here..." 
                              />
                            ) : (
                              <div className="w-full">
                                <input 
                                  value={block.content} 
                                  onChange={(e) => {
                                    const newBlocks = [...editingItem.blocks];
                                    newBlocks[idx].content = e.target.value;
                                    setEditingItem({...editingItem, blocks: newBlocks});
                                  }}
                                  className="w-full p-2 border border-gray-200 rounded mb-2" 
                                  placeholder="Paste Image URL here..." 
                                />
                                {block.content && <img src={block.content} alt="Preview" className="h-32 object-cover rounded" />}
                              </div>
                            )}
                            <button type="button" onClick={() => {
                              const newBlocks = [...editingItem.blocks];
                              newBlocks.splice(idx, 1);
                              setEditingItem({...editingItem, blocks: newBlocks});
                            }} className="p-2 text-red-500 hover:bg-red-50 rounded">
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'text', content: ''}]})} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50">
                          <Type size={16}/> Add Text Block
                        </button>
                        <button type="button" onClick={() => setEditingItem({...editingItem, blocks: [...(editingItem.blocks || []), {type: 'image', content: ''}]})} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50">
                          <ImageIcon size={16}/> Add Image Block
                        </button>
                      </div>
                    </div>
                  </>
                )}
                
                <button type="submit" className="w-full bg-red-800 text-white p-4 rounded font-bold hover:bg-red-900 transition-colors flex items-center justify-center gap-2 text-lg">
                  <Save size={20} /> Save Changes
                </button>
              </form>
            </div>
          );
        }

        return (
          <div className="min-h-full pb-24 font-sans">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-8">Admin Dashboard</h1>
            
            <div className="flex gap-2 overflow-x-auto mb-8 border-b border-gray-300 pb-2">
              {['about', 'projects', 'blogs', 'playground'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setAdminTab(tab)}
                  className={`font-bold capitalize px-4 py-2 rounded-t-lg transition-colors whitespace-nowrap ${adminTab === tab ? 'bg-red-800 text-white' : 'bg-white/50 text-gray-700 hover:bg-white'}`}
                >
                  Manage {tab}
                </button>
              ))}
            </div>

            {/* MANAGE ABOUT PAGE */}
            {adminTab === 'about' && (
              <div className="bg-white/50 p-6 rounded-xl border border-yellow-600/30 space-y-10">
                
                {/* 1. Intro */}
                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">1. Introduction</h3>
                  <textarea 
                    value={aboutData.introText} 
                    onChange={e => setAboutData({...aboutData, introText: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded h-40 mb-2"
                  />
                  <input 
                    placeholder="Intro Image URL" 
                    value={aboutData.introImage} 
                    onChange={e => setAboutData({...aboutData, introImage: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>

                {/* 2. Myspace */}
                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">2. Myspace Ref</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.myspace.map((friend, idx) => (
                      <div key={friend.id} className="bg-white p-3 border border-gray-200 rounded flex gap-2 items-center">
                        <img src={friend.image || 'https://placehold.co/100x100'} className="w-12 h-12 rounded object-cover" alt="prev"/>
                        <div className="flex-1 space-y-2">
                          <input 
                            value={friend.name} 
                            onChange={(e) => {
                              const newMyspace = [...aboutData.myspace];
                              newMyspace[idx].name = e.target.value;
                              setAboutData({...aboutData, myspace: newMyspace});
                            }}
                            className="w-full p-1 border-b border-gray-200 text-sm outline-none font-bold" placeholder="Friend Name"
                          />
                          <input 
                            value={friend.image} 
                            onChange={(e) => {
                              const newMyspace = [...aboutData.myspace];
                              newMyspace[idx].image = e.target.value;
                              setAboutData({...aboutData, myspace: newMyspace});
                            }}
                            className="w-full p-1 border-b border-gray-200 text-xs outline-none text-gray-500" placeholder="Image URL"
                          />
                        </div>
                        <button onClick={() => {
                          const newMyspace = aboutData.myspace.filter((_, i) => i !== idx);
                          setAboutData({...aboutData, myspace: newMyspace});
                        }} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    setAboutData({...aboutData, myspace: [...aboutData.myspace, { id: Date.now(), name: "New Friend", image: "" }]});
                  }} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm">
                    <Plus size={16}/> Add Myspace Friend
                  </button>
                </div>

                {/* 3. Interests */}
                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">3. Interests</h3>
                  <div className="space-y-4 mb-4">
                    {aboutData.interests.map((interest, idx) => (
                      <div key={interest.id} className="bg-white p-4 border border-gray-200 rounded flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-32 shrink-0">
                           <img src={interest.image || 'https://placehold.co/300x200'} className="w-full h-24 object-cover rounded" alt="prev"/>
                        </div>
                        <div className="flex-1 space-y-2">
                          <input 
                            value={interest.title} 
                            onChange={(e) => {
                              const newInterests = [...aboutData.interests];
                              newInterests[idx].title = e.target.value;
                              setAboutData({...aboutData, interests: newInterests});
                            }}
                            className="w-full p-2 border border-gray-200 rounded font-bold outline-none" placeholder="Interest Title"
                          />
                          <input 
                            value={interest.image} 
                            onChange={(e) => {
                              const newInterests = [...aboutData.interests];
                              newInterests[idx].image = e.target.value;
                              setAboutData({...aboutData, interests: newInterests});
                            }}
                            className="w-full p-2 border border-gray-200 rounded text-sm outline-none" placeholder="Image URL"
                          />
                          <textarea 
                            value={interest.desc} 
                            onChange={(e) => {
                              const newInterests = [...aboutData.interests];
                              newInterests[idx].desc = e.target.value;
                              setAboutData({...aboutData, interests: newInterests});
                            }}
                            className="w-full p-2 border border-gray-200 rounded text-sm outline-none h-20" placeholder="Description..."
                          />
                        </div>
                        <button onClick={() => {
                          const newInterests = aboutData.interests.filter((_, i) => i !== idx);
                          setAboutData({...aboutData, interests: newInterests});
                        }} className="text-red-500 hover:bg-red-50 p-2 rounded h-fit"><Trash2 size={20}/></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    setAboutData({...aboutData, interests: [...aboutData.interests, { id: Date.now(), title: "New Interest", desc: "", image: "" }]});
                  }} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm">
                    <Plus size={16}/> Add Interest
                  </button>
                </div>

                {/* 4. Obsessions */}
                <div>
                  <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">4. Obsessions (Top Lists)</h3>
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {aboutData.obsessions.map((obs, idx) => (
                      <div key={obs.id} className="bg-white p-4 border border-gray-200 rounded shadow-sm relative group">
                        <button onClick={() => {
                          const newObs = aboutData.obsessions.filter((_, i) => i !== idx);
                          setAboutData({...aboutData, obsessions: newObs});
                        }} className="absolute top-2 right-2 text-red-500 hover:bg-red-50 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        
                        <input 
                          value={obs.category} 
                          onChange={(e) => {
                            const newObs = [...aboutData.obsessions];
                            newObs[idx].category = e.target.value;
                            setAboutData({...aboutData, obsessions: newObs});
                          }}
                          className="font-bold w-full p-2 mb-2 border-b border-gray-200 outline-none pr-8"
                        />
                        <textarea 
                          value={obs.items.join('\n')}
                          onChange={(e) => {
                            const newObs = [...aboutData.obsessions];
                            newObs[idx].items = e.target.value.split('\n');
                            setAboutData({...aboutData, obsessions: newObs});
                          }}
                          className="w-full p-2 border border-gray-200 rounded h-40 text-sm text-gray-600 font-mono"
                          placeholder="Enter items, one per line..."
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => {
                    setAboutData({...aboutData, obsessions: [...aboutData.obsessions, { id: Date.now(), category: "New List", items: ["Item 1"] }]});
                  }} className="flex items-center gap-1 bg-white border border-gray-300 px-3 py-2 rounded text-sm hover:bg-gray-50 shadow-sm">
                    <Plus size={16}/> Add New List
                  </button>
                </div>

                <p className="text-sm text-gray-500 italic mt-4">* Note: Changes to the About page save automatically.</p>
              </div>
            )}

            {/* MANAGE PLAYGROUND */}
            {adminTab === 'playground' && (
              <div className="bg-white/50 p-6 rounded-xl border border-yellow-600/30 space-y-6">
                <h3 className="font-bold text-xl mb-4 text-gray-800 border-b border-gray-300 pb-2">Playground Customization</h3>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                  <input 
                    value={playgroundData.title} 
                    onChange={e => setPlaygroundData({...playgroundData, title: e.target.value})} 
                    className="w-full p-3 border border-gray-300 rounded font-bold text-lg bg-white"
                    placeholder="E.g. Blank Canvas"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Content (Text / Markdown)</label>
                  <textarea 
                    value={playgroundData.content}
                    onChange={e => setPlaygroundData({...playgroundData, content: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded h-48 bg-white font-mono text-sm"
                    placeholder="Write your playground content here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Background Image URL (Optional)</label>
                  <input 
                    value={playgroundData.image} 
                    onChange={e => setPlaygroundData({...playgroundData, image: e.target.value})} 
                    className="w-full p-3 border border-gray-300 rounded bg-white text-sm"
                    placeholder="https://..."
                  />
                </div>

                <p className="text-sm text-gray-500 italic mt-4">* Note: Changes to the Playground save automatically.</p>
              </div>
            )}

            {/* MANAGE PROJECTS OR BLOGS LIST */}
            {(adminTab === 'projects' || adminTab === 'blogs') && (
              <div>
                <div className="flex justify-between items-end mb-4 border-b border-red-900/20 pb-2">
                  <h2 className="text-2xl font-bold font-elegant text-gray-800 capitalize">Your {adminTab}</h2>
                  <button onClick={() => setEditingItem(adminTab === 'blogs' ? {blocks: []} : {})} className="bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-800 shadow">
                    <Plus size={18} /> Add New
                  </button>
                </div>
                <div className="space-y-3">
                  {(adminTab === 'projects' ? projects : blogs).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white/70 p-4 rounded-lg border border-yellow-600/30 shadow-sm">
                      <span className="font-bold text-gray-800 text-lg">{item.title}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingItem(item)} className="p-2 text-blue-700 hover:bg-blue-100 rounded transition-colors"><Edit2 size={18} /></button>
                        <button onClick={() => deleteItem(item.id, adminTab === 'projects' ? 'project' : 'blog')} className="p-2 text-red-700 hover:bg-red-100 rounded transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      // PLAYGROUND PAGE
      case 'blank':
        return (
          <div className="min-h-full pb-16 flex items-center justify-center relative rounded-2xl overflow-hidden">
            {playgroundData.image && (
              <img src={playgroundData.image} className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay" alt="Playground BG" />
            )}
            <div className="border-2 border-dashed border-red-800/30 w-full min-h-[60vh] rounded-2xl flex flex-col items-center justify-center p-8 text-center bg-white/10 relative z-10 backdrop-blur-[2px]">
              <h2 className="font-elegant text-4xl text-red-900 mb-6">{playgroundData.title}</h2>
              <p className="font-handwriting text-2xl text-gray-800 max-w-2xl whitespace-pre-wrap leading-relaxed">
                {playgroundData.content}
              </p>
            </div>
          </div>
        );

      case 'socials':
      default:
        return (
          <div className="min-h-full pb-16 flex flex-col items-center justify-center">
            <h1 className="text-4xl font-elegant text-[#991b1b] mb-12">
               <span className="italic font-light">Where to</span> Find Me
            </h1>
            <div className="flex gap-8 flex-wrap justify-center">
              {['GitHub', 'LinkedIn', 'Twitter', 'Email'].map((social, i) => (
                <div key={i} className="bg-[#fefce8] p-4 pb-12 rounded shadow-md border border-gray-200 rotate-[-2deg] hover:rotate-0 hover:-translate-y-2 transition-all cursor-pointer w-40 text-center relative">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-white/50 shadow-sm rounded-sm backdrop-blur-sm -rotate-2"></div>
                  <div className="w-full h-32 bg-gray-200 mb-4 rounded-sm overflow-hidden">
                    <img src={`https://placehold.co/400x400/991b1b/fff?text=${social.charAt(0)}`} alt={social} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-handwriting text-2xl text-gray-800">{social}</span>
                </div>
              ))}
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
      `}} />

      <div className="min-h-screen bg-cover bg-center bg-fixed p-4 md:p-8 lg:p-16 flex items-center justify-center relative"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041&auto=format&fit=crop')`, backgroundColor: '#2a4b3c' }}
      >
        <div className="w-full max-w-6xl relative z-10 flex flex-col h-[90vh] md:h-[85vh] min-h-[600px] mt-8 md:mt-0">
          
          <div className="flex px-4 md:px-8 gap-1 md:gap-2 overflow-x-auto hide-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-4 md:px-8 py-3 rounded-t-2xl font-elegant text-lg md:text-xl transition-all whitespace-nowrap
                  ${activeTab === tab.id 
                    ? 'bg-[#EEDF7A] text-[#991b1b] shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.2)] z-20 pb-5 -mb-2' 
                    : 'bg-[#DCCB5A] text-gray-700 hover:bg-[#E5D66C] z-10 pb-2 mt-2 opacity-90'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-[#EEDF7A] rounded-b-3xl rounded-tr-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden p-3 md:p-5">
            
            {/* INNER RECESSED BOX FOR DEPTH EFFECT */}
            <div className="flex-1 bg-[#e4d467] rounded-2xl shadow-[inset_0_4px_20px_rgba(0,0,0,0.2)] border border-yellow-800/10 flex flex-col overflow-hidden relative">
              
              <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 hide-scrollbar relative">
                {renderContent()}
              </main>

              <div className="absolute bottom-0 left-0 w-full p-6 flex justify-between items-end text-red-900/60 pointer-events-none bg-gradient-to-t from-[#e4d467] via-[#e4d467]/90 to-transparent pt-12">
                <span className="font-sans font-bold tracking-widest text-sm">archive</span>
                <button onClick={() => setShowLogin(true)} className="pointer-events-auto font-sans text-lg tracking-[0.3em] hover:text-red-800 transition-colors" title="Secret Login">
                  ✧.* ♡ ✿
                </button>
                <span className="font-sans font-bold text-sm">2026</span>
              </div>
              
            </div>
          </div>
        </div>

        {/* MODALS */}
        {selectedItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
            <div className="bg-[#fefce8] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-yellow-200">
              <button onClick={() => setSelectedItem(null)} className="absolute top-4 right-4 z-10 bg-white/80 p-2 rounded-full hover:bg-red-100 text-gray-800 hover:text-red-800 transition-colors shadow">
                <X size={24} />
              </button>
              
              {itemType === 'project' && (
                <div>
                  <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-64 md:h-96 object-cover" />
                  <div className="p-8 md:p-12">
                    <h2 className="text-4xl font-elegant font-bold text-red-900 mb-2">{selectedItem.title}</h2>
                    <p className="font-mono text-gray-500 mb-8 border-b border-gray-200 pb-4">{selectedItem.author} • {selectedItem.year}</p>
                    <p className="font-sans text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedItem.content}</p>
                  </div>
                </div>
              )}

              {itemType === 'blog' && (
                <div className="p-8 md:p-16">
                  <p className="font-handwriting text-2xl text-red-700 mb-2">{selectedItem.date}</p>
                  <h2 className="text-4xl md:text-5xl font-elegant font-bold text-gray-900 mb-8 border-b border-gray-200 pb-6">{selectedItem.title}</h2>
                  <div className="space-y-6">
                    {(selectedItem.blocks || []).map((block, idx) => (
                      <div key={idx}>
                        {block.type === 'text' ? (
                          <p className="font-sans text-lg text-gray-800 leading-relaxed whitespace-pre-wrap">{block.content}</p>
                        ) : (
                          block.content && <img src={block.content} alt={`visual ${idx}`} className="w-full rounded-lg my-8 shadow-md" />
                        )}
                      </div>
                    ))}
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
                <h2 className="text-2xl font-elegant font-bold text-gray-800">Admin Access</h2>
              </div>
              <form onSubmit={handleLogin}>
                <input type="password" autoFocus placeholder="Password..." value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-3 rounded-lg border border-gray-300 mb-4 bg-white font-sans text-center tracking-widest outline-none" />
                <button type="submit" className="w-full bg-red-800 text-white font-bold p-3 rounded-lg hover:bg-red-900 transition-colors">Unlock</button>
              </form>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </>
  );
}