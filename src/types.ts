
export type Realm = {
  id: string;
  name: string;
  description: string;
  primaryLore: string;
  imagePrompt: string;
  imageUrl?: string;
  themeColor: string;
  isCustom?: boolean;
};

export type MonsterAIProfile = {
  behavior: string;
  fleeCondition?: string;
  specialAbility?: {
    name: string;
    trigger: string;
    effect: string;
  };
};

export type ResearchEntity = {
  name: string;
  description: string;
  imagePrompt: string;
  aiProfile?: MonsterAIProfile;
};

export type ResearchData = {
  summary: string;
  discovery: string;
  lands: ResearchEntity[];
  npcs: ResearchEntity[];
  monsters: ResearchEntity[];
  artifacts: ResearchEntity[];
};

export type StoryStep = {
  story: string;
  imagePrompt?: string;
  musicMood?: string;
  options?: string[];
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export const FORGOTTEN_REALMS: Realm = {
  id: 'forgotten-realms',
  name: 'Forgotten Realms',
  description: 'A world of high fantasy, ancient ruins, and legendary heroes like Elminster.',
  primaryLore: 'Deep lore of Toril, the Weave, and city-states like Waterdeep and Neverwinter.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, sprawling high fantasy city of Waterdeep, white stone towers with blue banners, mountain backdrop, golden sunset, epic cinematic lighting, highly detailed digital painting',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, sprawling high fantasy city of Waterdeep, white stone towers with blue banners, mountain backdrop, golden sunset, epic cinematic lighting, highly detailed digital painting')}&width=800&height=450&seed=waterdeep`,
  themeColor: 'blue'
};

export const EBERRON: Realm = {
  id: 'eberron',
  name: 'Eberron',
  description: 'A pulp adventure world where magic is technology and warforged walk the streets.',
  primaryLore: 'Post-war noir, Dragonmarks, airships, and the lightning rail.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, magipunk cityscape of Sharn, soaring towers connected by bridges, flying airships with glowing arcane engines, neon blue lightning effects, noir atmosphere, detailed fantasy illustration',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, magipunk cityscape of Sharn, soaring towers connected by bridges, flying airships with glowing arcane engines, neon blue lightning effects, noir atmosphere, detailed fantasy illustration')}&width=800&height=450&seed=sharn`,
  themeColor: 'purple'
};

export const RAVENLOFT: Realm = {
  id: 'ravenloft',
  name: 'Ravenloft',
  description: 'A gothic horror setting ruled by Dark Lords in a realm of mists.',
  primaryLore: 'Vampires, mists, the Dark Powers, and domains like Barovia.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, gothic horror Castle Ravenloft on a jagged cliff, blood red moon, swirling mists, dramatic shadows, eerie lighting, dark fantasy masterpiece',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, gothic horror Castle Ravenloft on a jagged cliff, blood red moon, swirling mists, dramatic shadows, eerie lighting, dark fantasy masterpiece')}&width=800&height=450&seed=ravenloft`,
  themeColor: 'red'
};

export const GREYHAWK: Realm = {
  id: 'greyhawk',
  name: 'Greyhawk',
  description: 'The classic Gygaxian world of sword and sorcery, home to Mordenkainen and Vecna.',
  primaryLore: 'The Flanaess, the Circle of Eight, and the ruins of Castle Greyhawk.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, classic high fantasy City of Greyhawk, medieval stone walls, mystical glowing towers of the Circle of Eight, bustling market, traditional fantasy aesthetic',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, classic high fantasy City of Greyhawk, medieval stone walls, mystical glowing towers of the Circle of Eight, bustling market, traditional fantasy aesthetic')}&width=800&height=450&seed=greyhawk`,
  themeColor: 'yellow'
};

export const DRAGONLANCE: Realm = {
  id: 'dragonlance',
  name: 'Dragonlance',
  description: 'A world of epic wars, heroic dragons, and the high sorcery of Krynn.',
  primaryLore: 'The Cataclysm, the Dragon Orbs, and the war against Takhisis.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, epic dragon war over the world of Krynn, metallic and chromatic dragons clashing in the sky, soaring citadels, glowing dragon orbs, high fantasy epic',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, epic dragon war over the world of Krynn, metallic and chromatic dragons clashing in the sky, soaring citadels, glowing dragon orbs, high fantasy epic')}&width=800&height=450&seed=dragonlance`,
  themeColor: 'orange'
};

export const PLANESCAPE: Realm = {
  id: 'planescape',
  name: 'Planescape',
  description: 'A journey through the Outer Planes and the city of Sigil, at the center of the multiverse.',
  primaryLore: 'The Lady of Pain, the Factions of Sigil, and the Great Wheel cosmology.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, the City of Doors Sigil, surreal ring-shaped city interior, floating buildings, numerous glowing portals of different shapes, metaphysical atmosphere, high detail',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, the City of Doors Sigil, surreal ring-shaped city interior, floating buildings, numerous glowing portals of different shapes, metaphysical atmosphere, high detail')}&width=800&height=450&seed=sigil`,
  themeColor: 'cyan'
};

export const DARK_SUN: Realm = {
  id: 'dark-sun',
  name: 'Dark Sun',
  description: 'A brutal desert world where magic is dying and water is more precious than gold.',
  primaryLore: 'The Sorcerer-Kings, Athas, psionics, and the lack of gods.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, brutal desert landscape of Athas, massive dying red sun, obsidian mountains, warriors on giant insects, harsh lighting, orange and red tones',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, brutal desert landscape of Athas, massive dying red sun, obsidian mountains, warriors on giant insects, harsh lighting, orange and red tones')}&width=800&height=450&seed=darksun`,
  themeColor: 'brown'
};

export const SPELLJAMMER: Realm = {
  id: 'spelljammer',
  name: 'Spelljammer',
  description: 'Magical ships sailing the Astral Sea between worlds in Wildspace.',
  primaryLore: 'Astral ships, giant space hamsters, the Rock of Bral, and celestial navigation.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, a magical sailing galleon in Wildspace, vibrant rainbow nebula in space, glowing stars, space whales in the distance, cosmic fantasy art',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, a magical sailing galleon in Wildspace, vibrant rainbow nebula in space, glowing stars, space whales in the distance, cosmic fantasy art')}&width=800&height=450&seed=spelljammer`,
  themeColor: 'indigo'
};

export const KEMET: Realm = {
  id: 'kemet',
  name: 'Kemet (Empire of the Nile)',
  description: 'A realm of majestic pyramids, eternal deserts, and powerful god-kings inspired by Egyptian mythology.',
  primaryLore: 'Centered on the life-giving River Maat. Ruled by Pharaoh God-Kings and the pantheon of animal-headed deities including Ra, Osiris, Isis, Horus, and Anubis. Lore involves the Hall of Two Truths, the weighing of hearts against the feather of Maat, the celestial barge of the sun, and the eternal war against the chaos serpent Apep. Geography includes the fertile Black Lands and the scorching Red Lands, hidden necropolises, and the Great Library of Thoth.',
  imagePrompt: 'Vibrant official Dungeons and Dragons art style, epic golden pyramids under a vibrant blue sky, the lush green valley of the River Nile, colossal statues of Horus and Anubis, desert sunset, cinematic lighting',
  imageUrl: `/image?prompt=${encodeURIComponent('Vibrant official Dungeons and Dragons art style, epic golden pyramids under a vibrant blue sky, the lush green valley of the River Nile, colossal statues of Horus and Anubis, desert sunset, cinematic lighting')}&width=800&height=450&seed=kemet`,
  themeColor: 'amber'
};

export type Character = {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  skills: string[];
  inventory: string[];
  description: string;
  imagePrompt: string;
};

export type Party = {
  members: Character[];
  gold: number;
  sharedInventory: string[];
  reputation: number;
};

export const REALMS: Realm[] = [
  FORGOTTEN_REALMS, 
  EBERRON, 
  RAVENLOFT, 
  GREYHAWK, 
  DRAGONLANCE, 
  PLANESCAPE, 
  DARK_SUN, 
  SPELLJAMMER,
  KEMET
];
