export const ARKANSAS_COUNTIES = [
  "Arkansas", "Ashley", "Baxter", "Benton", "Boone", "Bradley", "Calhoun", "Carroll", "Chicot", "Clark",
  "Clay", "Cleburne", "Cleveland", "Columbia", "Conway", "Craighead", "Crawford", "Crittenden", "Cross",
  "Dallas", "Desha", "Drew", "Faulkner", "Franklin", "Fulton", "Garland", "Grant", "Greene", "Hempstead",
  "Hot Spring", "Howard", "Independence", "Izard", "Jackson", "Jefferson", "Johnson", "Lafayette", "Lawrence",
  "Lee", "Lincoln", "Little River", "Logan", "Lonoke", "Madison", "Marion", "Miller", "Mississippi", "Monroe",
  "Montgomery", "Nevada", "Newton", "Ouachita", "Perry", "Phillips", "Pike", "Poinsett", "Polk", "Pope",
  "Prairie", "Pulaski", "Randolph", "St. Francis", "Saline", "Scott", "Searcy", "Sebastian", "Sevier",
  "Sharp", "Stone", "Union", "Van Buren", "Washington", "White", "Woodruff", "Yell"
];

export const DRUG_OPTIONS = [
  { value: "Epinephrine 1:1,000 (IM for Anaphylaxis)", label: "Epinephrine 1:1,000 (Anaphylaxis)" },
  { value: "Adenosine (for SVT)", label: "Adenosine (for SVT)" },
  { value: "Dextrose 10% (for Hypoglycemia)", label: "Dextrose 10% (Hypoglycemia)" },
  { value: "Midazolam (for Seizures)", label: "Midazolam (Seizures)" },
  { value: "Naloxone (for Opioid Overdose)", label: "Naloxone (Opioid Overdose)" },
];

let _apiKey = '';

export function setApiKey(key: string) {
  _apiKey = key;
}

export function getApiKey(): string {
  return _apiKey;
}

export function getApiUrlText(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${_apiKey}`;
}

export function getApiUrlTts(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${_apiKey}`;
}
