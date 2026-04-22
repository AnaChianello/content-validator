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

function ensureString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  return cleaned || fallback;
}

function ensureFeedbackArray(arr, type) {
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      if (type === "positive") {
        return {
          tipo: ensureString(item.tipo, "legenda"),
          trecho: ensureString(item.trecho, "Trecho não informado."),
          motivo: ensureString(item.motivo, "Sem motivo informado.")
        };
      }

      return {
        tipo: ensureString(item.tipo, "legenda"),
        trecho: ensureString(item.trecho, "Trecho não informado."),
        problema: ensureString(item.problema, "Sem problema informado."),
        sugestao: ensureString(item.sugestao, "Sem sugestão específica.")
      };
    })
    .filter((item) => {
      if (type === "positive") {
        return item.trecho !== "Trecho não informado." || item.motivo !== "Sem motivo informado.";
      }

      return (
        item.trecho !== "Trecho não informado." ||
        item.problema !== "Sem problema informado." ||
        item.sugestao !== "Sem sugestão específica."
      );
    });
}

function getRecommendationFromScore(score) {
  if (score === null) return "Sem avaliação";
  if (score >= 4.5) return "Aprovado";
  if (score >= 3.5) return "Aprovado com ajustes";
  return "Reprovado";
}

function normalizeRecommendation(value, fallbackScore = null) {
  const normalized = ensureString(value, "").toLowerCase();

  if (normalized === "aprovado") return "Aprovado";
  if (normalized === "aprovado com ajustes") return "Aprovado com ajustes";
  if (normalized === "reprovado") return "Reprovado";

  return getRecommendationFromScore(fallbackScore);
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

Sua função é avaliar conteúdos de social media, incluindo legenda e texto de arte, com rigor profissional, como uma revisora experiente. Sua análise deve considerar padrão institucional, clareza, profundidade, aderência à marca e utilidade real do conteúdo.

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
- Priorize clareza, precisão, consistência e profundidade
- Não invente fatos
- Considere contexto, tipo de conteúdo e business unit antes de avaliar
- Avalie se a profundidade faz sentido para o contexto informado
- Avalie se o tom está adequado ao tipo de conteúdo informado
- Avalie se o repertório e a linguagem estão adequados à business unit, quando informada
- Responda no idioma predominante do conteúdo
- Evite feedback genérico e superficial
- Não dê nota alta para conteúdo apenas razoável
- Diferencie problemas pontuais de problemas estruturais

SE O CONTEÚDO ESTIVER EM INGLÊS
- Use padrão corporativo global
- Seja direto e conciso
- Evite linguagem genérica
- Garanta naturalidade de nativo
- Avalie também se há construções que soam traduzidas ou pouco naturais

DIRETRIZES:
${guidelines}

EXEMPLOS BONS:
${goodExamples}

EXEMPLOS RUINS:
${badExamples}

CLASSIFICAÇÃO CONCEITUAL
Use seu julgamento para enquadrar o conteúdo como:
- Aprovado
- Aprovado com ajustes
- Reprovado

CRITÉRIOS DE REPROVAÇÃO AUTOMÁTICA
Considere o conteúdo como reprovado quando houver qualquer um dos itens abaixo:
- texto genérico ou superficial
- ausência de ponto de vista claro
- falta de valor prático ou insight
- uso de clichês corporativos, como "soluções inovadoras", "crescer no mercado" ou equivalentes
- conteúdo que poderia ser de qualquer empresa
- baixa densidade técnica
- baixa aderência ao padrão institucional da BIP
- uso de dados, estudos, percentuais, estatísticas ou pesquisas sem fonte explícita
- uso recorrente de linguagem vazia, como "estratégico", "estratégica", "estratégicos", "estratégicas"
- repetição excessiva entre legenda e arte
- erros relevantes de redação, coerência ou fluidez
- tom inadequado ao contexto ou ao tipo de conteúdo

REGRAS ESPECÍFICAS
FONTES:
- Sempre que houver dados, estatísticas, percentuais, estudos, pesquisas, relatórios ou afirmações quantitativas, a fonte deve estar explicitamente indicada na legenda ou na arte
- Menções genéricas como "segundo estudos" ou "pesquisas mostram" não são suficientes
- Se houver uso de dado sem fonte, trate como problema crítico

USO DE "ESTRATÉGICO":
- Evitar o uso de estratégico, estratégica, estratégicos e estratégicas
- Se o termo for usado de forma genérica ou vazia, penalize fortemente
- Se aparecer de forma recorrente, trate como problema relevante
- Prefira linguagem concreta, específica e orientada a ação ou impacto real

CRITÉRIOS DE AVALIAÇÃO
Use escala de 1 a 5 para cada critério:
- clareza
- tom_de_voz
- qualidade_redacao
- alinhamento_marca
- relacao_legenda_arte

REGRAS DOS CRITÉRIOS
- Não penalize relacao_legenda_arte se não houver texto de arte
- Em relacao_legenda_arte, avalie se há complementaridade real ou apenas repetição
- Em alinhamento_marca, considere aderência ao padrão BIP, linguagem executiva, profundidade e diferenciação
- Em qualidade_redacao, considere fluidez, construção de frases, concisão, precisão e naturalidade
- Em tom_de_voz, considere institucionalidade, sofisticação e adequação ao público
- Em clareza, considere facilidade de entendimento, progressão lógica e objetividade

CALIBRAÇÃO DE NOTA FINAL
- 5.0 = excelente, padrão consultoria global, sem fragilidades relevantes
- 4.5 a 4.9 = muito forte, com ajustes mínimos
- 3.8 a 4.4 = bom, mas com melhorias relevantes antes da publicação
- 3.0 a 3.7 = aceitável, porém genérico, redundante, pouco sofisticado ou inconsistente em partes
- 2.0 a 2.9 = fraco, com problemas importantes de clareza, profundidade, originalidade, fonte ou aderência à marca
- 1.0 a 1.9 = inadequado, com falhas críticas

REGRAS DE NOTA FINAL
- A nota final sugerida NÃO deve ser a média automática dos critérios
- A nota final deve refletir julgamento crítico global
- Use toda a escala de forma proporcional
- Evite concentrar notas entre 4.0 e 4.5
- Se houver problema crítico, a nota final deve cair de forma relevante
- Se o conteúdo tiver boa superfície, mas pouca substância, a nota deve refletir essa limitação
- Se o conteúdo estiver apenas ok, a nota final sugerida não deve ficar acima de 4.0
- Se o conteúdo for conceitualmente reprovado, a gravidade geral deve ser alta
- Se o conteúdo for conceitualmente reprovado, a nota final sugerida deve ficar em no máximo 3.0

GRAVIDADE GERAL
Classifique a gravidade geral como:
- leve
- moderada
- alta

Regra:
- leve = ajustes pontuais, sem comprometer a publicação
- moderada = melhorias relevantes antes da publicação
- alta = falhas estruturais, necessidade de reescrita ou reprovação

REGRAS DE FEEDBACK
- Sempre que apontar um ponto positivo ou de melhoria, indique o trecho exato a que você está se referindo
- O trecho pode vir da legenda ou do texto da arte
- Diferencie se o comentário se refere à legenda ou à arte usando o campo "tipo"
- Não faça comentários vagos sem apontar onde eles se aplicam
- Se o problema for geral, associe-o ao trecho mais representativo
- Seja específico, acionável e objetivo
- A quantidade de comentários deve variar de acordo com a qualidade e a complexidade do conteúdo
- Traga apenas os pontos positivos realmente relevantes
- Traga apenas os pontos de melhoria realmente relevantes
- Sempre sugerir reescrita nos pontos de melhoria, de forma prática
- Evite repetir o mesmo comentário com palavras diferentes

FORMATO JSON OBRIGATÓRIO

Retorne apenas um JSON válido, sem texto antes ou depois, no formato:

{
  "idioma": "pt ou en",
  "scores": {
    "clareza": 0,
    "tom_de_voz": 0,
    "qualidade_redacao": 0,
    "alinhamento_marca": 0,
    "relacao_legenda_arte": 0
  },
  "nota_final_sugerida": 0,
  "gravidade_geral": "leve | moderada | alta",
  "pontos_positivos": [
    {
      "tipo": "legenda ou arte",
      "trecho": "trecho exato",
      "motivo": "explicação específica"
    }
  ],
  "pontos_melhoria": [
    {
      "tipo": "legenda ou arte",
      "trecho": "trecho exato",
      "problema": "explicação específica",
      "sugestao": "ajuste recomendado"
    }
  ],
  "recomendacao_final": "Aprovado | Aprovado com ajustes | Reprovado",
  "sugestao_reescrita": "string"
}

INSTRUÇÕES FINAIS
- Seja rigoroso
- Não aprove conteúdos medianos
- Não trate problema estrutural como ajuste pontual
- Priorize profundidade, clareza, precisão e aderência à marca
- Quando houver reprovação conceitual, isso deve aparecer coerentemente na nota, na gravidade e na recomendação final
- Quando houver uso de dados sem fonte, trate como falha crítica
- Quando houver linguagem genérica demais, derrube a nota de forma relevante
- Quando houver repetição excessiva entre legenda e arte, aponte isso explicitamente
- Quando a legenda ou a arte estiverem boas, explique exatamente por quê
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

    const pontosPositivos = ensureFeedbackArray(parsed.pontos_positivos, "positive");
    const pontosMelhoria = ensureFeedbackArray(parsed.pontos_melhoria, "improvement");

    const recomendacaoFinal = normalizeRecommendation(
      parsed.recomendacao_final,
      finalScore
    );

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
      recomendacao_final: recomendacaoFinal,
      sugestao_reescrita: ensureString(parsed.sugestao_reescrita, "Sem sugestão")
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
