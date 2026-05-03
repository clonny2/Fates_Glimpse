/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Book, Sword, Scroll, Music, Image as ImageIcon, RefreshCcw, Map as MapIcon, ChevronRight, Search, Sparkles, Globe, Volume2, VolumeX, MessageSquare, ShieldAlert, Zap, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Howl } from 'howler';

import { REALMS, Realm, StoryStep, ChatMessage, ResearchData } from './types';
import { researchRealm, generateStoryTurn, getLearnedRealms, generateCustomRealm, chatWithNPC, getMonsterTactics, analyzeLore, getStrategicInsight } from './services/geminiService';
import { DiceRoller } from './components/DiceRoller';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function ProceduralMap({ realm, research, seed }: { realm: Realm, research: ResearchData | null, seed: number }) {
  const points = research?.lands.map((land, i) => ({
    x: 100 + (Math.sin(seed + i * 1.5) * 150 + 150),
    y: 100 + (Math.cos(seed + i * 2.1) * 150 + 150),
    name: land.name
  })) || [];

  // Generate some decorative elements based on seed
  const decorations = Array.from({ length: 15 }).map((_, i) => ({
    x: (Math.sin(seed * (i + 1)) * 200 + 250),
    y: (Math.cos(seed * (i + 1) * 1.3) * 200 + 250),
    type: i % 2 === 0 ? 'mountain' : 'trees'
  }));

  return (
    <div className="relative w-full aspect-square bg-[#1a1714] subtle-border overflow-hidden p-8 font-serif italic text-gold/40">
      <svg viewBox="0 0 500 500" className="w-full h-full">
        {/* Parchment Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Coastlines / Noise Placeholder */}
        <path 
          d="M 50,50 Q 150,20 250,50 T 450,50 T 400,250 T 450,450 T 250,400 T 50,450 T 100,250 Z" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1" 
          opacity="0.15" 
          className="animate-pulse"
        />

        {/* Decorations */}
        {decorations.map((d, i) => (
          <g key={`dec-${i}`} transform={`translate(${d.x}, ${d.y})`} className="opacity-20">
            {d.type === 'mountain' ? (
              <path d="M -10,10 L 0,-10 L 10,10 Z" fill="none" stroke="currentColor" strokeWidth="1" />
            ) : (
              <path d="M 0,-10 L 0,10 M -5,0 L 5,0 M -3,-5 L 3,-5" fill="none" stroke="currentColor" strokeWidth="1" />
            )}
          </g>
        ))}

        {/* Connections */}
        {points.length > 1 && points.map((p, i) => i > 0 && (
          <line 
            key={`line-${i}`}
            x1={points[i-1].x} y1={points[i-1].y} 
            x2={p.x} y2={p.y} 
            stroke="currentColor" 
            strokeWidth="0.5" 
            strokeDasharray="4 4"
            className="opacity-20"
          />
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="currentColor" />
            <text x={p.x + 8} y={p.y + 4} fontSize="12" fill="white" className="drop-shadow-md cursor-default hover:fill-gold transition-colors">{p.name}</text>
          </g>
        ))}

        {/* Center compass */}
        <g transform="translate(430, 430) scale(0.5)" className="opacity-30">
          <circle cx="0" cy="0" r="40" fill="none" stroke="white" strokeWidth="2" />
          <path d="M 0,-50 L 0,50 M -50,0 L 50,0" stroke="white" strokeWidth="1" />
          <text x="-5" y="-55" fill="white" fontSize="14">N</text>
        </g>
      </svg>
      <div className="absolute top-4 left-4 text-[10px] uppercase tracking-[4px]">Cartographic Matrix: {realm.id}</div>
      <div className="absolute bottom-4 right-4 text-[10px] uppercase tracking-[2px]">Seed: 0x{seed.toString(16)}</div>
    </div>
  );
}

export default function App() {
  const [currentRealm, setCurrentRealm] = useState<Realm | null>(null);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'selecting' | 'choice' | 'researching' | 'adventuring' | 'codex' | 'mapping'>('selecting');
  const [selectedRealmForChoice, setSelectedRealmForChoice] = useState<Realm | null>(null);
  const [mapSeed, setMapSeed] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [customRealms, setCustomRealms] = useState<Realm[]>([]);
  const [discoveryPrompt, setDiscoveryPrompt] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [learnedRealms, setLearnedRealms] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState<Record<string, string>>({});
  const [currentTurn, setCurrentTurn] = useState<StoryStep | null>(null);
  const [input, setInput] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioRef] = useState(new Audio());
  
  // SFX Matrix using Howler for concurrent playback
  const sfxRef = useRef<Record<string, Howl>>({});
  const locationAmbienceRef = useRef<Howl | null>(null);

  useEffect(() => {
    // Initialize SFX library
    sfxRef.current = {
      click: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_783cf3a90c.mp3'], volume: 0.4 }),
      roll: new Howl({ src: ['https://cdn.pixabay.com/audio/2021/08/04/audio_333a41b59c.mp3'], volume: 0.6 }),
      paper: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_029584fd09.mp3'], volume: 0.5 }),
      sword: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_b3c3b3131b.mp3'], volume: 0.5 }), 
      hit: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_c89938b8e8.mp3'], volume: 0.4 }),
      miss: new Howl({ src: ['https://cdn.pixabay.com/audio/2024/02/09/audio_65ae10b06b.mp3'], volume: 0.3 }),
      block: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_c8de304247.mp3'], volume: 0.4 }),
      magic: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_e200832381.mp3'], volume: 0.4 }), 
      door: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/24/audio_9ef8145717.mp3'], volume: 0.5 }), 
      mystic: new Howl({ src: ['https://cdn.pixabay.com/audio/2023/10/05/audio_9658097b6a.mp3'], volume: 0.3 }),
      footsteps: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_6ba164c9d9.mp3'], volume: 0.2 }),
    };

    return () => {
      if (locationAmbienceRef.current) locationAmbienceRef.current.stop();
    };
  }, []);

  // Location-based dynamic sound triggers
  useEffect(() => {
    if (!audioEnabled || !currentTurn?.story) return;

    const story = currentTurn.story.toLowerCase();
    let newAmbienceUrl = '';

    if (story.includes('forest') || story.includes('woods') || story.includes('jungle')) {
      newAmbienceUrl = 'https://cdn.pixabay.com/audio/2022/03/13/audio_73e72844c2.mp3'; // Forest birds
    } else if (story.includes('cave') || story.includes('dungeon') || story.includes('underground')) {
      newAmbienceUrl = 'https://cdn.pixabay.com/audio/2022/04/27/audio_e6ef82912a.mp3'; // Drip/Echo
    } else if (story.includes('water') || story.includes('river') || story.includes('ocean') || story.includes('sea')) {
      newAmbienceUrl = 'https://cdn.pixabay.com/audio/2021/11/24/audio_9ea797f374.mp3'; // Waves/Water
    } else if (story.includes('fire') || story.includes('volcano') || story.includes('burning')) {
      newAmbienceUrl = 'https://cdn.pixabay.com/audio/2022/03/15/audio_783cf3a90c.mp3'; // Crackle (placeholder)
    }

    if (newAmbienceUrl) {
      if (locationAmbienceRef.current) {
        // Only change if different
        // @ts-ignore - Howler src is private but we can check if it's the same
        if (locationAmbienceRef.current._src !== newAmbienceUrl) {
          locationAmbienceRef.current.fade(0.3, 0, 1000).once('fade', () => {
            locationAmbienceRef.current?.stop();
            locationAmbienceRef.current = new Howl({ src: [newAmbienceUrl], loop: true, volume: 0 });
            locationAmbienceRef.current.play();
            locationAmbienceRef.current.fade(0, 0.3, 1000);
          });
        }
      } else {
        locationAmbienceRef.current = new Howl({ src: [newAmbienceUrl], loop: true, volume: 0.3 });
        locationAmbienceRef.current.play();
      }
    } else if (locationAmbienceRef.current) {
      locationAmbienceRef.current.fade(0.3, 0, 2000).once('fade', () => {
        locationAmbienceRef.current?.stop();
        locationAmbienceRef.current = null;
      });
    }
  }, [currentTurn?.story, audioEnabled]);

  const playSfx = (type: string) => {
    if (!audioEnabled || !sfxRef.current[type]) return;
    sfxRef.current[type].play();
  };

  const [specialtyResult, setSpecialtyResult] = useState<{ type: string, content: string, name: string, item?: any } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [npcChatHistory, setNpcChatHistory] = useState<ChatMessage[]>([]);
  const [isNpcTyping, setIsNpcTyping] = useState(false);

  useEffect(() => {
    if (audioEnabled) {
      // Atmospheric Matrix - Expanded for more variety
      const musicMatrix: Record<string, Record<string, string>> = {
        'kemet': {
          'default': 'https://cdn.pixabay.com/audio/2022/10/25/audio_7315152865.mp3', // Desert caravan vibe
          'battle': 'https://cdn.pixabay.com/audio/2024/01/29/audio_247a324fb7.mp3', // War drums
        },
        'astral': {
          'default': 'https://cdn.pixabay.com/audio/2023/07/26/audio_03d97f519d.mp3', // Space synth
          'mystic': 'https://cdn.pixabay.com/audio/2021/11/25/audio_91b32e01b3.mp3',
        },
        'feywild': {
          'default': 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', // Forest fantasy
          'whimsical': 'https://cdn.pixabay.com/audio/2023/10/24/audio_3879d71a81.mp3',
        },
        'underdark': {
          'default': 'https://cdn.pixabay.com/audio/2022/04/27/audio_e6ef82912a.mp3', // Dark ambient drone
        },
        'barovia': {
          'default': 'https://cdn.pixabay.com/audio/2023/10/24/audio_3879d71a81.mp3', // Horror/Piano
        }
      };

      const realmId = currentRealm?.id || 'default';
      const mood = (currentTurn?.musicMood || '').toLowerCase();
      
      let trackUrl = 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3'; // Generic Base

      const realmTracks = musicMatrix[realmId] || musicMatrix['feywild'];
      
      if ((mood.includes('battle') || mood.includes('combat') || mood.includes('action')) && realmTracks['battle']) {
        trackUrl = realmTracks['battle'];
      } else if ((mood.includes('mystic') || mood.includes('magic') || mood.includes('ethereal')) && realmTracks['mystic']) {
        trackUrl = realmTracks['mystic'];
      } else if (realmTracks['default']) {
        trackUrl = realmTracks['default'];
      }

      if (audioRef.src !== trackUrl) {
        audioRef.src = trackUrl;
        audioRef.loop = true;
        audioRef.volume = 0.25;
        audioRef.play().catch(e => console.log("Audio waiting for user interaction"));
      }
    } else {
      audioRef.pause();
    }
  }, [audioEnabled, currentTurn?.musicMood, currentRealm?.id]);

  useEffect(() => {
    getLearnedRealms().then(data => {
      setLearnedRealms(data.learnedIds);
      setDiscoveries(data.discoveries);
    });
  }, []);

  const getMoodColor = (mood: string = '') => {
    const m = mood.toLowerCase();
    if (m.includes('battle') || m.includes('tense') || m.includes('danger')) return 'rgba(220, 38, 38, 0.15)'; // Red
    if (m.includes('ethereal') || m.includes('magic') || m.includes('mystic')) return 'rgba(168, 85, 247, 0.15)'; // Purple
    if (m.includes('forest') || m.includes('nature')) return 'rgba(34, 197, 94, 0.15)'; // Green
    if (m.includes('tavern') || m.includes('city') || m.includes('bustle')) return 'rgba(197, 160, 89, 0.15)'; // Gold
    if (m.includes('dark') || m.includes('eerie') || m.includes('horror')) return 'rgba(0, 0, 0, 0.4)'; // Black/Dark
    return 'rgba(201, 160, 80, 0.1)'; // Default Goldish
  };

  useEffect(() => {
    if (currentTurn?.musicMood) {
      console.log(`[Bard Agent] Synthesizing Ambience: ${currentTurn.musicMood}`);
    }
  }, [currentTurn?.musicMood]);

  const handleSelectRealm = async (realm: Realm) => {
    playSfx('paper');
    if (learnedRealms.includes(realm.id)) {
      setSelectedRealmForChoice(realm);
      setStep('choice');
    } else {
      startResearch(realm);
    }
  };

  const startResearch = async (realm: Realm) => {
    setCurrentRealm(realm);
    setStep('researching');
    setLoading(true);
    try {
      const research = await researchRealm(realm.id, realm.name);
      setResearchData(research);
      setLearnedRealms(prev => prev.includes(realm.id) ? prev : [...prev, realm.id]);
      if (research.discovery) {
        setDiscoveries(prev => ({ ...prev, [realm.id]: research.discovery }));
      }
      setStep('adventuring');
      // Start the adventure with an intro
      handleAction("Start my journey");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const viewCodex = async (realm: Realm) => {
    setCurrentRealm(realm);
    setStep('researching'); // Show loading state
    setLoading(true);
    try {
      const research = await researchRealm(realm.id, realm.name);
      setResearchData(research);
      setStep('codex');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverRealm = async () => {
    if (!discoveryPrompt) return;
    playSfx('magic');
    setIsDiscovering(true);
    try {
      const newRealm = await generateCustomRealm(discoveryPrompt);
      setCustomRealms(prev => [...prev, newRealm]);
      setDiscoveryPrompt('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!currentRealm) return;
    
    // Thematic Audio Triggers
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('attack') || lowerAction.includes('fight') || lowerAction.includes('sword') || lowerAction.includes('strike')) {
      playSfx('sword');
    } else if (lowerAction.includes('block') || lowerAction.includes('defend') || lowerAction.includes('shield') || lowerAction.includes('parry')) {
      playSfx('block');
    } else if (lowerAction.includes('hit') || lowerAction.includes('damage') || lowerAction.includes('slash')) {
      playSfx('hit');
    } else if (lowerAction.includes('miss') || lowerAction.includes('dodge')) {
      playSfx('miss');
    } else if (lowerAction.includes('cast') || lowerAction.includes('magic') || lowerAction.includes('spell') || lowerAction.includes('incantation')) {
      playSfx('magic');
    } else if (lowerAction.includes('open') || lowerAction.includes('door') || lowerAction.includes('enter') || lowerAction.includes('gate')) {
      playSfx('door');
    } else if (lowerAction.includes('walk') || lowerAction.includes('move') || lowerAction.includes('travel')) {
      playSfx('footsteps');
    } else if (lowerAction.includes('search') || lowerAction.includes('look') || lowerAction.includes('investigate')) {
      playSfx('mystic');
    } else {
      playSfx('click');
    }

    setLoading(true);
    const newHistory: ChatMessage[] = [...history, { role: 'user', content: action }];
    setHistory(newHistory);
    
    try {
      const turn = await generateStoryTurn(newHistory, currentRealm.name, action);
      setCurrentTurn(turn);
      setHistory(prev => [...prev, { role: 'assistant', content: turn.story }]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSpecialty = async (type: 'chat' | 'tactics' | 'lore', item: any) => {
    if (!currentRealm) return;
    if (type === 'chat') playSfx('mystic');
    else if (type === 'tactics') playSfx('sword');
    else playSfx('magic');

    setLoading(true);
    setSpecialtyResult(null); // Clear previous
    try {
      let result;
      if (type === 'chat') {
        const firstMessage = `Greeting, traveler. I am ${item.name}. What brings you to ${currentRealm.name}?`;
        setNpcChatHistory([{ role: 'assistant' as const, content: firstMessage }]);
        setSpecialtyResult({ type, content: firstMessage, name: item.name, item });
      } else if (type === 'tactics') {
        result = await getMonsterTactics(item.name, item.description, currentRealm.name);
        setSpecialtyResult({ type, content: result.content, name: item.name, item });
      } else {
        result = await analyzeLore(item.name, item.description, currentRealm.name);
        setSpecialtyResult({ type, content: result.content, name: item.name, item });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleNpcMessage = async (msg: string) => {
    if (!specialtyResult || !specialtyResult.item || !currentRealm) return;
    
    playSfx('click');
    const newHistory: ChatMessage[] = [...npcChatHistory, { role: 'user' as const, content: msg }];
    setNpcChatHistory(newHistory);
    setIsNpcTyping(true);
    
    try {
      const response = await chatWithNPC(
        specialtyResult.name, 
        specialtyResult.item.description, 
        currentRealm.name, 
        msg, 
        newHistory
      );
      setNpcChatHistory(prev => [...prev, { role: 'assistant' as const, content: response.content }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsNpcTyping(false);
    }
  };

  const handleFetchInsight = async () => {
    if (!currentTurn || !currentRealm) return;
    playSfx('magic');
    setInsightLoading(true);
    try {
      const response = await getStrategicInsight(
        currentTurn.story,
        currentTurn.options || [],
        currentRealm.name
      );
      setSpecialtyResult({
        type: 'lore',
        name: "Fate's Glimpse",
        content: response.content
      });
    } catch (err) {
      console.error(err);
    } finally {
      setInsightLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0d0b09]">
      {/* Background Ambience Layers */}
      <div className="absolute inset-0 z-0 opacity-[0.07] pointer-events-none mix-blend-overlay">
        <img 
          src={`https://picsum.photos/seed/dnd-hero-dragon-multiverse/1920/1080`} 
          className="w-full h-full object-cover"
          alt="Ancient dragon background"
        />
      </div>
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: getMoodColor(currentTurn?.musicMood) }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#0d0b09_100%)]" />
      </div>

      <header className="relative z-10 border-b border-[#333] bg-dark-surface p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="font-serif italic text-gold text-xl tracking-wider">
              CHRONICLER ARCHIVE v4.0
            </h1>
            <div className="status-badge hidden sm:block">
              Research Level: Expert
            </div>
          </div>
          <div className="flex items-center gap-6 text-[11px] uppercase tracking-tighter">
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={cn("flex items-center gap-2 transition-all p-2 rounded-sm", audioEnabled ? "text-gold bg-gold/10" : "text-gray-500 hover:text-white")}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hidden md:inline">{audioEnabled ? "Ambience Active" : "Silence"}</span>
            </button>
            <div className="text-gray-500 hidden md:block">Multi-Agent RAG System Active</div>
            {currentRealm && (
              <div className="flex items-center gap-4">
                <span className="text-gold font-bold">{currentRealm.name}</span>
                <button 
                  onClick={() => window.location.reload()}
                  className="hover:text-white transition-colors flex items-center gap-1 text-gray-400"
                >
                  <RefreshCcw size={12} /> Reset
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 'selecting' && (
            <motion.div
              key="selecting"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12 py-8 flex-1 flex flex-col justify-center"
            >
              <div className="text-center space-y-3">
                <div className="text-[10px] uppercase tracking-[4px] text-gray-500 font-bold mb-2">INITIALIZE PARAMETERS</div>
                <h2 className="text-4xl font-serif text-white italic tracking-wide">
                  Select Realm for Deep Research
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
                {/* Discovery Input Card */}
                <div className="group relative flex flex-col items-center justify-center p-8 bg-dark-card subtle-border transition-all hover:border-gold hover:bg-gold/5 text-center space-y-6">
                  <div className="p-4 rounded-full bg-gold/10 text-gold group-hover:scale-110 transition-transform">
                    <Sparkles size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-white italic mb-2">Explore New Realm</h3>
                    <p className="text-gray-500 text-[10px] leading-relaxed italic mb-4">
                      Describe a dream, a myth, or a strange new world to initialize a custom research archive.
                    </p>
                    <input 
                      type="text"
                      placeholder="e.g. A city built on the back of a giant snail..."
                      value={discoveryPrompt}
                      onChange={(e) => setDiscoveryPrompt(e.target.value)}
                      disabled={isDiscovering}
                      className="w-full bg-black/30 border border-[#222] focus:border-gold outline-none p-3 rounded-sm text-white text-[11px] font-serif italic mb-3 transition-all placeholder:text-gray-700"
                    />
                    <button 
                      onClick={handleDiscoverRealm}
                      disabled={isDiscovering || !discoveryPrompt.trim()}
                      className="w-full bg-gold text-black py-2 text-[10px] uppercase font-black tracking-widest disabled:opacity-50 disabled:grayscale transition-all hover:bg-white"
                    >
                      {isDiscovering ? 'Initializing...' : 'Discover Realm'}
                    </button>
                  </div>
                </div>

                {[...REALMS, ...customRealms].map((realm, idx) => {
                  const isLearned = learnedRealms.includes(realm.id);
                  return (
                    <button
                      key={realm.id}
                      onClick={() => handleSelectRealm(realm)}
                      className="group relative text-left bg-dark-card subtle-border overflow-hidden transition-all hover:border-gold hover:bg-dark-accent"
                    >
                      <div className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity">
                        <img 
                          src={realm.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(realm.id)}-dnd-fantasy-art/400/600`} 
                          alt={realm.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-all duration-700"
                        />
                      </div>
                      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 items-end">
                        {realm.isCustom && (
                          <div className="bg-indigo-500/90 text-white px-2 py-1 flex items-center gap-1.5 rounded-sm shadow-lg backdrop-blur-md border border-white/10">
                            <Globe size={10} strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-tighter">Custom Realm</span>
                          </div>
                        )}
                        {isLearned && (
                          <>
                            <div className="bg-gold/90 text-black px-2 py-1 flex items-center gap-1.5 rounded-sm shadow-lg backdrop-blur-md border border-white/20">
                              <Book size={10} strokeWidth={3} />
                              <span className="text-[9px] font-black uppercase tracking-tighter">Archived</span>
                            </div>
                            {discoveries[realm.id] && (
                              <motion.div 
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                className="bg-emerald-500/90 text-white px-2 py-1 flex items-center gap-1.5 rounded-sm shadow-lg backdrop-blur-md border border-white/20"
                              >
                                <Sword size={10} strokeWidth={3} />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Discovery Found</span>
                              </motion.div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="relative p-6 z-10 bg-gradient-to-t from-dark-card via-dark-card/80 to-transparent h-full flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className="text-[10px] uppercase tracking-widest text-gold">
                            {realm.isCustom ? 'DISCOVERED_DATA' : `SYSTEM_REALM_0${idx + 1}`}
                          </div>
                          {isLearned && <div className="text-[9px] text-emerald-400 font-bold uppercase tracking-tight">Verified Locally</div>}
                        </div>
                        <h3 className="font-serif text-2xl text-white mb-2 italic">{realm.name}</h3>
                        <p className="text-gray-500 text-xs italic leading-relaxed mb-6 flex-1">
                          {realm.description}
                        </p>
                        <div className="flex items-center gap-2 text-gold uppercase tracking-[2px] text-[10px] font-bold opacity-60 group-hover:opacity-100 transition-opacity">
                          {isLearned ? 'Re-Access Archives' : 'Engage Research Pod'} <ChevronRight size={10} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 'choice' && selectedRealmForChoice && (
            <motion.div
              key="choice"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="text-[10px] uppercase tracking-[4px] text-emerald-400 font-bold mb-2">ARCHIVE DETECTED</div>
                <h2 className="text-4xl font-serif text-white italic tracking-wide max-w-2xl">
                  Historical data for <span className="text-gold">{selectedRealmForChoice.name}</span> is available in the local matrix.
                </h2>
                <p className="text-gray-500 text-sm max-w-lg mx-auto italic">
                  How would you like to proceed with the research pod?
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-8 w-full max-w-2xl px-4">
                <button
                  onClick={() => viewCodex(selectedRealmForChoice)}
                  className="group relative flex flex-col items-center p-8 bg-dark-card subtle-border transition-all hover:border-emerald-500 hover:bg-emerald-500/5 text-center space-y-6"
                >
                  <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                    <Book size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-white italic mb-2">Access Archive</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Consult the Codex of Knowledge containing already discovered NPCs, monsters, and artifacts.
                    </p>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold group-hover:translate-x-2 transition-transform">
                    View Codex <ChevronRight size={10} className="inline ml-1" />
                  </div>
                </button>

                <button
                  onClick={() => startResearch(selectedRealmForChoice)}
                  className="group relative flex flex-col items-center p-8 bg-dark-card subtle-border transition-all hover:border-gold hover:bg-gold/5 text-center space-y-6"
                >
                  <div className="p-4 rounded-full bg-gold/10 text-gold group-hover:scale-110 transition-transform">
                    <RefreshCcw size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-white italic mb-2">Deep Research</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Re-engage the research agent to uncover fresh insights and potentially new discoveries.
                    </p>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-gold font-bold group-hover:translate-x-2 transition-transform">
                    Re-Analyze <ChevronRight size={10} className="inline ml-1" />
                  </div>
                </button>
              </div>

              <button 
                onClick={() => setStep('selecting')}
                className="text-[10px] uppercase tracking-widest text-gray-600 hover:text-white transition-colors"
              >
                Go Back to Realm Selection
              </button>
            </motion.div>
          )}

          {step === 'codex' && researchData && currentRealm && (
            <motion.div
              key="codex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col space-y-8 py-8 flex-1"
            >
              <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[4px] text-emerald-400 font-bold">CODEX_ARCHIVE_SITE: {currentRealm.id}</div>
                  <h2 className="text-5xl font-serif text-white italic tracking-wide">{currentRealm.name}</h2>
                </div>
                <button 
                  onClick={() => setStep('selecting')}
                  className="bg-dark-card border border-[#333] hover:border-gold px-6 py-2 text-[10px] uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center gap-2"
                >
                  Return to Matrix <RefreshCcw size={12} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                <input 
                  type="text"
                  placeholder="Search names, descriptions, or lore..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-dark-card border border-[#222] focus:border-gold outline-none p-4 pl-12 rounded-sm text-white text-sm font-serif italic tracking-wide transition-all placeholder:text-gray-600"
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-12">
                <div className="space-y-8 lg:col-span-1">
                  <div className="bg-dark-card p-8 subtle-border space-y-6">
                    <div className="text-[10px] uppercase tracking-[2px] text-gold font-bold">Executive Summary</div>
                    <div className="prose prose-invert prose-sm">
                      <ReactMarkdown>{researchData.summary}</ReactMarkdown>
                    </div>
                    {researchData.discovery && (
                      <div className="bg-gold/5 border-l-2 border-gold p-4 mt-8 italic text-xs text-gray-300">
                        <div className="text-[9px] uppercase tracking-widest text-gold font-bold mb-2 flex items-center gap-2">
                          <Sword size={10} /> Noted Discovery
                        </div>
                        "{researchData.discovery}"
                      </div>
                    )}
                    <button
                      onClick={() => setStep('mapping')}
                      className="w-full border border-gold text-gold py-4 font-black uppercase tracking-[3px] text-[10px] hover:bg-gold hover:text-black transition-all flex items-center justify-center gap-2"
                    >
                      <MapIcon size={14} /> Open Visual Map
                    </button>
                    <button
                      onClick={() => {
                        setStep('adventuring');
                        handleAction("Begin an adventure here");
                      }}
                      className="w-full bg-gold text-black py-4 font-black uppercase tracking-[3px] text-[10px] hover:bg-white transition-colors"
                    >
                      Begin Adventuring Now
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-12">
                  {[
                    { label: 'Lands & Regions', items: researchData.lands, icon: <MapIcon size={16} /> },
                    { label: 'Legendary NPCs', items: researchData.npcs, icon: <Scroll size={16} /> },
                    { label: 'Iconic Monsters', items: researchData.monsters, icon: <Compass size={16} /> },
                    { label: 'Sacred Artifacts', items: researchData.artifacts, icon: <Sword size={16} /> }
                  ].map((section) => {
                    const filteredItems = section.items.filter(item => 
                      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      item.description.toLowerCase().includes(searchTerm.toLowerCase())
                    );
                    
                    if (filteredItems.length === 0) return null;

                    return (
                      <div key={section.label} className="space-y-6">
                        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[3px] text-gray-500 font-bold">
                          <span className="text-gold opacity-50">{section.icon}</span>
                          {section.label}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          {filteredItems.map((item, idx) => (
                            <div key={idx} className="group bg-dark-card subtle-border flex flex-col relative overflow-hidden h-64">
                              <div className="absolute inset-0 opacity-20 group-hover:opacity-60 transition-opacity">
                                <img 
                                  src={`https://picsum.photos/seed/${encodeURIComponent(item.imagePrompt)}/400/400`} 
                                  alt={item.name}
                                  className="w-full h-full object-cover transition-all duration-700"
                                />
                              </div>
                              <div className="relative p-6 mt-auto bg-gradient-to-t from-dark-card via-dark-card/90 to-transparent">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="text-white font-serif text-lg italic">{item.name}</div>
                                  <div className="flex gap-2">
                                    {section.label.includes('NPC') && (
                                      <button 
                                        onClick={() => handleSpecialty('chat', item)}
                                        className="p-1.5 rounded-full bg-gold/10 text-gold hover:bg-gold hover:text-black transition-all"
                                        title="Chat Specialty"
                                      >
                                        <MessageSquare size={12} />
                                      </button>
                                    )}
                                    {section.label.includes('Monster') && (
                                      <button 
                                        onClick={() => handleSpecialty('tactics', item)}
                                        className="p-1.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                        title="Combat Tactics Specialty"
                                      >
                                        <ShieldAlert size={12} />
                                      </button>
                                    )}
                                    {(section.label.includes('Artifact') || section.label.includes('Land')) && (
                                      <button 
                                        onClick={() => handleSpecialty('lore', item)}
                                        className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                                        title="Lore Analysis Specialty"
                                      >
                                        <Zap size={12} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-gray-400 text-[10px] leading-relaxed line-clamp-3 italic">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {searchTerm && ![...researchData.lands, ...researchData.npcs, ...researchData.monsters, ...researchData.artifacts].some(item => 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    item.description.toLowerCase().includes(searchTerm.toLowerCase())
                  ) && (
                    <div className="text-center py-20 bg-dark-card subtle-border border-dashed">
                      <div className="text-gold opacity-20 mb-4 flex justify-center">
                        <Search size={48} />
                      </div>
                      <p className="text-gray-500 font-serif italic">No lore entries found matching "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 'mapping' && currentRealm && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="flex-1 flex flex-col space-y-8 py-8"
            >
              <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[4px] text-gold font-bold">ARCANE_CARTOGRAPHY_POD: {currentRealm.id}</div>
                  <h2 className="text-5xl font-serif text-white italic tracking-wide">World Map: {currentRealm.name}</h2>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setMapSeed(prev => prev + 1)}
                    className="bg-gold text-black border border-gold px-6 py-2 text-[10px] uppercase tracking-widest font-black hover:bg-white transition-all flex items-center gap-2"
                  >
                    <RefreshCcw size={12} /> Generate Random Layout
                  </button>
                  <button 
                    onClick={() => setStep('codex')}
                    className="bg-dark-card border border-[#333] hover:border-gold px-6 py-2 text-[10px] uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                  >
                    Return to Codex
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center">
                <div className="max-w-3xl w-full">
                  <ProceduralMap realm={currentRealm} research={researchData} seed={mapSeed} />
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {researchData?.lands.map((land, idx) => (
                      <div key={idx} className="bg-dark-card p-4 subtle-border">
                        <div className="text-gold font-serif italic text-sm mb-1">{land.name}</div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-tighter">Verified Landmark</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'researching' && (
            <motion.div
              key="researching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-10"
            >
              <div className="w-64 h-px bg-gray-800 relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-gold"
                />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-[4px] text-gold animate-pulse">
                  Synthesizing Lore Matrix
                </h3>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono">Accessing Canonical Datasources: {currentRealm?.name}</p>
              </div>
            </motion.div>
          )}

          {step === 'adventuring' && currentTurn && (
            <motion.div
              key="adventuring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid lg:grid-cols-12 gap-8 py-4 flex-1 h-full"
            >
              {/* Left Column: Media & Agents */}
              <div className="lg:col-span-3 space-y-6 relative overflow-hidden rounded-sm p-1">
                <div 
                  className="absolute inset-0 z-0 opacity-15 grayscale pointer-events-none"
                  style={{ 
                    backgroundImage: `url(${currentRealm?.imageUrl || `https://picsum.photos/seed/${currentRealm?.id}/1000/1200`})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="relative z-10 space-y-6">
                  <div className="subtle-border bg-dark-card aspect-[4/5] relative overflow-hidden group">
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={currentTurn.imagePrompt}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        src={`https://picsum.photos/seed/${encodeURIComponent(currentTurn.imagePrompt || 'dnd')}/800/1000`}
                        alt="Scene illustration"
                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </AnimatePresence>
                    <div className="hero-overlay absolute inset-0 flex flex-col justify-end p-4">
                      <div className="text-[10px] text-gold uppercase tracking-widest mb-1">Visual Log</div>
                      <div className="text-white font-serif italic text-lg leading-tight">Current Objective Site</div>
                    </div>
                  </div>

                  <div className="space-y-6 px-1">
                    <div className="text-[10px] uppercase tracking-[2px] text-gray-600 font-bold">Active Agents</div>
                    
                    <div className="bg-dark-card/80 backdrop-blur-sm p-4 subtle-border space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-gold">THE ARCHIVIST</span>
                        <span className="text-emerald-500">READY</span>
                      </div>
                      <div className="h-[2px] bg-[#222] w-full">
                        <div className="h-full bg-gold w-full"></div>
                      </div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-tighter">Monitoring Ley Lines & History</p>
                    </div>

                    <div className="bg-dark-card/80 backdrop-blur-sm p-4 subtle-border space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-gold">THE BARD</span>
                        <span className="text-cyan-400">{loading ? 'SYNTHESIZING' : 'STREAMING'}</span>
                      </div>
                      <div className="h-[1px] bg-[#222] w-full relative overflow-hidden">
                        <motion.div 
                          initial={{ left: "-100%" }}
                          animate={{ left: "100%" }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute h-full w-1/2 bg-cyan-400/50"
                        />
                      </div>
                      <p className="text-[9px] text-gray-500 uppercase tracking-tighter">
                        Audio Stream: {currentTurn?.musicMood || 'Idle'}
                      </p>
                    </div>

                    <div className="bg-dark-card/80 backdrop-blur-sm p-4 subtle-border space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-gold">THE LOREMASTER</span>
                        <span className="text-emerald-500">ACTIVE</span>
                      </div>
                      <div className="h-[2px] bg-[#222] w-full">
                        <div className="h-full bg-gold w-[82%]"></div>
                      </div>
                      <div className="text-[11px] text-gray-400 font-body leading-relaxed max-h-64 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                      <div className="prose prose-invert prose-xs">
                        <ReactMarkdown>
                          {researchData?.summary || ''}
                        </ReactMarkdown>
                      </div>

                      {discoveries[currentRealm.id] && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-sm space-y-2">
                           <div className="flex items-center gap-2 text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                            <Sword size={10} /> Discovered Secret
                           </div>
                           <p className="text-[10px] text-gray-300 italic leading-relaxed">
                            "{discoveries[currentRealm.id]}"
                           </p>
                        </div>
                      )}

                      {researchData && (
                        <div className="space-y-4 pt-4 border-t border-[#222]">
                          <div className="text-[10px] uppercase tracking-widest text-gold opacity-60">Archived Findings</div>
                          
                          {/* Render entities with images */}
                          {[
                            { label: 'LANDS', items: researchData.lands },
                            { label: 'NPCS', items: researchData.npcs },
                            { label: 'MONSTERS', items: researchData.monsters },
                            { label: 'ARTIFACTS', items: researchData.artifacts }
                          ].map((section) => section.items.length > 0 && (
                            <div key={section.label} className="space-y-3">
                              <div className="text-[9px] uppercase tracking-tighter text-gray-500 font-bold">{section.label}</div>
                              <div className="space-y-3">
                                {section.items.map((item, idx) => (
                                  <div key={idx} className="group flex gap-3 items-start bg-black/20 p-2 rounded-sm border border-transparent hover:border-gold/20 transition-colors">
                                    <div className="w-12 h-12 shrink-0 bg-dark-accent rounded-sm overflow-hidden subtle-border">
                                      <img 
                                        src={`https://picsum.photos/seed/${encodeURIComponent(item.imagePrompt)}/100/100`} 
                                        alt={item.name}
                                        className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                      />
                                    </div>
                                    <div className="space-y-0.5 flex-1 min-w-0">
                                      <div className="flex justify-between items-start gap-2">
                                        <div className="text-[10px] text-white font-bold leading-tight truncate">{item.name}</div>
                                        <div className="flex gap-1 shrink-0">
                                          {section.label === 'NPCS' && (
                                            <button onClick={() => handleSpecialty('chat', item)} className="text-gold/60 hover:text-gold transition-colors"><MessageSquare size={10} /></button>
                                          )}
                                          {section.label === 'MONSTERS' && (
                                            <button onClick={() => handleSpecialty('tactics', item)} className="text-red-400/60 hover:text-red-400 transition-colors"><ShieldAlert size={10} /></button>
                                          )}
                                          {(section.label === 'ARTIFACTS' || section.label === 'LANDS') && (
                                            <button onClick={() => handleSpecialty('lore', item)} className="text-cyan-400/60 hover:text-cyan-400 transition-colors"><Zap size={10} /></button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-[9px] text-gray-500 leading-tight line-clamp-2">{item.description}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                    <DiceRoller />
                  </div>
                </div>
              </div>

              {/* Right Column: Narrative & Interaction */}
              <div className="lg:col-span-9 flex flex-col space-y-8 h-full">
                <div className="flex-1 bg-dark-surface narrative-accent p-12 overflow-y-auto min-h-[400px]">
                  <div className="text-[10px] text-gold uppercase tracking-[4px] mb-8 font-bold opacity-60">CHRONICLE_ENTRY_LOG</div>
                  <div className="prose max-w-none">
                    <ReactMarkdown>
                      {currentTurn.story}
                    </ReactMarkdown>
                  </div>

                  {loading && (
                    <div className="mt-12 flex items-center gap-3 text-gold/40">
                      <RefreshCcw className="animate-spin" size={12} />
                      <span className="text-[10px] uppercase tracking-widest font-mono">Processing Narrative Flow...</span>
                    </div>
                  )}
                </div>

                <div className="bg-dark-card p-8 subtle-border space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] uppercase tracking-[2px] text-gray-600 font-bold">Decisions Required</div>
                    <button
                      onClick={handleFetchInsight}
                      disabled={insightLoading || loading}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-mono tracking-widest transition-all",
                        "bg-gold/5 border border-gold/20 text-gold hover:bg-gold hover:text-black",
                        (insightLoading || loading) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {insightLoading ? (
                        <RefreshCcw className="animate-spin" size={10} />
                      ) : (
                        <Eye size={10} />
                      )}
                      {insightLoading ? 'DECRYPTION_IN_PROGRESS' : 'FATE_GLIMPSE_REQUEST'}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentTurn.options?.map((opt, i) => (
                      <button
                        key={i}
                        disabled={loading}
                        onClick={() => handleAction(opt)}
                        className="subtle-border bg-[#151515] p-5 text-left text-xs tracking-wide text-gray-300 hover:border-gold hover:bg-dark-accent transition-all group disabled:opacity-50"
                      >
                        <div className="text-[9px] text-gold/40 mb-2 font-mono">EXEC_OPT_0{i+1}</div>
                        {opt}
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 flex items-center gap-6 border-t border-[#222]">
                    <div className="flex items-center gap-3 text-gray-500">
                      <Music size={16} className="text-gold" />
                      <span className="text-[10px] font-mono whitespace-nowrap">{currentTurn.musicMood?.toUpperCase() || "ATMOSPHERE_IDLE"}</span>
                    </div>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (input.trim()) handleAction(input);
                      }}
                      className="flex-1"
                    >
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="AWAITING COMMAND OR ACTION DESCRIPTION..."
                        className="w-full bg-[#151515] border border-[#333] focus:border-gold outline-none p-3 px-6 rounded-sm text-white text-sm font-mono tracking-tight transition-all placeholder:text-gray-700"
                        disabled={loading}
                      />
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Specialty Result Overlay */}
        <AnimatePresence>
          {specialtyResult && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed top-0 right-0 w-full md:w-[450px] h-full bg-[#0d0b09] border-l border-gold/10 z-[100] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              <div className="p-6 border-b border-gold/5 flex justify-between items-center bg-dark-card/50 backdrop-blur-md">
                <div>
                  <div className="text-[9px] uppercase tracking-[4px] text-gold font-bold mb-1 opacity-50">Trans-Matrix Specialty Link</div>
                  <div className="font-serif italic text-white text-xl tracking-wide">{specialtyResult.name}</div>
                </div>
                <button 
                  onClick={() => setSpecialtyResult(null)}
                  className="p-3 hover:bg-gold/10 text-gray-500 hover:text-gold transition-all rounded-full"
                >
                  <RefreshCcw size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center gap-3 py-2 border-b border-gold/5">
                  {specialtyResult.type === 'chat' && <div className="text-gold flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><MessageSquare size={14} /> Neural Voice Decryption</div>}
                  {specialtyResult.type === 'tactics' && <div className="text-red-400 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><ShieldAlert size={14} /> Threat Vector Analysis</div>}
                  {specialtyResult.type === 'lore' && <div className="text-cyan-400 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Zap size={14} /> Acausal Wisdom Extraction</div>}
                </div>

                {specialtyResult.type === 'chat' ? (
                  <div className="flex flex-col h-[70vh] space-y-4">
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                      {npcChatHistory.map((chat, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-4 rounded-sm border text-[13px] leading-relaxed",
                            chat.role === 'assistant' 
                              ? "bg-gold/5 border-gold/10 text-gray-200 font-serif italic" 
                              : "bg-white/5 border-white/5 text-gold ml-8 font-mono"
                          )}
                        >
                          <div className="text-[9px] uppercase tracking-[2px] opacity-40 mb-2">
                            {chat.role === 'assistant' ? specialtyResult.name : 'Researcher'}
                          </div>
                          <ReactMarkdown>{chat.content}</ReactMarkdown>
                        </motion.div>
                      ))}
                      {isNpcTyping && (
                        <div className="text-[10px] text-gold/40 animate-pulse font-mono uppercase tracking-widest">
                          Incoming neural stream...
                        </div>
                      )}
                    </div>
                    <div className="relative pt-4">
                      <input 
                        type="text"
                        placeholder="Type your response..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            handleNpcMessage(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                        className="w-full bg-black/40 border border-gold/20 focus:border-gold outline-none p-4 pr-12 rounded-sm text-white text-sm font-serif italic placeholder:text-gray-700 transition-all"
                      />
                      <MessageSquare className="absolute right-4 top-1/2 -translate-y-1/2 text-gold/30" size={16} />
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:italic prose-headings:font-serif prose-headings:text-gold prose-strong:text-gold prose-code:text-emerald-400">
                    <ReactMarkdown>{specialtyResult.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gold/10 bg-black/60">
                <div className="flex items-center gap-3 text-[9px] text-gray-600 uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Chronicler Intelligence Grid: Multi-Agent Synthesis v4.2
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="text-center p-6 text-gray-600 text-xs uppercase tracking-[0.2em]">
        &copy; {new Date().getFullYear()} Chronicles of the Multiverse &bull; An AI Storytelling Engine
      </footer>
    </div>
  );
}

