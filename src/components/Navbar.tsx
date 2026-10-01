import { Zap } from 'lucide-react';
import { Progress } from '@project/components/ui/progress';

interface NavProps {
  step?: number;
  totalSteps?: number;
}

export default function Navbar({ step, totalSteps = 7 }: NavProps) {
  return (
    <nav className="w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-warm flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground text-lg tracking-tight">Watts Better</span>
        </div>
        {step != null && step > 0 && (
          <div className="flex items-center gap-3">
            <Progress value={(step / totalSteps) * 100} className="w-20 sm:w-32 h-2" />
            <span className="text-xs text-muted-foreground font-medium">Step {step} of {totalSteps}</span>
          </div>
        )}
        {step == null && (
          <span className="text-sm text-muted-foreground hidden sm:block">Solar & Battery Advisor</span>
        )}
      </div>
    </nav>
  );
}
