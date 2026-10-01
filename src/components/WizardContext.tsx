import { createContext, useContext, useState, type ReactNode } from 'react';
import type { EnergyProfile } from '../lib/energy';

interface WizardState {
  step: number;
  setStep: (s: number) => void;
  inputMethod: 'manual' | 'pdf' | 'interval' | null;
  setInputMethod: (m: 'manual' | 'pdf' | 'interval') => void;
  profile: EnergyProfile;
  setProfile: (p: EnergyProfile) => void;
  scenarioSolarKw: number;
  setScenarioSolarKw: (v: number) => void;
  scenarioBatteryKwh: number;
  setScenarioBatteryKwh: (v: number) => void;
}

const defaults: EnergyProfile = {
  tariffType: 'tou',
  peakRate: 44,
  shoulderRate: 29,
  offPeakRate: 22,
  flatRate: 30,
  dailySupplyCharge: 1.15,
  feedInRate: 5,
  billingPeriodDays: 91,
  peakUsageKwh: 250,
  shoulderUsageKwh: 350,
  offPeakUsageKwh: 300,
  totalGridUsageKwh: 900,
  totalExportKwh: 300,
  solarSystemSizeKw: 6.6,
  hasSolar: true,
  totalBillAmount: 0,
};

const Ctx = createContext<WizardState | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0);
  const [inputMethod, setInputMethod] = useState<'manual' | 'pdf' | 'interval' | null>(null);
  const [profile, setProfile] = useState<EnergyProfile>(defaults);
  const [scenarioSolarKw, setScenarioSolarKw] = useState(profile.solarSystemSizeKw);
  const [scenarioBatteryKwh, setScenarioBatteryKwh] = useState(0);

  return (
    <Ctx.Provider value={{ step, setStep, inputMethod, setInputMethod, profile, setProfile, scenarioSolarKw, setScenarioSolarKw, scenarioBatteryKwh, setScenarioBatteryKwh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWizard must be inside WizardProvider');
  return ctx;
}
