import { MapPin } from 'lucide-react';
import { Language, t } from '@/lib/translations';
import { ARKANSAS_COUNTIES } from '@/lib/constants';

interface CountySelectProps {
  lang: Language;
  value: string;
  onChange: (v: string) => void;
}

export function CountySelect({ lang, value, onChange }: CountySelectProps) {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
        <MapPin className="w-3.5 h-3.5" />
        {t(lang, 'countyLabel')}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full p-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none"
      >
        <option value="" disabled>{t(lang, 'selectCounty')}</option>
        {ARKANSAS_COUNTIES.map(c => (
          <option key={c} value={c}>{c} County</option>
        ))}
      </select>
    </div>
  );
}
