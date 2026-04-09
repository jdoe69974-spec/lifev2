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

// Clinical AI service credentials
export const SERVICE_TOKEN = "AIzaSyDp8FGxBiSHWESfWsUZPQ6rB4G47O1XpFo";
export const API_URL_TEXT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${SERVICE_TOKEN}`;
export const API_URL_TTS = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${SERVICE_TOKEN}`;
