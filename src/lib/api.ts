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

// ⚠️ TO DO: Replace with your key from https://console.groq.com
const GROQ_API_KEY = "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"; 
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Process transcript using Groq Cloud AI
 */
export async function processTranscript(
  fullContext: string,
  county: string
): Promise<{ pcr: PCRData; recommendation: string }> {
  
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  Synthesize the chronological narration into a JSON structure. 
  Provide a concise clinical recommendation (under 15 words).
  
  Respond ONLY with a JSON object containing:
  chiefComplaint, mechanismOfInjury, initialVitals, interventions (array), triageRecommendation, clinicalRecommendation.`;

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Encounter context: ${fullContext}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
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

    if (!response.ok) throw new Error("Cloud AI is unavailable.");

    const result = await response.json();
    const rawData = JSON.parse(result.choices[0].message.content);

    const pcr: PCRData = {
      chiefComplaint: rawData.chiefComplaint,
      mechanismOfInjury: rawData.mechanismOfInjury,
      initialVitals: rawData.initialVitals,
      interventions: rawData.interventions,
      triageRecommendation: rawData.triageRecommendation,
    };

    const recommendation = rawData.clinicalRecommendation || "Report analyzed.";

    return { pcr, recommendation };
  } catch (error: any) {
    console.error("Cloud AI Error:", error);
    throw new Error(`Cloud Error: ${error.message}`);
  }
}

/**
 * Calculate Pediatric Dose using Groq Cloud AI
 */
export async function calculateDose(
  drug: string, 
  weightKg: number, 
  weightLbs: number
): Promise<DosageData> {
  
  const systemPrompt = `You are a certified Paramedic AI assistant. 
  Calculate the pediatric dose for the requested drug based on standard weight-based protocols.
  Respond ONLY with a JSON object: { "drug": string, "weightKg": number, "calculatedDose": string, "justification": string }`;

  const query = `Calculate the dose for ${drug} for a patient who weighs ${weightKg} kg (${weightLbs} lbs).`;

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
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

    if (!response.ok) throw new Error("Cloud AI is unavailable.");

    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
  } catch (error: any) {
    console.error("Dose Calculation Error:", error);
    throw new Error(`Dose Error: ${error.message}`);
  }
}

export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.onend = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
