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

const guidelines = readTextFile(
  "guidelines.txt",
  "Sem diretrizes adicionais."
);

const examples = readTextFile(
  path.join("data", "good-examples.txt"),
  ""
);

function normalizeScore(value) {
  if (value === null || value === undefined || value === "") return null;

  const num = Number(value);

  if (Number.isNaN(num)) return null;
  if (num < 1) return 1;
  if (num > 5) return 5;

  return Math.round(num * 10) / 10;
}

function calculateFinalScore(scores) {
  const validScores = Object.values(scores).filter(
    (value) => value !== null && value !== undefined && !Number.isNaN(value)
  );

  if (validScores.length === 0) return null;

  const sum = validScores.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / validScores.length) * 10) / 10;
}

function getRecommendation(finalScore) {
  if (finalScore === null) return "Ajustar manualmente";
  if (finalScore >= 4.5) return "Aprovado";
  if (finalScore >= 3.5) return "Aprovado com ajustes";
  return "Reprovado";
}

function ensureArray(value, fallback) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", async (req, res) => {
  try {
    const { caption, visualText, artworkText } = req.body;

    const finalCaption = (caption || "").trim();
    const finalVisualText = (visualText || artworkText || "").trim();

    if (!finalCaption && !finalVisualText) {
      return res.status(400).json({
        error: "Envie pelo menos uma legenda ou um texto de arte."
      });
    }

    const prompt = `
Você é um especialista sênior em validação de conteúdo para uma consultoria de negócios.

Sua função é avaliar com rigor conteúdos de social media da BIP.
Você não deve ser genérico.
Você deve agir como uma revisora sênior de conteúdo institucional e consultivo.

CONTEÚDO RECEBIDO

Legenda:
${finalCaption || "Não informada"}

Texto da arte:
${finalVisualText || "Não informado"}

DIRETRIZES DA MARCA
${guidelines}

EXEMPLOS DE REFERÊNCIA
${examples || "Sem exemplos adicionais."}

REGRAS DE AVALIAÇÃO

1. Seja rigoroso, mas justo.
2. Não elogie sem justificar.
3. Sempre aponte pontos específicos.
4. Mesmo textos bons devem receber ao menos um refinamento útil.
5. Se o texto da arte não existir, não penalize a relação entre legenda e arte.
6. Se o conteúdo estiver em inglês, responda em inglês.
7. Se o conteúdo estiver em português, responda em português.
8. Não misture idiomas.
9. Não invente fatos.
10. Responda apenas em JSON válido.

CRITÉRIOS
- clareza
- tom_de_voz
- qualidade_redacao
- alinhamento_marca
- relacao_legenda_arte

ESCALA
1 = fraco
2 = abaixo do esperado
3 = aceitável
4 = bom
5 = excelente

REGRAS DE PREENCHIMENTO
- Todos os scores devem ir de 1 a 5
- relacao_legenda_arte deve ser null se não houver texto da arte
- Não calcule a nota final somando critérios
- Traga pelo menos 2 pontos positivos, se houver
- Traga pelo menos 2 pontos de melhoria, se houver
- Sempre traga uma sugestão de reescrita da legenda
- A sugestão de reescrita pode manter a essência original, mas deve elevar a qualidade

FORMATO OBRIGATÓRIO DE RESPOSTA

{
  "idioma": "pt ou en",
  "scores": {
    "clareza": 0,
    "tom_de_voz": 0,
    "qualidade_redacao": 0,
    "alinhamento_marca": 0,
    "relacao_legenda_arte": 0
  },
  "pontos_positivos": [
    "..."
  ],
  "pontos_melhoria": [
    "..."
  ],
  "sugestao_reescrita": "..."
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const rawOutput = response.choices[0].message.content;
    const parsed = JSON.parse(rawOutput);

    const normalizedScores = {
      clareza: normalizeScore(parsed?.scores?.clareza),
      tom_de_voz: normalizeScore(parsed?.scores?.tom_de_voz),
      qualidade_redacao: normalizeScore(parsed?.scores?.qualidade_redacao),
      alinhamento_marca: normalizeScore(parsed?.scores?.alinhamento_marca),
      relacao_legenda_arte: finalVisualText
        ? normalizeScore(parsed?.scores?.relacao_legenda_arte)
        : null
    };

    const finalScore = calculateFinalScore(normalizedScores);

    const output = {
      idioma: parsed?.idioma || "pt",
      final_score: finalScore,
      scores: normalizedScores,
      pontos_positivos: ensureArray(parsed?.pontos_positivos, [
        "Nenhum ponto positivo específico foi informado."
      ]),
      pontos_melhoria: ensureArray(parsed?.pontos_melhoria, [
        "Nenhum ponto de melhoria específico foi informado."
      ]),
      recomendacao_final: getRecommendation(finalScore),
      sugestao_reescrita:
        typeof parsed?.sugestao_reescrita === "string" &&
        parsed.sugestao_reescrita.trim() !== ""
          ? parsed.sugestao_reescrita.trim()
          : "Nenhuma sugestão de reescrita foi informada."
    };

    res.json(output);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erro ao validar conteúdo",
      detail: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
