/** Maps a lead + energy profile to the external CRM's ingestLead fields (daily values, their names). */
export interface CrmSource {
  name: string; email: string; phone?: string | null; postcode?: string | null;
  tariffType?: string | null; peakRate?: number | null; shoulderRate?: number | null; offPeakRate?: number | null;
  flatRate?: number | null; dailySupplyCharge?: number | null; feedInRate?: number | null; billingPeriodDays?: number | null;
  peakUsageKwh?: number | null; shoulderUsageKwh?: number | null; offPeakUsageKwh?: number | null;
  totalGridUsageKwh?: number | null; totalExportKwh?: number | null; solarSystemSizeKw?: number | null;
  hasSolar?: boolean | null; totalBillAmount?: number | null;
  batteryKwh?: number | null; solarSizeKw?: number | null; recommendation?: string | null;
  estimatedAnnualSavings?: number | null; currentQuarterlyBill?: number | null; projectedQuarterlyBill?: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function crmPayload(s: CrmSource) {
  const days = s.billingPeriodDays && s.billingPeriodDays > 0 ? s.billingPeriodDays : 91;
  const perDay = (v?: number | null) => (v == null ? undefined : r2(v / days));
  const isFlat = /flat/i.test(s.tariffType ?? '');
  const dailyUsage = perDay(s.totalGridUsageKwh);
  const quarterly = s.currentQuarterlyBill ?? (s.totalBillAmount != null ? r2((s.totalBillAmount / days) * 91) : undefined);
  const notes = [
    'Submitted via Watts Better energy advisor.',
    s.recommendation && `Recommendation: ${s.recommendation}`,
    s.solarSizeKw ? `Modelled solar: ${s.solarSizeKw} kW` : null,
    s.batteryKwh ? `Modelled battery: ${s.batteryKwh} kWh` : null,
    s.estimatedAnnualSavings ? `Est. annual savings: $${Math.round(s.estimatedAnnualSavings)}` : null,
    s.projectedQuarterlyBill != null ? `Projected quarterly bill: $${Math.round(s.projectedQuarterlyBill)}` : null,
    s.postcode && `Postcode: ${s.postcode}`,
    s.feedInRate != null ? `Feed-in rate: $${s.feedInRate}/kWh` : null,
  ].filter(Boolean).join('\n');

  return {
    name: s.name,
    email: s.email,
    phone: s.phone ?? undefined,
    address: s.postcode ?? undefined,
    leadSource: 'Web',
    notes,
    dailyUsageKwh: dailyUsage,
    quarterlyBill: quarterly != null ? r2(quarterly) : undefined,
    tariffType: isFlat ? 'Flat' : 'TOU',
    peakUsageKwh: perDay(s.peakUsageKwh),
    shoulderUsageKwh: perDay(s.shoulderUsageKwh),
    offPeakUsageKwh: perDay(s.offPeakUsageKwh),
    peakRate: (isFlat ? s.flatRate : s.peakRate) ?? undefined,
    shoulderRate: (isFlat ? s.flatRate : s.shoulderRate) ?? undefined,
    offPeakRate: (isFlat ? s.flatRate : s.offPeakRate) ?? undefined,
    dailySupplyCharge: s.dailySupplyCharge ?? undefined,
    dailyElectricityCost: s.totalBillAmount != null ? r2(s.totalBillAmount / days) : undefined,
    existingSolar: !!s.hasSolar,
    existingSystemSize: s.hasSolar && s.solarSystemSizeKw ? `${s.solarSystemSizeKw}kW` : undefined,
    exportToGridKwh: perDay(s.totalExportKwh),
    batteryInterest: (s.batteryKwh ?? 0) > 0,
  };
}
