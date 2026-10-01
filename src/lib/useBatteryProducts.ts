import { useEffect, useState } from 'react';
import { getBatteryProducts, type GetBatteryProductsOutputType } from 'zitejs/api';

export type BatteryOffer = GetBatteryProductsOutputType['offers'][0];

const CACHE_KEY = 'wb-battery-offers';
let memo: BatteryOffer[] | null = null;

/** Live battery options + prices from the Battery Database, falling back to the last fetched list. */
export function useBatteryProducts() {
  const [offers, setOffers] = useState<BatteryOffer[]>(() => {
    if (memo) return memo;
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]'); } catch { return []; }
  });
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(!memo);

  useEffect(() => {
    if (memo) return;
    getBatteryProducts({})
      .then(({ offers }) => {
        memo = offers;
        setOffers(offers);
        localStorage.setItem(CACHE_KEY, JSON.stringify(offers));
      })
      .catch(() => setStale(true))
      .finally(() => setLoading(false));
  }, []);

  return { offers, stale, loading };
}

/** Cheapest offer per capacity — what the advisor models and quotes. */
export function cheapestPerCapacity(offers: BatteryOffer[]): BatteryOffer[] {
  const best = new Map<number, BatteryOffer>();
  for (const o of offers) {
    const cur = best.get(o.capacityKwh);
    if (!cur || o.installedPrice < cur.installedPrice) best.set(o.capacityKwh, o);
  }
  return [...best.values()].sort((a, b) => a.capacityKwh - b.capacityKwh);
}
