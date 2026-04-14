import { useState, useRef, useCallback, useEffect } from 'react';
import { Language, t } from '@/lib/translations';
import { processTranscript, speakText, PCRData, SessionEntry } from '@/lib/api';
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
  const [detailLevel, setDetailLevel] = useState<'simple' | 'detailed'>('simple');
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [pcr, setPcr] = useState<PCRData>({});
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
      ctx += `[REPORT ${i + 1}]: ${entry.transcript}\n---\n`;
    });
    ctx += `[CURRENT UPDATE]: ${current}\n---\n`;
    return ctx.trim();
  }, [sessionHistory]);

  const handlePlay = async () => {
    if (recommendation) {
      setIsPlaying(true);
      await speakText(recommendation, lang === 'es' ? 'es-US' : 'en-US');
      setIsPlaying(false);
    }
  };

  const handleProcess = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true); 
    setStatus(t(lang, 'aiProcessing'));
    
    try {
      const fullContext = getFullContext(text);
      
      const { pcr: rawPcr, recommendation: rec } = await processTranscript(
        fullContext, 
        county || 'Unspecified Arkansas County',
        detailLevel 
      );

      // CRITICAL FIX: Aggressive Sanitization
      // This prevents the "Black Screen Crash" by guaranteeing the AI hasn't
      // sneaked any unrenderable JSON objects into the React state.
      const safePcr: PCRData = {
        chiefComplaint: typeof rawPcr.chiefComplaint === 'string' ? rawPcr.chiefComplaint : JSON.stringify(rawPcr.chiefComplaint || ""),
        mechanismOfInjury: typeof rawPcr.mechanismOfInjury === 'string' ? rawPcr.mechanismOfInjury : JSON.stringify(rawPcr.mechanismOfInjury || ""),
        initialVitals: typeof rawPcr.initialVitals === 'string' ? rawPcr.initialVitals : JSON.stringify(rawPcr.initialVitals || ""),
        triageRecommendation: typeof rawPcr.triageRecommendation === 'string' ? rawPcr.triageRecommendation : JSON.stringify(rawPcr.triageRecommendation || ""),
        interventions: Array.isArray(rawPcr.interventions) 
          ? rawPcr.interventions.map((item: any) => {
              // If the AI returns a detailed object like {"drug": "O2", "dose": "15L"}, flatten it.
              if (typeof item === 'object' && item !== null) {
                return Object.values(item).join(' - ');
              }
              return String(item);
            })
          : []
      };
      
      setPcr(safePcr);
      setRecommendation(rec);

      const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      const entry: SessionEntry = {
        time: timestamp,
        transcript: text,
        chiefComplaint: safePcr.chiefComplaint,
        recommendation: rec,
        interventions: (safePcr.interventions || []).join(', '),
      };

      setSessionHistory(prev => [entry, ...prev].slice(0, 2));

      setStatus(t(lang, 'ttsReady'));
      setIsPlaying(true);
      await speakText(rec, lang === 'es' ? 'es-US' : 'en-US');
      setIsPlaying(false);

    } catch (e: any) {
      console.error("Processing error:", e);
      setStatus(`${t(lang, 'aiFailed')}: ${e.message}`);
    } finally {
      setTimeout(() => setIsProcessing(false), 2000);
    }
  }, [lang, county, detailLevel, getFullContext, isProcessing]);

  const toggleRecording = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      setStatus(t(lang, 'speechNotSupported'));
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(false);

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'es' ? 'es-US' : 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setStatus(t(lang, 'listening'));
      setTranscript(t(lang, 'listeningText'));
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
        setStatus(`${t(lang, 'recognitionError')}: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, lang, handleProcess]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
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
              
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <CountySelect lang={lang} value={county} onChange={setCounty} />
                </div>
                
                <div className="flex flex-col justify-end">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 uppercase">
                    {lang === 'es' ? 'Nivel de Resumen' : 'Summary Detail'}
                  </label>
                  <select
                    value={detailLevel}
                    onChange={(e) => setDetailLevel(e.target.value as 'simple' | 'detailed')}
                    className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="simple">{lang === 'es' ? 'Simple (Breve)' : 'Simple (Brief)'}</option>
                    <option value="detailed">{lang === 'es' ? 'Detallado (Completo)' : 'Detailed (Comprehensive)'}</option>
                  </select>
                </div>
              </div>

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
              canPlay={!!recommendation}
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
