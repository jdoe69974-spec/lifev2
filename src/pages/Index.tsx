import { useState, useRef, useCallback, useEffect } from 'react';
import { Language, t } from '@/lib/translations';
import { processTranscript, generateTTS, PCRData, SessionEntry } from '@/lib/api';
import { AppHeader } from '@/components/AppHeader';
import { VoiceInput } from '@/components/VoiceInput';
import { AIGuidance } from '@/components/AIGuidance';
import { DoseCalculator } from '@/components/DoseCalculator';
import { PCRTemplate } from '@/components/PCRTemplate';
import { SessionLog } from '@/components/SessionLog';
import { CountySelect } from '@/components/CountySelect';

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

  const recognitionRef = useRef<any>(null);

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

  const getFullContext = useCallback((current: string) => {
    let ctx = '';
    [...sessionHistory].reverse().forEach((entry, i) => {
      ctx += `[REPORT ${i + 1} - TIME AGO]: ${entry.transcript}\n---\n`;
    });
    ctx += `[CURRENT REPORT - JUST NOW]: ${current}\n---\n`;
    return ctx.trim();
  }, [sessionHistory]);

  const handleProcess = useCallback(async (text: string) => {
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
