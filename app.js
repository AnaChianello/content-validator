const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/validate", (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({
      error: "Texto é obrigatório."
    });
  }

  const result = {
    final_score: 4.0,
    status: "ok",
    feedback: [
      "O texto está claro e com tom institucional.",
      "Pode aprofundar a mensagem para reforçar autoridade.",
      "Vale revisar se a conexão com a marca está explícita."
    ]
  };

  res.json(result);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
