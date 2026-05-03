
import { ChatMessage, ResearchData } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Skill mandate: Always use process.env.GEMINI_API_KEY in frontend for Vite apps
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function extractJson(text: string) {
  try {
    if (!text) return null;
    // Look for JSON block in markdown or just the object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON object found in text:", text);
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("JSON Extraction Error:", error, "Raw text:", text);
    return null;
  }
}

export async function getLearnedRealms(): Promise<{ learnedIds: string[], discoveries: Record<string, string> }> {
  try {
    const response = await fetch('/api/learned');
    if (!response.ok) return { learnedIds: [], discoveries: {} };
    return response.json();
  } catch (e) {
    return { learnedIds: [], discoveries: {} };
  }
}

async function saveToLibrary(realmId: string, realmName: string, researchData: ResearchData) {
  try {
    await fetch(`/api/save-research/${realmId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realmName, researchData })
    });
  } catch (e) {}
}

export async function generateCustomRealm(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            primaryLore: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
            themeColor: { type: Type.STRING }
          },
          required: ["id", "name", "description", "primaryLore", "imagePrompt", "themeColor"]
        }
      },
      contents: [{ role: "user", parts: [{ text: `Create a DnD realm: ${prompt}` }] }]
    });
    
    const data = extractJson(response.text || '{}');
    if (!data) throw new Error("Failed to parse realm data");
    return { ...data, isCustom: true };
  } catch (e) {
    console.error("Gemini Realm Gen Error:", e);
    throw e;
  }
}

export async function researchRealm(realmId: string, realmName: string): Promise<ResearchData> {
  // Check cache first
  try {
    const check = await fetch(`/api/research-check/${realmId}`);
    if (check.ok) return check.json();
  } catch (e) {}

  try {
    console.log(`[Gemini Agent] Starting deep research on ${realmName}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        responseMimeType: "application/json",
        systemInstruction: `Act as a DnD Research Agent. Provide deep lore for ${realmName}. 
        Return ONLY valid JSON with keys: summary, discovery, lands, npcs, monsters, artifacts.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            discovery: { type: Type.STRING },
            lands: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, imagePrompt: { type: Type.STRING } } } },
            npcs: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, imagePrompt: { type: Type.STRING } } } },
            monsters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, imagePrompt: { type: Type.STRING } } } },
            artifacts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, imagePrompt: { type: Type.STRING } } } }
          },
          required: ["summary", "discovery", "lands", "npcs", "monsters", "artifacts"]
        }
      },
      contents: [{ role: "user", parts: [{ text: `Research ${realmName}` }] }]
    });

    const data = extractJson(response.text || '{}');
    if (!data) throw new Error("Failed to parse research data");
    
    await saveToLibrary(realmId, realmName, data);
    return data;
  } catch (e) {
    console.error("Gemini Research Error:", e);
    throw e;
  }
}

export async function generateStoryTurn(history: ChatMessage[], currentRealmName: string, userInput: string) {
  try {
    console.log(`[Gemini DM] Processing turn for ${currentRealmName}...`);
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        responseMimeType: "application/json",
        systemInstruction: `You are a legendary Dungeon Master in ${currentRealmName}. 
        Return ONLY JSON: { "story": string, "musicMood": string, "imagePrompt": string, "options": string[] }`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            story: { type: Type.STRING },
            musicMood: { type: Type.STRING },
            imagePrompt: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["story", "musicMood", "imagePrompt", "options"]
        }
      },
      contents: [
        ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
        { role: "user", parts: [{ text: userInput }] }
      ]
    });
    
    const data = extractJson(response.text || '{}');
    if (!data) throw new Error("Failed to parse story turn");
    return data;
  } catch (e) {
    console.error("Gemini DM Error:", e);
    throw e;
  }
}


export async function chatWithNPC(npcName: string, npcDesc: string, realmName: string, message: string, history: any[]) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: `You are ${npcName} in ${realmName}. Desc: ${npcDesc}.` },
      contents: [
        ...(history || []).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
        { role: "user", parts: [{ text: message }] }
      ]
    });
    return { content: response.text };
  } catch (e) {
    console.error("Gemini NPC Error:", e);
    return { content: "I am rendered speechless by the currents of fate... (API Error)" };
  }
}

export async function getMonsterTactics(monsterName: string, monsterDesc: string, realmName: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: `Strategy for ${monsterName} in ${realmName}.` },
      contents: [{ role: "user", parts: [{ text: `How to defeat ${monsterName}? Context: ${monsterDesc}` }] }]
    });
    return { content: response.text };
  } catch (e) { return { content: "Error fetching tactics." }; }
}

export async function analyzeLore(entityName: string, entityDesc: string, realmName: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: `Lore for ${entityName} in ${realmName}.` },
      contents: [{ role: "user", parts: [{ text: `Lore of ${entityName}? Context: ${entityDesc}` }] }]
    });
    return { content: response.text };
  } catch (e) { return { content: "Error fetching lore." }; }
}

export async function getStrategicInsight(story: string, options: string[], realmName: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: { systemInstruction: `Insight for Situation in ${realmName}.` },
      contents: [{ role: "user", parts: [{ text: `Situation: ${story}\nOptions: ${options.join(", ")}` }] }]
    });
    return { content: response.text };
  } catch (e) { return { content: "Error fetching insight." }; }
}
