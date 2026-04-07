import { ClipboardList } from 'lucide-react';
import { Language, t } from '@/lib/translations';
import { SessionEntry } from '@/lib/api';

interface SessionLogProps {
  lang: Language;
  entries: SessionEntry[];
}

export function SessionLog({ lang, entries }: SessionLogProps) {
  return (
    <div className="mt-8 p-5 bg-card rounded-xl shadow-lg border border-border">
      <h2 className="text-lg font-semibold mb-4 text-card-foreground flex items-center gap-2">
        <ClipboardList className="w-5 h-5" />
        {t(lang, 'sessionLog')}
      </h2>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {entries.length === 0 ? (
          <p className="text-muted-foreground italic text-sm">{t(lang, 'noLogs')}</p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border shadow-sm ${
                index === 0 ? 'border-primary/40 bg-muted' : 'border-border bg-muted/50'
              }`}
            >
              <p className="text-xs font-bold text-primary mb-1">
                {entry.time} - {t(lang, 'report')} #{entries.length - index}
              </p>
              <p className="text-xs text-foreground"><strong>{t(lang, 'cc')}</strong> {entry.chiefComplaint || t(lang, 'na')}</p>
              <p className="text-xs text-foreground"><strong>{t(lang, 'interventionsLabel')}</strong> {entry.interventions || t(lang, 'noneDocumented')}</p>
              <p className="text-xs font-semibold text-success mt-1">{t(lang, 'aiGuidanceLabel')} {entry.recommendation}</p>
              <details className="text-xs text-muted-foreground mt-1 cursor-pointer">
                <summary>{t(lang, 'fullTranscript')}</summary>
                <p className="mt-1 p-1 bg-background rounded text-xs">{entry.transcript}</p>
              </details>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
