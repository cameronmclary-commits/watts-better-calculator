// Brisbane-area typical household load profile (fraction of daily total per half-hour)
// Scaled so 48 values sum to 1.0
const LOAD_PROFILE_48 = [
  0.012, 0.011, 0.010, 0.010, 0.009, 0.009, 0.009, 0.009, // 12am-4am
  0.010, 0.011, 0.014, 0.018, 0.022, 0.025, 0.028, 0.026, // 4am-8am
  0.022, 0.020, 0.018, 0.016, 0.015, 0.014, 0.014, 0.015, // 8am-12pm
  0.016, 0.017, 0.019, 0.021, 0.024, 0.028, 0.032, 0.036, // 12pm-4pm
  0.040, 0.044, 0.046, 0.045, 0.042, 0.038, 0.034, 0.030, // 4pm-8pm
  0.026, 0.023, 0.020, 0.018, 0.016, 0.015, 0.014, 0.013, // 8pm-12am
];

const normalise48 = (a: number[]) => { const s = a.reduce((x, y) => x + y, 0); return a.map((v) => v / s); };

export type UsagePattern = 'evening' | 'daytime' | 'steady';

export const USAGE_PATTERNS: Record<UsagePattern, { label: string; summary: string; profile: number[] }> = {
  evening: {
    label: 'Out during the day',
    summary: 'Morning and evening peaks — most usage 4pm–9pm when cooking, TV and air-con kick in. Typical for working households.',
    profile: normalise48(LOAD_PROFILE_48),
  },
  daytime: {
    label: 'Home during the day',
    summary: 'Steady daytime use from working from home, retirees or young families, with a smaller evening peak.',
    profile: normalise48(LOAD_PROFILE_48.map((v, i) => (i >= 16 && i < 34 ? v + 0.022 : i >= 34 && i < 42 ? v * 0.8 : v))),
  },
  steady: {
    label: 'Fairly even, day & night',
    summary: 'Consistent usage around the clock — pool pumps, overnight hot water, shift work or electric heating.',
    profile: normalise48(LOAD_PROFILE_48.map((v) => v * 0.5 + 0.0105)),
  },
};

// Solar bell curve (fraction of daily production per half-hour)
// Peak at solar noon (~12:30), zero before 6am and after 6pm
const SOLAR_PROFILE_48 = [
  0, 0, 0, 0, 0, 0, 0, 0, // 12am-4am
  0, 0, 0, 0.005, 0.015, 0.028, 0.042, 0.055, // 4am-8am
  0.065, 0.073, 0.079, 0.082, 0.083, 0.082, 0.079, 0.073, // 8am-12pm
  0.065, 0.055, 0.042, 0.028, 0.015, 0.005, 0, 0, // 12pm-4pm
  0, 0, 0, 0, 0, 0, 0, 0, // 4pm-8pm
  0, 0, 0, 0, 0, 0, 0, 0, // 8pm-12am
];

// Default TOU windows (Brisbane Energex)
export const DEFAULT_TOU_WINDOWS = {
  peak: { start: 16, end: 20 },       // 4pm-8pm
  shoulder: { start: 7, end: 16 },     // 7am-4pm
  offPeak: { start: 20, end: 7 },      // 8pm-7am (wraps)
};

export interface EnergyProfile {
  tariffType: 'flat' | 'tou';
  peakRate: number;       // ¢/kWh
  shoulderRate: number;
  offPeakRate: number;
  flatRate: number;
  dailySupplyCharge: number; // $/day
  feedInRate: number;     // ¢/kWh
  billingPeriodDays: number;
  peakUsageKwh: number;
  shoulderUsageKwh: number;
  offPeakUsageKwh: number;
  totalGridUsageKwh: number;
  totalExportKwh: number;
  solarSystemSizeKw: number;
  hasSolar: boolean;
  totalBillAmount: number;
  usagePattern?: UsagePattern;
  intervalData?: number[][];
}

/** Rates are stored internally in cents; display them as $/kWh */
export const fmtRate = (cents: number) => {
  const d = Number((cents / 100).toFixed(4));
  const s = String(d).split('.')[1]?.length >= 2 ? String(d) : d.toFixed(2);
  return `$${s}/kWh`;
};
/** Accept either dollars (0.33) or cents (33) and return cents */
export const parseRateToCents = (n: number) => (n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n);

/** Calculate expected bill from profile inputs */
export function calculateBillFromProfile(p: EnergyProfile): number {
  const supplyCost = p.dailySupplyCharge * p.billingPeriodDays;
  let usageCost: number;
  if (p.tariffType === 'tou') {
    usageCost = (p.peakUsageKwh * p.peakRate + p.shoulderUsageKwh * p.shoulderRate + p.offPeakUsageKwh * p.offPeakRate) / 100;
  } else {
    usageCost = p.totalGridUsageKwh * p.flatRate / 100;
  }
  const exportCredit = !p.hasSolar ? 0 : p.totalExportKwh * p.feedInRate / 100;
  return supplyCost + usageCost - exportCredit;
}

export interface HalfHourSlot {
  hour: number;
  minute: number;
  label: string;
  demand: number;
  solar: number;
  selfConsumed: number;
  exported: number;
  gridImport: number;
  touPeriod: 'peak' | 'shoulder' | 'offPeak';
  cost: number;
  batteryCharge: number;
  batteryDischarge: number;
  batteryLevel: number;
}

export interface ScenarioResult {
  slots: HalfHourSlot[];
  dailyDemand: number;
  dailyCost: number;
  dailySolarGeneration: number;
  dailySelfConsumed: number;
  dailyExported: number;
  dailyGridImport: number;
  dailyFeedInCredit: number;
  quarterlyBill: number;
  monthlyBill: number;
  peakCost: number;
  shoulderCost: number;
  offPeakCost: number;
  supplyCost: number;
}

function getTouPeriod(hour: number): 'peak' | 'shoulder' | 'offPeak' {
  if (hour >= DEFAULT_TOU_WINDOWS.peak.start && hour < DEFAULT_TOU_WINDOWS.peak.end) return 'peak';
  if (hour >= DEFAULT_TOU_WINDOWS.shoulder.start && hour < DEFAULT_TOU_WINDOWS.peak.start) return 'shoulder';
  return 'offPeak';
}

function getRateForPeriod(profile: EnergyProfile, period: 'peak' | 'shoulder' | 'offPeak'): number {
  if (profile.tariffType === 'flat') return profile.flatRate;
  switch (period) {
    case 'peak': return profile.peakRate;
    case 'shoulder': return profile.shoulderRate;
    case 'offPeak': return profile.offPeakRate;
  }
}

export function estimateDailySolarProduction(systemSizeKw: number): number {
  return systemSizeKw * 4.2;
}

export function calculateProfile(
  profile: EnergyProfile,
  scenarioSolarKw?: number,
  scenarioBatteryKwh?: number,
  options?: { biDirCharging?: boolean }
): ScenarioResult {
  const selfConsumedExisting = profile.hasSolar ? estimateSelfConsumed(profile) : 0;
  const dailyGridUsage = profile.totalGridUsageKwh / profile.billingPeriodDays;
  const dailyDemand = dailyGridUsage + selfConsumedExisting;

  // Build per-slot demand that respects user's TOU bracket usage
  const slotDemands = buildSlotDemands(profile, dailyDemand);

  const solarKw = scenarioSolarKw ?? (profile.hasSolar ? profile.solarSystemSizeKw : 0);
  const dailySolar = estimateDailySolarProduction(solarKw);
  const batteryKwh = scenarioBatteryKwh ?? 0;
  const usableBattery = batteryKwh * 0.9;
  const biDir = options?.biDirCharging ?? false;

  let batteryLevel = 0;
  let biDirChargedToday = 0;
  const slots: HalfHourSlot[] = [];

  // Simulate two days so the battery enters the recorded day with its realistic overnight charge
  for (let k = 0; k < 96; k++) {
    const i = k % 48;
    const record = k >= 48;
    if (k === 48) biDirChargedToday = 0;
    let batteryCharge = 0;
    let batteryDischarge = 0;
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    const label = `${hour.toString().padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;

    const demand = slotDemands[i];
    const solar = dailySolar * SOLAR_PROFILE_48[i];
    const touPeriod = getTouPeriod(hour);
    const rate = getRateForPeriod(profile, touPeriod);

    let selfConsumed = Math.min(solar, demand);
    let surplus = solar - selfConsumed;
    let deficit = demand - selfConsumed;

    // Battery: charge from surplus
    if (surplus > 0 && batteryLevel < usableBattery) {
      const charge = Math.min(surplus, usableBattery - batteryLevel, batteryKwh * 0.5 / 2);
      batteryLevel += charge;
      batteryCharge += charge;
      surplus -= charge;
    }

    // Bi-directional grid charging: 11am-2pm window at 6c/kWh, max 30kWh/day
    if (biDir && hour >= 11 && hour < 14 && batteryLevel < usableBattery && biDirChargedToday < 30) {
      const maxCharge = Math.min(usableBattery - batteryLevel, batteryKwh * 0.5 / 2, (30 - biDirChargedToday) / 6);
      batteryLevel += maxCharge;
      batteryCharge += maxCharge;
      biDirChargedToday += maxCharge;
      // Cost of grid charging at 6c/kWh already factored as extra import
      deficit += maxCharge;
    }

    // Battery: discharge to cover deficit
    if (deficit > 0 && batteryLevel > 0) {
      const discharge = Math.min(deficit, batteryLevel, batteryKwh * 0.5 / 2);
      batteryLevel -= discharge;
      batteryDischarge += discharge;
      deficit -= discharge;
    }

    const exported = surplus;
    const gridImport = deficit;
    const cost = (gridImport * rate / 100) - (exported * profile.feedInRate / 100);

    if (record) slots.push({ hour, minute, label, demand, solar, selfConsumed: 0, exported, gridImport, touPeriod, cost, batteryCharge, batteryDischarge, batteryLevel });
  }

  // Fix selfConsumed
  for (const s of slots) {
    s.selfConsumed = s.solar - s.exported;
  }

  const actualDailyDemand = slots.reduce((s, sl) => s + sl.demand, 0);
  const dailySolarGeneration = slots.reduce((s, sl) => s + sl.solar, 0);
  const dailySelfConsumed = slots.reduce((s, sl) => s + sl.selfConsumed, 0);
  const dailyExported = slots.reduce((s, sl) => s + sl.exported, 0);
  const dailyGridImport = slots.reduce((s, sl) => s + sl.gridImport, 0);
  const dailyCostFromSlots = slots.reduce((s, sl) => s + sl.cost, 0);
  const dailyFeedInCredit = dailyExported * profile.feedInRate / 100;
  const dailyCost = dailyCostFromSlots + profile.dailySupplyCharge;

  const peakCost = slots.filter(s => s.touPeriod === 'peak').reduce((s, sl) => s + sl.cost, 0);
  const shoulderCost = slots.filter(s => s.touPeriod === 'shoulder').reduce((s, sl) => s + sl.cost, 0);
  const offPeakCost = slots.filter(s => s.touPeriod === 'offPeak').reduce((s, sl) => s + sl.cost, 0);

  return {
    slots,
    dailyDemand: actualDailyDemand,
    dailyCost,
    dailySolarGeneration,
    dailySelfConsumed,
    dailyExported,
    dailyGridImport,
    dailyFeedInCredit,
    quarterlyBill: dailyCost * 91,
    monthlyBill: dailyCost * 30.4,
    peakCost,
    shoulderCost,
    offPeakCost,
    supplyCost: profile.dailySupplyCharge,
  };
}

function estimateSelfConsumed(profile: EnergyProfile): number {
  const totalProd = estimateDailySolarProduction(profile.solarSystemSizeKw);
  const dailyExport = profile.totalExportKwh / profile.billingPeriodDays;
  return Math.max(0, totalProd - dailyExport);
}

/**
 * Build per-slot (48) demand array that respects user's TOU bracket kWh.
 * For TOU tariffs: scale the generic load profile within each TOU period
 * so that total demand in peak/shoulder/offPeak matches user-entered values.
 * For flat tariffs: use generic profile scaled to total usage.
 */
function buildSlotDemands(profile: EnergyProfile, dailyDemand: number): number[] {
  if (profile.tariffType === 'flat' || (profile.peakUsageKwh === 0 && profile.shoulderUsageKwh === 0 && profile.offPeakUsageKwh === 0)) {
    // Flat: distribute using generic shape
    return (USAGE_PATTERNS[profile.usagePattern ?? 'evening'] ?? USAGE_PATTERNS.evening).profile.map(f => dailyDemand * f);
  }

  // TOU: get daily bracket usage from billing-period totals
  const days = profile.billingPeriodDays || 91;
  const dailyPeak = profile.peakUsageKwh / days;
  const dailyShoulder = profile.shoulderUsageKwh / days;
  const dailyOffPeak = profile.offPeakUsageKwh / days;

  // Add self-consumed solar back proportionally (it's demand met by solar, not grid)
  const selfConsumed = profile.hasSolar ? estimateSelfConsumed(profile) : 0;
  // Solar self-consumption happens during shoulder hours, so add it to shoulder
  const dailyShoulderTotal = dailyShoulder + selfConsumed;

  // Sum generic profile fractions per TOU period
  let sumPeak = 0, sumShoulder = 0, sumOffPeak = 0;
  for (let i = 0; i < 48; i++) {
    const hour = Math.floor(i / 2);
    const period = getTouPeriod(hour);
    if (period === 'peak') sumPeak += LOAD_PROFILE_48[i];
    else if (period === 'shoulder') sumShoulder += LOAD_PROFILE_48[i];
    else sumOffPeak += LOAD_PROFILE_48[i];
  }

  // Scale each slot's generic fraction to match the user's bracket total for that period
  // Blend the generic shape with an even spread inside each period to avoid sharp ramps
  const counts = { peak: 0, shoulder: 0, offPeak: 0 };
  for (let i = 0; i < 48; i++) counts[getTouPeriod(Math.floor(i / 2))]++;
  const weight = (f: number, sum: number, n: number) => (sum > 0 ? 0.35 * (f / sum) + 0.65 / n : 1 / n);

  return LOAD_PROFILE_48.map((f, i) => {
    const hour = Math.floor(i / 2);
    const period = getTouPeriod(hour);
    if (period === 'peak') return weight(f, sumPeak, counts.peak) * dailyPeak;
    if (period === 'shoulder') return weight(f, sumShoulder, counts.shoulder) * dailyShoulderTotal;
    return weight(f, sumOffPeak, counts.offPeak) * dailyOffPeak;
  });
}

export function getBestRecommendation(
  profile: EnergyProfile,
  currentResult: ScenarioResult
): { type: 'solar' | 'battery' | 'solar_battery'; reason: string } {
  if (!profile.hasSolar && profile.solarSystemSizeKw === 0) {
    return { type: 'solar', reason: 'Adding solar would offset your daytime usage and reduce grid costs significantly.' };
  }
  if (currentResult.dailyExported > currentResult.dailySolarGeneration * 0.25) {
    return { type: 'battery', reason: 'Your solar already covers daytime — a battery captures overnight value.' };
  }
  return { type: 'solar_battery', reason: 'A larger solar system with a battery would maximise your savings.' };
}

// Aggregate slots to hourly for charts
export function toHourly(slots: HalfHourSlot[]) {
  const hourly: { hour: number; label: string; demand: number; solar: number; selfConsumed: number; exported: number; gridImport: number; cost: number; touPeriod: 'peak' | 'shoulder' | 'offPeak'; batteryCharge: number; batteryDischarge: number; batteryLevel: number }[] = [];
  // Day starts at 6am and runs through to 5am the next morning
  for (let i = 0; i < 24; i++) {
    const h = (i + 6) % 24;
    const pair = slots.filter(s => s.hour === h);
    hourly.push({
      hour: h,
      label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
      demand: pair.reduce((s, p) => s + p.demand, 0),
      solar: pair.reduce((s, p) => s + p.solar, 0),
      selfConsumed: pair.reduce((s, p) => s + p.selfConsumed, 0),
      exported: pair.reduce((s, p) => s + p.exported, 0),
      gridImport: pair.reduce((s, p) => s + p.gridImport, 0),
      cost: pair.reduce((s, p) => s + p.cost, 0),
      touPeriod: pair[0]?.touPeriod ?? 'offPeak',
      batteryCharge: pair.reduce((s, p) => s + p.batteryCharge, 0),
      batteryDischarge: pair.reduce((s, p) => s + p.batteryDischarge, 0),
      batteryLevel: pair[pair.length - 1]?.batteryLevel ?? 0,
    });
  }
  return hourly;
}

/* ================================================================
   FULL COMPARISON ENGINE
   ================================================================ */

// Panel config: 7–27 panels at 485W each
const PANEL_WATT = 485;
const MIN_PANELS = 7;
const MAX_PANELS = 27;

// Battery options
export const BATTERY_SIZES = [12.8, 16, 19.2, 22.4, 25.6, 32, 40, 48];

// Indicative install costs
const COST_PER_PANEL = 1200; // installed $/panel (premium tier)
const BATTERY_COST_PER_KWH = 765;
const BATTERY_INSTALL_BASE = 1500; // fixed install cost for battery

export const CAPITAL_IMPROVEMENT_FACTOR = 0.8; // 80% of install cost = property value add
export const ESCALATION_RATE = 0.08; // 8% electricity price escalation

export interface SystemCombo {
  id: string;
  solarPanels: number; // 0 = existing solar
  solarKw: number;
  hasBattery: boolean;
  batteryKwh: number;
  category: 'solar_only' | 'battery_only' | 'solar_battery';
  label: string;
  subLabel: string;
  totalCost: number;
  propertyValueAdd: number;
  netInvestment: number;
  year1Savings: number;
  tenYearReturn: number;
  selfSufficiency: number; // 0-100
  dailyNewCost: number;
  annualNewCost: number;
  paybackYears: number;
  adjPaybackYears: number; // adjusted for property value
  batteryProduct?: string; // product name from the Battery Database
}

export interface BatteryPriceOption { capacityKwh: number; installedPrice: number; label: string }

function panelCost(panels: number): number {
  return panels * COST_PER_PANEL;
}
function batteryCost(kwh: number): number {
  return kwh * BATTERY_COST_PER_KWH + BATTERY_INSTALL_BASE;
}

export function generateAllCombos(
  profile: EnergyProfile,
  biDirCharging: boolean,
  batteryOptions: BatteryPriceOption[] = []
): SystemCombo[] {
  // Live priced batteries when available, otherwise indicative sizes and rates
  const batteries: BatteryPriceOption[] = batteryOptions.length
    ? batteryOptions
    : BATTERY_SIZES.map((k) => ({ capacityKwh: k, installedPrice: batteryCost(k), label: '' }));
  const baseline = calculateProfile(profile, profile.hasSolar ? profile.solarSystemSizeKw : 0, 0);
  const baselineAnnual = baseline.dailyCost * 365;
  const combos: SystemCombo[] = [];

  const evalCombo = (
    panels: number,
    solarKw: number,
    batteryKwh: number,
    category: SystemCombo['category'],
    label: string,
    subLabel: string,
    totalCost: number,
    batteryProduct?: string
  ) => {
    const result = calculateProfile(profile, solarKw, batteryKwh, { biDirCharging: biDirCharging && batteryKwh > 0 });
    const annualNew = result.dailyCost * 365;
    const year1Savings = baselineAnnual - annualNew;
    if (year1Savings <= 0) return; // skip combos that don't save money

    // 10yr return with 8% escalation
    let tenYrReturn = 0;
    for (let y = 0; y < 10; y++) {
      tenYrReturn += year1Savings * Math.pow(1 + ESCALATION_RATE, y);
    }
    tenYrReturn -= totalCost;

    const selfSuff = result.dailyDemand > 0
      ? Math.round((1 - result.dailyGridImport / result.dailyDemand) * 100)
      : 0;

    const propValue = totalCost * CAPITAL_IMPROVEMENT_FACTOR;
    const netInvestment = totalCost - propValue;
    const payback = year1Savings > 0 ? totalCost / year1Savings : 99;
    const adjPayback = year1Savings > 0 ? netInvestment / year1Savings : 99;

    combos.push({
      id: `${panels}p-${batteryKwh}`,
      solarPanels: panels,
      solarKw,
      hasBattery: batteryKwh > 0,
      batteryKwh,
      category,
      label,
      subLabel,
      totalCost,
      propertyValueAdd: propValue,
      netInvestment,
      year1Savings,
      tenYearReturn: tenYrReturn,
      selfSufficiency: selfSuff,
      dailyNewCost: result.dailyCost,
      annualNewCost: annualNew,
      paybackYears: Math.round(payback * 10) / 10,
      adjPaybackYears: Math.max(0, Math.round(adjPayback * 10) / 10),
      batteryProduct,
    });
  };

  // Solar only combos (only if user doesn't have solar, or to upgrade)
  if (!profile.hasSolar) {
    for (let p = MIN_PANELS; p <= MAX_PANELS; p++) {
      const kw = p * PANEL_WATT / 1000;
      evalCombo(p, kw, 0, 'solar_only', `${p} panels (${kw.toFixed(2)} kW)`, 'Solar only', panelCost(p));
    }
  }

  // Battery only combos (existing solar)
  if (profile.hasSolar) {
    for (const b of batteries) {
      evalCombo(0, profile.solarSystemSizeKw, b.capacityKwh, 'battery_only',
        'Existing solar', b.label || `${b.capacityKwh} kWh battery`, b.installedPrice, b.label || undefined);
    }
  }

  // Solar + battery combos
  for (let p = MIN_PANELS; p <= MAX_PANELS; p += 2) { // step by 2 to keep combos manageable
    const kw = p * PANEL_WATT / 1000;
    for (const b of batteries) {
      const solarCostVal = profile.hasSolar ? 0 : panelCost(p);
      const effectiveSolarKw = profile.hasSolar ? profile.solarSystemSizeKw : kw;
      evalCombo(p, effectiveSolarKw, b.capacityKwh, 'solar_battery',
        profile.hasSolar ? 'Existing solar' : `${p}p · ${kw.toFixed(2)} kW`,
        b.label || `${b.capacityKwh} kWh battery`,
        solarCostVal + b.installedPrice, b.label || undefined);
    }
  }

  return combos;
}

export type SortMode = 'payback' | 'savings' | 'selfSuff';

export function getTopPicks(combos: SystemCombo[]): {
  fastestPayback: SystemCombo | null;
  bestTenYear: SystemCombo | null;
  bestSavings: SystemCombo | null;
  mostSelfSuff: SystemCombo | null;
} {
  if (combos.length === 0) return { fastestPayback: null, bestTenYear: null, bestSavings: null, mostSelfSuff: null };

  const sorted = [...combos];
  return {
    fastestPayback: [...sorted].sort((a, b) => a.paybackYears - b.paybackYears)[0],
    bestTenYear: [...sorted].sort((a, b) => b.tenYearReturn - a.tenYearReturn)[0],
    bestSavings: [...sorted].sort((a, b) => b.year1Savings - a.year1Savings)[0],
    mostSelfSuff: [...sorted].sort((a, b) => b.selfSufficiency - a.selfSufficiency)[0],
  };
}

export function sortAndGroupCombos(
  combos: SystemCombo[],
  sortBy: SortMode,
  topN: number = 10
): Record<string, SystemCombo[]> {
  const sorted = [...combos].sort((a, b) => {
    if (sortBy === 'payback') return a.paybackYears - b.paybackYears;
    if (sortBy === 'savings') return b.year1Savings - a.year1Savings;
    return b.selfSufficiency - a.selfSufficiency;
  });

  const groups: Record<string, SystemCombo[]> = {};
  for (const combo of sorted) {
    const cat = categoryLabel(combo.category);
    if (!groups[cat]) groups[cat] = [];
    if (groups[cat].length < topN) groups[cat].push(combo);
  }
  return groups;
}

export function categoryLabel(cat: string): string {
  switch (cat) {
    case 'solar_only': return 'Solar Only';
    case 'battery_only': return 'Battery Only';
    case 'solar_battery': return 'Solar + Battery';
    default: return cat;
  }
}

export const MODEL_ASSUMPTIONS = [
  'Electricity price escalation: 8% per year. Year 1 savings compounded at 8%/yr over 10 years.',
  'Solar generation: 4.2 peak sun hours/day, bell curve profile centred at 12:30pm.',
  `Solar sizing: ${MIN_PANELS} to ${MAX_PANELS} panels at ${PANEL_WATT}W each (${(MIN_PANELS * PANEL_WATT / 1000).toFixed(1)}kW–${(MAX_PANELS * PANEL_WATT / 1000).toFixed(1)}kW), increments of ${(PANEL_WATT / 1000).toFixed(3)}kW.`,
  'Battery products and installed prices: read live from the Battery Database (cheapest product at each capacity). If it can\'t be reached, the last fetched prices are used.',
  `Solar panels: indicative $${COST_PER_PANEL.toLocaleString()} installed per panel (no solar prices in the Battery Database yet).`,
  'Battery usable capacity: 90% of rated. Battery charges from solar surplus first.',
  'Bi-directional charging: grid → battery at 6c/kWh, 11am–2pm window, max 30 kWh/day.',
  'Smartshift plan caps all import rates at 21.5c/kWh.',
  'Existing solar: export redirected to battery (FIT lost on captured kWh). FIT maintained on residual export.',
  'Legacy FIT (above $0.20/kWh): lost on any new panel installation. Battery-only retrofits preserve existing FIT.',
  'Capital improvement factor: 80% of install cost treated as property value increase.',
  'No system degradation or maintenance costs modelled.',
];
