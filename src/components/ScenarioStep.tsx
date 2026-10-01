import { useEffect, useMemo } from 'react';
import { Sun, Battery, Sparkles, Clock, Wand2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Slider } from '@project/components/ui/slider';
import Navbar from './Navbar';
import { EnergyFlowChart } from './scenario/EnergyFlowCharts';
import { useWizard } from './WizardContext';
import { calculateProfile, toHourly, getBestRecommendation, estimateDailySolarProduction, generateAllCombos, getTopPicks } from '../lib/energy';
import { useBatteryProducts, cheapestPerCapacity } from '../lib/useBatteryProducts';
import { toast } from 'sonner';


const PANEL_PRICE = 1200; // indicative installed $/panel until solar prices are available
const PANEL_KW = 0.485;

export default function ScenarioStep() {
  const { profile, setStep, scenarioSolarKw, setScenarioSolarKw, scenarioBatteryKwh, setScenarioBatteryKwh } = useWizard();
  const { offers } = useBatteryProducts();
  const priced = useMemo(() => cheapestPerCapacity(offers), [offers]);
  // Cheapest battery at or above the chosen size — brand/model is picked later
  const offer = scenarioBatteryKwh > 0
    ? offers.filter((o) => o.capacityKwh >= scenarioBatteryKwh).sort((a, b) => a.installedPrice - b.installedPrice)[0]
    : undefined;
  const existingKw = profile.hasSolar ? profile.solarSystemSizeKw : 0;
  const solarMax = Math.max(13.3, Math.ceil((existingKw + 6.6) * 10) / 10);
  useEffect(() => {
    if (scenarioSolarKw < existingKw) setScenarioSolarKw(existingKw);
  }, [scenarioSolarKw, existingKw, setScenarioSolarKw]);
  const newSolarKw = Math.max(0, scenarioSolarKw - existingKw);
  const panels = Math.ceil(newSolarKw / PANEL_KW - 0.01);
  const solarPrice = panels * PANEL_PRICE;
  const totalPrice = solarPrice + (offer?.installedPrice ?? 0);

  const optimise = () => {
    const best = getTopPicks(generateAllCombos(profile, false, priced)).bestTenYear;
    if (!best) { toast('Your current setup already looks like the best value.'); return; }
    setScenarioSolarKw(Math.max(existingKw, Math.round(best.solarKw * 10) / 10));
    setScenarioBatteryKwh(best.batteryKwh);
    toast.success(`Optimised: ${best.solarKw.toFixed(1)} kW solar${best.batteryKwh ? ` + ${best.batteryKwh} kWh battery` : ''}`);
  };

  const currentResult = useMemo(() => calculateProfile(profile), [profile]);
  const scenarioResult = useMemo(
    () => calculateProfile(profile, scenarioSolarKw, scenarioBatteryKwh),
    [profile, scenarioSolarKw, scenarioBatteryKwh]
  );
  const hourly = useMemo(() => toHourly(scenarioResult.slots), [scenarioResult]);
  const recommendation = useMemo(() => getBestRecommendation(profile, currentResult), [profile, currentResult]);

  const savings = currentResult.quarterlyBill - scenarioResult.quarterlyBill;
  const dailySavings = currentResult.dailyCost - scenarioResult.dailyCost;
  const annualSavings = dailySavings * 365;

  // Battery overnight duration estimate
  const usableBattery = scenarioBatteryKwh * 0.9;
  const eveningDemandPerHour = scenarioResult.dailyDemand / 24 * 1.3; // evening is ~30% above average
  const batteryHours = usableBattery > 0 ? usableBattery / eveningDemandPerHour : 0;
  const depletionHour = Math.min(6, batteryHours); // capped at sunrise
  const depletionTime = batteryHours > 0 ? formatDepletion(18 + batteryHours) : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={3} totalSteps={7} />
      <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 w-full">
        <h2 className="text-2xl font-bold text-foreground mb-1">What If…?</h2>
        <p className="text-muted-foreground text-sm mb-8">Drag the sliders to model solar, battery, or both.</p>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Controls */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
            {/* Solar card */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Sun className="w-5 h-5 text-accent" />
                <span className="font-semibold text-sm">Solar System</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">System Size</p>
              {existingKw > 0 && (
                <div className="relative h-5 mb-1 text-[10px] font-semibold">
                  <div className="absolute inset-y-0 left-0 rounded-md bg-muted-foreground/20 border border-muted-foreground/30 flex items-center justify-center text-muted-foreground overflow-hidden whitespace-nowrap"
                    style={{ width: `${(existingKw / solarMax) * 100}%` }}>
                    Existing {existingKw.toFixed(1)} kW
                  </div>
                  <div className="absolute inset-y-0 right-0 rounded-md bg-primary/10 border border-dashed border-primary/40 flex items-center justify-center text-primary overflow-hidden whitespace-nowrap"
                    style={{ left: `calc(${(existingKw / solarMax) * 100}% + 2px)` }}>
                    Add capacity →
                  </div>
                </div>
              )}
              <Slider
                value={[Math.max(scenarioSolarKw, existingKw)]}
                onValueChange={([v]) => setScenarioSolarKw(Math.max(existingKw, Math.round(v * 10) / 10))}
                min={0} max={solarMax} step={0.1}
                className="mb-2"
              />
              <div className="flex justify-between text-xs">
                <span className="font-bold text-foreground">{scenarioSolarKw.toFixed(1)} kW total</span>
                <span className="text-muted-foreground">{existingKw > 0 ? `min ${existingKw.toFixed(1)} kW (existing)` : `0–${solarMax} kW`}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Est. daily production: {estimateDailySolarProduction(scenarioSolarKw).toFixed(1)} kWh
              </p>
              {panels > 0 && (
                <p className="text-xs text-foreground mt-1">{panels} new panels · ${solarPrice.toLocaleString()} installed (indicative)</p>
              )}
              {existingKw > 0 && (
                <p className={`text-xs mt-1 font-medium ${scenarioSolarKw > existingKw ? 'text-primary' : 'text-muted-foreground'}`}>
                  {scenarioSolarKw > existingKw
                    ? `Your ${existingKw.toFixed(1)} kW + ${(scenarioSolarKw - existingKw).toFixed(1)} kW new`
                    : 'Showing your existing system — slide right to add panels'}
                </p>
              )}
            </div>

            {/* Battery card */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Battery className="w-5 h-5 text-secondary" />
                <span className="font-semibold text-sm">Battery</span>
                {scenarioBatteryKwh > 0 && (
                  <span className="ml-auto text-lg font-bold text-foreground">{scenarioBatteryKwh} kWh</span>
                )}
              </div>
              <Slider
                value={[scenarioBatteryKwh]}
                onValueChange={([v]) => setScenarioBatteryKwh(v)}
                min={0} max={40} step={0.5}
                className="mb-2"
              />
              <div className="flex justify-between text-xs mb-2">
                <span className="font-bold text-foreground">{scenarioBatteryKwh === 0 ? 'No battery' : `${scenarioBatteryKwh} kWh`}</span>
                <span className="text-muted-foreground">0–40 kWh</span>
              </div>
              {scenarioBatteryKwh > 0 && (
                <p className="text-xs text-muted-foreground">
                  {(scenarioBatteryKwh * 0.9).toFixed(1)} kWh usable · 10% reserve · 90% round-trip
                </p>
              )}
              {offer && (
                <p className="text-xs text-foreground mt-2">
                  Installed from <span className="font-semibold">${offer.installedPrice.toLocaleString()}</span> (indicative)
                </p>
              )}
            </div>

            <Button onClick={optimise} className="w-full rounded-xl gap-2">
              <Wand2 className="w-4 h-4" /> Optimise my system
            </Button>
            {totalPrice > 0 && (
              <p className="text-xs text-muted-foreground">
                Total system: <span className="font-semibold text-foreground">${totalPrice.toLocaleString()}</span>
                {annualSavings > 0 && <> · Payback {(totalPrice / annualSavings).toFixed(1)} yrs</>}
              </p>
            )}

            {/* Recommendation */}
            <div className="bg-accent/15 border border-accent/30 rounded-2xl p-4 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Best opportunity: {recommendation.type === 'solar_battery' ? 'Solar + Battery' : recommendation.type === 'battery' ? 'Battery' : 'Solar'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{recommendation.reason}</p>
              </div>
            </div>
          </div>

          {/* Right: Charts + comparison */}
          <div className="flex-1 space-y-4">
            <EnergyFlowChart hourly={hourly} hasBattery={scenarioBatteryKwh > 0} batteryKwh={scenarioBatteryKwh} />

            {/* Bill comparison */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-card rounded-2xl p-3 sm:p-5 border border-border shadow-sm text-center">
                <p className="text-xs text-muted-foreground mb-1">Current Quarterly Bill</p>
                <p className="text-2xl sm:text-3xl font-bold text-foreground">${Math.round(currentResult.quarterlyBill).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">${currentResult.dailyCost.toFixed(2)}/day</p>
              </div>
              <div className="bg-card rounded-2xl p-3 sm:p-5 border-2 border-primary shadow-sm text-center">
                <p className="text-xs text-muted-foreground mb-1">Projected Quarterly Bill</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary">${Math.round(scenarioResult.quarterlyBill).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">${scenarioResult.dailyCost.toFixed(2)}/day</p>
                {savings > 0 && (
                  <p className="text-sm text-primary font-semibold mt-2">↘ Save ${Math.round(savings)}/quarter</p>
                )}
              </div>
            </div>

            {/* Annual savings */}
            {annualSavings > 0 && (
              <div className="bg-primary/10 rounded-2xl p-4 text-center">
                <p className="text-sm text-foreground">
                  Estimated annual savings: <span className="font-bold text-primary text-lg">${Math.round(annualSavings).toLocaleString()}/year</span>
                </p>
              </div>
            )}

            {/* Battery timeline */}
            {scenarioBatteryKwh > 0 && (
              <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-secondary" />
                  <p className="text-sm font-semibold text-foreground">Battery Coverage Timeline</p>
                </div>
                <div className="w-full h-7 rounded-full bg-muted relative overflow-hidden">
                  <div
                    className="absolute left-0 h-full rounded-full"
                    style={{
                      left: '0%',
                      width: `${Math.min(100, (depletionHour / 12) * 100)}%`,
                      background: 'linear-gradient(90deg, #36B37E, #2D9966)',
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Sunset 6 PM</span>
                  {depletionTime && <span>Battery depleted {depletionTime}</span>}
                  <span>Sunrise 6 AM</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {batteryHours >= 12
                    ? 'Battery covers the full overnight period!'
                    : `Grid supplies the remaining ${(12 - batteryHours).toFixed(1)} hours of overnight usage at off-peak rates.`}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <Button variant="outline" onClick={() => setStep(profile.hasSolar ? 2.5 : 2)} className="rounded-xl">← Back</Button>
          <Button onClick={() => setStep(4)} className="flex-1 py-6 rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold">
            See Your Energy Day →
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDepletion(hour24: number): string {
  const h = hour24 % 24;
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr >= 12 ? 'AM' : 'PM'; // after midnight is AM
  const display = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${display}:${min.toString().padStart(2, '0')} ${ampm}`;
}
