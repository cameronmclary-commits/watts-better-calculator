import { useState, useMemo } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';
import { calculateProfile, getBestRecommendation } from '../lib/energy';
import { submitLead } from 'zitejs/api';
import { toast } from 'sonner';
import ReportView from './ReportView';

export default function LeadCaptureStep() {
  const { profile, scenarioSolarKw, scenarioBatteryKwh, setStep } = useWizard();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const currentResult = useMemo(() => calculateProfile(profile), [profile]);
  const scenarioResult = useMemo(() => calculateProfile(profile, scenarioSolarKw, scenarioBatteryKwh), [profile, scenarioSolarKw, scenarioBatteryKwh]);
  const recommendation = useMemo(() => getBestRecommendation(profile, currentResult), [profile, currentResult]);

  const annualSavings = (currentResult.dailyCost - scenarioResult.dailyCost) * 365;

  const handleSubmit = async () => {
    if (!name || !email) return;
    setLoading(true);
    try {
      await submitLead({
        profile: {
          customerName: name,
          email,
          phone,
          postcode,
          tariffType: profile.tariffType === 'flat' ? 'Flat Rate' : 'Time of Use',
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
          inputMethod: 'Manual Entry',
        },
        scenario: {
          solarSizeKw: scenarioSolarKw,
          batteryKwh: scenarioBatteryKwh,
          recommendation: recommendation.type === 'solar_battery' ? 'Solar + Battery' : recommendation.type === 'battery' ? 'Battery' : 'Solar',
          estimatedAnnualSavings: Math.round(annualSavings),
          currentQuarterlyBill: Math.round(currentResult.quarterlyBill),
          projectedQuarterlyBill: Math.round(scenarioResult.quarterlyBill),
        },
      });
      setDone(true);
    } catch {
      toast.error("We couldn't save your details, but here's your report.");
      setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const recLabel = recommendation.type === 'solar_battery' ? 'Solar + Battery' : recommendation.type === 'battery' ? 'Battery' : 'Solar';

  if (done) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="print:hidden"><Navbar step={7} totalSteps={7} /></div>
        <ReportView name={name} email={email} profile={profile} current={currentResult} scenario={scenarioResult}
          solarKw={scenarioSolarKw} batteryKwh={scenarioBatteryKwh} recommendation={recLabel} reason={recommendation.reason}
          onRestart={() => setStep(0)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={7} totalSteps={7} />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-2xl gradient-warm flex items-center justify-center mx-auto mb-6">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Your Report Is Ready</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Enter your details to receive the full analysis — including savings breakdown, system recommendations, and battery comparisons.
          </p>
          <div className="space-y-4 text-left">
            <div>
              <Label className="text-xs text-muted-foreground">Full Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0400 000 000" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Postcode</Label>
              <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="4000" className="mt-1 rounded-xl" />
            </div>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!name || !email || loading}
            className="w-full mt-8 py-6 rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold text-base"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate My Report →'}
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Your report appears straight away on the next screen, and you can print or save it as a PDF.
          </p>
        </div>
      </div>
      <div className="px-6 pb-6 text-center">
        <Button variant="ghost" onClick={() => setStep(6.5)} className="text-sm text-muted-foreground">← Back to battery comparison</Button>
      </div>
    </div>
  );
}
