import { useState, useEffect, useMemo, useCallback } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';
import { calculateProfile, toHourly } from '../lib/energy';
import { ChartGrid, socData } from './scenario/EnergyFlowCharts';

const SPEEDS = [1, 3, 8] as const;

const TIME_NARRATIONS: Record<number, { label: string; badge: string; badgeColor: string; text: string }> = {
  0: { label: '12am', badge: 'DEEP NIGHT', badgeColor: '#36B37E', text: 'Deep overnight. Minimal draw. Home in standby mode.' },
  1: { label: '1am', badge: 'DEEP NIGHT', badgeColor: '#36B37E', text: 'Deep overnight. Minimal draw. Home in standby mode.' },
  2: { label: '2am', badge: 'DEEP NIGHT', badgeColor: '#36B37E', text: 'Overnight low. Base loads only — fridge, standby.' },
  3: { label: '3am', badge: 'DEEP NIGHT', badgeColor: '#36B37E', text: 'Overnight low. Base loads only — fridge, standby.' },
  4: { label: '4am', badge: 'DEEP NIGHT', badgeColor: '#36B37E', text: 'Early morning. Hot water systems may cycle on.' },
  5: { label: '5am', badge: 'PRE-DAWN', badgeColor: '#36B37E', text: 'Pre-dawn. Controlled loads winding down.' },
  6: { label: '6am', badge: 'SUNRISE', badgeColor: '#F5A623', text: 'Sunrise. Solar begins to trickle. Morning routines start.' },
  7: { label: '7am', badge: 'MORNING', badgeColor: '#36B37E', text: 'Shoulder period begins. Breakfast loads active.' },
  8: { label: '8am', badge: 'MORNING', badgeColor: '#36B37E', text: 'Morning peak activity — showers, kitchen, getting ready.' },
  9: { label: '9am', badge: 'MORNING', badgeColor: '#36B37E', text: 'Solar ramping up. Daytime loads settling.' },
  10: { label: '10am', badge: 'SOLAR RAMP', badgeColor: '#F5A623', text: 'Strong solar generation. Self-consumption rising.' },
  11: { label: '11am', badge: 'SOLAR RAMP', badgeColor: '#F5A623', text: 'Near-peak solar. Surplus energy building.' },
  12: { label: '12pm', badge: 'SOLAR PEAK', badgeColor: '#36B37E', text: 'Solar noon. Maximum generation window.' },
  13: { label: '1pm', badge: 'SOLAR PEAK', badgeColor: '#36B37E', text: 'Peak solar generation. Maximum self-consumption achieved.' },
  14: { label: '2pm', badge: 'SOLAR PEAK', badgeColor: '#36B37E', text: 'Strong solar continues. Export at its highest.' },
  15: { label: '3pm', badge: 'AFTERNOON', badgeColor: '#F5A623', text: 'Solar declining. Afternoon loads increasing.' },
  16: { label: '4pm', badge: 'EVENING PEAK', badgeColor: '#E5484D', text: 'Peak period starts. Highest electricity rates active.' },
  17: { label: '5pm', badge: 'EVENING PEAK', badgeColor: '#E5484D', text: 'Evening peak — cooking, TV, heating/cooling all running. Battery providing peak cover.' },
  18: { label: '6pm', badge: 'EVENING PEAK', badgeColor: '#E5484D', text: 'Peak demand. Solar has set. Grid or battery covering all load.' },
  19: { label: '7pm', badge: 'EVENING PEAK', badgeColor: '#E5484D', text: 'Highest consumption hour. Dinner, entertainment, climate control.' },
  20: { label: '8pm', badge: 'NIGHT', badgeColor: '#36B37E', text: 'Peak period ends. Off-peak rates resume. Wind-down begins.' },
  21: { label: '9pm', badge: 'NIGHT', badgeColor: '#36B37E', text: 'Peak period ends. Off-peak rates resume. Wind-down begins.' },
  22: { label: '10pm', badge: 'NIGHT', badgeColor: '#36B37E', text: 'Late evening. Loads dropping. Standby mode approaching.' },
  23: { label: '11pm', badge: 'NIGHT', badgeColor: '#36B37E', text: 'Approaching midnight. Minimal draw. Overnight begins.' },
};

export default function HouseAnimationStep() {
  const { profile, setStep, scenarioSolarKw, scenarioBatteryKwh } = useWizard();
  const [currentHour, setCurrentHour] = useState(6);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 3 | 8>(3);

  const result = useMemo(() => calculateProfile(profile, scenarioSolarKw, scenarioBatteryKwh), [profile, scenarioSolarKw, scenarioBatteryKwh]);
  const chartData = useMemo(() => socData(toHourly(result.slots), scenarioBatteryKwh), [result, scenarioBatteryKwh]);
  const markerIndex = Math.max(0, chartData.findIndex((d) => d.hour === currentHour));
  const pickHour = useCallback((i: number) => { const d = chartData[i]; if (d) { setCurrentHour(d.hour); setPlaying(false); } }, [chartData]);

  // Get hourly data for current hour
  const hourlyData = useMemo(() => {
    const slots = result.slots.filter(s => s.hour === currentHour);
    const solar = slots.reduce((a, s) => a + s.solar, 0);
    const demand = slots.reduce((a, s) => a + s.demand, 0);
    const gridImport = slots.reduce((a, s) => a + s.gridImport, 0);
    const exported = slots.reduce((a, s) => a + s.exported, 0);
    return { solar, demand, gridImport, exported };
  }, [result, currentHour]);

  // Daily totals
  const dailyTotals = useMemo(() => ({
    consumption: result.dailyDemand,
    gridImport: result.dailyGridImport,
    selfSuff: result.dailyDemand > 0 ? Math.round((1 - result.dailyGridImport / result.dailyDemand) * 100) : 0,
  }), [result]);

  // Timer
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setCurrentHour(h => (h + 1) % 24);
    }, 3000 / speed);
    return () => clearInterval(interval);
  }, [playing, speed]);

  const reset = useCallback(() => { setCurrentHour(6); setPlaying(true); }, []);

  const isDay = currentHour >= 6 && currentHour < 19;
  const isSolarActive = hourlyData.solar > 0.01;
  const isExporting = hourlyData.exported > 0.01;
  const isImporting = hourlyData.gridImport > 0.01;
  const narration = TIME_NARRATIONS[currentHour];
  const timeRemaining = playing ? `~${Math.round((24 - ((currentHour - 6 + 24) % 24)) * 3 / speed)}s` : 'paused';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={4} totalSteps={7} />
      <div className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setPlaying(!playing)} className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-foreground">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={reset} className="bg-card border border-border rounded-xl p-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                speed === s ? 'bg-secondary text-secondary-foreground' : 'bg-card border border-border text-muted-foreground'
              }`}
            >
              {s}×
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{timeRemaining}</span>
          <span className="text-2xl font-bold text-accent">{narration.label}</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <div>
        {/* House Scene */}
        <HouseScene
          isDay={isDay}
          currentHour={currentHour}
          solarKw={hourlyData.solar}
          consumptionKw={hourlyData.demand}
          gridKw={isExporting ? hourlyData.exported : hourlyData.gridImport}
          isExporting={isExporting}
          isSolarActive={isSolarActive}
        />

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard label="SOLAR" value={`${hourlyData.solar.toFixed(2)} kW`} color="text-accent" />
          <StatCard label="CONSUMPTION" value={`${hourlyData.demand.toFixed(2)} kW`} color="text-accent" />
          <StatCard
            label="BATTERY"
            value={scenarioBatteryKwh > 0 ? `${Math.round(chartData[markerIndex]?.soc ?? 0)}% charged` : 'Not installed'}
            color="text-foreground"
          />
          <StatCard
            label="GRID"
            value={isExporting ? `Exporting ${hourlyData.exported.toFixed(2)} kW` : `Importing ${hourlyData.gridImport.toFixed(2)} kW`}
            color={isExporting ? 'text-secondary' : 'text-destructive'}
          />
        </div>

        </div>
        <div>
        {/* Individual charts following the animation */}
        <p className="text-xs text-muted-foreground mt-4 lg:mt-0 mb-2">Tap any chart to jump to that hour.</p>
        <ChartGrid data={chartData} hasBattery={scenarioBatteryKwh > 0} markerIndex={markerIndex} onPick={pickHour} />

        {/* Narration */}
        <div className="bg-card border border-border rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-foreground">⚡ WHAT'S HAPPENING AT {narration.label.toUpperCase()}</span>
            <span
              className="px-2 py-0.5 rounded-md text-xs font-bold text-white ml-auto"
              style={{ backgroundColor: narration.badgeColor }}
            >
              {narration.badge}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{narration.text}</p>
        </div>

        {/* Daily summary */}
        <div className="bg-card border border-border rounded-2xl p-4 mt-4">
          <p className="text-xs font-bold text-foreground mb-2">⚡ DAILY ENERGY SUMMARY</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Consumption</p>
              <p className="text-lg font-bold font-mono text-foreground">{dailyTotals.consumption.toFixed(1)} kWh</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grid Import</p>
              <p className="text-lg font-bold font-mono text-foreground">{dailyTotals.gridImport.toFixed(1)} kWh</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Self-Suff.</p>
              <p className="text-lg font-bold font-mono text-foreground">{dailyTotals.selfSuff}%</p>
            </div>
          </div>
        </div>

        </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-6">
          <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl">← Back</Button>
          <span className="text-xs text-muted-foreground flex-1 text-center">4/6</span>
          <Button onClick={() => setStep(6.5)} className="rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold px-6 py-5">
            Continue →
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}

/* ---- Animated House SVG Scene ---- */
function HouseScene({ isDay, currentHour, solarKw, consumptionKw, gridKw, isExporting, isSolarActive }: {
  isDay: boolean;
  currentHour: number;
  solarKw: number;
  consumptionKw: number;
  gridKw: number;
  isExporting: boolean;
  isSolarActive: boolean;
}) {
  // Sky gradient based on time
  const skyColors = useMemo(() => {
    if (currentHour >= 10 && currentHour <= 15) return ['#87CEEB', '#B0E0E6']; // midday
    if (currentHour >= 6 && currentHour < 10) return ['#87CEEB', '#FFD700']; // morning
    if (currentHour >= 15 && currentHour < 19) return ['#FF8C00', '#FF6347']; // afternoon/sunset
    if (currentHour >= 19 && currentHour < 21) return ['#2C1654', '#4A2C6E']; // dusk
    return ['#0D1B2A', '#1B2838']; // night
  }, [currentHour]);

  // Timeline bar (24 segments)
  const timelineSegments = useMemo(() => {
    return Array.from({ length: 24 }, (_, idx) => {
      const i = (idx + 6) % 24;
      const active = i === currentHour;
      let bg = '#1e293b';
      if (i >= 6 && i < 16) bg = '#36B37E'; // shoulder/solar
      else if (i >= 16 && i < 20) bg = '#E5484D'; // peak
      if (active) bg = '#F5A623';
      return { bg, active };
    });
  }, [currentHour]);

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '16/10' }}>
      <svg viewBox="0 0 640 400" className="w-full h-full">
        {/* Sky */}
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={skyColors[0]} />
            <stop offset="100%" stopColor={skyColors[1]} />
          </linearGradient>
        </defs>
        <rect width="640" height="400" fill="url(#skyGrad)" />

        {/* Sun or Moon */}
        {isDay ? (
          <g>
            <circle cx="500" cy="80" r="40" fill="#FFD700" opacity="0.9" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
              <line
                key={a}
                x1={500 + Math.cos(a * Math.PI / 180) * 48}
                y1={80 + Math.sin(a * Math.PI / 180) * 48}
                x2={500 + Math.cos(a * Math.PI / 180) * 58}
                y2={80 + Math.sin(a * Math.PI / 180) * 58}
                stroke="#FFD700"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.7"
              />
            ))}
          </g>
        ) : (
          <circle cx="520" cy="60" r="25" fill="#E8E8E8" opacity="0.8" />
        )}

        {/* Ground */}
        <rect x="0" y="310" width="640" height="90" fill={isDay ? '#4CAF50' : '#2E7D32'} />

        {/* House body */}
        <rect x="180" y="180" width="200" height="130" fill="#B0BEC5" stroke="#78909C" strokeWidth="2" rx="4" />

        {/* Roof */}
        <polygon points="160,185 280,110 400,185" fill="#5D4037" stroke="#4E342E" strokeWidth="2" />

        {/* Solar panels on roof */}
        <rect x="210" y="135" width="55" height="30" fill="#1A237E" stroke="#0D47A1" strokeWidth="1" rx="2" opacity="0.9" />
        <rect x="270" y="135" width="55" height="30" fill="#1A237E" stroke="#0D47A1" strokeWidth="1" rx="2" opacity="0.9" />
        {/* Panel grid lines */}
        <line x1="237" y1="135" x2="237" y2="165" stroke="#0D47A1" strokeWidth="0.5" opacity="0.5" />
        <line x1="210" y1="150" x2="265" y2="150" stroke="#0D47A1" strokeWidth="0.5" opacity="0.5" />
        <line x1="297" y1="135" x2="297" y2="165" stroke="#0D47A1" strokeWidth="0.5" opacity="0.5" />
        <line x1="270" y1="150" x2="325" y2="150" stroke="#0D47A1" strokeWidth="0.5" opacity="0.5" />

        {/* Windows */}
        <rect x="205" y="210" width="40" height="35" fill={isDay ? '#B3E5FC' : '#FFF9C4'} stroke="#546E7A" strokeWidth="1.5" rx="2" />
        <rect x="260" y="210" width="40" height="35" fill={isDay ? '#B3E5FC' : '#FFF9C4'} stroke="#546E7A" strokeWidth="1.5" rx="2" />
        <line x1="225" y1="210" x2="225" y2="245" stroke="#546E7A" strokeWidth="1" />
        <line x1="280" y1="210" x2="280" y2="245" stroke="#546E7A" strokeWidth="1" />

        {/* Door */}
        <rect x="310" y="248" width="35" height="62" fill="#6D4C41" stroke="#4E342E" strokeWidth="1.5" rx="2" />
        <circle cx="338" cy="280" r="3" fill="#FFD700" />

        {/* Chimney */}
        <rect x="330" y="118" width="20" height="40" fill="#8D6E63" stroke="#6D4C41" strokeWidth="1" />

        {/* Power pole (grid) */}
        <rect x="530" y="170" width="8" height="150" fill="#5D4037" />
        <line x1="510" y1="190" x2="560" y2="190" stroke="#5D4037" strokeWidth="4" />
        <line x1="515" y1="210" x2="555" y2="210" stroke="#5D4037" strokeWidth="3" />
        {/* Wires */}
        <line x1="510" y1="190" x2="490" y2="195" stroke="#333" strokeWidth="1.5" />
        <line x1="560" y1="190" x2="580" y2="195" stroke="#333" strokeWidth="1.5" />

        {/* Solar arrows - from panels to house */}
        {isSolarActive && (
          <g>
            <line x1="250" y1="140" x2="250" y2="125" stroke="#FFD700" strokeWidth="2.5" markerEnd="url(#arrowYellow)">
              <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
            </line>
            <rect x="220" y="108" width="60" height="18" rx="4" fill="rgba(0,0,0,0.6)" />
            <text x="250" y="121" textAnchor="middle" fill="#FFD700" fontSize="11" fontWeight="bold">{solarKw.toFixed(1)}kW</text>
          </g>
        )}

        {/* Power flow: house to/from grid */}
        {(isExporting || gridKw > 0.01) && (
          <g>
            <line
              x1="395" y1="250" x2="520" y2="250"
              stroke={isExporting ? '#36B37E' : '#E5484D'}
              strokeWidth="2.5"
              strokeDasharray="8 4"
            >
              <animate attributeName="stroke-dashoffset" values={isExporting ? "0;-24" : "-24;0"} dur="1s" repeatCount="indefinite" />
            </line>
            {/* Grid flow label */}
            <rect x="430" y="235" width="60" height="18" rx="4" fill="rgba(0,0,0,0.6)" />
            <text x="460" y="248" textAnchor="middle" fill={isExporting ? '#36B37E' : '#E5484D'} fontSize="11" fontWeight="bold">
              {gridKw.toFixed(1)}kW
            </text>
          </g>
        )}

        {/* Import/Export badge on grid */}
        <rect x="545" y="225" width="65" height="22" rx="4" fill={isExporting ? '#36B37E' : '#E5484D'} />
        <text x="577" y="240" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
          {isExporting ? 'EXPORT' : 'IMPORT'}
        </text>
        <text x="534" y="285" textAnchor="middle" fill={isDay ? '#1B2838' : '#E8E8E8'} fontSize="11" fontWeight="500">Grid</text>

        {/* House consumption label */}
        <rect x="228" y="270" width="85" height="22" rx="4" fill="rgba(0,0,0,0.6)" />
        <text x="270" y="285" textAnchor="middle" fill="#FFD700" fontSize="11" fontWeight="bold">
          ⚡ {consumptionKw.toFixed(2)} kW
        </text>

        {/* Trees / decoration */}
        <circle cx="100" cy="280" r="25" fill={isDay ? '#66BB6A' : '#2E7D32'} />
        <circle cx="115" cy="270" r="20" fill={isDay ? '#81C784' : '#388E3C'} />
        <circle cx="85" cy="275" r="18" fill={isDay ? '#43A047' : '#1B5E20'} />
        <rect x="95" y="295" width="8" height="20" fill="#5D4037" />

        {/* Flowers */}
        {isDay && (
          <g>
            {[130, 140, 150, 160, 170].map((x, i) => (
              <g key={i}>
                <line x1={x} y1="310" x2={x} y2="295" stroke="#4CAF50" strokeWidth="1.5" />
                <circle cx={x} cy="293" r="4" fill={['#E91E63', '#FF5722', '#FFEB3B', '#E91E63', '#FF5722'][i]} />
              </g>
            ))}
          </g>
        )}

        {/* Arrow marker defs */}
        <defs>
          <marker id="arrowYellow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#FFD700" />
          </marker>
        </defs>
      </svg>

      {/* Timeline bar overlaid at bottom */}
      <div className="absolute bottom-2 left-3 right-3 flex gap-0.5 h-3">
        {timelineSegments.map((seg, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{ backgroundColor: seg.bg, opacity: seg.active ? 1 : 0.5 }}
          />
        ))}
      </div>
      {/* Timeline labels */}
      <div className="absolute bottom-6 left-3 right-3 flex justify-between text-[9px] text-white/60 font-mono">
        <span>6am</span><span>12pm</span><span>6pm</span><span>12am</span><span>5am</span>
      </div>
    </div>
  );
}
