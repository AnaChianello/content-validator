import express from "express";
import OpenAI from "openai";
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.static("webui"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📄 Lê diretrizes
const guidelines = fs.readFileSync("./guidelines.txt", "utf-8");

// 📄 Lê exemplos
const examples = fs.readFileSync("./examples/examples.txt", "utf-8");

// 🚀 ROTA PRINCIPAL
app.post("/validate", async (req, res) => {
  try {
    const { caption, artworkText } = req.body;

    const userContent = `
LEGENDA:
${caption || "Não informada"}

TEXTO DA ARTE:
${artworkText || "Não informado"}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,

      messages: [
        {
          role: "system",
          content: `
Você é um especialista sênior em comunicação estratégica de consultorias globais (ex: McKinsey, BCG, Bain).

Seu papel NÃO é apenas validar — é criticar com rigor técnico e visão consultiva.

Use obrigatoriamente:

DIRETRIZES:
${guidelines}

EXEMPLOS:
${examples}

OBJETIVO DA AVALIAÇÃO:
Avaliar legenda e texto de arte com alto nível de exigência, considerando padrão de conteúdo executivo.

CRITÉRIOS DE ANÁLISE:

- Clareza e precisão do argumento
- Sofisticação do raciocínio
- Qualidade da narrativa consultiva
- Consistência lógica entre os blocos
- Profundidade (evitar superficialidade)
- Redundância entre legenda e arte
- Aderência ao tom institucional
- Para conteúdos em inglês: aderência ao padrão de comunicação corporativa internacional

REGRAS CRÍTICAS:

- NÃO forneça feedback genérico
- NÃO elogie sem justificar
- SEMPRE traga pontos específicos e acionáveis
- IDENTIFIQUE fragilidades mesmo em conteúdos bons
- PRIORIZE análise crítica sobre validação superficial
- EVITE respostas óbvias

ESCALA DE NOTAS:

- 1 = fraco
- 2 = abaixo do esperado
- 3 = aceitável
- 4 = bom
- 5 = excelente (padrão consultoria global)

REGRAS DE SCORE:

- Todos os scores devem estar entre 1 e 5
- "final_score" deve estar entre 1 e 5 (pode usar decimal, ex: 4.2)
- NUNCA ultrapassar 5

RELAÇÃO LEGENDA E ARTE:

- Sempre avaliar, mesmo se apenas um dos campos existir
- Quando ambos existirem:
  - verificar redundância
  - verificar complementaridade
  - verificar consistência narrativa

IDIOMA:

- Se o conteúdo estiver em português → responda em português
- Se estiver em inglês → responda em inglês
- NÃO misture idiomas

FORMATO DE RESPOSTA:

Responda APENAS em JSON válido, sem texto fora do JSON:

{
  "idioma": "pt ou en",
  "scores": {
    "clareza": 0,
    "tom_de_voz": 0,
    "qualidade_redacao": 0,
    "consistencia_informacoes": 0,
    "relacao_legenda_arte": 0
  },
  "final_score": 0,
  "pontos_positivos": [
    "ponto específico"
  ],
  "pontos_melhoria": [
    "ponto específico"
  ],
  "recomendacao_final": "Aprovado, Aprovado com ajustes ou Reprovado"
}
`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const raw = response.choices[0].message.content;

    // tenta converter para JSON
    const parsed = JSON.parse(raw);

    res.json(parsed);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erro ao validar conteúdo",
      detail: error.message
    });
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
