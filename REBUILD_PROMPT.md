# Rebuild Prompt & Architectural Blueprint

Use this prompt to recreate or extend the "Ravenloft: Chronos & Chaos" application.

## The Core Concept
A high-fidelity, brutalist D&D persistent world simulator using React, Tailwind, and Gemini 2.0 Flash. The app serves as a digital Dungeon Master that manages state across sessions.

## Technical Requirements
- **Framework**: React 18+ (Vite).
- **Styling**: Tailwind CSS (Dark/Brutalist aesthetic).
- **AI Engine**: Gemini 2.0 Flash for narrative generation, research, and character creation.
- **Backend**: Express server for persistent storage of "Learned Realms" and "Character Rosters".
- **State Management**: React State for active session; Server Files for long-term storage.

## The System Prompt
> "Build a D&D adventure simulator called 'Ravenloft: Chronos & Chaos'. 
> Features:
> 1. **Realm Matrix**: A selection screen for pre-defined and user-generated D&D realms.
> 2. **Research Pod**: A phase where AI researches lore, monster tactics, and strategic insights for a realm, saving them to a local library.
> 3. **Character Builder**: A system to generate random heroes with full stats (STR, DEX, etc.), skills, and inventory. 
> 4. **Persistent Party**: Store characters in a JSON file system. Track HP, Gold, and Reputation across narrative turns.
> 5. **Archivist UI**: A sidebar showing party status, HP bars, and inventory.
> 6. **Dynamic DM**: An AI DM that returns JSON with story text, music moods, image prompts, and specific state updates (deltas) for the party."

## Key Data Structures
- **Character**: `id, name, race, class, level, hp, maxHp, stats: { ... }, skills: [], inventory: [], description, imagePrompt`
- **Party**: `members: Character[], gold: number, reputation: number, sharedInventory: []`
- **Story Turn**: `{ story: string, musicMood: string, imagePrompt: string, options: string[], partyUpdates: { goldDelta, memberUpdates: [...] } }`
