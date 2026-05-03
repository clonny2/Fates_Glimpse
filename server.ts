import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config();

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const CHARACTERS_DIR = path.join(process.cwd(), "characters");

async function ensureDir(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  await ensureDir(KNOWLEDGE_DIR);
  await ensureDir(CHARACTERS_DIR);

  // Character APIs
  app.get("/api/characters", async (req, res) => {
    try {
      const files = await fs.readdir(CHARACTERS_DIR);
      const characters = [];
      for (const file of files) {
        if (file.endsWith(".json")) {
          const data = await fs.readFile(path.join(CHARACTERS_DIR, file), "utf-8");
          characters.push(JSON.parse(data));
        }
      }
      res.json(characters);
    } catch (error) {
      res.json([]);
    }
  });

  app.post("/api/characters", async (req, res) => {
    const character = req.body;
    if (!character.id) return res.status(400).json({ error: "Missing id" });
    try {
      await fs.writeFile(path.join(CHARACTERS_DIR, `${character.id}.json`), JSON.stringify(character, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save character" });
    }
  });

  app.delete("/api/characters/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await fs.unlink(path.join(CHARACTERS_DIR, `${id}.json`));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete character" });
    }
  });

  // Storage APIs only - Gemini is handle on the frontend as per skill instructions
  app.get("/api/learned", async (req, res) => {
    try {
      const files = await fs.readdir(KNOWLEDGE_DIR);
      const learnedIds = files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
      
      const discoveries: Record<string, string> = {};
      for (const id of learnedIds) {
        try {
          const data = await fs.readFile(path.join(KNOWLEDGE_DIR, `${id}.json`), "utf-8");
          const json = JSON.parse(data);
          if (json.discovery) discoveries[id] = json.discovery;
        } catch {}
      }
      
      res.json({ learnedIds, discoveries });
    } catch (error) {
      res.json({ learnedIds: [], discoveries: {} });
    }
  });

  app.get("/api/research-check/:realmId", async (req, res) => {
    const { realmId } = req.params;
    const jsonPath = path.join(KNOWLEDGE_DIR, `${realmId}.json`);
    try {
      await fs.access(jsonPath);
      const data = await fs.readFile(jsonPath, "utf-8");
      res.json(JSON.parse(data));
    } catch {
      res.status(404).json({ error: "Not found" });
    }
  });

  app.post("/api/save-research/:realmId", async (req, res) => {
    const { realmId } = req.params;
    const { researchData, realmName } = req.body;
    const jsonPath = path.join(KNOWLEDGE_DIR, `${realmId}.json`);
    const mdPath = path.join(KNOWLEDGE_DIR, `${realmId}.md`);

    try {
      await fs.writeFile(jsonPath, JSON.stringify(researchData, null, 2));

      // Save to MD for "Memory"
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
        if (section.items && section.items.length > 0) {
          mdContent += `## ${section.title}\n`;
          section.items.forEach((item: any) => {
            mdContent += `### ${item.name}\n${item.description}\n\n`;
          });
        }
      });

      await fs.writeFile(mdPath, mdContent);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save research" });
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
