import type { EnergyProfile, UsagePattern } from '../../lib/energy';
import { USAGE_PATTERNS, fmtRate } from '../../lib/energy';

export type NumField = { key: keyof EnergyProfile; label: string; unit: string; step?: number; rate?: boolean };

export type ChoiceOption = { label: string; sub?: string; preview?: number[]; apply: Partial<EnergyProfile>; selected: (f: EnergyProfile) => boolean };

export type Question =
  | { id: string; prompt: string; hint?: string; kind: 'choice'; options: ChoiceOption[]; custom?: NumField; answer: (f: EnergyProfile) => string }
  | { id: string; prompt: string; hint?: string; kind: 'fields'; fields: NumField[]; answer: (f: EnergyProfile) => string };

const PERIODS = [
  { label: 'Monthly', sub: '~30 days', days: 30 },
  { label: 'Bi-monthly', sub: '~61 days', days: 61 },
  { label: 'Quarterly', sub: '~91 days', days: 91 },
];

const periodName = (d: number) => PERIODS.find((p) => p.days === d)?.label ?? `${d} days`;

export function buildQuestions(f: EnergyProfile): Question[] {
  const qs: Question[] = [
    {
      id: 'tariff',
      prompt: "Hi! Let's work out your energy profile. First up — how are you charged for electricity?",
      hint: 'Check your bill: Time of Use lists separate Peak, Shoulder and Off-Peak rates.',
      kind: 'choice',
      options: [
        { label: 'Fixed cost per kWh', sub: 'One rate all day', apply: { tariffType: 'flat' }, selected: (x) => x.tariffType === 'flat' },
        { label: 'Time of Use', sub: 'Peak / Shoulder / Off-Peak', apply: { tariffType: 'tou' }, selected: (x) => x.tariffType === 'tou' },
      ],
      answer: (x) => (x.tariffType === 'flat' ? 'Fixed cost per kWh' : 'Time of Use'),
    },
    {
      id: 'period',
      prompt: 'Great. What billing period does the bill you\'re looking at cover?',
      hint: 'You\'ll find the dates near the top of your bill.',
      kind: 'choice',
      options: PERIODS.map((p) => ({
        label: p.label,
        sub: p.sub,
        apply: { billingPeriodDays: p.days },
        selected: (x: EnergyProfile) => x.billingPeriodDays === p.days,
      })),
      custom: { key: 'billingPeriodDays', label: 'Or enter exact days', unit: 'days' },
      answer: (x) => periodName(x.billingPeriodDays),
    },
  ];

  if (f.tariffType === 'flat') {
    qs.push({
      id: 'flat',
      prompt: `What's your rate per kWh, and how much did you use from the grid over those ${f.billingPeriodDays} days?`,
      kind: 'fields',
      fields: [
        { key: 'flatRate', label: 'Rate', unit: '$/kWh', step: 0.0001, rate: true },
        { key: 'totalGridUsageKwh', label: 'Grid usage', unit: 'kWh' },
      ],
      answer: (x) => `${fmtRate(x.flatRate)} · ${x.totalGridUsageKwh} kWh (${daily(x, x.totalGridUsageKwh)}/day)`,
    });
    qs.push({
      id: 'pattern',
      prompt: 'When does your household use most of its electricity? Pick the pattern that looks most like you.',
      hint: 'This helps us model your usage hour by hour, which matters for solar and battery sizing.',
      kind: 'choice',
      options: (Object.keys(USAGE_PATTERNS) as UsagePattern[]).map((k) => ({
        label: USAGE_PATTERNS[k].label,
        sub: USAGE_PATTERNS[k].summary,
        preview: USAGE_PATTERNS[k].profile,
        apply: { usagePattern: k },
        selected: (x: EnergyProfile) => x.usagePattern === k,
      })),
      answer: (x) => (x.usagePattern ? USAGE_PATTERNS[x.usagePattern].label : '—'),
    });
  } else {
    const brackets = [
      { id: 'peak', name: 'Peak', time: '4pm – 8pm', rate: 'peakRate', usage: 'peakUsageKwh' },
      { id: 'shoulder', name: 'Shoulder', time: '7am – 4pm', rate: 'shoulderRate', usage: 'shoulderUsageKwh' },
      { id: 'offpeak', name: 'Off-Peak', time: '8pm – 7am', rate: 'offPeakRate', usage: 'offPeakUsageKwh' },
    ] as const;
    brackets.forEach((b, i) =>
      qs.push({
        id: b.id,
        prompt: `${i === 0 ? "Let's go through each time period. " : ''}What's your **${b.name}** rate (${b.time}) and usage for the period?`,
        kind: 'fields',
        fields: [
          { key: b.rate, label: `${b.name} rate`, unit: '$/kWh', step: 0.0001, rate: true },
          { key: b.usage, label: `${b.name} usage`, unit: 'kWh' },
        ],
        answer: (x) => `${fmtRate(x[b.rate])} · ${x[b.usage]} kWh (${daily(x, x[b.usage])}/day)`,
      }),
    );
  }

  qs.push(
    {
      id: 'supply',
      prompt: "What's your daily supply charge?",
      hint: 'Usually listed as "Supply charge" in $ per day.',
      kind: 'fields',
      fields: [{ key: 'dailySupplyCharge', label: 'Daily supply', unit: '$/day', step: 0.01 }],
      answer: (x) => `$${x.dailySupplyCharge.toFixed(2)}/day`,
    },
    {
      id: 'solar',
      prompt: 'Do you already have solar panels?',
      kind: 'choice',
      options: [
        { label: 'Yes, I have solar', apply: { hasSolar: true }, selected: (x) => x.hasSolar },
        { label: 'No solar yet', apply: { hasSolar: false }, selected: (x) => !x.hasSolar },
      ],
      answer: (x) => (x.hasSolar ? 'Yes, I have solar' : 'No solar yet'),
    },
  );

  if (f.hasSolar) {
    qs.push({
      id: 'solarDetails',
      prompt: 'Nice! Tell me about your system and what you exported back to the grid.',
      kind: 'fields',
      fields: [
        { key: 'solarSystemSizeKw', label: 'System size', unit: 'kW', step: 0.1 },
        { key: 'totalExportKwh', label: 'Exported', unit: 'kWh' },
        { key: 'feedInRate', label: 'Feed-in rate', unit: '$/kWh', step: 0.0001, rate: true },
      ],
      answer: (x) => `${x.solarSystemSizeKw} kW · ${x.totalExportKwh} kWh (${daily(x, x.totalExportKwh)}/day) exported · ${fmtRate(x.feedInRate)} feed-in`,
    });
  }
  return qs;
}

function daily(x: EnergyProfile, kwh: number) {
  return x.billingPeriodDays > 0 ? `${(kwh / x.billingPeriodDays).toFixed(1)} kWh` : '—';
}
