import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Language, t } from '@/lib/translations';
import { DRUG_OPTIONS } from '@/lib/constants';
import { calculateDose, DosageData } from '@/lib/api';

interface DoseCalculatorProps {
  lang: Language;
}

export function DoseCalculator({ lang }: DoseCalculatorProps) {
  const [drug, setDrug] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DosageData | null>(null);
  const [error, setError] = useState('');

  const canCalc = drug && parseFloat(weightLbs) > 0;

  const handleCalc = async () => {
    const lbs = parseFloat(weightLbs);
    if (!drug || isNaN(lbs) || lbs <= 0) {
      setError(t(lang, 'calcError'));
      return;
    }
    const kg = parseFloat((lbs / 2.20462).toFixed(2));
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await calculateDose(drug, kg, lbs);
      setResult(data);
    } catch (e: any) {
      setError(`${t(lang, 'calcApiError')} ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 bg-card rounded-xl shadow-lg border border-accent/30">
      <h2 className="text-lg font-semibold mb-4 text-accent flex items-center gap-2">
        <Calculator className="w-5 h-5" />
        {t(lang, 'doseCalcTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t(lang, 'drugLabel')}</label>
          <select
            value={drug}
            onChange={e => setDrug(e.target.value)}
            className="w-full p-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-accent focus:outline-none"
          >
            <option value="" disabled>{t(lang, 'drugPlaceholder')}</option>
            {DRUG_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{t(lang, 'weightLabel')}</label>
          <input
            type="number"
            value={weightLbs}
            onChange={e => setWeightLbs(e.target.value)}
            placeholder={t(lang, 'weightPlaceholder')}
            min="1"
            className="w-full p-2 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-accent focus:outline-none"
          />
        </div>
      </div>
      <button
        onClick={handleCalc}
        disabled={!canCalc || loading}
        className="w-full py-2.5 text-sm font-bold rounded-xl bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {loading ? '...' : t(lang, 'calculateDose')}
      </button>
      <div className="mt-3 p-3 bg-muted rounded-lg text-foreground border border-border min-h-[40px] text-sm">
        {error && <p className="text-destructive">🚨 {error}</p>}
        {result && (
          <>
            <p className="text-lg font-bold text-accent">{result.calculatedDose}</p>
            <p className="text-xs"><strong>{t(lang, 'drug')}</strong> {result.drug}</p>
            <p className="text-xs"><strong>{t(lang, 'inputWeight')}</strong> {weightLbs} {t(lang, 'lbs')}</p>
            <p className="text-xs"><strong>{t(lang, 'weightUsed')}</strong> {result.weightKg} {t(lang, 'kg')}</p>
            <p className="text-xs mt-1 text-muted-foreground">({result.justification})</p>
          </>
        )}
        {!error && !result && !loading && <p className="text-xs text-muted-foreground">{t(lang, 'doseDefault')}</p>}
        {loading && <p className="text-warning text-xs">🧠 {t(lang, 'calculating')}...</p>}
      </div>
    </div>
  );
}
