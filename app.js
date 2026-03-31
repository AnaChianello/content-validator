import express from "express";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function readTextFile(filename, fallback = "") {
  try {
    return fs.readFileSync(path.join(__dirname, filename), "utf-8");
  } catch (error) {
    console.error(`Erro ao ler ${filename}:`, error.message);
    return fallback;
  }
}

const guidelines = readTextFile("guidelines.txt", "Diretrizes não encontradas.");

const examples = readTextFile(
  "examples.txt",
  `
EXEMPLOS DE REFERÊNCIA (ESTILO ESPERADO)

1.
Legenda:
A formalização de uma Política de Qualidade da Informação é um dos pilares centrais da RC 18/2025.

Arte:
Requisitos mínimos da Política de Qualidade da Informação

---

2.
Legenda:
O Brasil ocupa uma posição singular na crise energética global ao combinar reservas offshore competitivas com estabilidade institucional.

Arte:
O Brasil como eixo de estabilidade energética global

---

3.
Legenda:
A governança de dados fortalece a conformidade regulatória e a tomada de decisão baseada em evidências auditáveis.

Arte:
Pilares da governança de dados
`
);

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
Você é um especialista sênior em comunicação estratégica de consultorias globais.

Seu papel NÃO é apenas validar, mas criticar com rigor técnico e visão consultiva.

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
- Profundidade
- Redundância entre legenda e arte
- Aderência ao tom institucional
- Para conteúdos em inglês, aderência ao padrão de comunicação corporativa internacional

REGRAS CRÍTICAS:
- Não forneça feedback genérico
- Não elogie sem justificar
- Sempre traga pontos específicos e acionáveis
- Identifique fragilidades mesmo em conteúdos bons
- Priorize análise crítica sobre validação superficial
- Evite respostas óbvias

ESCALA DE NOTAS:
- 1 = fraco
- 2 = abaixo do esperado
- 3 = aceitável
- 4 = bom
- 5 = excelente, padrão consultoria global

REGRAS DE SCORE:
- Todos os scores devem estar entre 1 e 5
- final_score deve estar entre 1 e 5, podendo usar decimal
- Nunca ultrapassar 5

IDIOMA:
- Se o conteúdo estiver em português, responda em português
- Se estiver em inglês, responda em inglês
- Não misture idiomas

FORMATO DE RESPOSTA:
Responda apenas em JSON válido:

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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
