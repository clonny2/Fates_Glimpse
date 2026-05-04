/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Book, Sword, Scroll, Music, Library, Image as ImageIcon, RefreshCcw, Map as MapIcon, ChevronRight, ChevronLeft, Search, Sparkles, Globe, Volume2, VolumeX, MessageSquare, ShieldAlert, Zap, Eye, FileText, X, Shield, Activity, Backpack, Save, Skull } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Howl, Howler } from 'howler';

import { REALMS, Realm, StoryStep, ChatMessage, ResearchData, Character, Party } from './types';
import { researchRealm, generateStoryTurn, getLearnedRealms, generateCustomRealm, chatWithNPC, getMonsterTactics, analyzeLore, getStrategicInsight, generateRandomCharacter } from './services/geminiService';
import { DiceRoller } from './components/DiceRoller';

import { CharacterSheet } from './components/CharacterSheet';

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
  const [step, setStep] = useState<'splash' | 'selecting' | 'choice' | 'researching' | 'adventuring' | 'codex' | 'mapping' | 'party-builder' | 'bestiary'>('splash');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [party, setParty] = useState<Party>({ members: [], gold: 100, sharedInventory: [], reputation: 0 });
  const [selectedRealmForChoice, setSelectedRealmForChoice] = useState<Realm | null>(null);
  const [mapSeed, setMapSeed] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customRealms, setCustomRealms] = useState<Realm[]>([]);
  const [discoveryPrompt, setDiscoveryPrompt] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [learnedRealms, setLearnedRealms] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState<Record<string, string>>({});
  const [currentTurn, setCurrentTurn] = useState<StoryStep | null>(null);
  const [input, setInput] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const mainTrackRef = useRef<Howl | null>(null);
  const sfxRef = useRef<Record<string, Howl>>({});
  const locationAmbienceRef = useRef<Howl | null>(null);
  const currentTrackUrlRef = useRef<string>('');

  const [specialtyResult, setSpecialtyResult] = useState<{ type: string, content: string, name: string, item?: any } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [npcChatHistory, setNpcChatHistory] = useState<ChatMessage[]>([]);
  const [isNpcTyping, setIsNpcTyping] = useState(false);

  // Initialize Audio unlocking
  useEffect(() => {
    const handleGesture = () => {
      if (typeof Howler !== 'undefined' && Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().then(() => {
          console.log("Audio Context Resumed via Gesture");
        });
      }
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  useEffect(() => {
    // Initialize SFX library
    sfxRef.current = {
      click: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73566.mp3'], volume: 0.5, html5: false }),
      roll: new Howl({ src: ['https://cdn.pixabay.com/audio/2021/08/04/audio_333a41b59c.mp3'], volume: 0.8, html5: false }),
      paper: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_029584fd09.mp3'], volume: 0.7, html5: false }),
      sword: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_b3c3b3131b.mp3'], volume: 0.6, html5: false }), 
      hit: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_c89938b8e8.mp3'], volume: 0.6, html5: false }),
      miss: new Howl({ src: ['https://cdn.pixabay.com/audio/2024/02/09/audio_65ae10b06b.mp3'], volume: 0.5, html5: false }),
      block: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_c8de304247.mp3'], volume: 0.6, html5: false }),
      magic: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_e200832381.mp3'], volume: 0.6, html5: false }), 
      door: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/24/audio_9ef8145717.mp3'], volume: 0.7, html5: false }), 
      mystic: new Howl({ src: ['https://cdn.pixabay.com/audio/2023/10/05/audio_9658097b6a.mp3'], volume: 0.6, html5: false }),
      footsteps: new Howl({ src: ['https://cdn.pixabay.com/audio/2022/03/15/audio_6ba164c9d9.mp3'], volume: 0.4, html5: false }),
    };

    if (typeof Howler !== 'undefined') {
      Howler.autoUnlock = true;
    }

    return () => {
      Object.values(sfxRef.current).forEach(sfx => sfx.unload());
      if (locationAmbienceRef.current) locationAmbienceRef.current.unload();
      if (mainTrackRef.current) mainTrackRef.current.unload();
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
    if (!audioEnabled || !sfxRef.current[type]) {
      console.log("[SFX] Skip (Disabled/Missing):", type);
      return;
    }
    console.log("[SFX] Play:", type);
    sfxRef.current[type].play();
  };

  useEffect(() => {
    if (typeof Howler !== 'undefined') {
      Howler.mute(!audioEnabled);
    }

    if (audioEnabled) {
      const musicMatrix: Record<string, Record<string, string>> = {
        'kemet': {
          'default': 'https://cdn.pixabay.com/audio/2022/10/25/audio_7315152865.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/12/03/audio_448e894c25.mp3',
          'mystic': 'https://cdn.pixabay.com/audio/2024/01/24/audio_34d1b8c0a3.mp3',
        },
        'forgotten-realms': {
          'default': 'https://cdn.pixabay.com/audio/2023/05/22/audio_7b864a78a2.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/11/10/audio_556942c75a.mp3', 
          'mystic': 'https://cdn.pixabay.com/audio/2023/10/05/audio_9658097b6a.mp3',
        },
        'eberron': {
          'default': 'https://cdn.pixabay.com/audio/2024/01/24/audio_34d1b8c0a3.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/06/12/audio_7995874246.mp3',
          'mystic': 'https://cdn.pixabay.com/audio/2023/07/26/audio_03d97f519d.mp3',
        },
        'ravenloft': {
          'default': 'https://cdn.pixabay.com/audio/2022/04/27/audio_e6ef82912a.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/12/05/audio_783cf3a90c.mp3',
          'mystic': 'https://cdn.pixabay.com/audio/2022/03/10/audio_b3c3b3131b.mp3',
        },
        'spelljammer': {
          'default': 'https://cdn.pixabay.com/audio/2023/07/26/audio_03d97f519d.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/06/12/audio_7995874246.mp3',
          'mystic': 'https://cdn.pixabay.com/audio/2021/11/24/audio_3879d71a81.mp3',
        },
        'default': {
          'default': 'https://cdn.pixabay.com/audio/2023/05/22/audio_7b864a78a2.mp3',
          'battle': 'https://cdn.pixabay.com/audio/2023/11/10/audio_556942c75a.mp3',
          'mystic': 'https://cdn.pixabay.com/audio/2023/10/05/audio_9658097b6a.mp3',
        }
      };

      const realmId = currentRealm?.id || 'default';
      const mood = (currentTurn?.musicMood || '').toLowerCase();
      const realmTracks = musicMatrix[realmId] || musicMatrix['default'];
      let trackUrl = realmTracks['default'];

      if (mood.includes('battle') || mood.includes('combat') || mood.includes('action')) {
        trackUrl = realmTracks['battle'] || trackUrl;
      } else if (mood.includes('mystic') || mood.includes('magic')) {
        trackUrl = realmTracks['mystic'] || trackUrl;
      }

      if (mainTrackRef.current) {
        if (currentTrackUrlRef.current !== trackUrl) {
          console.log("[Bard] Changing track to:", trackUrl);
          currentTrackUrlRef.current = trackUrl;
          mainTrackRef.current.fade(0.25, 0, 2000).once('fade', () => {
            mainTrackRef.current?.stop();
            mainTrackRef.current = new Howl({ src: [trackUrl], loop: true, volume: 0, html5: true });
            mainTrackRef.current.play();
            mainTrackRef.current.fade(0, 0.25, 2000);
          });
        } else if (!mainTrackRef.current.playing()) {
          mainTrackRef.current.play();
        }
      } else {
        console.log("[Bard] Initializing main track:", trackUrl);
        currentTrackUrlRef.current = trackUrl;
        mainTrackRef.current = new Howl({ src: [trackUrl], loop: true, volume: 0.25, html5: true });
        mainTrackRef.current.play();
      }
    } else {
      if (mainTrackRef.current) {
        mainTrackRef.current.pause();
      }
    }
  }, [audioEnabled, currentTurn?.musicMood, currentRealm?.id]);

  useEffect(() => {
    getLearnedRealms().then(data => {
      setLearnedRealms(data.learnedIds);
      setDiscoveries(data.discoveries);
    });

    fetch('/api/characters').then(res => res.json()).then(data => {
      if (Array.isArray(data)) setCharacters(data);
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

  const [researchTasks, setResearchTasks] = useState<string[]>([]);
  const [isResearchSlow, setIsResearchSlow] = useState(false);
  
  const startResearch = async (realm: Realm) => {
    setCurrentRealm(realm);
    setStep('researching');
    setLoading(true);
    setIsResearchSlow(false);
    setErrorMessage(null);
    setResearchTasks(['Analyzing ley lines...', 'Consulting the astral archives...', 'Mapping topographical variance...']);
    
    // Timer for slow notice
    const slowTimer = setTimeout(() => setIsResearchSlow(true), 12000);

    // Rotate tasks
    const interval = setInterval(() => {
      const nextTasks = [
        'Deciphering local dialects...',
        'Scanning for high-value artifacts...',
        'Evaluating monster threat vectors...',
        'Synthesizing regional lore...',
        'Optimizing combat subroutines...',
        'Syncing temporal fragments...',
        'Calibrating arcane sensors...'
      ];
      setResearchTasks(prev => {
        const next = nextTasks[Math.floor(Math.random() * nextTasks.length)];
        return [next, ...prev].slice(0, 3);
      });
    }, 2500);

    try {
      console.log(`[Research Pod] Initializing search for ${realm.name}...`);
      
      // Use Promise.race to prevent infinite hang if Gemini takes too long
      const researchPromise = researchRealm(realm.id, realm.name);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Temporal link timeout after 45s. The Archives are currently unstable.")), 45000)
      );
      
      const research = await Promise.race([researchPromise, timeoutPromise]) as ResearchData;
      
      console.log(`[Research Pod] Data retrieved from library.`);
      setResearchData(research);
      setLearnedRealms(prev => prev.includes(realm.id) ? prev : [...prev, realm.id]);
      if (research.discovery) {
        setDiscoveries(prev => ({ ...prev, [realm.id]: research.discovery }));
      }
      
      setStep('party-builder');
    } catch (error) {
      console.error("[Fatal Error] Research failure:", error);
      const msg = error instanceof Error ? error.message : "The research pod encountered a temporal distortion.";
      setErrorMessage(`${msg} Please try again.`);
      setStep('selecting');
    } finally {
      clearInterval(interval);
      clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  const handleCreateParty = () => {
    setStep('party-builder');
  };

  const handleGoToAdventuring = async () => {
    if (!currentRealm) return;
    setLoading(true);
    try {
      const turn = await generateStoryTurn([], currentRealm.name, "Begin our odyssey", party);
      setCurrentTurn(turn);
      setHistory([{ role: 'assistant', content: turn.story }]);
      setStep('adventuring');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleMemberInParty = (char: Character) => {
    setParty(prev => {
      const isMember = prev.members.some(m => m.id === char.id);
      if (isMember) {
        return { ...prev, members: prev.members.filter(m => m.id !== char.id) };
      } else {
        return { ...prev, members: [...prev.members, char] };
      }
    });
  };

  const saveNewCharacter = async (char: Character) => {
    try {
      await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(char)
      });
      setCharacters(prev => {
        const idx = prev.findIndex(c => c.id === char.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = char;
          return next;
        }
        return [...prev, char];
      });
      setParty(prev => {
        const idx = prev.members.findIndex(m => m.id === char.id);
        if (idx >= 0) {
          const nextMembers = [...prev.members];
          nextMembers[idx] = char;
          return { ...prev, members: nextMembers };
        }
        return prev;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCharacter = async (id: string) => {
    try {
      await fetch(`/api/characters?id=${id}`, { method: 'DELETE' });
      setCharacters(prev => prev.filter(c => c.id !== id));
      setParty(prev => ({ ...prev, members: prev.members.filter(m => m.id !== id) }));
      playSfx('hit');
    } catch (e) {
      console.error(e);
    }
  };

  const generateAndSaveRandomCharacter = async () => {
    setLoading(true);
    try {
      const realmName = currentRealm?.name || "The Great Multiverse";
      const archetypes = [
        "Reclusive Scholarly", "Broken Veteran", "Chaos-Touched", "Legacy-Bound", 
        "Shadow-Born", "Nature-Vowed", "Silver-Tongued", "Iron-Willed", 
        "Cursed Aristocrat", "Street-Urchin Savant", "Planar Traveler", "Berserker Poet"
      ];
      const r = Math.floor(Math.random() * archetypes.length);
      const hint = archetypes[r];
      const char = await generateRandomCharacter(`${realmName} (Hint: Character should embody a ${hint} archetype)`);
      await saveNewCharacter(char);
      playSfx('magic');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const generateFullRandomParty = async () => {
    setLoading(true);
    try {
      const realmName = currentRealm?.name || "The Great Multiverse";
      const newChars = [];
      const archetypes = ["Rogueish", "Academic", "Brutal", "Divinely-Inspired", "Ancient", "Young & Reckless"];
      for (let i = 0; i < 3; i++) {
        const hint = archetypes[i % archetypes.length];
        const char = await generateRandomCharacter(`${realmName} (${hint} vibe)`);
        await saveNewCharacter(char);
        newChars.push(char);
      }
      setParty(prev => ({ ...prev, members: [...prev.members, ...newChars].slice(0, 4) }));
      playSfx('mystic');
    } catch (e) {
      console.error(e);
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
      const turn = await generateStoryTurn(newHistory, currentRealm.name, action, party);
      
      // Apply party updates if any
      if (turn.partyUpdates) {
        setParty(prev => {
          const next = { ...prev };
          if (turn.partyUpdates.goldDelta) next.gold += turn.partyUpdates.goldDelta;
          if (turn.partyUpdates.reputationDelta) next.reputation += turn.partyUpdates.reputationDelta;
          
          if (turn.partyUpdates.memberUpdates) {
            next.members = next.members.map(m => {
              const update = turn.partyUpdates.memberUpdates.find((u: any) => u.id === m.id);
              if (update) {
                const updatedMember = { ...m };
                if (update.hpDelta) updatedMember.hp = Math.max(0, Math.min(updatedMember.maxHp, updatedMember.hp + update.hpDelta));
                if (update.inventoryDelta) {
                  updatedMember.inventory = [...updatedMember.inventory, ...update.inventoryDelta];
                }
                // Persist changed character back to server
                saveNewCharacter(updatedMember);
                return updatedMember;
              }
              return m;
            });
          }
          return next;
        });
      }

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
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img 
          src={`/image?prompt=${encodeURIComponent('Dungeons and Dragons legendary landscape concept art, cinematic lighting, high fantasy, epic scale, ' + (currentRealm?.name || 'mythic realm'))}&seed=global-bg-seed&width=1920&height=1080`} 
          className="w-full h-full object-cover"
          alt="Ancient realm background"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: getMoodColor(currentTurn?.musicMood) }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#0d0b09_100%)]" />
      </div>

      <header className="relative z-20 border-b border-[#333] bg-dark-surface/60 backdrop-blur-md p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <h1 className="font-serif italic text-gold text-xl tracking-wider">
              CHRONICLER ARCHIVE v4.2
            </h1>
            <div className="status-badge hidden sm:block">
              {currentRealm ? currentRealm.name.toUpperCase() : "Select Realm"}
            </div>
          </div>
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-tighter">
            <button 
              onClick={() => {
                if (step !== 'splash') {
                  setStep('bestiary');
                  playSfx('paper');
                }
              }}
              className={cn("flex items-center gap-2 transition-all p-2 rounded-sm", step === 'bestiary' ? "text-gold bg-gold/10" : "text-gray-500 hover:text-white")}
            >
              <Skull size={16} /> 
              <span className="hidden md:inline">Bestiary</span>
            </button>
            <button 
              onClick={() => {
                if (step !== 'splash') {
                  setStep('party-builder');
                  playSfx('click');
                }
              }}
              className={cn("flex items-center gap-2 transition-all p-2 rounded-sm", step === 'party-builder' ? "text-gold bg-gold/10" : "text-gray-500 hover:text-white")}
            >
              <Zap size={16} /> 
              <span className="hidden md:inline">Global Roster</span>
            </button>
            {currentRealm && (
               <button 
                 onClick={() => setStep('selecting')}
                 className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors p-2"
               >
                 <RefreshCcw size={16} />
                 <span className="hidden md:inline">Change Realm</span>
               </button>
            )}
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <button 
              onClick={() => {
                const nextState = !audioEnabled;
                setAudioEnabled(nextState);
                if (nextState) {
                  if (typeof Howler !== 'undefined' && Howler.ctx) Howler.ctx.resume();
                  playSfx('click');
                }
              }}
              className={cn("flex items-center gap-2 transition-all p-2 rounded-sm", audioEnabled ? "text-gold bg-gold/10" : "text-gray-500 hover:text-white")}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hidden md:inline">{audioEnabled ? "Ambience Active" : "Silence"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 'splash' && (
            <motion.div
              key="splash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-8 text-center p-6"
            >
              <div className="space-y-4">
                <h1 className="text-6xl font-serif text-white italic tracking-tighter">LORE ENGINE</h1>
                <p className="text-gray-400 font-mono text-sm tracking-widest uppercase">Autonomous World-Building & Discovery</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setAudioEnabled(true);
                  if (typeof Howler !== 'undefined' && Howler.ctx) {
                    Howler.ctx.resume().then(() => {
                      console.log("[Audio] Context Resumed on Start");
                      setStep('selecting');
                      playSfx('mystic');
                    });
                  } else {
                    setStep('selecting');
                    playSfx('mystic');
                  }
                }}
                className="px-12 py-4 bg-gold text-black font-bold uppercase tracking-[4px] hover:bg-white transition-colors"
              >
                Enter the Multiverse
              </motion.button>
              <div className="text-[10px] text-gold/50 font-mono uppercase tracking-widest">v2.4.0-Flash // Audio Recommended</div>
            </motion.div>
          )}

          {step === 'selecting' && (
            <motion.div
              key="selecting"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12 py-8 flex-1 flex flex-col justify-center"
            >
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/50 p-4 text-red-500 text-xs text-center rounded-sm max-w-md mx-auto flex items-center gap-2">
                  <ShieldAlert size={14} />
                  {errorMessage}
                  <button onClick={() => setErrorMessage(null)} className="ml-auto underline">Dismiss</button>
                </div>
              )}
              <div className="text-center space-y-4">
                <div className="flex flex-col items-center gap-3">
                   <div className="text-[10px] uppercase tracking-[4px] text-gray-500 font-bold mb-2">INITIALIZE PARAMETERS</div>
                   <button 
                     onClick={() => setStep('party-builder')}
                     className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest text-gold hover:bg-gold hover:text-black transition-all flex items-center gap-2"
                   >
                     <Zap size={10} /> Manage Characters ({characters.length})
                   </button>
                </div>
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
                          src={realm.imageUrl || `/image?prompt=${encodeURIComponent('D&D campaign setting art for ' + realm.name)}&seed=${realm.id}`} 
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
                    <h3 className="text-xl font-serif text-white italic mb-2">Monster Bestiary & Archive</h3>
                    <p className="text-gray-500 text-xs leading-relaxed">
                      Consult the Codex of Knowledge. Contains learned monsters, legendary heroes, and artifacts of this realm.
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
              <div className="flex justify-between items-center border-b border-[#222] pb-6">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[4px] text-emerald-400 font-bold">CODEX_ARCHIVE_SITE: {currentRealm.id}</div>
                  <h2 className="text-5xl font-serif text-white italic tracking-wide">{currentRealm.name}</h2>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setStep('party-builder')}
                    className="px-6 py-2 bg-gold text-black text-[10px] uppercase font-black tracking-widest hover:bg-white transition-all"
                  >
                    Assemble Party
                  </button>
                  <button 
                    onClick={() => setStep('selecting')}
                    className="px-6 py-2 bg-white/5 text-gray-400 text-[10px] uppercase font-black tracking-widest hover:text-white transition-all border border-white/10"
                  >
                    Back to Selection
                  </button>
                </div>
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
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[3px] text-gray-500 font-bold">
                            <span className="text-gold opacity-50">{section.icon}</span>
                            {section.label}
                          </div>
                          {section.label === 'Iconic Monsters' && (
                            <button 
                              onClick={() => setStep('bestiary')}
                              className="text-[10px] text-gold hover:text-white transition-colors flex items-center gap-1 font-bold uppercase tracking-widest"
                            >
                              Open Specialized Codex <Skull size={10} />
                            </button>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          {filteredItems.map((item, idx) => (
                            <div key={idx} className="group bg-dark-card subtle-border flex flex-col relative overflow-hidden h-64">
                              <div className="absolute inset-0 opacity-20 group-hover:opacity-60 transition-opacity">
                                <img 
                                  src={`/image?prompt=${encodeURIComponent(item.imagePrompt || ('Dungeons and Dragons entity: ' + item.name))}&seed=${item.name}`} 
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
                                        className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all transform hover:scale-110"
                                        title="Summon Lore Agent"
                                      >
                                        <Library size={12} />
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
              <div className="relative group">
                <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="w-80 h-px bg-white/5 relative overflow-hidden backdrop-blur-md">
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-gold to-transparent"
                  />
                </div>
              </div>
              
              <div className="text-center space-y-4 max-w-sm">
                <div className="flex flex-col gap-1 items-center">
                  <h3 className="text-sm font-bold uppercase tracking-[6px] text-gold animate-pulse drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]">
                    Synthesizing Lore Matrix
                  </h3>
                  <div className="h-px w-24 bg-gold/30" />
                </div>
                
                <div className="space-y-2">
                  <p className="text-white/60 text-[11px] uppercase tracking-[2px] font-serif italic">
                    Accessing Canonical Datasources: <span className="text-gold not-italic font-bold">{currentRealm?.name}</span>
                  </p>
                  
                  <div className="flex flex-col items-center gap-1 min-h-[60px]">
                    <AnimatePresence mode="wait">
                      {researchTasks.map((task, i) => (
                        <motion.p
                          key={task + i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1 - (i * 0.3), scale: 1 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-gray-500 text-[10px] uppercase tracking-widest font-mono"
                        >
                          {task}
                        </motion.p>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                <p className="text-[9px] text-gold/30 uppercase tracking-widest animate-pulse font-mono mt-4">
                  Neural link established. Streaming high-density lore...
                </p>

                {isResearchSlow && (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[9px] text-amber-500 font-mono italic animate-pulse mt-2"
                  >
                    Deep-tier analysis requiring additional compute cycles... Still researching.
                  </motion.p>
                )}
              </div>
            </motion.div>
          )}

          {step === 'bestiary' && (
            <motion.div
              key="bestiary"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex flex-col space-y-8 py-8 flex-1"
            >
              <div className="flex justify-between items-start">
                 <button 
                   onClick={() => setStep('selecting')}
                   className="text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest"
                 >
                   <ChevronLeft size={14} /> Exit Codex
                 </button>
                 <div className="text-right">
                   <div className="text-[10px] uppercase tracking-[4px] text-gold font-bold">MONSTER_BEASTIARY_CODEX</div>
                   <h2 className="text-4xl font-serif text-white italic tracking-wide">Threats of the Realm</h2>
                 </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(researchData?.monsters || [
                  { name: "Ancient Shadow Dragon", challenge: "24", description: "A beast of pure darkness that feeds on the souls of the forgotten." },
                  { name: "Mind Flayer Arcanist", challenge: "10", description: "Psionic horrors that master the weave to enslave entire civilizations." },
                  { name: "Beholder Tyrant", challenge: "13", description: "A multi-eyed nightmare that projects an anti-magic cone of pure hate." }
                ]).map((monster, idx) => (
                  <div key={idx} className="group bg-dark-card/50 subtle-border p-6 space-y-4 hover:border-gold/30 transition-all">
                    <div className="h-48 bg-black/40 rounded-sm overflow-hidden mb-4 border border-white/5 relative">
                      <img 
                        src={`/image?prompt=${encodeURIComponent('D&D monster concept art: ' + monster.name + ' from ' + (currentRealm?.name || 'Ravenloft'))}&seed=${monster.name}`}
                        className="w-full h-full object-cover grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700" 
                        alt={monster.name}
                      />
                      <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 text-[10px] text-gold border border-gold/20">
                        CR {monster.challenge}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-serif text-white italic group-hover:text-gold transition-colors">{monster.name}</h3>
                      <p className="text-gray-500 text-xs mt-2 leading-relaxed italic line-clamp-3">
                        {monster.description}
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        playSfx('paper');
                        setSpecialtyResult({
                          type: 'monster',
                          name: monster.name,
                          content: monster.description,
                        });
                      }}
                      className="w-full py-2 bg-white/5 text-[10px] uppercase font-bold tracking-widest text-gray-400 hover:bg-gold hover:text-black transition-all"
                    >
                      Inspect Weaknesses
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 'party-builder' && (
            <motion.div
              key="party-builder"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col space-y-12 py-8 flex-1"
            >
              <div className="text-center space-y-4">
                 <div className="flex justify-between items-start">
                   <button 
                     onClick={() => setStep('selecting')}
                     className="text-gray-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest"
                   >
                     <ChevronRight size={14} className="rotate-180" /> Back to Matrix
                   </button>
                   <div className="text-right">
                     <div className="text-[10px] uppercase tracking-[4px] text-gold font-bold">ARCANE_ASSEMBLY_CHAMBER</div>
                   </div>
                 </div>
                 <h2 className="text-4xl font-serif text-white italic tracking-wide">Prepare for the Journey</h2>
                 <p className="text-gray-500 text-sm italic">Recruit legendary heroes from the archives or summon new ones from the ether.</p>
                 {!currentRealm && (
                   <button 
                    onClick={() => setStep('selecting')}
                    className="text-amber-500 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors flex items-center gap-2 mx-auto"
                   >
                     <Compass size={12} /> No Realm Selected. Choose one before embarking.
                   </button>
                 )}
              </div>

              <div className="grid lg:grid-cols-12 gap-12">
                 {/* Current Party */}
                 <div className="lg:col-span-4 space-y-6">
                    <div className="subtle-border bg-dark-card p-6 space-y-6">
                       <div className="flex justify-between items-center">
                          <h3 className="text-gold font-bold uppercase tracking-widest text-[10px]">Current Party</h3>
                          <span className="text-gray-500 text-[9px] uppercase font-mono">{party.members.length} / 4 Members</span>
                       </div>
                       <div className="space-y-4 min-h-[300px]">
                          {party.members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 pt-12 grayscale opacity-40">
                               <RefreshCcw size={32} className="text-gray-600" />
                               <p className="text-[10px] uppercase tracking-widest text-gray-500">Party matrix empty. Select heroes to begin.</p>
                            </div>
                          ) : (
                            party.members.map(member => (
                              <motion.div 
                                layout
                                key={member.id}
                                className="group relative bg-white/5 p-4 subtle-border flex gap-4 items-center"
                              >
                                 <div className="w-12 h-12 shrink-0 bg-dark-accent rounded-sm overflow-hidden border border-white/10">
                                    <img src={`/image?prompt=${encodeURIComponent('Dungeons and Dragons character portrait: ' + member.race + ' ' + member.class + ' ' + member.name)}&seed=${member.id}`} alt={member.name} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="text-white font-serif italic text-sm">{member.name}</div>
                                    <div className="text-[9px] text-gold/60 uppercase tracking-tighter">{member.race} {member.class} • Lvl {member.level}</div>
                                 </div>
                                 <button 
                                  onClick={() => setEditingCharacter(member)}
                                  className="text-gray-600 hover:text-gold transition-colors"
                                  title="Edit Sheet"
                                 >
                                    <FileText size={14} />
                                 </button>
                                 <button 
                                  onClick={() => toggleMemberInParty(member)}
                                  className="text-gray-600 hover:text-red-500 transition-colors"
                                 >
                                    <RefreshCcw size={14} className="rotate-45" />
                                 </button>
                              </motion.div>
                            ))
                          )}
                       </div>
                       <div className="pt-6 border-t border-white/5 space-y-4">
                          <div className="flex justify-between text-[10px] font-mono tracking-widest uppercase">
                             <span className="text-gray-500">Starting Gold</span>
                             <span className="text-amber-500">100 GP</span>
                          </div>
                          <button 
                            onClick={handleGoToAdventuring}
                            disabled={party.members.length === 0 || loading}
                            className="w-full bg-gold text-black py-3 text-[10px] uppercase font-black tracking-[4px] hover:bg-white transition-all disabled:opacity-20 flex items-center justify-center gap-2"
                          >
                             {loading ? <RefreshCcw size={14} className="animate-spin" /> : 'Embark on Odyssey'}
                          </button>
                       </div>
                    </div>
                    
                    <button 
                      onClick={generateFullRandomParty}
                      disabled={loading}
                      className="w-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 py-3 text-[9px] uppercase tracking-widest font-bold hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                    >
                       <Zap size={10} /> Quick-Summon Random Party
                    </button>
                 </div>

                 {/* Available Characters */}
                 <div className="lg:col-span-8 space-y-6">
                    <div className="flex justify-between items-end">
                       <h3 className="text-gold font-bold uppercase tracking-widest text-[10px]">Archived Explorers</h3>
                       <button 
                        onClick={generateAndSaveRandomCharacter}
                        disabled={loading}
                        className="text-gold hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase tracking-widest underline underline-offset-4"
                       >
                          {loading ? <RefreshCcw size={10} className="animate-spin" /> : <Sparkles size={10} />} Summon Wanderer
                       </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                       {characters.map(char => {
                         const isMember = party.members.some(m => m.id === char.id);
                         return (
                           <div 
                            key={char.id}
                            className={cn(
                              "relative group bg-dark-card subtle-border p-6 transition-all",
                              isMember ? "border-emerald-500/50 bg-emerald-500/5" : "hover:border-gold/30"
                            )}
                           >
                              <div className="flex gap-6 items-start">
                                 <div className="w-16 h-16 shrink-0 bg-dark-accent rounded-sm overflow-hidden border border-white/10 group-hover:border-gold/50 transition-colors">
                                    <img src={`/image?prompt=${encodeURIComponent('Dungeons and Dragons character portrait: ' + char.race + ' ' + char.class + ' ' + char.name)}&seed=${char.id}`} alt={char.name} className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100" />
                                 </div>
                                 <div className="flex-1 space-y-1">
                                    <h4 className="text-white font-serif italic text-lg leading-tight">{char.name}</h4>
                                    <div className="text-[10px] text-gold uppercase tracking-widest font-black opacity-60">{char.race} {char.class}</div>
                                    <p className="text-[10px] text-gray-500 italic line-clamp-2 leading-relaxed">{char.description}</p>
                                 </div>
                              </div>
                              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                                 <div className="flex gap-1">
                                    {char.inventory.slice(0, 2).map((item, i) => (
                                      <span key={i} className="text-[8px] bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-sm text-gray-400">{item}</span>
                                    ))}
                                 </div>
                                 <div className="flex items-center gap-3">
                                   <button 
                                      onClick={() => setEditingCharacter(char)}
                                      className="p-1.5 text-gray-600 hover:text-gold transition-colors"
                                      title="Edit Sheet"
                                   >
                                      <FileText size={12} />
                                   </button>
                                   <button 
                                      onClick={() => deleteCharacter(char.id)}
                                      className="p-1.5 text-gray-600 hover:text-red-500 transition-colors"
                                      title="Vanish from matrix"
                                   >
                                      <RefreshCcw size={12} className="rotate-45" />
                                   </button>
                                   <button 
                                    onClick={() => toggleMemberInParty(char)}
                                    className={cn(
                                      "px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest transition-all",
                                      isMember 
                                        ? "bg-emerald-500 text-black hover:bg-red-500" 
                                        : "bg-white/5 text-gray-400 hover:bg-gold hover:text-black border border-white/10"
                                    )}
                                   >
                                      {isMember ? 'Joined' : 'Recruit'}
                                   </button>
                                 </div>
                              </div>
                           </div>
                         );
                       })}
                       {characters.length === 0 && !loading && (
                         <div className="col-span-2 py-12 text-center text-gray-600 italic text-sm">
                           No archived explorers found. Summon your first wanderer to begin.
                         </div>
                       )}
                    </div>
                 </div>
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
                    backgroundImage: `url(${`/image?prompt=${encodeURIComponent('Atmospheric fantasy landscape for ' + currentRealm?.name)}&seed=${currentRealm?.id}-bg&width=800&height=1000`})`,
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
                        src={`/image?prompt=${encodeURIComponent(currentTurn.imagePrompt || ('Dungeons and Dragons story scene: ' + currentTurn.story.slice(0, 50)))}&seed=story-${history.length}`}
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
                        <span className="text-gold">PARTY STATUS</span>
                        <div className="flex gap-2 items-center">
                           <button 
                            onClick={() => setStep('party-builder')}
                            className="bg-white/5 p-1 rounded-sm text-gray-500 hover:text-gold transition-colors"
                            title="Manage Roster"
                           >
                             <Zap size={10} />
                           </button>
                           <span className="text-amber-500">G: {party.gold}</span>
                           <span className="text-emerald-500">R: {party.reputation}</span>
                        </div>
                      </div>
                      <div className="space-y-4 pt-2">
                        {party.members.map(member => (
                          <div key={member.id} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-[11px] text-white font-serif italic">{member.name}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => setEditingCharacter(member)} className="text-gray-600 hover:text-gold transition-colors">
                                  <FileText size={10} />
                                </button>
                                <span className="text-[9px] text-gray-500">{member.hp}/{member.maxHp} HP</span>
                              </div>
                            </div>
                            <div className="h-[2px] bg-white/5 w-full rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(member.hp / member.maxHp) * 100}%` }}
                                className={cn(
                                  "h-full transition-all duration-500",
                                  (member.hp / member.maxHp) < 0.3 ? "bg-red-500" : "bg-emerald-500"
                                )}
                              />
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                               {member.inventory.slice(0, 3).map((item, i) => (
                                 <span key={i} className="text-[7px] bg-white/5 px-1 py-0.5 rounded-sm text-gray-400 border border-white/5">{item}</span>
                               ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

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
                                        src={`/image?prompt=${encodeURIComponent(item.imagePrompt || ('Dungeons and Dragons lore: ' + item.name))}&seed=${item.name}`} 
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
                <div className="flex-1 bg-dark-surface/40 backdrop-blur-sm narrative-accent p-12 overflow-y-auto min-h-[400px]">
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
                  {specialtyResult.type === 'lore' && <div className="text-cyan-400 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest"><Library size={14} /> Lore Agent Deep Analysis</div>}
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
                  <div className="space-y-6">
                    {specialtyResult.type === 'lore' && (
                       <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-sm">
                          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                             <Library size={12} /> Archive Lore Agent Report
                          </div>
                          <div className="text-gray-400 text-[11px] italic font-serif leading-relaxed">
                            "I have reached into the deep-archives of {currentRealm?.name}. The following historical resonance was detected..."
                          </div>
                       </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none prose-p:italic prose-headings:font-serif prose-headings:text-gold prose-strong:text-gold prose-code:text-emerald-400">
                      <ReactMarkdown>{specialtyResult.content}</ReactMarkdown>
                    </div>
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
          {editingCharacter && (
            <CharacterSheet 
              character={editingCharacter} 
              onSave={saveNewCharacter} 
              onClose={() => setEditingCharacter(null)}
              playSfx={playSfx}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="text-center p-6 text-gray-600 text-xs uppercase tracking-[0.2em]">
        &copy; {new Date().getFullYear()} Chronicles of the Multiverse &bull; An AI Storytelling Engine
      </footer>
    </div>
  );
}

