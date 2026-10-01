import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

import { crmPayload } from '../lib/crmPayload';

export default createEndpoint({
  description: 'Saves an energy profile and creates a CRM lead from the advisor wizard',
  inputSchema: z.object({
    profile: z.object({
      customerName: z.string(),
      email: z.string(),
      phone: z.string().optional(),
      postcode: z.string().optional(),
      tariffType: z.string(),
      peakRate: z.number(),
      shoulderRate: z.number(),
      offPeakRate: z.number(),
      flatRate: z.number(),
      dailySupplyCharge: z.number(),
      feedInRate: z.number(),
      billingPeriodDays: z.number(),
      peakUsageKwh: z.number(),
      shoulderUsageKwh: z.number(),
      offPeakUsageKwh: z.number(),
      totalGridUsageKwh: z.number(),
      totalExportKwh: z.number(),
      solarSystemSizeKw: z.number(),
      hasSolar: z.boolean(),
      totalBillAmount: z.number(),
      inputMethod: z.string(),
    }),
    scenario: z.object({
      solarSizeKw: z.number(),
      batteryKwh: z.number(),
      recommendation: z.string(),
      estimatedAnnualSavings: z.number(),
      currentQuarterlyBill: z.number(),
      projectedQuarterlyBill: z.number(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    leadId: z.string().optional(),
  }),
  execute: async ({ input }) => {
    const { profile, scenario } = input;

    // Create energy profile
    const ep = await zite.energyProfiles.create({
      record: {
        customerName: profile.customerName,
        email: profile.email,
        phone: profile.phone || null,
        postcode: profile.postcode || null,
        tariffType: profile.tariffType,
        peakRate: profile.peakRate,
        shoulderRate: profile.shoulderRate,
        offPeakRate: profile.offPeakRate,
        flatRate: profile.flatRate,
        dailySupplyCharge: profile.dailySupplyCharge,
        feedInRate: profile.feedInRate,
        billingPeriodDays: profile.billingPeriodDays,
        peakUsageKwh: profile.peakUsageKwh,
        shoulderUsageKwh: profile.shoulderUsageKwh,
        offPeakUsageKwh: profile.offPeakUsageKwh,
        totalGridUsageKwh: profile.totalGridUsageKwh,
        totalExportKwh: profile.totalExportKwh,
        solarSystemSizeKw: profile.solarSystemSizeKw,
        hasSolar: profile.hasSolar,
        totalBillAmount: profile.totalBillAmount,
        inputMethod: profile.inputMethod,
        intervalData: null,
        billUpload: null,
        leads: null,
      },
    });

    // Create lead
    const lead = await zite.leads.create({
      record: {
        customerName: profile.customerName,
        energyProfile: ep.id,
        status: 'New',
        recommendation: scenario.recommendation,
        estimatedAnnualSavings: scenario.estimatedAnnualSavings,
        scenarioSolarSizeKw: scenario.solarSizeKw,
        scenarioBatteryKwh: scenario.batteryKwh,
        currentQuarterlyBill: scenario.currentQuarterlyBill,
        projectedQuarterlyBill: scenario.projectedQuarterlyBill,
        notes: null,
        crmSyncStatus: 'Pending',
      },
    });

    // Export contact details + energy profile to the external CRM. Failures never block the customer.
    let crmSyncStatus: 'Synced' | 'Failed' = 'Failed';
    try {
      const key = process.env.ZITE_CRM_API_KEY ?? '';
      const res = await fetch('https://iysyexnytt.zite.so/api/ingestLead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({
          inputs: { apiKey: key, ...crmPayload({ ...profile, ...scenario, name: profile.customerName }) },
        }),
      });
      const text = await res.text();
      console.log('CRM response', res.status, text);
      let body: { success?: boolean } = {};
      try { body = JSON.parse(text); } catch { /* non-JSON */ }
      // Duplicates (same email/phone) are updated in place by the CRM — still a successful sync
      if (res.ok && body.success !== false) crmSyncStatus = 'Synced';
    } catch (err) {
      console.log('CRM send failed', String(err));
    }
    await zite.leads.update({ id: lead.id, record: { crmSyncStatus } });

    return { success: true, leadId: lead.id };
  },
});
