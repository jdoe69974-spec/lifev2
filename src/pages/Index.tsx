import { useState, useRef, useCallback, useEffect } from 'react';
import { Language, t } from '@/lib/translations';
import { processTranscript, generateTTS, PCRData, SessionEntry } from '@/lib/api';
import { setApiKey, getApiKey } from '@/lib/constants';
import { AppHeader } from '@/components/AppHeader';
import { VoiceInput } from '@/components/VoiceInput';
import { AIGuidance } from '@/components/AIGuidance';
import { DoseCalculator } from '@/components/DoseCalculator';
import { PCRTemplate } from '@/components/PCRTemplate';
import { SessionLog } from '@/components/SessionLog';
import { CountySelect } from '@/components/CountySelect';
import { Key } from 'lucide-react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function Index() {
  const [lang, setLang] = useState<Language>('en');
  const [dark, setDark] = useState(true);
  const [county, setCounty] = useState('Washington');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pcr, setPcr] = useState<PCRData>({});
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      setApiKeyInput(saved);
      setApiKey(saved);
      setApiKeySaved(true);
    }
  }, []);

  useEffect(() => {
    setStatus(t(lang, 'statusDefault'));
    setTranscript(t(lang, 'waitingTranscript'));
  }, [lang]);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      localStorage.setItem('gemini_api_key', apiKeyInput.trim());
      setApiKeySaved(true);
    }
  };

  const handleClearApiKey = () => {
    setApiKey('');
    localStorage.removeItem('gemini_api_key');
    setApiKeyInput('');
    setApiKeySaved(false);
  };

  const getFullContext = useCallback((current: string) => {
    let ctx = '';
    [...sessionHistory].reverse().forEach((entry, i) => {
      ctx += `[REPORT ${i + 1} - TIME AGO]: ${entry.transcript}\n---\n`;
    });
    ctx += `[CURRENT REPORT - JUST NOW]: ${current}\n---\n`;
    return ctx.trim();
  }, [sessionHistory]);

  const handleProcess = useCallback(async (text: string) => {
    if (!getApiKey()) {
      setStatus('⚠️ Please enter your Gemini API key first.');
      return;
    }
    setStatus(t(lang, 'aiProcessing'));
    try {
      const fullContext = getFullContext(text);
      const { pcr: newPcr, recommendation: rec } = await processTranscript(fullContext, county || 'Unspecified Arkansas County');
      setPcr(newPcr);
      setRecommendation(rec);

      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const entry: SessionEntry = {
        time: timestamp,
        transcript: text,
        chiefComplaint: newPcr.chiefComplaint,
        recommendation: rec,
        interventions: (newPcr.interventions || []).join(', '),
      };
      setSessionHistory(prev => [entry, ...prev].slice(0, 10));

      setStatus(t(lang, 'ttsGenerating'));
      const url = await generateTTS(rec);
      setAudioUrl(url);
      setStatus(t(lang, 'ttsReady'));
      playAudioFromUrl(url);
    } catch (e: any) {
      setStatus(`${t(lang, 'aiFailed')}: ${e.message}`);
    }
  }, [lang, county, getFullContext]);

  const playAudioFromUrl = (url: string) => {
    const audio = new Audio(url);
    setIsPlaying(true);
    audio.play();
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
  };

  const handlePlay = () => {
    if (audioUrl) playAudioFromUrl(audioUrl);
  };

  const toggleRecording = useCallback(() => {
    if (!getApiKey()) {
      setStatus('⚠️ Please enter your Gemini API key first.');
      return;
    }

    if (!('webkitSpeechRecognition' in window)) {
      setStatus(t(lang, 'speechNotSupported'));
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'es' ? 'es-US' : 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setStatus(t(lang, 'listening'));
      setTranscript(t(lang, 'listeningText'));
      setAudioUrl(null);
      setRecommendation('');
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setStatus(t(lang, 'transcribed'));
      handleProcess(text);
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === 'no-speech') {
        setStatus(t(lang, 'noSpeech'));
      } else {
        setStatus(`${t(lang, 'recognitionError')}: ${event.error}. ${t(lang, 'tryAgain')}`);
      }
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, lang, handleProcess]);

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <AppHeader
          lang={lang}
          dark={dark}
          onToggleLang={() => setLang(l => l === 'en' ? 'es' : 'en')}
          onToggleDark={() => setDark(d => !d)}
        />

        {/* API Key Input */}
        <div className="mb-6 p-4 bg-card rounded-xl shadow-lg border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Gemini API Key</h3>
            {apiKeySaved && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">✓ Connected</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder="Paste your Gemini API key here..."
              className="flex-1 p-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-accent focus:outline-none placeholder:text-muted-foreground"
            />
            {!apiKeySaved ? (
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                Save
              </button>
            ) : (
              <button
                onClick={handleClearApiKey}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Get your key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-accent underline">
              Google AI Studio
            </a>
            . Your key is stored locally in your browser.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="p-5 bg-card rounded-xl shadow-lg border border-border">
              <CountySelect lang={lang} value={county} onChange={setCounty} />
              <VoiceInput
                lang={lang}
                isRecording={isRecording}
                status={status}
                transcript={transcript}
                onToggle={toggleRecording}
              />
            </div>
            <AIGuidance
              lang={lang}
              recommendation={recommendation}
              isPlaying={isPlaying}
              canPlay={!!audioUrl}
              onPlay={handlePlay}
            />
          </div>

          <div className="space-y-6">
            <DoseCalculator lang={lang} />
            <PCRTemplate lang={lang} data={pcr} />
          </div>
        </div>

        <SessionLog lang={lang} entries={sessionHistory} />
      </div>
    </div>
  );
}
