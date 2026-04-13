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

const GROQ_API_KEY = "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"; 
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * 1. AI-POWERED TRANSCRIPT PROCESSING
 * Summarizes clinical data from speech using Groq.
 */
export async function processTranscript(
  fullContext: string,
  county: string
): Promise<{ pcr: PCRData; recommendation: string }> {
  
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  Synthesize the chronological narration into a JSON structure. 

  STRICT RULES:
  1. Use ONLY information explicitly stated in the transcript.
  2. If vitals (BP, HR, RR, O2, Temp) are NOT mentioned, set that field to "Not recorded".
  3. If MOI or Chief Complaint is not clear, set it to "Information not provided".
  4. DO NOT hallucinate statistics.
  5. Provide a concise clinical recommendation (under 15 words) based ONLY on facts.

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

    // Prevent React Error #31 by ensuring vitals is a string
    let vitalsDisplay = "";
    if (typeof rawData.initialVitals === 'object' && rawData.initialVitals !== null) {
      vitalsDisplay = Object.entries(rawData.initialVitals)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
    } else {
      vitalsDisplay = String(rawData.initialVitals || "Not recorded");
    }

    return {
      pcr: {
        chiefComplaint: String(rawData.chiefComplaint || ""),
        mechanismOfInjury: String(rawData.mechanismOfInjury || ""),
        initialVitals: vitalsDisplay, 
        interventions: Array.isArray(rawData.interventions) ? rawData.interventions : [],
        triageRecommendation: String(rawData.triageRecommendation || ""),
      },
      recommendation: String(rawData.clinicalRecommendation || "Report analyzed.")
    };
  } catch (error: any) {
    console.error("Cloud AI Error:", error);
    throw new Error(`Cloud Error: ${error.message}`);
  }
}

/**
 * 2. DETERMINISTIC DOSAGE CALCULATION (Non-AI)
 * Matches keys directly to DRUG_OPTIONS values for 100% accuracy.
 */
const PROTOCOLS: Record<string, { dosePerKg: number; unit: string; max?: number }> = {
  "epinephrine 1:1,000 (im for anaphylaxis)": { dosePerKg: 0.01, unit: "mg", max: 0.5 },
  "adenosine (for svt)": { dosePerKg: 0.1, unit: "mg", max: 6 },
  "dextrose 10% (for hypoglycemia)": { dosePerKg: 5, unit: "ml", max: 250 },
  "midazolam (for seizures)": { dosePerKg: 0.1, unit: "mg", max: 5 },
  "naloxone (for opioid overdose)": { dosePerKg: 0.1, unit: "mg", max: 2 },
};

export async function calculateDose(
  drug: string, 
  weightKg: number, 
  weightLbs: number
): Promise<DosageData> {
  // Artificial delay for UX
  await new Promise(r => setTimeout(r, 100));

  const selection = drug.toLowerCase();
  
  // Find protocol by checking if our keys exist within the selected string
  const protocolKey = Object.keys(PROTOCOLS).find(key => selection.includes(key));
  const protocol = protocolKey ? PROTOCOLS[protocolKey] : null;

  if (!protocol) {
    return {
      drug,
      weightKg,
      calculatedDose: "Protocol not found",
      justification: "Manual calculation required. Verify protocol for this specific concentration."
    };
  }

  let dose = weightKg * protocol.dosePerKg;
  let isCapped = false;

  if (protocol.max && dose > protocol.max) {
    dose = protocol.max;
    isCapped = true;
  }

  // Clean up the drug name for display (removes the "(for...)" part)
  const displayName = drug.split('(')[0].trim();

  return {
    drug: displayName,
    weightKg: parseFloat(weightKg.toFixed(2)),
    calculatedDose: `${dose.toFixed(2)} ${protocol.unit}`,
    justification: isCapped 
      ? `Calculated ${dose.toFixed(2)}${protocol.unit} (Capped at Max)`
      : `Math: ${protocol.dosePerKg}${protocol.unit}/kg × ${weightKg.toFixed(2)}kg`
  };
}

/**
 * 3. TEXT TO SPEECH
 */
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
