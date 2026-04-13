export interface PCRData {
  chiefComplaint?: string;
  mechanismOfInjury?: string;
  initialVitals?: string;
  interventions?: string[];
  triageRecommendation?: string;
}

export interface DosageData {
  drug: string;
  weightKg: number;
  calculatedDose: string;
  justification: string;
}

// ⚠️ REPLACE THIS WITH YOUR ACTUAL KEY FROM GROQ CONSOLE
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function processTranscript(fullContext: string, county: string): Promise<{ pcr: PCRData; recommendation: string }> {
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. Output ONLY valid JSON.`;

  const payload = {
    model: "llama-3.1-8b-instant", // High speed, great for demos
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Encounter context: ${fullContext}` }
    ],
    response_format: { type: "json_object" }
  };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    const rawData = JSON.parse(result.choices[0].message.content);

    return {
      pcr: {
        chiefComplaint: rawData.chiefComplaint,
        mechanismOfInjury: rawData.mechanismOfInjury,
        initialVitals: rawData.initialVitals,
        interventions: rawData.interventions,
        triageRecommendation: rawData.triageRecommendation,
      },
      recommendation: rawData.clinicalRecommendation || "Report analyzed."
    };
  } catch (error) {
    console.error("Cloud AI Error:", error);
    throw new Error("Failed to reach AI Cloud.");
  }
}

// Update calculateDose similarly using the GROQ_API_URL...

export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise<void>((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
