import express from "express";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function readTextFile(relativePath, fallback = "") {
  try {
    return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
  } catch (error) {
    console.log(`Arquivo não encontrado: ${relativePath}`);
    return fallback;
  }
}

const guidelines = readTextFile("guidelines.txt", "Sem diretrizes.");
const examples = readTextFile(path.join("data", "good-examples.txt"), "");

function normalizeScore(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.min(5, Math.max(1, Math.round(num * 10) / 10));
}

function calculateFinalScore(scores) {
  const valid = Object.values(scores).filter(v => v !== null);
  if (valid.length === 0) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.round(avg * 10) / 10;
}

function getRecommendation(score) {
  if (score >= 4.5) return "Aprovado";
  if (score >= 3.5) return "Aprovado com ajustes";
  return "Reprovado";
}

function ensureArray(arr, fallback) {
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  return arr;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", async (req, res) => {
  try {
    const { caption, artworkText, visualText } = req.body;

    const finalCaption = (caption || "").trim();
    const finalVisualText = (artworkText || visualText || "").trim();

    const prompt = `
Você é um especialista sênior em validação de conteúdo para uma consultoria global (BIP).

Sua função é avaliar conteúdos de social media (legenda e texto de arte) com rigor profissional, como uma revisora experiente.

---

Legenda:
${finalCaption || "Não informada"}

Texto da arte:
${finalVisualText || "Não informado"}

---

PRINCÍPIOS:
- Seja rigoroso, mas justo
- Não elogie genericamente
- Sempre justifique observações
- Priorize clareza, precisão e consistência
- Não invente fatos
- Responda no idioma do conteúdo

---

SE FOR INGLÊS:
- Use padrão corporativo global
- Seja direto e conciso
- Evite linguagem genérica
- Garanta naturalidade de nativo

---

DIRETRIZES:
${guidelines}

EXEMPLOS:
${examples}

---

CRITÉRIOS:
- clareza
- tom_de_voz
- qualidade_redacao
- alinhamento_marca
- relacao_legenda_arte

---

REGRAS:
- Use escala de 1 a 5
- Não penalize relação se não houver arte
- Sempre trazer pontos positivos e melhorias
- Sempre sugerir reescrita

---

FORMATO JSON:

{
  "idioma": "pt ou en",
  "scores": {
    "clareza": number,
    "tom_de_voz": number,
    "qualidade_redacao": number,
    "alinhamento_marca": number,
    "relacao_legenda_arte": number ou null
  },
  "pontos_positivos": [],
  "pontos_melhoria": [],
  "recomendacao_final": "",
  "sugestao_reescrita": ""
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    });

    const parsed = JSON.parse(response.choices[0].message.content);

    const scores = {
      clareza: normalizeScore(parsed.scores?.clareza),
      tom_de_voz: normalizeScore(parsed.scores?.tom_de_voz),
      qualidade_redacao: normalizeScore(parsed.scores?.qualidade_redacao),
      alinhamento_marca: normalizeScore(parsed.scores?.alinhamento_marca),
      relacao_legenda_arte: finalVisualText
        ? normalizeScore(parsed.scores?.relacao_legenda_arte)
        : null
    };

    const finalScore = calculateFinalScore(scores);

    res.json({
      idioma: parsed.idioma || "pt",
      final_score: finalScore,
      scores,
      pontos_positivos: ensureArray(parsed.pontos_positivos, ["Sem pontos positivos claros."]),
      pontos_melhoria: ensureArray(parsed.pontos_melhoria, ["Sem melhorias claras."]),
      recomendacao_final: getRecommendation(finalScore),
      sugestao_reescrita: parsed.sugestao_reescrita || "Sem sugestão"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro na validação" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
