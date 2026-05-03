
import { ChatMessage } from "../types";

export async function getLearnedRealms(): Promise<{ learnedIds: string[], discoveries: Record<string, string> }> {
  const response = await fetch('/api/learned');
  if (!response.ok) return { learnedIds: [], discoveries: {} };
  return response.json();
}

export async function generateCustomRealm(prompt: string) {
  const response = await fetch('/api/generate-realm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!response.ok) throw new Error('Failed to generate realm');
  return response.json();
}

export async function researchRealm(realmId: string, realmName: string) {
  const response = await fetch(`/api/research/${realmId}?realmName=${encodeURIComponent(realmName)}`);
  if (!response.ok) throw new Error('Failed to fetch research');
  return response.json();
}

export async function chatWithNPC(npcName: string, npcDesc: string, realmName: string, message: string, history: any[]) {
  const response = await fetch('/api/specialty/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npcName, npcDesc, realmName, message, history })
  });
  if (!response.ok) throw new Error('Failed to chat');
  return response.json();
}

export async function getMonsterTactics(monsterName: string, monsterDesc: string, realmName: string) {
  const response = await fetch('/api/specialty/tactics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monsterName, monsterDesc, realmName })
  });
  if (!response.ok) throw new Error('Failed to get tactics');
  return response.json();
}

export async function analyzeLore(entityName: string, entityDesc: string, realmName: string) {
  const response = await fetch('/api/specialty/lore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityName, entityDesc, realmName })
  });
  if (!response.ok) throw new Error('Failed to analyze lore');
  return response.json();
}

export async function getStrategicInsight(story: string, options: string[], realmName: string) {
  const response = await fetch('/api/specialty/insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ story, options, realmName })
  });
  if (!response.ok) throw new Error('Failed to get insight');
  return response.json();
}

export async function generateStoryTurn(history: ChatMessage[], currentRealmName: string, userInput: string) {
  const response = await fetch('/api/adventure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, currentRealm: currentRealmName, userInput })
  });
  if (!response.ok) throw new Error('Failed to generate story');
  return response.json();
}
