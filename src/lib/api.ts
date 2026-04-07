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

const pcrSchema = {
  type: "OBJECT",
  properties: {
    chiefComplaint: { type: "STRING", description: "The primary reason for EMS activation and patient's chief complaint." },
    mechanismOfInjury: { type: "STRING", description: "How the injury occurred." },
    initialVitals: { type: "STRING", description: "The patient's first recorded vital signs and GCS." },
    interventions: { type: "ARRAY", items: { type: "STRING" }, description: "A comprehensive list of ALL treatments performed." },
    triageRecommendation: { type: "STRING", description: "The suggested destination based on the field findings." },
  },
  propertyOrdering: ["chiefComplaint", "mechanismOfInjury", "initialVitals", "interventions", "triageRecommendation"],
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
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        const delay = fastRetry ? 1000 * (2 ** i) : 5000 * (2 ** i);
        if (i < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`API rate limit exceeded after ${maxRetries} retries.`);
      }
      const errorBody = await response.text();
      let errorMessage = `API request failed with status ${response.status}.`;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch { /* ignore */ }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(errorMessage);
      }
      if (i === maxRetries - 1) throw new Error(errorMessage);
      const delay = fastRetry ? 1000 * (2 ** i) : 5000 * (2 ** i);
      await new Promise(r => setTimeout(r, delay));
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = fastRetry ? 1000 * (2 ** i) : 5000 * (2 ** i);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function processTranscript(
  fullContext: string,
  county: string
): Promise<{ pcr: PCRData; recommendation: string }> {
  const systemPrompt = `You are an AI clinical assistant for EMS in ${county}, Arkansas. Your goal is to maintain a continuous, evolving Pre-Hospital Care Report (PCR) based on sequential verbal updates from the field.
  
  ***SYNTHESIS INSTRUCTION:*** Analyze the complete chronological narration provided below. Synthesize ALL information across all reports into a single, comprehensive, and up-to-date JSON structure. Vitals should reflect the most recent, complete set.
  
  The overall patient encounter context is:\n\n${fullContext}`;

  const payloadText = {
    contents: [{ parts: [{ text: `Synthesize the full patient encounter history and provide the current, complete PCR in JSON format. The service location is ${county}.` }] }],
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
  const pcr: PCRData = JSON.parse(jsonText);

  // Generate recommendation
  const recQuery = `Based on this structured report for a scene in ${county}: ${JSON.stringify(pcr)}. What is a single, concise (under 15 words) clinical recommendation for the EMS crew? Ensure the recommendation aligns with the Arkansas guidelines.`;
  const recResponse = await fetchWithRetry(API_URL_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: recQuery }] }],
      systemInstruction: { parts: [{ text: "You are a concise clinical advisor. Provide only the recommendation text." }] },
      tools: [{ google_search: {} }],
    }),
  });
  const recResult = await recResponse.json();
  const recommendation = recResult.candidates?.[0]?.content?.parts?.[0]?.text || "Report analyzed. No critical recommendations at this time.";

  return { pcr, recommendation };
}

export async function calculateDose(drug: string, weightKg: number, weightLbs: number): Promise<DosageData> {
  const query = `Calculate the pediatric dose for ${drug} for a patient who weighs ${weightKg} kg (converted from ${weightLbs} lbs). Base your calculation on standard PALS/APLS weight-based protocols and common EMS protocols.`;
  const systemPrompt = `You are a certified Paramedic AI assistant. Your role is to provide quick, accurate, weight-based pediatric drug calculations. You MUST use the provided weight in kilograms (${weightKg} kg) to calculate the dose.`;

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
