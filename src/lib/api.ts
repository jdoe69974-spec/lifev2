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
 * 2. DETERMINISTIC DOSAGE CALCULATION (Non-AI)
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
 * 3. TEXT TO SPEECH (Auto-Retry Loop Engine)
 */
let globalUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(text: string, lang: string = 'en-US'): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    let isResolved = false;
    
    // --- RETRY SETTINGS ---
    const maxRetries = 2; // Will attempt a total of 3 times (Attempt 0, 1, and 2)
    const retryDelayMs = 3000; // Wait 3 seconds before trying again. Change to 5000 if needed!

    const safeResolve = () => {
      if (!isResolved) {
        isResolved = true;
        resolve();
      }
    };

    // The recursive attempt function
    const attemptSpeak = (attemptIndex: number) => {
      if (isResolved) return; // Stop if we already successfully finished

      console.log(`[TTS] Attempt ${attemptIndex + 1} of ${maxRetries + 1}...`);

      // 1. Wake the engine
      window.speechSynthesis.resume();

      // 2. Clear any stuck audio
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }

      // 3. Wait a moment for Safari to clear its cache, then speak
      setTimeout(() => {
        if (isResolved) return; // Double check we haven't resolved while waiting

        const utterance = new SpeechSynthesisUtterance(text);
        globalUtterance = utterance; 
        utterance.lang = lang;

        // Success!
        utterance.onend = safeResolve;
        
        // Error Handler with RETRY logic
        utterance.onerror = (e: any) => {
          console.warn(`[TTS Error on Attempt ${attemptIndex + 1}]: "${e.error}"`);
          
          if (attemptIndex < maxRetries) {
            console.log(`[TTS] iOS crashed. Retrying in ${retryDelayMs / 1000} seconds...`);
            setTimeout(() => attemptSpeak(attemptIndex + 1), retryDelayMs);
          } else {
            console.error("[TTS] Max retries reached. Forcing unlock.");
            safeResolve(); // Resolve anyway so your UI never freezes
          }
        };

        window.speechSynthesis.speak(utterance);

        // Failsafe timeout (if iOS drops the onend event completely)
        const fallbackTime = Math.min(Math.max(text.length * 60, 3000), 15000);
        setTimeout(() => {
          if (!isResolved) {
            console.warn(`[TTS Timeout on Attempt ${attemptIndex + 1}]. Audio hung.`);
            if (attemptIndex < maxRetries) {
              console.log(`[TTS] Retrying due to timeout...`);
              attemptSpeak(attemptIndex + 1);
            } else {
              safeResolve();
            }
          }
        }, fallbackTime);
        
      }, 250); // 250ms gives the browser enough time to actually execute the cancel() command
    };

    // Start the first attempt
    attemptSpeak(0);
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
