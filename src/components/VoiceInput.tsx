import { Mic, MicOff } from 'lucide-react';
import { Language, t } from '@/lib/translations';

interface VoiceInputProps {
  lang: Language;
  isRecording: boolean;
  status: string;
  transcript: string;
  onToggle: () => void;
}

export function VoiceInput({ lang, isRecording, status, transcript, onToggle }: VoiceInputProps) {
  return (
    <div className="p-5 bg-card rounded-xl shadow-lg border border-border">
      <h2 className="text-lg font-semibold mb-4 text-card-foreground">{t(lang, 'narrate')}</h2>

      <div className={`text-sm p-3 rounded-lg text-center font-medium mb-4 ${
        isRecording ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
      }`}>
        {status}
      </div>

      <button
        onClick={onToggle}
        className={`w-full py-3.5 text-base font-bold rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 ${
          isRecording
            ? 'bg-muted text-muted-foreground animate-pulse'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        {isRecording ? t(lang, 'recording') : t(lang, 'startReport')}
      </button>

      <div className="mt-4 p-3 bg-muted rounded-lg h-28 overflow-y-auto text-sm text-foreground border border-border">
        <p className={isRecording ? 'text-warning' : ''}>{transcript}</p>
      </div>
    </div>
  );
}
