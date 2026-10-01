import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@project/components/ui/button';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';
import { calculateProfile, toHourly, fmtRate } from '../lib/energy';

const TOU_COLORS = { peak: '#E5484D', shoulder: '#F5A623', offPeak: '#36B37E' };

export default function UsageBreakdownStep() {
  const { profile, setStep } = useWizard();
  const result = useMemo(() => calculateProfile(profile), [profile]);
  const hourly = useMemo(() => toHourly(result.slots), [result]);

  const totalDailyCost = result.peakCost + result.shoulderCost + result.offPeakCost + result.supplyCost;
  const pct = (v: number) => totalDailyCost > 0 ? Math.round((v / totalDailyCost) * 100) : 0;

  // Determine which TOU period actually costs the most from real data
  const costRanking = useMemo(() => {
    const periods = [
      { key: 'Peak' as const, cost: result.peakCost },
      { key: 'Shoulder' as const, cost: result.shoulderCost },
      { key: 'Off-Peak' as const, cost: result.offPeakCost },
    ];
    periods.sort((a, b) => b.cost - a.cost);
    return periods;
  }, [result]);
  const highestPeriod = costRanking[0].key;

  // Data-driven insight about the customer's usage
  const insight = useMemo(() => {
    const days = profile.billingPeriodDays || 91;
    const dailyPeak = profile.peakUsageKwh / days;
    const dailyShoulder = profile.shoulderUsageKwh / days;
    const dailyOffPeak = profile.offPeakUsageKwh / days;
    const totalDaily = dailyPeak + dailyShoulder + dailyOffPeak;
    const peakPct = totalDaily > 0 ? Math.round((dailyPeak / totalDaily) * 100) : 0;

    if (highestPeriod === 'Peak') {
      return `Peak usage (${dailyPeak.toFixed(1)} kWh/day, ${peakPct}% of total) at ${fmtRate(profile.peakRate)} is your biggest cost driver.`;
    } else if (highestPeriod === 'Shoulder') {
      return `Shoulder usage (${dailyShoulder.toFixed(1)} kWh/day) at ${fmtRate(profile.shoulderRate)} is your biggest cost driver — your volume during 7am–4pm outweighs the higher peak rate.`;
    } else {
      return `Off-peak usage (${dailyOffPeak.toFixed(1)} kWh/day) at ${fmtRate(profile.offPeakRate)} is your biggest cost driver — high overnight volume adds up despite the lower rate.`;
    }
  }, [profile, highestPeriod]);

  const cards = [
    { label: 'Peak Cost', value: result.peakCost, pct: pct(result.peakCost), color: TOU_COLORS.peak },
    { label: 'Shoulder Cost', value: result.shoulderCost, pct: pct(result.shoulderCost), color: TOU_COLORS.shoulder },
    { label: 'Off-Peak Cost', value: result.offPeakCost, pct: pct(result.offPeakCost), color: TOU_COLORS.offPeak },
    { label: 'Supply Charge', value: result.supplyCost, pct: pct(result.supplyCost), color: '#A78BFA' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={2} totalSteps={7} />
      <div className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">
        <h2 className="text-2xl font-bold text-foreground mb-1">Your 24-Hour Energy Profile</h2>
        <p className="text-muted-foreground text-sm mb-8">How your consumption and costs spread across a typical day.</p>

        {/* Cost cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {cards.map((c) => (
            <div key={c.label} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className="text-xl font-bold text-foreground">
                ${c.value.toFixed(2)}
                <span className="text-xs font-normal text-muted-foreground">/day</span>
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{c.pct}% of bill</p>
            </div>
          ))}
        </div>

        {/* Consumption chart */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-4">
          <p className="text-sm font-semibold text-foreground mb-4">Consumption by Hour (kWh)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourly} barCategoryGap="15%">
              <XAxis dataKey="label" tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} tickLine={{ stroke: "hsl(var(--border))" }} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} height={32} tickMargin={6} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)} kWh`, 'Usage']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="demand" radius={[4, 4, 0, 0]}>
                {hourly.map((h, i) => (
                  <Cell key={i} fill={TOU_COLORS[h.touPeriod]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <TouRibbon />
        </div>

        {/* Cost chart */}
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm mb-6">
          <p className="text-sm font-semibold text-foreground mb-4">Cost per Hour ($)</p>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={hourly} barCategoryGap="15%">
              <XAxis dataKey="label" tick={{ fontSize: 13, fontWeight: 600, fill: "hsl(var(--foreground))" }} tickLine={{ stroke: "hsl(var(--border))" }} axisLine={{ stroke: "hsl(var(--border))" }} interval={2} height={32} tickMargin={6} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toFixed(3)}`, 'Cost']}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {hourly.map((h, i) => (
                  <Cell key={i} fill={TOU_COLORS[h.touPeriod]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Data-driven insight */}
        <div className="bg-accent/15 border border-accent/30 rounded-2xl p-4 mb-6">
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">← Back</Button>
          <Button onClick={() => setStep(profile.hasSolar ? 2.5 : 3)} className="flex-1 py-6 rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold">
            {profile.hasSolar ? 'See Your Solar Story →' : 'Model Scenarios →'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TouRibbon() {
  // Day runs 6am → 5am. Padding matches the chart's Y-axis width and margins so bands line up with bars.
  const bands = [
    { flex: 1, color: TOU_COLORS.offPeak, label: '' },
    { flex: 9, color: TOU_COLORS.shoulder, label: 'shoulder 7am–4pm' },
    { flex: 4, color: TOU_COLORS.peak, label: 'PEAK 4–8pm' },
    { flex: 10, color: TOU_COLORS.offPeak, label: 'off-peak 8pm–7am' },
  ];
  return (
    <div className="flex rounded-lg overflow-hidden mt-2 h-7 text-xs font-semibold text-white" style={{ marginLeft: 40, marginRight: 5 }}>
      {bands.map((b, i) => (
        <div key={i} style={{ flex: b.flex, backgroundColor: b.color }}>
          <span className="flex items-center justify-center h-full whitespace-nowrap overflow-hidden">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
