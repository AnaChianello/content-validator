const express = require("express");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/**
 * Load guidelines from file
 */
function loadGuidelines() {
  try {
    return fs.readFileSync(path.join(__dirname, "guidelines.txt"), "utf-8");
  } catch (error) {
    console.error("Erro ao ler guidelines.txt:", error.message);
    return "Diretrizes não encontradas.";
  }
}

/**
 * Reference examples (curated)
 */
const examples = `
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

---

4.
Legenda:
A aplicação prática da IA na mineração transforma desafios operacionais em ganhos mensuráveis de eficiência.

Arte:
Impacto da IA na mineração

---

5.
Legenda:
A democratização da IA exige infraestrutura robusta, governança de dados e integração entre tecnologia e estratégia.

Arte:
Infraestrutura de IA em escala

---

6.
Legenda:
Modelos de inteligência prescritiva permitem decisões operacionais mais eficientes e baseadas em múltiplas variáveis.

Arte:
IA aplicada à eficiência operacional

---

7.
Legenda:
A integração entre dados e operação permite transformar insights analíticos em decisões em tempo real.

Arte:
Data-driven operations

---

8.
Legenda:
A consistência e rastreabilidade dos dados são essenciais para garantir transparência regulatória.

Arte:
Qualidade e rastreabilidade da informação

---

9.
Legenda:
A liderança feminina fortalece a transformação organizacional ao ampliar diversidade e inovação.

Arte:
Vozes Femininas

---

10.
Legenda:
A escalada geopolítica reforça a importância da gestão de risco energético e previsibilidade logística.

Arte:
Impactos geopolíticos no petróleo
`;

/**
 * Home route
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * Validation route
 */
app.post("/validate", async (req, res) => {
  const { caption, artworkText, text } = req.body;

  const finalCaption = (caption || text || "").trim();
  const finalArtworkText = (artworkText || "").trim();

  if (!finalCaption && !finalArtworkText) {
    return res.status(400).json({
      error: "Envie pelo menos uma legenda ou um texto de arte."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada."
    });
  }

  const guidelines = loadGuidelines();

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const userContent = `
Analise o conteúdo abaixo:

LEGENDA:
${finalCaption || "Não informada"}

TEXTO DA ARTE:
${finalArtworkText || "Não informado"}
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Você é um especialista em validação de conteúdo institucional de consultoria.

Use obrigatoriamente:

DIRETRIZES:
${guidelines}

EXEMPLOS:
${examples}

Avalie o conteúdo considerando:
- clareza
- tom institucional e consultivo
- qualidade da redação
- consistência das informações
- relação entre legenda e arte

Responda apenas em JSON válido no formato:

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
  "pontos_positivos": [],
  "pontos_melhoria": [],
  "recomendacao_final": ""
}
`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const aiText = response.choices[0].message.content;

    let parsed;

    try {
      parsed = JSON.parse(aiText);
    } catch (parseError) {
      console.error("Erro ao fazer parse do JSON:", aiText);

      return res.status(500).json({
        error: "Erro ao interpretar resposta da IA.",
        raw: aiText
      });
    }

    res.json(parsed);

  } catch (error) {
    console.error("Erro na validação:", error);

    res.status(500).json({
      error: error.message || "Erro interno na validação."
    });
  }
});

/**
 * Start server
 */
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
