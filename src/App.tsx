import { WizardProvider, useWizard } from './components/WizardContext';
import WelcomeStep from './components/WelcomeStep';
import ManualEntryStep from './components/ManualEntryStep';
import UsageBreakdownStep from './components/UsageBreakdownStep';
import SolarOverlayStep from './components/SolarOverlayStep';
import ScenarioStep from './components/ScenarioStep';
import HouseAnimationStep from './components/HouseAnimationStep';
import LeadCaptureStep from './components/LeadCaptureStep';
import BatteryCompareStep from './components/BatteryCompareStep';
import { Toaster } from '@project/components/ui/sonner';

function WizardRouter() {
  const { step } = useWizard();

  switch (step) {
    case 0: return <WelcomeStep />;
    case 1: return <ManualEntryStep />;
    case 2: return <UsageBreakdownStep />;
    case 2.5: return <SolarOverlayStep />;
    case 3: return <ScenarioStep />;
    case 4: return <HouseAnimationStep />;
    case 6.5: return <BatteryCompareStep />;
    case 7: return <LeadCaptureStep />;
    default: return <WelcomeStep />;
  }
}

export default function App() {
  return (
    <WizardProvider>
      <WizardRouter />
      <Toaster />
    </WizardProvider>
  );
}
