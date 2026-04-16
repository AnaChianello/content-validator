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

const validationConfig = {
  input_schema: {
    caption: "",
    artworkText: "",
    visualText: "",
    context: "",
    contentType: "",
    businessUnit: ""
  },

  content_types: {
    institucional: {
      descricao:
        "Conteúdo voltado para posicionamento da marca, reputação, presença institucional, cultura, eventos, conquistas e fortalecimento de imagem.",
      tom_esperado: "institucional, claro, executivo, confiável"
    },
    tecnico: {
      descricao:
        "Conteúdo voltado para demonstrar conhecimento técnico, visão de mercado, capacidade analítica e experiência setorial.",
      tom_esperado: "técnico, consultivo, objetivo e analítico"
    }
  },

  business_units: {
    "Oil & Gas": {
      descricao:
        "Atuação em upstream, downstream, midstream, logística, eficiência operacional e transformação no setor de óleo e gás.",
      tom: "técnico, setorial, objetivo e orientado à operação"
    },
    "Retail & CG": {
      descricao:
        "Atuação em varejo e consumer goods, com foco em transformação comercial, experiência do cliente, eficiência e crescimento.",
      tom: "consultivo, dinâmico, claro e orientado a negócio"
    },
    "Financial Services": {
      descricao:
        "Atuação em bancos, pagamentos, seguros, risco, compliance e transformação no setor financeiro.",
      tom: "técnico, confiável, consultivo e executivo"
    },
    "Mineração": {
      descricao:
        "Atuação no setor de mineração com foco em eficiência, transformação operacional, sustentabilidade e geração de valor.",
      tom: "técnico, analítico, setorial e orientado a performance"
    },
    "Telco & Media": {
      descricao:
        "Atuação em telecomunicações e mídia, apoiando transformação, inovação, eficiência operacional e evolução dos modelos de negócio.",
      tom: "consultivo, técnico, atual e orientado à transformação"
    },
    "Energy & Utilities": {
      descricao:
        "Atuação em energia e utilities, com foco em geração, distribuição, comercialização, regulação e sustentabilidade.",
      tom: "técnico, regulatório, claro e orientado à operação"
    },
    "Life Sciences": {
      descricao:
        "Atuação em life sciences, da estratégia à execução em ambientes regulados.",
      tom: "técnico, preciso, consultivo e orientado à conformidade"
    },
    "Agronegócio": {
      descricao:
        "Atuação no agronegócio, conectando produção, eficiência, cadeia de valor e posicionamento global.",
      tom: "consultivo, setorial, claro e orientado a impacto de negócio"
    },
    "Indústria 5.0": {
      descricao:
        "Atuação em manufatura competitiva com inteligência tecnológica, eficiência operacional e transformação industrial.",
      tom: "técnico, analítico, moderno e orientado a performance"
    },
    Sustainability: {
      descricao:
        "Atuação em sustentabilidade, ESG, descarbonização, transição energética e geração de valor de longo prazo.",
      tom: "consultivo, claro, técnico e orientado a impacto"
    },
    xTech: {
      descricao:
        "Atuação em tecnologia, dados, inteligência artificial, integração tecnológica e transformação digital.",
      tom: "técnico, atual, consultivo e orientado a negócio"
    }
  }
};

function readTextFile(relativePath, fallback = "") {
  try {
    return fs.readFileSync(path.join(__dirname, relativePath), "utf-8");
  } catch (error) {
    console.log(`Arquivo não encontrado: ${relativePath}`);
    return fallback;
  }
}

const guidelines = readTextFile("guidelines.txt", "Sem diretrizes.");
const goodExamples = readTextFile(path.join("data", "good-examples.txt"), "");
const badExamples = readTextFile(path.join("data", "bad-examples.txt"), "");

function normalizeScore(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.min(5, Math.max(1, Math.round(num * 10) / 10));
}

function ensureArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => String(item).trim()).filter(Boolean);
}

function getRecommendationFromScore(score) {
  if (score === null) return "Sem avaliação";
  if (score >= 4.5) return "Aprovado";
  if (score >= 3.5) return "Aprovado com ajustes";
  return "Reprovado";
}

function normalizeSeverity(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (
    normalized === "alta" ||
    normalized === "high" ||
    normalized === "crítica" ||
    normalized === "critica"
  ) {
    return "alta";
  }

  if (
    normalized === "moderada" ||
    normalized === "medium" ||
    normalized === "média" ||
    normalized === "media"
  ) {
    return "moderada";
  }

  return "leve";
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", async (req, res) => {
  try {
    const {
      caption,
      artworkText,
      visualText,
      context,
      contentType,
      businessUnit
    } = req.body;

    const finalCaption = (caption || "").trim();
    const finalVisualText = (artworkText || visualText || "").trim();
    const finalContext = (context || "").trim();
    const finalContentType = (contentType || "").trim();
    const finalBusinessUnit = (businessUnit || "").trim();

    if (!finalCaption && !finalVisualText) {
      return res.status(400).json({
        error: "Envie pelo menos uma legenda ou um texto de arte."
      });
    }

    const selectedContentType =
      validationConfig.content_types[finalContentType] || null;

    const selectedBU =
      validationConfig.business_units[finalBusinessUnit] || null;

    const prompt = `
Você é um especialista sênior em validação de conteúdo para uma consultoria global, a BIP.

Sua função é avaliar conteúdos de social media, legenda e texto de arte, com rigor profissional, como uma revisora experiente.

ENTRADAS DO USUÁRIO

Legenda:
${finalCaption || "Não informada"}

Texto da arte:
${finalVisualText || "Não informado"}

Contexto do conteúdo:
${finalContext || "Não informado"}

Tipo de conteúdo:
${finalContentType || "Não informado"}

Detalhes do tipo de conteúdo:
${selectedContentType ? JSON.stringify(selectedContentType, null, 2) : "Não informado"}

Business Unit:
${finalBusinessUnit || "Não informada"}

Detalhes da Business Unit:
${selectedBU ? JSON.stringify(selectedBU, null, 2) : "Não informado"}

PRINCÍPIOS DE AVALIAÇÃO
- Seja rigoroso, mas justo
- Não elogie genericamente
- Sempre justifique observações
- Priorize clareza, precisão e consistência
- Não invente fatos
- Considere contexto, tipo de conteúdo e business unit antes de avaliar
- Responda no idioma predominante do conteúdo
- Evite feedback genérico e superficial
- Não dê nota alta para conteúdo apenas razoável

SE O CONTEÚDO ESTIVER EM INGLÊS
- Use padrão corporativo global
- Seja direto e conciso
- Evite linguagem genérica
- Garanta naturalidade de nativo

DIRETRIZES:
${guidelines}

EXEMPLOS BONS:
${goodExamples}

EXEMPLOS RUINS:
${badExamples}

CRITÉRIOS
- clareza
- tom_de_voz
- qualidade_redacao
- alinhamento_marca
- relacao_legenda_arte

CALIBRAÇÃO DE NOTA FINAL
- 5.0 = excelente, padrão consultoria global, sem fragilidades relevantes
- 4.5 a 4.9 = muito forte, com ajustes mínimos
- 3.8 a 4.4 = bom, mas com melhorias relevantes antes da publicação
- 3.0 a 3.7 = aceitável, porém genérico, redundante, pouco sofisticado ou inconsistente em partes
- 2.0 a 2.9 = fraco, com problemas importantes de clareza, profundidade ou aderência à marca
- 1.0 a 1.9 = inadequado, com falhas críticas

GRAVIDADE GERAL
Classifique a gravidade geral como:
- leve
- moderada
- alta

REGRAS
- Use escala de 1 a 5 para cada critério
- Não penalize relacao_legenda_arte se não houver texto de arte
- Traga apenas os pontos positivos realmente relevantes
- Traga apenas os pontos de melhoria realmente relevantes
- A quantidade de comentários deve variar de acordo com a qualidade e complexidade do conteúdo
- Sempre sugerir reescrita
- Avalie se a profundidade faz sentido para o contexto informado
- Avalie se o tom está adequado ao tipo de conteúdo informado
- Avalie se o repertório e a linguagem estão adequados à business unit, quando informada
- A nota final sugerida NÃO deve ser a média automática dos critérios. Ela deve refletir julgamento crítico global.
- Se houver problema crítico, a nota final sugerida deve cair de forma relevante.
- Se o conteúdo estiver apenas “ok”, a nota final sugerida não deve ficar acima de 4.0.

FORMATO JSON OBRIGATÓRIO

{
  "idioma": "pt ou en",
  "scores": {
    "clareza": number,
    "tom_de_voz": number,
    "qualidade_redacao": number,
    "alinhamento_marca": number,
    "relacao_legenda_arte": number ou null
  },
  "nota_final_sugerida": number,
  "gravidade_geral": "leve | moderada | alta",
  "pontos_positivos": ["string"],
  "pontos_melhoria": ["string"],
  "recomendacao_final": "string",
  "sugestao_reescrita": "string"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    });

    const content = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const scores = {
      clareza: normalizeScore(parsed.scores?.clareza),
      tom_de_voz: normalizeScore(parsed.scores?.tom_de_voz),
      qualidade_redacao: normalizeScore(parsed.scores?.qualidade_redacao),
      alinhamento_marca: normalizeScore(parsed.scores?.alinhamento_marca),
      relacao_legenda_arte: finalVisualText
        ? normalizeScore(parsed.scores?.relacao_legenda_arte)
        : null
    };

    let finalScore = normalizeScore(parsed.nota_final_sugerida);

    if (finalScore === null) {
      const valid = Object.values(scores).filter((v) => v !== null);
      if (valid.length > 0) {
        finalScore =
          Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
      }
    }

    const gravidadeGeral = normalizeSeverity(parsed.gravidade_geral);

    if (gravidadeGeral === "alta" && finalScore !== null && finalScore > 2.9) {
      finalScore = 2.9;
    }

    if (gravidadeGeral === "moderada" && finalScore !== null && finalScore > 4.2) {
      finalScore = 4.2;
    }

    const pontosPositivos = ensureArray(parsed.pontos_positivos);
    const pontosMelhoria = ensureArray(parsed.pontos_melhoria);

    res.json({
      idioma: parsed.idioma || "pt",
      final_score: finalScore,
      gravidade_geral: gravidadeGeral,
      scores,
      contexto_recebido: finalContext || null,
      tipo_conteudo_recebido: finalContentType || null,
      business_unit_recebida: finalBusinessUnit || null,
      pontos_positivos: pontosPositivos,
      pontos_melhoria: pontosMelhoria,
      recomendacao_final: getRecommendationFromScore(finalScore),
      sugestao_reescrita: parsed.sugestao_reescrita || "Sem sugestão"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro na validação",
      detail: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
