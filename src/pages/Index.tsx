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
import { BookOpen, Trash2, ShieldAlert } from 'lucide-react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription 
} from "@/components/ui/sheet";

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
  const [citations, setCitations] = useState<string[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionEntry[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isCoolingDown) {
      setStatus(t(lang, 'statusDefault'));
      setTranscript(t(lang, 'waitingTranscript'));
    }
  }, [lang, isCoolingDown]);

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
    if (recommendation && !isCoolingDown) {
      setIsPlaying(true);
      await speakText(recommendation, lang === 'es' ? 'es-US' : 'en-US');
      setIsPlaying(false);
    }
  };

  const handleClear = () => {
    if (window.confirm(lang === 'es' ? '¿Borrar datos del paciente?' : 'Clear patient data?')) {
      setTranscript(t(lang, 'waitingTranscript'));
      setRecommendation('');
      setPcr({});
      setCitations([]);
      setSessionHistory([]);
      setStatus(t(lang, 'statusDefault'));
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      if (isRecording) recognitionRef.current?.stop();
    }
  };

  const handleProcess = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing || isCoolingDown) return;
    setIsProcessing(true); 
    setStatus(t(lang, 'aiProcessing'));
    
    try {
      const { pcr: rawPcr, recommendation: rec } = await processTranscript(
        getFullContext(text), 
        county,
        detailLevel 
      );

      setPcr(rawPcr);
      setRecommendation(rec);
      setCitations(rawPcr.citations || []);

      const entry: SessionEntry = {
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        transcript: text,
        chiefComplaint: rawPcr.chiefComplaint,
        recommendation: rec,
        interventions: (rawPcr.interventions || []).join(', '),
      };

      setSessionHistory(prev => [entry, ...prev].slice(0, 2));
      setStatus(t(lang, 'ttsReady'));
      setIsPlaying(true);
      await speakText(rec, lang === 'es' ? 'es-US' : 'en-US');
      setIsPlaying(false);

    } catch (e: any) {
      setStatus(`${t(lang, 'aiFailed')}`);
    } finally {
      setIsProcessing(false);
      setIsCoolingDown(true);
      setStatus(lang === 'es' ? 'Enfriamiento (5s)...' : 'Safety Cooldown (5s)...');
      setTimeout(() => setIsCoolingDown(false), 5000);
    }
  }, [lang, county, detailLevel, getFullContext, isProcessing, isCoolingDown]);

  const toggleRecording = useCallback(() => {
    if (isCoolingDown || isProcessing) return;
    if (!('webkitSpeechRecognition' in window)) return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.resume();
      const primer = new SpeechSynthesisUtterance('');
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
    }

    if (isRecording) {
      recognitionRef.current?.stop();
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
    };

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleProcess(text);
    };

    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, lang, handleProcess, isCoolingDown, isProcessing]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <AppHeader
            lang={lang}
            dark={dark}
            onToggleLang={() => setLang(l => l === 'en' ? 'es' : 'en')}
            onToggleDark={() => setDark(d => !d)}
          />
          
          <div className="flex gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <button 
                  disabled={citations.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg font-bold hover:bg-primary/20 transition-all disabled:opacity-30"
                >
                  <div className="relative flex h-2 w-2">
                    {citations.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>}
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </div>
                  <BookOpen className="w-4 h-4" />
                  {lang === 'es' ? 'Protocolos' : 'Protocols'}
                </button>
              </SheetTrigger>
              <SheetContent className="w-[90%] sm:w-[540px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ShieldAlert className="text-primary w-5 h-5" /> Textbook Citations
                  </SheetTitle>
                  <SheetDescription>Raw reference data used for this patient summary.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {citations.map((text, i) => (
                    <div key={i} className="p-4 bg-muted/40 rounded-lg border border-border text-sm italic leading-relaxed">
                      "{text}"
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <button 
              onClick={handleClear}
              disabled={isRecording || isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 rounded-lg font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
              {lang === 'es' ? 'Borrar' : 'Clear'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="p-5 bg-card rounded-xl shadow-lg border border-border">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1"><CountySelect lang={lang} value={county} onChange={setCounty} /></div>
                <div className="flex flex-col justify-end">
                  <label className="text-[10px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">{lang === 'es' ? 'Nivel' : 'Detail'}</label>
                  <select
                    value={detailLevel}
                    onChange={(e) => setDetailLevel(e.target.value as 'simple' | 'detailed')}
                    disabled={isProcessing || isCoolingDown}
                    className="h-10 px-3 py-2 bg-background border border-input rounded-md text-sm shadow-sm focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <option value="simple">Simple</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
              </div>
              <VoiceInput lang={lang} isRecording={isRecording} status={status} transcript={transcript} onToggle={toggleRecording} />
            </div>
            <AIGuidance lang={lang} recommendation={recommendation} isPlaying={isPlaying} canPlay={!!recommendation && !isCoolingDown} onPlay={handlePlay} />
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
