import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sword, RefreshCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Howl } from 'howler';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

interface RollResult {
  id: number;
  type: DieType;
  value: number;
  timestamp: number;
}

export function DiceRoller() {
  const [history, setHistory] = useState<RollResult[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);

  const rollDie = (type: DieType) => {
    setIsRolling(true);
    // Play rattle sound using Howler
    const rattleSound = new Howl({
      src: ['https://cdn.pixabay.com/audio/2021/08/04/audio_333a41b59c.mp3'],
      volume: 0.5
    });
    rattleSound.play();
    
    // Artificial delay for tension
    setTimeout(() => {
      const value = Math.floor(Math.random() * type) + 1;
      const isCriticalSuccess = (type === 20 && value === 20) || (type !== 20 && value === type);
      const isCriticalFail = value === 1;

      if (isCriticalSuccess) {
        new Howl({ 
          src: ['https://cdn.pixabay.com/audio/2022/03/10/audio_c8de304247.mp3'], 
          volume: 0.7 
        }).play();
      } else if (isCriticalFail) {
        new Howl({ 
          src: ['https://cdn.pixabay.com/audio/2022/03/24/audio_dc395616e4.mp3'], 
          volume: 0.6 
        }).play();
      }

      const newRoll: RollResult = {
        id: Date.now(),
        type,
        value,
        timestamp: Date.now(),
      };
      
      setLastRoll(newRoll);
      setHistory((prev) => [newRoll, ...prev].slice(0, 10));
      setIsRolling(false);
    }, 800);
  };

  const dice: DieType[] = [4, 6, 8, 10, 12, 20, 100];

  return (
    <div className="bg-dark-card/90 backdrop-blur-md border border-gold/10 p-4 space-y-4 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gold/80">
        <div className="flex items-center gap-2">
          <Sword size={12} className="text-gold" /> Strategic Matrix Roll
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Neural Link Active
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {dice.map((d) => (
          <button
            key={d}
            onClick={() => rollDie(d)}
            disabled={isRolling}
            className="h-10 flex flex-col items-center justify-center bg-black/60 border border-gold/5 hover:border-gold/40 hover:bg-gold/10 transition-all group disabled:opacity-50"
          >
            <span className="text-[10px] font-mono text-gray-400 group-hover:text-gold transition-colors">d{d}</span>
          </button>
        ))}
        <button
          onClick={() => {
            setHistory([]);
            setLastRoll(null);
          }}
          className="h-10 flex items-center justify-center bg-black/20 border border-white/5 hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-all"
          title="Reset Temporal Log"
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      <div className="relative h-28 bg-black/80 rounded-sm overflow-hidden flex flex-col items-center justify-center border-t border-b border-gold/10">
        <AnimatePresence mode="wait">
          {isRolling ? (
            <motion.div
              key="rolling"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex gap-1">
                {[1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 0.4, delay: i * 0.1 }}
                    className="w-2 h-2 bg-gold/40 rounded-full"
                  />
                ))}
              </div>
              <div className="text-gold/60 font-mono text-[9px] uppercase tracking-[3px]">Calculating Vector</div>
            </motion.div>
          ) : lastRoll ? (
            <motion.div
              key={lastRoll.id}
              initial={{ y: 20, opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
              className="flex flex-col items-center relative"
            >
              {( (lastRoll.type === 20 && lastRoll.value === 20) || (lastRoll.type !== 20 && lastRoll.value === lastRoll.type) ) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [1, 0], scale: [1, 2.5] }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 bg-gold/20 rounded-full blur-xl"
                />
              )}
              
              <div className={twMerge(
                "text-5xl font-serif italic drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]",
                lastRoll.value === 1 ? "text-red-500" : 
                ((lastRoll.type === 20 && lastRoll.value === 20) || (lastRoll.type !== 20 && lastRoll.value === lastRoll.type)) ? "text-gold" : 
                "text-white"
              )}>
                {lastRoll.value}
              </div>
              
              <div className="text-[8px] uppercase tracking-[4px] text-gray-500 mt-2 font-mono">
                {lastRoll.value === 1 ? 'BOTCH' : 
                 ((lastRoll.type === 20 && lastRoll.value === 20) || (lastRoll.type !== 20 && lastRoll.value === lastRoll.type)) ? 'CRITICAL SUCCESS' : 
                 `d${lastRoll.type} Manifestation`}
              </div>
            </motion.div>
          ) : (
            <div className="text-gray-700 text-[10px] uppercase font-mono tracking-[5px] opacity-40">
              Standing By
            </div>
          )}
        </AnimatePresence>

        {/* Sensory Flourishes */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
      </div>

      {history.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-center text-[8px] uppercase tracking-widest text-gray-600 font-bold">
            <span>Temporal History</span>
            <span>{history.length} ROLLS</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 max-h-20 overflow-y-auto pr-1 custom-scrollbar">
            {history.map((roll) => (
              <motion.div 
                key={roll.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className={twMerge(
                  "py-1.5 flex flex-col items-center rounded-sm border transition-all",
                  roll.value === 1 ? "bg-red-500/5 border-red-500/20 text-red-400" :
                  ((roll.type === 20 && roll.value === 20) || (roll.type !== 20 && roll.value === roll.type)) ? "bg-gold/5 border-gold/20 text-gold" :
                  "bg-white/5 border-white/5 text-gray-400"
                )}
              >
                <span className="text-[10px] font-serif italic mb-0.5">{roll.value}</span>
                <span className="text-[7px] font-mono opacity-50">d{roll.type}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
