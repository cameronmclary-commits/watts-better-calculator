import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';

const COMPARE_URL = 'https://68n6pxk82z.zite.so/';

export default function BatteryCompareStep() {
  const { setStep } = useWizard();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar step={7} totalSteps={7} />
      <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 w-full">
        <div className="flex justify-end mb-2">
          <Button variant="ghost" size="sm" asChild>
            <a href={COMPARE_URL} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1.5" /> Open in new tab</a>
          </Button>
        </div>

        <div className="relative bg-card rounded-2xl border border-border shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 190px)', minHeight: 520 }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading battery comparison…
            </div>
          )}
          <iframe src={COMPARE_URL} title="Battery comparison" className="w-full h-full border-0" onLoad={() => setLoaded(true)} allow="clipboard-write" />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => setStep(4)} className="rounded-xl">← Back</Button>
          <Button onClick={() => setStep(7)} className="flex-1 py-6 rounded-xl gradient-warm border-0 text-white hover:opacity-90 font-semibold">
            Get My Report →
          </Button>
        </div>
      </div>
    </div>
  );
}
