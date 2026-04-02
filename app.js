import express from "express";
import cors from "cors";
import OpenAI from "openai";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 👉 (Opcional, mas recomendado)
// Se quiser usar arquivo separado de exemplos:
let examples = "";
try {
  examples = fs.readFileSync("./data/good-examples.txt", "utf-8");
} catch (err) {
  console.log("No examples file found, continuing without it.");
}

// 🔹 FUNÇÃO PRINCIPAL DE VALIDAÇÃO
app.post("/validate", async (req, res) => {
  try {
    const { caption, visualText } = req.body;

    const prompt = `
You are a content validation specialist for a business consulting firm (BIP).

Your role is to evaluate social media content (caption + visual text) based on strict brand guidelines.

---

## INPUT

Caption:
${caption}

Visual text:
${visualText && visualText.trim() !== "" ? visualText : "not provided"}

---

## GLOBAL RULES

- The evaluation must be deterministic.
- The same input must always generate the same score.
- Be strict but fair.
- Score 5 must be achievable.
- Do not be overly punitive.

---

## CONDITIONAL RULE

If visual text is empty, null, or not provided:
- Ignore the "caption vs visual relation" criterion
- Do NOT penalize the score
- Set "caption_visual_relation" as null
- Final score must be calculated only with the remaining criteria

---

## BRAND GUIDELINES

- Tone: institucional, técnico, claro e confiável
- Must demonstrate authority and business impact
- Avoid informal language (e.g. "galera", "imperdível", "super")
- Avoid empty adjectives
- Prefer clarity over embellishment
- Avoid redundancy
- Focus on insight and value

---

## VALIDATION RUBRIC

### 1. Tone of Voice (0–5)
+1 professional and technical language  
+1 no informal expressions  
+1 demonstrates authority  
+1 avoids empty adjectives  
+1 direct and objective  

---

### 2. Clarity and Structure (0–5)
+1 clear main message  
+1 concise sentences (~max 25 words)  
+1 logical flow  
+1 no ambiguity  
+1 easy to understand  

---

### 3. Quality and Writing (0–5)
+1 no grammar errors  
+1 no repetition of words nearby  
+1 no redundancy  
+1 strong vocabulary  
+1 fluid reading  

---

### 4. Brand Alignment (0–5)
+1 aligned with consulting positioning  
+1 business-oriented  
+1 avoids generic phrases  
+1 reflects expertise  
+1 delivers insight/value  

---

### 5. Caption vs Visual (0–5)
(ONLY if visual exists)

+1 complements (does not repeat)  
+1 adds new information  
+1 consistent message  
+1 no contradiction  
+1 enhances understanding  

---

## SCORE INTERPRETATION

1 = Poor  
2 = Weak  
3 = Acceptable  
4 = Good  
5 = Excellent  

Score 5 must be given ONLY when:
- No issues found
- Fully aligned with brand
- Clear, concise, and impactful

---

## FEW-SHOT EXAMPLES

${examples}

---

## OUTPUT FORMAT (JSON ONLY)

{
  "final_score": number,
  "scores": {
    "tone": number,
    "clarity": number,
    "quality": number,
    "brand_alignment": number,
    "caption_visual_relation": number or null
  },
  "issues": [
    "objective issues only"
  ],
  "improvements": [
    "clear and actionable suggestions"
  ],
  "rewrite_suggestion": "improved version of the caption"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    let output = response.choices[0].message.content;

    // 🔹 tenta garantir JSON válido
    try {
      output = JSON.parse(output);
    } catch (e) {
      console.log("⚠️ JSON parsing failed, returning raw output");
    }

    res.json(output);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error validating content"
    });
  }
});

// 🔹 SERVER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
