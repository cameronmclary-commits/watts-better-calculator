import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';

const BASE = 'https://ktycbo1fgx.zite.so/api';

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : null);

async function call(path: string): Promise<Raw[]> {
  const key = process.env.ZITE_BATTERY_DB_API_KEY;
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key },
    body: JSON.stringify({ inputs: { apiKey: key } }),
  });
  if (!res.ok) throw new Error(`Battery Database returned ${res.status}`);
  const json = (await res.json()) as { batteries?: Raw[] };
  return json.batteries ?? [];
}

/** "$11,700" → 11700; ranges like "$8,000 – $24,000" are ambiguous → null */
function singlePrice(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const nums = v.match(/[\d,]+(\.\d+)?/g);
  if (!nums || nums.length !== 1) return null;
  return num(Number(nums[0].replace(/,/g, '')));
}

export default createEndpoint({
  description: 'Lists priced battery options from the Battery Database',
  inputSchema: z.object({}),
  outputSchema: z.object({
    offers: z.array(z.object({
      id: z.string(),
      batteryName: z.string(),
      label: z.string(),
      capacityKwh: z.number(),
      installedPrice: z.number(),
    })),
  }),
  execute: async () => {
    const [calc, list] = await Promise.all([call('getBatteriesForCalculator'), call('listBatteries')]);
    const approx = new Map(list.map((b) => [String(b.id), b.approxPrice]));
    const offers: { id: string; batteryName: string; label: string; capacityKwh: number; installedPrice: number }[] = [];

    for (const b of calc) {
      if (b.status !== 'Active') continue;
      const name = String(b.name ?? '');
      const options = Array.isArray(b.capacityOptions) ? (b.capacityOptions as Raw[]) : [];
      if (options.length) {
        for (const o of options) {
          const kwh = num(o.capacityKwh);
          const price = num(o.priceMin) ?? num(o.priceMax);
          if (kwh && price) offers.push({ id: String(o.id), batteryName: name, label: String(o.label ?? `${name} ${kwh} kWh`), capacityKwh: kwh, installedPrice: price });
        }
      } else {
        const kwh = num(b.usableCapacity);
        const price = singlePrice(approx.get(String(b.id)));
        if (kwh && price) offers.push({ id: String(b.id), batteryName: name, label: `${name} ${kwh} kWh`, capacityKwh: kwh, installedPrice: price });
      }
    }
    offers.sort((a, b) => a.capacityKwh - b.capacityKwh || a.installedPrice - b.installedPrice);
    return { offers };
  },
});
