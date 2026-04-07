import { FileText } from 'lucide-react';
import { Language, t } from '@/lib/translations';
import { PCRData } from '@/lib/api';

interface PCRTemplateProps {
  lang: Language;
  data: PCRData;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-0.5">{label}</label>
      <p className="p-2 bg-muted rounded text-foreground text-sm min-h-[36px]">{value || 'Awaiting AI analysis...'}</p>
    </div>
  );
}

export function PCRTemplate({ lang, data }: PCRTemplateProps) {
  const interventions = Array.isArray(data.interventions) ? data.interventions : [];

  return (
    <div className="p-5 bg-card rounded-xl shadow-lg border border-primary/30">
      <h2 className="text-lg font-semibold mb-4 text-primary flex items-center gap-2">
        <FileText className="w-5 h-5" />
        {t(lang, 'pcrTitle')}
      </h2>
      <div className="space-y-3">
        <Field label={t(lang, 'chiefComplaint')} value={data.chiefComplaint} />
        <Field label={t(lang, 'moi')} value={data.mechanismOfInjury} />
        <Field label={t(lang, 'vitals')} value={data.initialVitals} />
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-0.5">{t(lang, 'interventions')}</label>
          <ul className="list-disc ml-5 space-y-0.5 p-2 bg-muted rounded text-foreground text-sm min-h-[36px]">
            {interventions.length > 0
              ? interventions.map((item, i) => <li key={i}>{item}</li>)
              : <li>{t(lang, 'awaiting')}</li>
            }
          </ul>
        </div>
        <Field label={t(lang, 'triage')} value={data.triageRecommendation} />
      </div>
    </div>
  );
}
