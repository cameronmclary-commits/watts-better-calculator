import { useState, useMemo, useEffect, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@project/components/ui/button';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';
import type { EnergyProfile } from '../lib/energy';
import { calculateBillFromProfile } from '../lib/energy';
import { buildQuestions } from './chat/questions';
import { BotBubble, UserBubble, AnswerPanel } from './chat/ChatBits';
import SummaryCard from './chat/SummaryCard';

function normalise(p: EnergyProfile): EnergyProfile {
  const next = { ...p };
  if (next.tariffType === 'tou') next.totalGridUsageKwh = next.peakUsageKwh + next.shoulderUsageKwh + next.offPeakUsageKwh;
  if (!next.hasSolar) { next.solarSystemSizeKw = 0; next.totalExportKwh = 0; }
  next.totalBillAmount = calculateBillFromProfile(next);
  return next;
}

const BLANK: Partial<EnergyProfile> = {
  peakRate: 0, shoulderRate: 0, offPeakRate: 0, flatRate: 0, dailySupplyCharge: 0, feedInRate: 0,
  billingPeriodDays: 0, peakUsageKwh: 0, shoulderUsageKwh: 0, offPeakUsageKwh: 0, totalGridUsageKwh: 0,
  totalExportKwh: 0, solarSystemSizeKw: 0, hasSolar: false, totalBillAmount: 0,
};

export default function ManualEntryStep() {
  const { profile, setProfile, setStep, setScenarioSolarKw } = useWizard();
  // Start blank unless the customer has already been through this step
  const [form, setForm] = useState<EnergyProfile>(() => (profile.totalBillAmount ? { ...profile } : { ...profile, ...BLANK }));
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const currentRef = useRef<HTMLDivElement>(null);

  const questions = useMemo(() => buildQuestions(form), [form]);
  const currentIdx = questions.findIndex((q) => !answered.has(q.id));
  const done = currentIdx === -1;
  const shown = done ? questions : questions.slice(0, currentIdx);
  const current = done ? null : questions[currentIdx];

  useEffect(() => {
    const t = setTimeout(() => currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    return () => clearTimeout(t);
  }, [currentIdx]);

  const apply = (id: string, patch: Partial<EnergyProfile>) => {
    setForm((f) => normalise({ ...f, ...patch }));
    setAnswered((a) => new Set(a).add(id));
  };
  const edit = (id: string) => setAnswered((a) => { const n = new Set(a); n.delete(id); return n; });

  const submit = () => {
    const final = normalise(form);
    setProfile(final);
    setScenarioSolarKw(final.hasSolar ? final.solarSystemSizeKw : 0);
    setStep(2);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={1} totalSteps={7} />
      <div className="flex-1 max-w-xl mx-auto px-4 sm:px-6 pt-10 pb-[40vh] w-full">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Your Tariff & Usage</h2>
            <p className="text-muted-foreground text-sm">Grab your latest electricity bill — I'll walk you through it.</p>
          </div>
          {answered.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setAnswered(new Set()); setForm((f) => ({ ...f, ...BLANK })); }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Start over
            </Button>
          )}
        </div>

        <div className="space-y-4">
          {shown.map((q) => (
            <div key={q.id} className="space-y-3">
              <BotBubble text={q.prompt} />
              <UserBubble text={q.answer(form)} onEdit={() => edit(q.id)} />
            </div>
          ))}

          {current && (
            <div ref={currentRef} className="space-y-3">
              <BotBubble text={current.prompt} hint={current.hint} />
              <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="ml-10 bg-muted/40 border border-border rounded-2xl p-4">
                <AnswerPanel q={current} form={form} onApply={(p) => apply(current.id, p)} />
              </motion.div>
            </div>
          )}

          {done && (
            <div ref={currentRef} className="space-y-3">
              <BotBubble text="Thanks! Here's a summary of what you've told me. Please check it's correct before we analyse your energy." />
              <SummaryCard form={form} questions={questions} onEdit={edit} onConfirm={submit}
                onAmend={() => setAnswered(new Set(['tariff', 'period']))} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
