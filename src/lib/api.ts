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
 */
export async function processTranscript(
  fullContext: string,
  county: string,
  detailLevel: 'simple' | 'detailed' = 'simple'
): Promise<{ pcr: PCRData; recommendation: string }> {
  
  const verbosityInstructions = detailLevel === 'detailed'
    ? "5. Provide a highly descriptive, comprehensive medical summary. Expand on the mechanism of injury, capture nuanced clinical observations in the chief complaint, and provide a thorough clinical recommendation."
    : "5. Keep all fields extremely brief and to the point. Provide a concise clinical recommendation (under 15 words) based ONLY on facts.";

  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  Synthesize the chronological narration into a JSON structure. 

  STRICT RULES:
  1. Use ONLY information explicitly stated in the transcript.
  2. If vitals (BP, HR, RR, O2, Temp) are NOT mentioned, set that field to "Not recorded".
  3. If MOI or Chief Complaint is not clear, set it to "Information not provided".
  4. DO NOT hallucinate statistics.
  ${verbosityInstructions}

  Respond ONLY with a JSON object containing:
  chiefComplaint, mechanismOfInjury, initialVitals, interventions (array), triageRecommendation, clinicalRecommendation.`;

  const payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Encounter context: ${fullContext}` }
    ],
    response_format: { type: "json_object" },
    temperature: detailLevel === 'detailed' ? 0.3 : 0.1 
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
 * 2. DETERMINISTIC DOSAGE CALCULATION
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
  await new Promise(r => setTimeout(r, 100));

  const selection = drug.toLowerCase();
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
 * 3. TEXT TO SPEECH: THE CHUNKING UPGRADE
 * This slices long texts into smaller sentences to bypass Apple WebKit's fatal memory limits.
 */
export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      return resolve();
    }

    const synth = window.speechSynthesis;
    
    // 1. Clear any stuck audio right away
    synth.cancel();

    // 2. Break the text down into small, digestible chunks via regex
    // This matches sentences ending in punctuation, or just chunks it up safely.
    const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunkIndex = 0;

    // 3. The recursive queue processor
    const speakNextChunk = () => {
      // Base Case: If we read all chunks, we are done!
      if (currentChunkIndex >= chunks.length) {
        return resolve();
      }

      const chunkText = chunks[currentChunkIndex].trim();
      if (!chunkText) {
        currentChunkIndex++;
        return speakNextChunk();
      }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = lang;
      utterance.rate = 1.0;
      
      // Global GC prevention for the current chunk
      (window as any)._activeUtterance = utterance;

      let chunkResolved = false;
      const advanceQueue = () => {
        if (!chunkResolved) {
          chunkResolved = true;
          currentChunkIndex++;
          // A tiny 50ms gap between sentences sounds natural and lets WebKit breathe
          setTimeout(speakNextChunk, 50); 
        }
      };

      utterance.onend = advanceQueue;
      
      utterance.onerror = (e) => {
        console.warn(`[TTS Chunk Failed]: ${e.error}`);
        advanceQueue(); // If a chunk fails, skip it and keep reading the next one to prevent freeze
      };

      // Failsafe per chunk (max 5 seconds per sentence)
      const chunkTimeout = Math.max(chunkText.length * 80, 5000);
      setTimeout(advanceQueue, chunkTimeout);

      // Speak this specific chunk
      synth.speak(utterance);
    };

    // Start the process slightly delayed to let the initial cancel() clear the pipes
    setTimeout(speakNextChunk, 100);
  });
}

/**
 * Shared interface for Session History
 */
export interface SessionEntry {
  time: string;
  transcript: string;
  chiefComplaint?: string;
  recommendation: string;
  interventions: string;
}
