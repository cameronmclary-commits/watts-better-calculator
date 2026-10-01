import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Sun, Home, ArrowUp, Lightbulb } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';
import { calculateProfile, toHourly, fmtRate } from '../lib/energy';

export default function SolarOverlayStep() {
  const { profile, setStep } = useWizard();
  const result = useMemo(() => calculateProfile(profile), [profile]);
  const hourly = useMemo(() => toHourly(result.slots), [result]);

  const dailyExport = result.dailyExported;
  // Weighted average rate based on actual usage entered
  const avgRate = profile.tariffType === 'flat' ? profile.flatRate :
    (profile.totalGridUsageKwh > 0
      ? (profile.peakUsageKwh * profile.peakRate + profile.shoulderUsageKwh * profile.shoulderRate + profile.offPeakUsageKwh * profile.offPeakRate) / profile.totalGridUsageKwh
      : (profile.peakRate + profile.shoulderRate + profile.offPeakRate) / 3);
  const hiddenSavings = result.dailySelfConsumed * avgRate / 100;
  const batteryOpportunity = dailyExport * (avgRate - profile.feedInRate) / 100;

  const stats = [
    { icon: Sun, label: 'Total daily production', value: `${result.dailySolarGeneration.toFixed(1)} kWh`, color: 'text-accent' },
    { icon: Home, label: 'Self-consumed (hidden savings)', value: `${result.dailySelfConsumed.toFixed(1)} kWh`, color: 'text-primary' },
    { icon: ArrowUp, label: `Exported @ ${fmtRate(profile.feedInRate)}`, value: `${dailyExport.toFixed(1)} kWh`, color: 'text-secondary' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={2} totalSteps={7} />
      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">
        <h2 className="text-2xl font-bold text-foreground mb-1">Your Solar Story</h2>
        <p className="text-muted-foreground text-sm mb-8">What your bill shows — and what it doesn't.</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-2xl p-3 sm:p-5 border border-border shadow-sm text-center">
              <s.icon className={`w-7 h-7 mx-auto mb-2 ${s.color}`} />
              <p className="text-base sm:text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Stacked area chart */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-6">
          <p className="text-sm font-semibold text-foreground mb-4">Production vs. Consumption</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hourly}>
              <defs>
                <linearGradient id="solarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5A623" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F5A623" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} tickLine={{ stroke: "hsl(var(--border))" }} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} height={32} tickMargin={6} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Area type="monotone" dataKey="demand" name="Household demand" stroke="#1E293B" strokeWidth={2} strokeDasharray="5 3" fill="none" />
              <Area type="monotone" dataKey="solar" name="Solar generation" stroke="#F5A623" strokeWidth={2} fill="url(#solarGrad)" />
              <Area type="monotone" dataKey="gridImport" name="Grid import" stroke="#3B82F6" strokeWidth={1.5} fill="url(#gridGrad)" />
              <Area type="monotone" dataKey="exported" name="Grid export" stroke="#36B37E" strokeWidth={1.5} fill="#36B37E" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Insight callout */}
        <div className="bg-accent/15 border border-accent/30 rounded-2xl p-5 flex items-start gap-3 mb-8">
          <Lightbulb className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Your solar is saving you ${hiddenSavings.toFixed(2)}/day in avoided grid costs
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              But you're exporting {dailyExport.toFixed(1)} kWh at just {fmtRate(profile.feedInRate)} — that energy is worth {fmtRate(avgRate)} if you used it yourself. A battery could capture ${batteryOpportunity.toFixed(2)}/day of that value.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">← Back</Button>
          <Button onClick={() => setStep(3)} className="flex-1 py-6 rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold">
            Model Scenarios →
          </Button>
        </div>
      </div>
    </div>
  );
}
