import { FileText, PenLine, BarChart3 } from 'lucide-react';
import Navbar from './Navbar';
import { useWizard } from './WizardContext';

const methods = [
  { id: 'manual' as const, icon: PenLine, title: 'Enter Manually', desc: 'Type in your rates and usage figures' },
  { id: 'interval' as const, icon: BarChart3, title: 'Interval Data', desc: 'Paste or upload 30-min interval CSV' },
  { id: 'pdf' as const, icon: FileText, title: 'Upload Your Bill', desc: 'Drop a PDF — we\'ll extract the details (coming soon)', disabled: true },
];

export default function WelcomeStep() {
  const { setInputMethod, setStep } = useWizard();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <section className="gradient-hero flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
            Understand Your Energy.<br />Unlock Your Savings.
          </h1>
          <p className="text-white/75 text-lg mb-12 max-w-xl mx-auto">
            See exactly where your money goes — and what solar or a battery could do for you.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl mx-auto">
            {methods.map((m) => (
              <button
                key={m.id}
                disabled={m.disabled}
                onClick={() => { setInputMethod(m.id); setStep(1); }}
                className="bg-white/95 backdrop-blur rounded-2xl p-6 text-center shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-12 h-12 rounded-xl gradient-warm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <m.icon className="w-5 h-5 text-white" />
                </div>
                <p className="font-semibold text-foreground text-sm mb-1">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
