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

export interface SessionEntry {
  time: string;
  transcript: string;
  chiefComplaint?: string;
  recommendation: string;
  interventions: string;
}

const LOCAL_API_URL = "http://localhost:11434/api/chat";

export async function processTranscript(
  fullContext: string,
  county: string
): Promise<{ pcr: PCRData; recommendation: string }> {
  
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  Synthesize the complete chronological narration provided into a single, comprehensive JSON structure. 
  Vitals should reflect the most recent set. You MUST also provide a concise clinical recommendation (under 15 words) 
  inside the JSON that aligns with Arkansas protocols.

  Respond EXACTLY with this JSON format and nothing else:
  {
    "chiefComplaint": "string",
    "mechanismOfInjury": "string",
    "initialVitals": "string",
    "interventions": ["string", "string"],
    "triageRecommendation": "string",
    "clinicalRecommendation": "string"
  }`;

  const payload = {
    model: "meditron",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Encounter context: ${fullContext}` }
    ],
    stream: false,
    format: "json",
    options: { temperature: 0.1 }
  };

  try {
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Local AI server not responding.");

    const result = await response.json();
    const jsonText = result.message.content;
    const rawData = JSON.parse(jsonText);

    const pcr: PCRData = {
      chiefComplaint: rawData.chiefComplaint,
      mechanismOfInjury: rawData.mechanismOfInjury,
      initialVitals: rawData.initialVitals,
      interventions: rawData.interventions,
      triageRecommendation: rawData.triageRecommendation,
    };

    const recommendation = rawData.clinicalRecommendation || "Report analyzed. No critical recommendations.";

    return { pcr, recommendation };
  } catch (error) {
    console.error("Local Model Error:", error);
    throw new Error("Failed to process with local AI. Is Ollama running with OLLAMA_ORIGINS=\"*\"?");
  }
}

export async function calculateDose(drug: string, weightKg: number, weightLbs: number): Promise<DosageData> {
  const systemPrompt = `You are a certified Paramedic AI assistant. 
  Calculate the pediatric dose for the requested drug based on standard PALS/APLS weight-based protocols.
  
  Respond EXACTLY with this JSON format and nothing else:
  {
    "drug": "string",
    "weightKg": number,
    "calculatedDose": "string",
    "justification": "string"
  }`;

  const query = `Calculate the dose for ${drug} for a patient who weighs ${weightKg} kg (${weightLbs} lbs).`;

  const payload = {
    model: "meditron",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: query }
    ],
    stream: false,
    format: "json",
    options: { temperature: 0.1 }
  };

  try {
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Local AI server not responding.");

    const result = await response.json();
    const jsonText = result.message.content;
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Local Model Error:", error);
    throw new Error("Failed to calculate dose with local AI. Ensure Ollama is running.");
  }
}

export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Text-to-Speech not supported in this browser.");
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0; 
    
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
