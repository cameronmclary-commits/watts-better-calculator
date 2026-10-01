import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Pencil, ArrowRight } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import type { EnergyProfile } from '../../lib/energy';
import { fmtRate, parseRateToCents } from '../../lib/energy';
import type { Question } from './questions';

function renderBold(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export function BotBubble({ text, hint }: { text: string; hint?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5 items-start">
      <div className="w-8 h-8 rounded-full gradient-warm flex items-center justify-center flex-shrink-0">
        <Zap className="w-4 h-4 text-white" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
        <p className="text-sm text-foreground">{renderBold(text)}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
      </div>
    </motion.div>
  );
}

export function UserBubble({ text, onEdit }: { text: string; onEdit: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <button onClick={onEdit} className="group flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%] text-left">
        {text}
        <Pencil className="w-3 h-3 opacity-50 group-hover:opacity-100" />
      </button>
    </motion.div>
  );
}

function ProfileSpark({ data }: { data: number[] }) {
  // Hourly bars, day starting at 6am
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const h = (i + 6) % 24;
    return data[h * 2] + data[h * 2 + 1];
  });
  const max = Math.max(...hourly);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-12">
        {hourly.map((v, i) => {
          const h = (i + 6) % 24;
          const tone = h >= 16 && h < 20 ? 'bg-destructive/80' : h >= 7 && h < 16 ? 'bg-accent' : 'bg-secondary/70';
          return <div key={i} className={`flex-1 rounded-sm ${tone}`} style={{ height: `${(v / max) * 100}%` }} />;
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>6am</span><span>12pm</span><span>6pm</span><span>12am</span><span>5am</span>
      </div>
    </div>
  );
}

export function AnswerPanel({ q, form, onApply }: { q: Question; form: EnergyProfile; onApply: (patch: Partial<EnergyProfile>) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries((q.kind === 'fields' ? q.fields : q.custom ? [q.custom] : []).map((f) => [f.key, form[f.key] ? String(f.rate ? Number(form[f.key]) / 100 : form[f.key]) : ''])),
  );
  const fields = q.kind === 'fields' ? q.fields : [];
  const valid = fields.every((f) => vals[f.key] !== '' && !isNaN(Number(vals[f.key])) && Number(vals[f.key]) >= 0);
  const submitFields = () => valid && onApply(Object.fromEntries(fields.map((f) => {
    const n = Number(vals[f.key]);
    return [f.key, f.rate ? parseRateToCents(n) : n];
  })));

  if (q.kind === 'choice') {
    const customDays = q.custom ? Number(vals[q.custom.key]) : 0;
    if (q.options.some((o) => o.preview)) {
      return (
        <div className="grid gap-2">
          {q.options.map((o) => (
            <button key={o.label} onClick={() => onApply(o.apply)}
              className={`rounded-xl p-3 text-left border transition-all hover:border-primary hover:shadow-md ${o.selected(form) ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <p className="text-sm font-semibold text-foreground mb-2">{o.label}</p>
              {o.preview && <ProfileSpark data={o.preview} />}
              <p className="text-xs text-muted-foreground mt-2">{o.sub}</p>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className={`grid gap-2 ${q.options.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {q.options.map((o) => (
            <button key={o.label} onClick={() => onApply(o.apply)}
              className={`rounded-xl px-3 py-3 text-left border transition-all hover:border-primary hover:shadow-md ${o.selected(form) ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <p className="text-sm font-semibold text-foreground">{o.label}</p>
              {o.sub && <p className="text-[11px] text-muted-foreground">{o.sub}</p>}
            </button>
          ))}
        </div>
        {q.custom && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{q.custom.label} ({q.custom.unit})</Label>
              <Input type="number" className="mt-1" value={vals[q.custom.key]} onChange={(e) => setVals({ ...vals, [q.custom!.key]: e.target.value })} />
            </div>
            <Button variant="outline" disabled={!(customDays > 0)} onClick={() => onApply({ [q.custom!.key]: customDays })}>Use</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submitFields(); }} className="space-y-3">
      <div className={`grid gap-2 ${fields.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : fields.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {fields.map((f, i) => (
          <div key={f.key}>
            <Label className="text-xs text-muted-foreground">{f.label} ({f.unit})</Label>
            <Input autoFocus={i === 0} type="number" step="any" min={0} className="mt-1"
              placeholder={f.rate ? 'e.g. 0.33' : undefined}
              value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
              onBlur={() => {
                const n = Number(vals[f.key]);
                if (f.rate && n >= 1) setVals((v) => ({ ...v, [f.key]: String(parseRateToCents(n) / 100) }));
              }} />
            {f.unit === 'kWh' && form.billingPeriodDays > 0 && (
              <p className="text-[11px] mt-1 text-muted-foreground">
                {vals[f.key] && Number(vals[f.key]) > 0
                  ? <>≈ <span className="font-semibold text-foreground">{(Number(vals[f.key]) / form.billingPeriodDays).toFixed(1)} kWh/day</span> over {form.billingPeriodDays} days</>
                  : `Total for your ${form.billingPeriodDays}-day bill`}
              </p>
            )}
            {f.rate && (
              <p className="text-[11px] mt-1 text-muted-foreground">
                {vals[f.key] && Number(vals[f.key]) > 0
                  ? <>Saved as <span className="font-semibold text-foreground">{fmtRate(parseRateToCents(Number(vals[f.key])))}</span></>
                  : 'Enter 0.33 or 33 — both mean 33c'}
              </p>
            )}
          </div>
        ))}
      </div>
      {fields.some((f) => f.rate) && (
        <p className="text-xs text-muted-foreground">Rates are in dollars per kWh. If you type a whole number like 33, we'll treat it as cents and convert it to $0.33.</p>
      )}
      <Button type="submit" disabled={!valid} className="w-full">Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
    </form>
  );
}
