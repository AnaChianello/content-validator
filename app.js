const express = require("express");
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

function loadGuidelines() {
  try {
    return fs.readFileSync(path.join(__dirname, "guidelines.txt"), "utf-8");
  } catch (error) {
    console.error("Erro ao ler guidelines.txt:", error.message);
    return "Nenhuma diretriz adicional encontrada.";
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", async (req, res) => {
  const { caption, artworkText, text } = req.body;

  const finalCaption = (caption || text || "").trim();
  const finalArtworkText = (artworkText || "").trim();

  if (!finalCaption && !finalArtworkText) {
    return res.status(400).json({
      error: "Envie pelo menos uma legenda ou um texto de arte para validação."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada no ambiente."
    });
  }

  const guidelines = loadGuidelines();

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const userContent = `
Analise o conteúdo abaixo com base nas diretrizes fornecidas.

LEGENDA:
${finalCaption || "Não informada"}

TEXTO DA ARTE:
${finalArtworkText || "Não informado"}

Instruções adicionais:
- Se o conteúdo estiver em português, responda em português.
- Se o conteúdo estiver em inglês, responda em inglês.
- Considere a relação entre legenda e arte quando ambos forem fornecidos.
- Avalie se há redundância entre arte e legenda.
- Avalie se o conteúdo está alinhado ao tom institucional, consultivo e técnico.
- Não invente informações.
- Responda apenas em JSON válido.
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Você é um avaliador especialista em conteúdo de redes sociais de uma consultoria.

Use obrigatoriamente as diretrizes abaixo como base de avaliação:

${guidelines}

Sua tarefa é avaliar legenda e/ou texto de arte.

Responda apenas em JSON válido, sem texto antes ou depois, no seguinte formato:

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
    "ponto 1",
    "ponto 2"
  ],
  "pontos_melhoria": [
    "ponto 1",
    "ponto 2"
  ],
  "recomendacao_final": "Aprovado, Aprovado com ajustes ou Reprovado"
}

Regras de preenchimento:
- Todos os scores devem ir de 1 a 5.
- "relacao_legenda_arte" deve receber nota mesmo quando só houver legenda ou só houver arte. Nesses casos, avalie a adequação do conteúdo disponível e use essa limitação no comentário.
- "final_score" deve ser um número de 1 a 5, podendo usar decimal.
- A recomendação final deve ser coerente com os scores.
`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    const aiText = response.choices[0].message.content;
    const parsed = JSON.parse(aiText);

    res.json(parsed);
  } catch (error) {
    console.error("Erro na validação:", error);

    res.status(500).json({
      error: error.message || "Erro ao processar a validação."
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
