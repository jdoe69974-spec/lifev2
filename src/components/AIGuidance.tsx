import { Volume2 } from 'lucide-react';
import { Language, t } from '@/lib/translations';

interface AIGuidanceProps {
  lang: Language;
  recommendation: string;
  isPlaying: boolean;
  canPlay: boolean;
  onPlay: () => void;
}

export function AIGuidance({ lang, recommendation, isPlaying, canPlay, onPlay }: AIGuidanceProps) {
  return (
    <div className="p-5 bg-card rounded-xl shadow-lg border border-border">
      <h2 className="text-lg font-semibold mb-4 text-card-foreground">{t(lang, 'aiGuidance')}</h2>
      <div className="text-sm p-4 bg-muted rounded-lg text-foreground border border-border min-h-[60px]">
        {recommendation || t(lang, 'aiPlaceholder')}
      </div>
      <button
        onClick={onPlay}
        disabled={!canPlay || isPlaying}
        className="mt-4 w-full py-3 text-sm font-bold rounded-xl bg-success text-success-foreground hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
      >
        <Volume2 className="w-4 h-4" />
        {isPlaying ? t(lang, 'playing') : t(lang, 'playback')}
      </button>
    </div>
  );
}
