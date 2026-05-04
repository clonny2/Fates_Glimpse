import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, Shield, Activity, Backpack, Save, Scroll, Sword, 
  Trash2, Plus, AlertCircle, Heart
} from 'lucide-react';
import { Character } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CharacterSheetProps {
  character: Character;
  onSave: (char: Character) => Promise<void>;
  onClose: () => void;
  playSfx?: (type: string) => void;
}

export function CharacterSheet({ character, onSave, onClose, playSfx }: CharacterSheetProps) {
  const [localChar, setLocalChar] = useState<Character>({ ...character });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalChar({ ...character });
  }, [character]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(localChar);
      if (playSfx) playSfx('magic');
      onClose();
    } catch (err) {
      setError('Failed to synchronize with backend.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateStat = (stat: keyof Character['stats'], val: number) => {
    setLocalChar(prev => ({
      ...prev,
      stats: { ...prev.stats, [stat]: val }
    }));
  };

  const addSkill = () => {
    const skill = prompt("Enter new skill or proficiency:");
    if (skill?.trim()) {
      setLocalChar(prev => ({
        ...prev,
        skills: [...prev.skills, skill.trim()]
      }));
    }
  };

  const removeSkill = (index: number) => {
    setLocalChar(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  };

  const addItem = () => {
    setLocalChar(prev => ({
      ...prev,
      inventory: [...prev.inventory, "New Item"]
    }));
  };

  const updateItem = (index: number, val: string) => {
    setLocalChar(prev => {
      const nextInv = [...prev.inventory];
      nextInv[index] = val;
      return { ...prev, inventory: nextInv };
    });
  };

  const removeItem = (index: number) => {
    setLocalChar(prev => ({
      ...prev,
      inventory: prev.inventory.filter((_, i) => i !== index)
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <div className="bg-[#121212] w-full max-w-4xl border border-white/10 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1a1a1a]">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-black rounded-sm overflow-hidden border border-gold/20 shadow-lg">
              <img 
                src={`/image?prompt=${encodeURIComponent('Dungeons and Dragons character portrait: ' + localChar.race + ' ' + localChar.class + ' ' + localChar.name)}&seed=${localChar.id}`} 
                alt={localChar.name} 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500" 
              />
            </div>
            <div>
              <input 
                value={localChar.name}
                onChange={(e) => setLocalChar(prev => ({ ...prev, name: e.target.value }))}
                className="bg-transparent text-white font-serif italic text-2xl outline-none focus:text-gold transition-colors w-full"
              />
              <div className="text-[10px] text-gold uppercase tracking-[2px] font-bold opacity-60 flex gap-2">
                <span>Level</span>
                <input 
                  type="number"
                  value={localChar.level}
                  onChange={(e) => setLocalChar(prev => ({ ...prev, level: parseInt(e.target.value) || 0 }))}
                  className="bg-transparent w-8 outline-none text-white"
                />
                <span>{localChar.race} {localChar.class}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-2"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 grid lg:grid-cols-12 gap-12 custom-scrollbar">
          {/* Stats & Vitals */}
          <div className="lg:col-span-5 space-y-10">
            <div className="space-y-6">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-gold opacity-50 flex items-center gap-2">
                <Activity size={12} /> Ability Scores
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(localChar.stats).map(([stat, val]) => (
                  <div key={stat} className="bg-white/5 p-4 rounded-sm border border-white/5 text-center group hover:border-gold/30 transition-all shadow-inner">
                    <div className="text-[9px] uppercase text-gray-500 font-bold mb-2">{stat.slice(0, 3)}</div>
                    <input 
                      type="number"
                      value={val}
                      onChange={(e) => updateStat(stat as keyof Character['stats'], parseInt(e.target.value) || 0)}
                      className="bg-transparent text-white font-serif text-2xl w-full text-center outline-none selection:bg-gold/30"
                    />
                    <div className="text-[10px] text-emerald-500 font-mono mt-1">
                      {Math.floor((val - 10) / 2) >= 0 ? `+${Math.floor((val - 10) / 2)}` : Math.floor((val - 10) / 2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-gold opacity-50 flex items-center gap-2">
                <Heart size={12} /> Vitality Matrix
              </h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 p-5 border border-white/5 shadow-inner">
                  <div className="text-[9px] uppercase text-gray-500 font-bold mb-2">Current HP</div>
                  <input 
                    type="number"
                    value={localChar.hp}
                    onChange={(e) => setLocalChar(prev => ({ ...prev, hp: parseInt(e.target.value) || 0 }))}
                    className="bg-transparent text-white font-serif text-4xl w-full outline-none text-emerald-500 font-bold"
                  />
                </div>
                <div className="bg-white/5 p-5 border border-white/5 shadow-inner">
                  <div className="text-[9px] uppercase text-gray-500 font-bold mb-2">Max Vitality</div>
                  <input 
                    type="number"
                    value={localChar.maxHp}
                    onChange={(e) => setLocalChar(prev => ({ ...prev, maxHp: parseInt(e.target.value) || 0 }))}
                    className="bg-transparent text-white font-serif text-4xl w-full outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-gold opacity-50 flex items-center gap-2">
                  <Sword size={12} /> Proficiencies
                </h4>
                <button onClick={addSkill} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localChar.skills.map((skill, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-sm border border-white/10 group animate-in fade-in zoom-in duration-300">
                    <span className="text-[11px] text-gray-300 font-serif italic">{skill}</span>
                    <button 
                      onClick={() => removeSkill(i)}
                      className="text-gray-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inventory & Lore */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] uppercase font-black tracking-widest text-gold opacity-50 flex items-center gap-2">
                  <Backpack size={12} /> Tactical Inventory
                </h4>
                <button onClick={addItem} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {localChar.inventory.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#1a1a1a] p-3 rounded-sm border border-white/5 group hover:border-gold/20 transition-all shadow-md">
                    <input 
                      type="text"
                      value={item}
                      onChange={(e) => updateItem(i, e.target.value)}
                      className="bg-transparent text-[11px] text-gray-300 w-full outline-none font-serif italic"
                    />
                    <button 
                      onClick={() => removeItem(i)}
                      className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[10px] uppercase font-black tracking-widest text-gold opacity-50 flex items-center gap-2">
                <Scroll size={12} /> Chronicle Backstory
              </h4>
              <textarea 
                value={localChar.description}
                onChange={(e) => setLocalChar(prev => ({ ...prev, description: e.target.value }))}
                className="w-full h-80 bg-white/5 p-6 rounded-sm border border-white/5 text-gray-300 text-sm leading-relaxed outline-none focus:border-gold/30 transition-all custom-scrollbar font-serif italic"
                placeholder="The archives are empty... dictate a legend."
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#1a1a1a] flex justify-between items-center">
          <div className="flex items-center gap-3">
            {error && (
              <div className="text-red-500 text-[10px] flex items-center gap-2 font-bold uppercase tracking-widest animate-pulse">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
          <div className="flex gap-6">
            <button 
              onClick={onClose}
              className="px-6 py-2 text-[10px] uppercase tracking-[3px] font-bold text-gray-600 hover:text-white transition-colors"
            >
              Discard Fragment
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-gold text-black px-10 py-3 text-[10px] uppercase font-black tracking-[4px] hover:bg-white transition-all flex items-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.2)] disabled:opacity-50"
            >
              {isSaving ? (
                 <Save size={14} className="animate-spin" />
              ) : (
                 <Save size={14} />
              )}
              {isSaving ? 'Synchronizing...' : 'Commit to History'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
