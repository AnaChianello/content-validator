const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const port = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      error: "Texto é obrigatório."
    });
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você é um avaliador de conteúdo para redes sociais de uma consultoria.

Avalie o texto com base em:
- tom institucional e consultivo
- clareza e qualidade
- alinhamento com marca

Responda apenas em JSON válido, sem texto antes ou depois, neste formato:
{
  "final_score": 0,
  "feedback": [
    "comentário 1",
    "comentário 2",
    "comentário 3"
  ]
}`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.4
    });

    const aiText = response.choices[0].message.content;
    const parsed = JSON.parse(aiText);

    res.json(parsed);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
