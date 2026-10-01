import { FileText, Printer, Sun, Battery, Zap, TrendingDown, Mail } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import type { EnergyProfile, ScenarioResult } from '../lib/energy';
import { fmtRate, USAGE_PATTERNS } from '../lib/energy';

interface Props {
  name: string;
  email: string;
  profile: EnergyProfile;
  current: ScenarioResult;
  scenario: ScenarioResult;
  solarKw: number;
  batteryKwh: number;
  recommendation: string;
  reason: string;
  onRestart: () => void;
}

const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export default function ReportView({ name, email, profile, current, scenario, solarKw, batteryKwh, recommendation, reason, onRestart }: Props) {
  const annual = (current.dailyCost - scenario.dailyCost) * 365;
  const selfSuffNow = current.dailyDemand > 0 ? (1 - current.dailyGridImport / current.dailyDemand) * 100 : 0;
  const selfSuffNew = scenario.dailyDemand > 0 ? (1 - scenario.dailyGridImport / scenario.dailyDemand) * 100 : 0;
  const days = profile.billingPeriodDays || 91;

  const rows: [string, string][] = [
    ['Tariff', profile.tariffType === 'flat' ? `Fixed rate · ${fmtRate(profile.flatRate)}` : `Time of Use · Peak ${fmtRate(profile.peakRate)} · Shoulder ${fmtRate(profile.shoulderRate)} · Off-peak ${fmtRate(profile.offPeakRate)}`],
    ['Billing period', `${days} days`],
    ['Grid usage', `${profile.totalGridUsageKwh.toLocaleString()} kWh (${(profile.totalGridUsageKwh / days).toFixed(1)} kWh/day)`],
    ['Daily supply charge', `$${profile.dailySupplyCharge.toFixed(2)}/day`],
    ...(profile.tariffType === 'flat' && profile.usagePattern ? [['Usage pattern', USAGE_PATTERNS[profile.usagePattern].label] as [string, string]] : []),
    ['Existing solar', profile.hasSolar ? `${profile.solarSystemSizeKw} kW · feed-in ${fmtRate(profile.feedInRate)}` : 'None'],
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full print:py-0">
      <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className="w-4 h-4" /> A copy will be emailed to {email} once emailing is switched on.</p>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1.5" /> Print / Save PDF</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="gradient-warm text-white p-6 sm:p-8">
          <div className="flex items-center gap-2 text-white/80 text-xs uppercase tracking-wider mb-2"><FileText className="w-4 h-4" /> Watts Better Energy Report</div>
          <h1 className="text-2xl sm:text-3xl font-bold">{name}'s personalised savings report</h1>
          <p className="text-white/80 text-sm mt-1">Prepared {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          <section className="grid sm:grid-cols-3 gap-3">
            <Stat label="Current quarterly bill" value={money(current.quarterlyBill)} sub={`$${current.dailyCost.toFixed(2)}/day`} />
            <Stat label="Projected quarterly bill" value={money(scenario.quarterlyBill)} sub={`$${scenario.dailyCost.toFixed(2)}/day`} highlight />
            <Stat label="Estimated annual savings" value={annual > 0 ? `${money(annual)}/yr` : '—'} sub={annual > 0 ? `${money(annual * 10)} over 10 years` : 'No saving with this setup'} highlight />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Recommended system</h2>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <Chip icon={<Sun className="w-4 h-4 text-accent" />} label="Solar" value={solarKw > 0 ? `${solarKw.toFixed(1)} kW` : 'None'} />
              <Chip icon={<Battery className="w-4 h-4 text-secondary" />} label="Battery" value={batteryKwh > 0 ? `${batteryKwh} kWh` : 'None'} />
              <Chip icon={<Zap className="w-4 h-4 text-primary" />} label="Best opportunity" value={recommendation} />
            </div>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-primary" /> What changes day to day</h2>
            <div className="rounded-xl border border-border divide-y divide-border text-sm">
              <Compare label="Power bought from the grid" now={`${current.dailyGridImport.toFixed(1)} kWh/day`} next={`${scenario.dailyGridImport.toFixed(1)} kWh/day`} />
              <Compare label="Solar generated" now={`${current.dailySolarGeneration.toFixed(1)} kWh/day`} next={`${scenario.dailySolarGeneration.toFixed(1)} kWh/day`} />
              <Compare label="Solar sent to the grid" now={`${current.dailyExported.toFixed(1)} kWh/day`} next={`${scenario.dailyExported.toFixed(1)} kWh/day`} />
              <Compare label="Self-sufficiency" now={`${Math.round(selfSuffNow)}%`} next={`${Math.round(selfSuffNew)}%`} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">Your details (from your bill)</h2>
            <div className="rounded-xl border border-border divide-y divide-border text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium text-foreground">{v}</span></div>
              ))}
            </div>
          </section>

          <p className="text-[11px] text-muted-foreground">Estimates are based on the bill details you entered, typical Brisbane solar production and household usage patterns. Actual results vary with weather, usage and tariff changes. One of our advisors will be in touch to confirm the right system for your home.</p>
        </div>
      </div>

      <div className="text-center mt-6 print:hidden">
        <Button variant="outline" onClick={onRestart} className="rounded-xl">Start Over</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'border-primary bg-primary/5' : 'border-border'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3 flex items-center gap-3">
      {icon}
      <div><p className="text-[11px] text-muted-foreground">{label}</p><p className="text-sm font-semibold text-foreground">{value}</p></div>
    </div>
  );
}

function Compare({ label, now, next }: { label: string; now: string; next: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{now}</span>
      <span className="text-right font-semibold text-primary">→ {next}</span>
    </div>
  );
}
