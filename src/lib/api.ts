import { API_URL_TEXT, API_URL_TTS } from './constants';

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

// FIXED: Added clinicalRecommendation to the schema to combine 2 API calls into 1
const pcrSchema = {
  type: "OBJECT",
  properties: {
    chiefComplaint: { type: "STRING", description: "The primary reason for EMS activation and patient's chief complaint." },
    mechanismOfInjury: { type: "STRING", description: "How the injury occurred." },
    initialVitals: { type: "STRING", description: "The patient's first recorded vital signs and GCS." },
    interventions: { type: "ARRAY", items: { type: "STRING" }, description: "A comprehensive list of ALL treatments performed." },
    triageRecommendation: { type: "STRING", description: "The suggested destination based on the field findings." },
    clinicalRecommendation: { type: "STRING", description: "A single, concise (under 15 words) clinical recommendation for the EMS crew based on Arkansas guidelines." },
  },
  required: ["chiefComplaint", "clinicalRecommendation"],
  propertyOrdering: ["chiefComplaint", "mechanismOfInjury", "initialVitals", "interventions", "triageRecommendation", "clinicalRecommendation"],
};

const dosageSchema = {
  type: "OBJECT",
  properties: {
    drug: { type: "STRING", description: "The drug requested." },
    weightKg: { type: "NUMBER", description: "The weight of the patient in kilograms." },
    calculatedDose: { type: "STRING", description: "The calculated pediatric dose, including the unit." },
    justification: { type: "STRING", description: "Brief explanation of the calculation." },
  },
  required: ["drug", "weightKg", "calculatedDose", "justification"],
};

async function fetchWithRetry(url: string, options: RequestInit, fastRetry = false): Promise<Response> {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      const errorBody = await response.text();
      let errorMessage = `Service request failed (${response.status}).`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch { /* ignore */ }

      if (response.status === 429) {
        const delay = fastRetry ? 2000 * (2 ** i) : 8000 * (2 ** i);
        if (i < maxRetries - 1) {
          console.warn(`Rate limited, retrying in ${delay / 1000}s... (attempt ${i + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`Service is busy. Please wait a moment and try again.`);
      }
      if (response.status >= 400 && response.status < 500) {
        throw new Error(errorMessage);
      }
      if (i === maxRetries - 1) throw new Error(errorMessage);
      const delay = fastRetry ? 2000 * (2 ** i) : 5000 * (2 ** i);
      await new Promise(r => setTimeout(r, delay));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = fastRetry ? 2000 * (2 ** i) : 5000 * (2 ** i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

// FIXED: Consolidated into a single AI request
export async function processTranscript(
  fullContext: string,
  county: string
): Promise<{ pcr: PCRData; recommendation: string }> {
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. 
  Synthesize the complete chronological narration provided into a single, comprehensive JSON structure. 
  Vitals should reflect the most recent set. You MUST also provide a concise clinical recommendation (under 15 words) 
  inside the JSON that aligns with Arkansas protocols.`;

  const payloadText = {
    contents: [{ parts: [{ text: `Synthesize history and provide the current PCR and clinical recommendation. Encounter context: ${fullContext}` }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json", responseSchema: pcrSchema },
  };

  const response = await fetchWithRetry(API_URL_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadText),
  });

  const result = await response.json();
  const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error("AI response content missing or malformed.");
  
  const rawData = JSON.parse(jsonText);

  // Split the combined response back into the expected objects
  const pcr: PCRData = {
    chiefComplaint: rawData.chiefComplaint,
    mechanismOfInjury: rawData.mechanismOfInjury,
    initialVitals: rawData.initialVitals,
    interventions: rawData.interventions,
    triageRecommendation: rawData.triageRecommendation,
  };

  const recommendation = rawData.clinicalRecommendation || "Report analyzed. No critical recommendations.";

  return { pcr, recommendation };
}

export async function calculateDose(drug: string, weightKg: number, weightLbs: number): Promise<DosageData> {
  const query = `Calculate the pediatric dose for ${drug} for a patient who weighs ${weightKg} kg (converted from ${weightLbs} lbs). Base your calculation on standard PALS/APLS weight-based protocols.`;
  const systemPrompt = `You are a certified Paramedic AI assistant. Use the provided weight in kilograms (${weightKg} kg) to calculate the dose.`;

  const payload = {
    contents: [{ parts: [{ text: query }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { responseMimeType: "application/json", responseSchema: dosageSchema },
  };

  const response = await fetchWithRetry(API_URL_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) throw new Error("Dosage calculation response missing or malformed.");
  return JSON.parse(jsonText);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

function pcmToWav(pcm16: Int16Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + pcm16.length * bytesPerSample);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); offset += str.length; };
  const writeUint32 = (val: number) => { view.setUint32(offset, val, true); offset += 4; };
  const writeUint16 = (val: number) => { view.setUint16(offset, val, true); offset += 2; };

  writeString('RIFF');
  writeUint32(36 + pcm16.length * bytesPerSample);
  writeString('WAVE');
  writeString('fmt ');
  writeUint32(16);
  writeUint16(1);
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(sampleRate * numChannels * bytesPerSample);
  writeUint16(numChannels * bytesPerSample);
  writeUint16(8 * bytesPerSample);
  writeString('data');
  writeUint32(pcm16.length * bytesPerSample);
  for (let i = 0; i < pcm16.length; i++) { view.setInt16(offset, pcm16[i], true); offset += bytesPerSample; }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function generateTTS(text: string): Promise<string> {
  const payload = {
    contents: [{ parts: [{ text: `Say confidently: ${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  };

  const response = await fetchWithRetry(API_URL_TTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, true);

  const result = await response.json();
  const part = result?.candidates?.[0]?.content?.parts?.[0];
  const audioData = part?.inlineData?.data;
  const mimeType = part?.inlineData?.mimeType;

  if (!audioData || !mimeType?.startsWith("audio/")) throw new Error("TTS audio data missing.");

  const match = mimeType.match(/rate=(\d+)/);
  const sampleRate = match ? parseInt(match[1], 10) : 16000;
  const pcmData = base64ToArrayBuffer(audioData);
  const pcm16 = new Int16Array(pcmData);
  const wavBlob = pcmToWav(pcm16, sampleRate);
  return URL.createObjectURL(wavBlob);
}
