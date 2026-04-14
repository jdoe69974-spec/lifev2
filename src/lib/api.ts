import textbookData from './textbook_index.json';

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
 * LOCAL TEXTBOOK SEARCH
 * Scans your generated JSON index for the most relevant protocols
 * based on the keywords detected in the patient report.
 */
function findRelevantProtocols(transcript: string): string {
  if (!textbookData || !Array.isArray(textbookData)) return "";
  
  // Clean the transcript into keywords (ignoring short words like 'the', 'is', 'and')
  const keywords = transcript.toLowerCase().split(/\W+/).filter(w => w.length > 4);
  
  const matches = (textbookData as any[])
    .map(chunk => {
      let score = 0;
      keywords.forEach(word => {
        if (chunk.content.toLowerCase().includes(word)) score++;
      });
      return { ...chunk, score };
    })
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Take top 3 relevant sections

  return matches.map(m => m.content).join('\n---\n');
}

/**
 * 1. AI-POWERED TRANSCRIPT PROCESSING
 * Summarizes clinical data and injects local textbook protocols into the AI's "brain."
 */
export async function processTranscript(
  fullContext: string,
  county: string,
  detailLevel: 'simple' | 'detailed' = 'simple'
): Promise<{ pcr: PCRData; recommendation: string }> {
  
  // Search the textbook index first
  const relevantProtocols = findRelevantProtocols(fullContext);

  const verbosityInstructions = detailLevel === 'detailed'
    ? "5. Provide a highly descriptive, comprehensive medical summary. Expand on the mechanism of injury and nuanced observations."
    : "5. Keep all fields extremely brief. Provide a concise clinical recommendation (under 15 words).";

  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  
  REFERENCED TEXTBOOK PROTOCOLS (Use these for accuracy):
  ${relevantProtocols || "No specific textbook protocol matches found."}

  STRICT RULES:
  1. Use ONLY stated facts + the REFERENCED PROTOCOLS to guide your recommendation.
  2. Synthesize the narration into a JSON structure.
  3. If vitals not mentioned, set "Not recorded".
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
 * Hard-coded protocols for 100% mathematical accuracy.
 */
const PROTOCOLS: Record<string, { dosePerKg: number; unit: string; max?: number }> = {
  "epinephrine 1:1,000 (im for anaphylaxis)": { dosePerKg: 0.01, unit: "mg", max: 0.5 },
  "adenosine (for svt)": { dosePerKg: 0.1, unit: "mg", max: 6 },
  "dextrose 10% (for hypoglycemia)": { dosePerKg: 5, unit: "ml", max: 250 },
  "midazolam (for seizures)": { dosePerKg: 0.1, unit: "mg", max: 5 },
  "naloxone (for opioid overdose)": { dosePerKg: 0.1, unit: "mg", max: 2 },
};

export async function calculateDose(drug: string, weightKg: number, weightLbs: number): Promise<DosageData> {
  await new Promise(r => setTimeout(r, 100));
  const selection = drug.toLowerCase();
  const protocolKey = Object.keys(PROTOCOLS).find(key => selection.includes(key));
  const protocol = protocolKey ? PROTOCOLS[protocolKey] : null;

  if (!protocol) {
    return { drug, weightKg, calculatedDose: "Protocol not found", justification: "Manual calculation required." };
  }

  let dose = weightKg * protocol.dosePerKg;
  let isCapped = false;
  if (protocol.max && dose > protocol.max) {
    dose = protocol.max;
    isCapped = true;
  }

  return {
    drug: drug.split('(')[0].trim(),
    weightKg: parseFloat(weightKg.toFixed(2)),
    calculatedDose: `${dose.toFixed(2)} ${protocol.unit}`,
    justification: isCapped ? `Capped at Max` : `Math: ${protocol.dosePerKg}${protocol.unit}/kg × ${weightKg.toFixed(2)}kg`
  };
}

/**
 * 3. TEXT TO SPEECH (Sentence Chunking Engine)
 * Prevents the iPad from bricking the audio engine by feeding it 
 * one sentence at a time instead of one long block.
 */
export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();
    const synth = window.speechSynthesis;
    
    // Resume engine if iPad suspended it
    synth.resume();

    // Slicing text into sentences
    const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunkIndex = 0;

    const speakNextChunk = () => {
      if (currentChunkIndex >= chunks.length) return resolve();
      const chunkText = chunks[currentChunkIndex].trim();
      if (!chunkText) { currentChunkIndex++; return speakNextChunk(); }

      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = lang;
      
      // Global tracking to prevent Apple garbage collection
      (window as any)._activeUtterance = utterance;

      let chunkResolved = false;
      const advanceQueue = () => {
        if (!chunkResolved) {
          chunkResolved = true;
          currentChunkIndex++;
          setTimeout(speakNextChunk, 50); 
        }
      };

      utterance.onend = advanceQueue;
      utterance.onerror = advanceQueue;
      
      // Safety timeout: stop waiting after 7 seconds per sentence
      setTimeout(advanceQueue, 7000);
      
      synth.speak(utterance);
      synth.resume(); // Safari often needs a kick-start after calling speak()
    };

    setTimeout(speakNextChunk, 100);
  });
}

export interface SessionEntry {
  time: string;
  transcript: string;
  chiefComplaint?: string;
  recommendation: string;
  interventions: string;
}
