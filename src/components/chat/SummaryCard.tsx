import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Pencil } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Checkbox } from '@project/components/ui/checkbox';
import type { EnergyProfile } from '../../lib/energy';
import { calculateBillFromProfile } from '../../lib/energy';
import type { Question } from './questions';

const TITLES: Record<string, string> = {
  tariff: 'Tariff type', period: 'Billing period', flat: 'Rate & usage', pattern: 'Usage pattern', peak: 'Peak (4pm–8pm)',
  shoulder: 'Shoulder (7am–4pm)', offpeak: 'Off-Peak (8pm–7am)', supply: 'Daily supply charge',
  solar: 'Existing solar', solarDetails: 'Solar system',
};

export default function SummaryCard({ form, questions, onEdit, onConfirm, onAmend }: {
  form: EnergyProfile; questions: Question[]; onEdit: (id: string) => void; onConfirm: () => void; onAmend: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const bill = calculateBillFromProfile(form);
  const daily = form.billingPeriodDays > 0 ? bill / form.billingPeriodDays : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-10 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="divide-y divide-border">
        {questions.map((q) => (
          <div key={q.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <span className="text-xs text-muted-foreground">{TITLES[q.id] ?? q.id}</span>
            <button onClick={() => onEdit(q.id)} className="group flex items-center gap-1.5 text-sm font-medium text-foreground text-right">
              {q.answer(form)}
              <Pencil className="w-3 h-3 opacity-30 group-hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
      <div className="bg-muted/40 px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-secondary" />
          <span className="text-sm font-semibold text-foreground">Estimated Bill</span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-3xl font-bold text-primary">${bill.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{form.billingPeriodDays}-day bill</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground">${daily.toFixed(2)}/day</p>
            <p className="text-xs text-muted-foreground">${(daily * 30.4).toFixed(0)}/month</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-border space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox checked={agreed} onCheckedChange={(c) => setAgreed(c === true)} className="mt-0.5" />
          <span className="text-sm text-foreground">These details are correct and the estimated bill is close to my actual bill.</span>
        </label>
        <Button disabled={!agreed} onClick={onConfirm} className="w-full py-6 text-base font-semibold rounded-xl gradient-warm border-0 text-white hover:opacity-90">
          Yes, Analyse My Energy →
        </Button>
        <Button variant="outline" onClick={onAmend} className="w-full rounded-xl">
          <Pencil className="w-4 h-4 mr-2" /> Figures aren't right — amend them
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">Your answers are kept, so you only need to change what's wrong. You can also tap any line above.</p>
      </div>
    </motion.div>
  );
}
