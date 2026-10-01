import { ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@project/components/ui/accordion';
import type { toHourly } from '../../lib/energy';

export type Hourly = ReturnType<typeof toHourly>;

export const SERIES = {
  demand: { name: 'Household demand', color: '#1E293B', desc: 'All the electricity your home uses in each hour — lights, fridge, air-con, TV, hot water.' },
  solar: { name: 'Solar production', color: '#F5A623', desc: 'Electricity your panels generate. It peaks around midday and is used by your home first, because it is free.' },
  batteryCharge: { name: 'Battery charging (from solar)', color: '#14B8A6', desc: 'Spare solar stored in the battery instead of being sold to the grid for a few cents.' },
  batteryDischarge: { name: 'Battery powering home', color: '#8B5CF6', desc: 'Stored solar released to run your home in the evening and overnight, when grid power is most expensive.' },
  batteryLevel: { name: 'Battery state of charge', color: '#7C3AED', desc: 'How full the battery is (10% is kept in reserve to protect battery life).' },
  gridImport: { name: 'Grid import', color: '#3B82F6', desc: 'Electricity bought from your retailer when solar and the battery can\'t cover demand. This is what you pay for.' },
  exported: { name: 'Grid export', color: '#36B37E', desc: 'Spare solar sent back to the grid. You earn a small feed-in credit.' },
} as const;
export type Key = keyof typeof SERIES;

const tooltipStyle = { borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };

export function chartKeys(hasBattery: boolean): Key[] {
  return ['demand', 'solar', ...(hasBattery ? (['batteryCharge', 'batteryDischarge', 'batteryLevel'] as Key[]) : []), 'gridImport', 'exported'];
}

export function socData(hourly: Hourly, batteryKwh: number) {
  const usable = batteryKwh * 0.9;
  return hourly.map((h) => ({ ...h, soc: usable > 0 ? Math.min(100, (h.batteryLevel / usable) * 100) : 0 }));
}
type Data = ReturnType<typeof socData>;

function summary(k: Key, data: Data) {
  if (k === 'batteryLevel') return `Peak ${Math.round(Math.max(...data.map((d) => d.soc)))}%`;
  return `${data.reduce((a, h) => a + h[k], 0).toFixed(1)} kWh/day`;
}
function hourValue(k: Key, d: Data[number]) {
  return k === 'batteryLevel' ? `${Math.round(d.soc)}%` : `${d[k].toFixed(2)} kWh`;
}

interface ChartProps {
  k: Key;
  data: Data;
  markerIndex?: number;
  onPick?: (index: number) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
  height?: number;
}

export function SeriesChart({ k, data, markerIndex, onPick, height = 90 }: ChartProps) {
  const s = SERIES[k];
  const isSoc = k === 'batteryLevel';
  const marker = markerIndex !== undefined ? data[markerIndex] : undefined;
  const header = marker ? `${marker.label} · ${hourValue(k, marker)}` : summary(k, data);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm" title={s.desc}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />{s.name}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{header}</span>
      </div>
      <div className={`px-1 pb-1 ${onPick ? 'cursor-pointer' : ''}`}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} onClick={(e) => { if (onPick && e?.activeTooltipIndex !== undefined) onPick(Number(e.activeTooltipIndex)); }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} interval={5} height={16} />
              <YAxis domain={isSoc ? [0, 100] : undefined} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [isSoc ? `${Math.round(v)}%` : `${v.toFixed(2)} kWh`, s.name]} />
              <Area type="monotone" dataKey={isSoc ? 'soc' : k} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={0.25} isAnimationActive={!marker} />
              {marker && <ReferenceLine x={marker.label} stroke="hsl(var(--foreground))" strokeWidth={2} />}
            </ComposedChart>
          </ResponsiveContainer>
      </div>
    </div>
  );
}

/** All charts visible at once in a compact grid that fits one screen. */
export function ChartGrid({ data, hasBattery, markerIndex, onPick }: { data: Data; hasBattery: boolean; markerIndex?: number; onPick?: (i: number) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {chartKeys(hasBattery).map((k) => (
        <SeriesChart key={k} k={k} data={data} markerIndex={markerIndex} onPick={onPick} />
      ))}
    </div>
  );
}

export function EnergyFlowChart({ hourly, hasBattery, batteryKwh }: { hourly: Hourly; hasBattery: boolean; batteryKwh: number }) {
  return (
    <div className="space-y-3">
      <ChartGrid data={socData(hourly, batteryKwh)} hasBattery={hasBattery} />
      <HowToRead />
    </div>
  );
}

function HowToRead() {
  const items = [
    { q: 'What is a kWh?', a: 'A kilowatt-hour is the unit you\'re billed in. Running a 1,000-watt heater for one hour uses 1 kWh. A typical Australian home uses 15–25 kWh a day.' },
    { q: 'Why does solar go to my home first?', a: 'Using your own solar is free and saves paying the full grid price (often 30–45c). Exporting only earns a small feed-in credit (often 3–8c).' },
    { q: 'What does a battery actually do?', a: 'It shifts cheap daytime solar to the evening, when grid power is most expensive.' },
    { q: 'How do I pick the right battery size?', a: 'The sweet spot is a battery that fills up on most days and empties overnight. If it never fills, it\'s too big for your solar.' },
  ];
  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> New to this? How to read these charts</p>
      <Accordion type="single" collapsible>
        {items.map((it) => (
          <AccordionItem key={it.q} value={it.q}>
            <AccordionTrigger className="text-sm">{it.q}</AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground">{it.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
