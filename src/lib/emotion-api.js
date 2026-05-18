export async function analyzeEmotionAI(text) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are reading text and detecting the person's emotional state. Be honest and specific about what emotion they're feeling."
          },
          {
            role: "user",
            content: `What emotion is this person feeling? Be specific and honest.\n\n"${text}"`
          }
        ],
        temperature: 0.85,
        max_tokens: 150
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    const emotion = raw.toLowerCase().split('\n')[0];

    return {
      emotion,
      label: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      confidence: 75,
      source: "groq",
    };
  } catch {
    return null;
  }
}
