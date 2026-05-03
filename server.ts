import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure knowledge directory exists
  const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
  try {
    await fs.access(KNOWLEDGE_DIR);
  } catch {
    await fs.mkdir(KNOWLEDGE_DIR);
  }

  function extractJson(text: string) {
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) return null;
      const jsonString = text.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error("JSON Extraction Error:", error);
      return null;
    }
  }

  // API Routes
  app.get("/api/learned", async (req, res) => {
    try {
      const files = await fs.readdir(KNOWLEDGE_DIR);
      const learnedIds = files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
      
      const discoveries: Record<string, string> = {};
      for (const id of learnedIds) {
        try {
          const content = await fs.readFile(path.join(KNOWLEDGE_DIR, `${id}.json`), "utf-8");
          const data = JSON.parse(content);
          if (data.discovery) {
            discoveries[id] = data.discovery;
          }
        } catch (e) {
          console.error(`Error reading discovery for ${id}:`, e);
        }
      }
      res.json({ learnedIds, discoveries });
    } catch {
      res.json({ learnedIds: [], discoveries: {} });
    }
  });

  app.post("/api/generate-realm", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `
        You are a master world-builder for Dungeons & Dragons. 
        Based on the user's idea, create a new high-fantasy realm.
        Return a single JSON object with these fields:
        "id": a unique slug (lowercase, no spaces)
        "name": the name of the realm
        "description": 1-2 sentence overview
        "primaryLore": 3-4 sentences of deep lore/mythology
        "imagePrompt": highly detailed visual prompt for D&D art style
        "themeColor": a tailwind color name (e.g., 'emerald', 'rose', 'indigo')

        Idea: ${prompt}
      ` }] }]});

      const text = response.text;
      const realmData = extractJson(text || '{}');
      res.json({ ...realmData, isCustom: true });
    } catch (error) {
      console.error("Realm generation error:", error);
      res.status(500).json({ error: "Failed to generate realm" });
    }
  });

  app.get("/api/research/:realmId", async (req, res) => {
    const { realmId } = req.params;
    const { realmName } = req.query;

    const jsonPath = path.join(KNOWLEDGE_DIR, `${realmId}.json`);
    const mdPath = path.join(KNOWLEDGE_DIR, `${realmId}.md`);

    try {
      await fs.access(jsonPath);
      const data = await fs.readFile(jsonPath, "utf-8");
      return res.json(JSON.parse(data));
    } catch {
      const systemInstruction = `Act as a DnD Research Agent. You are an expert on all DnD lore. 
    Research the realm: ${realmName} with a focus on its Geography, Cosmology, NPCs, Monsters, and Artifacts. 
    
    You must provide:
    1. A summary of the realm.
    2. A "discovery": A single, fascinating secret or lesser-known fact about the realm that the agent uncovered.
    3. 2-3 major lands/regions.
    4. 2-3 famous NPCs.
    5. 2-3 iconic monsters.
    6. 2-3 legendary artifacts.

    For every entity, provide a "name", "description", and a "imagePrompt".
    The "imagePrompt" MUST be a highly detailed visual description including style modifiers like 'detailed digital illustration', 'vibrant fantasy art style', 'epic lighting', 'Cinematic composition', 'high fantasy', and 'official Dungeons and Dragons art style'.
    
    IMPORTANT: You MUST respond ONLY with a single valid JSON object. No conversational text before or after.
    
    Format:
    {
      "summary": "...",
      "discovery": "...",
      "lands": [{"name": "...", "description": "...", "imagePrompt": "..."}],
      "npcs": [{"name": "...", "description": "...", "imagePrompt": "..."}],
      "monsters": [{"name": "...", "description": "...", "imagePrompt": "..."}],
      "artifacts": [{"name": "...", "description": "...", "imagePrompt": "..."}]
    }`;

      try {
        const result = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts: [{ text: `Research the realm: ${realmName}` }] }],
          config: {
            responseMimeType: "application/json",
            systemInstruction,
          },
        });

        const researchData = extractJson(result.text || '{}');
        await fs.writeFile(jsonPath, JSON.stringify(researchData, null, 2));

        // Save to MD
        let mdContent = `# Research Report: ${realmName}\n\n`;
        mdContent += `## Summary\n${researchData.summary}\n\n`;
        mdContent += `## Discovery\n> ${researchData.discovery}\n\n`;
        const sections = [
          { title: "Lands", items: researchData.lands },
          { title: "Notable NPCs", items: researchData.npcs },
          { title: "Iconic Monsters", items: researchData.monsters },
          { title: "Legendary Artifacts", items: researchData.artifacts }
        ];
        sections.forEach(section => {
          if (section.items) {
            mdContent += `## ${section.title}\n`;
            section.items.forEach((item: any) => {
              mdContent += `### ${item.name}\n${item.description}\n\n`;
            });
          }
        });
        await fs.writeFile(mdPath, mdContent);

        res.json(researchData);
      } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Research failed" });
      }
    }
  });

  app.post("/api/adventure", async (req, res) => {
    const { history, currentRealm, userInput } = req.body;
    const systemInstruction = `You are a legendary Dungeon Master for a DnD adventure in the realm of ${currentRealm}.
    Your goal is to weave an immersive, reactive story based on the user's choices.
    Always include:
    1. A vivid description of the scene (around 100-200 words).
    2. The atmosphere/mood for music (e.g., "Tense, rhythmic drums", "Ethereal flute melody").
    3. A prompt for an illustration of the current scene. This prompt MUST be highly specific and include modifiers like 'vibrant fantasy art style', 'detailed digital painting', 'epic cinematic lighting', 'high fantasy', and 'official Dungeons and Dragons art style'.
    4. 2-3 specific choices for the player to make next.
    
    IMPORTANT: You MUST respond ONLY with a single valid JSON object.
    
    Format:
    {
      "story": "your story text here",
      "musicMood": "mood description",
      "imagePrompt": "specific visual prompt for the scene",
      "options": ["Option 1", "Option 2", "Option 3"]
    }`;

    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          ...history.map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
          { role: "user", parts: [{ text: userInput }] }
        ],
        config: {
          responseMimeType: "application/json",
          systemInstruction,
        },
      });
      res.json(extractJson(result.text || '{}'));
    } catch (error) {
      res.status(500).json({ error: "Adventure generation failed" });
    }
  });

  app.post("/api/specialty/chat", async (req, res) => {
    const { npcName, npcDesc, realmName, message, history } = req.body;
    const systemInstruction = `You are ${npcName}, a resident of the realm of ${realmName}. 
    Your description: ${npcDesc}.
    Respond in character, keeping responses concise but atmospheric. 
    Use D&D style dialogue. Do not break character.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          ...(history || []).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
          { role: "user", parts: [{ text: message }] }
        ],
        config: { systemInstruction }
      });
      res.json({ content: response.text });
    } catch (error) {
      res.status(500).json({ error: "Chat failed" });
    }
  });

  app.post("/api/specialty/tactics", async (req, res) => {
    const { monsterName, monsterDesc, realmName } = req.body;
    const systemInstruction = `You are a veteran Monster Hunter and Tactician. 
    Provide a detailed D&D 5e-style combat strategy for defeating a ${monsterName} in the realm of ${realmName}.
    Include weaknesses, phases, and environmental considerations.
    Use Markdown formatting.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `How do I defeat ${monsterName}? Context: ${monsterDesc}` }] }],
        config: { systemInstruction }
      });
      res.json({ content: response.text });
    } catch (error) {
      res.status(500).json({ error: "Tactics failed" });
    }
  });

  app.post("/api/specialty/lore", async (req, res) => {
    const { entityName, entityDesc, realmName } = req.body;
    const systemInstruction = `You are a Great Sage from the Library of Worlds. 
    Provide deep, hidden lore about ${entityName} from the realm of ${realmName}.
    Expand on its origins, its connection to the gods, and its role in history.
    Use high-fantasy, evocative language. Use Markdown.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `Tell me the secret history of ${entityName}. Context: ${entityDesc}` }] }],
        config: { systemInstruction }
      });
      res.json({ content: response.text });
    } catch (error) {
      res.status(500).json({ error: "Lore failed" });
    }
  });

  app.post("/api/specialty/insight", async (req, res) => {
    const { story, options, realmName } = req.body;
    const systemInstruction = `You are the Eye of Fate, an omnipresent AI strategist for the realm of ${realmName}.
    Analyze the current story situation and the available options for the player.
    Provide a "Fate's Insight" which includes:
    1. A strategic evaluation of the risks.
    2. A suggested "Hidden Path" (a creative 4th option).
    3. A brief cryptic prophecy.
    Use Markdown formatting. Use a technical yet mystical tone.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `Current Situation: ${story}\nOptions: ${options.join(", ")}` }] }],
        config: { systemInstruction }
      });
      res.json({ content: response.text });
    } catch (error) {
      res.status(500).json({ error: "Insight failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
