import { supabase } from '../lib/supabase';

/* ========================================
   Pricing configuration (Web Login)
   ======================================== */

export interface FloorPricing {
  groundFloor: number;
  floor1: number;
  floor2: number;
  floor3: number;
  moreThan3Mode: 'use3rdFloor' | 'custom';
  customPrice: number;
}

export interface PricingConfig {
  houseApartment: {
    enabled: boolean;
    useFloorWise: boolean;
    floorPricing: FloorPricing;
  };
  commercial: {
    enabled: boolean;
    useCustomerSpecific: boolean;
    price: number;
  };
  other: {
    enabled: boolean;
    useDefaultPrice: boolean;
    defaultPrice: number;
  };
}

/** Default pricing — also used until the pricing_config table is reachable. */
export const DEFAULT_PRICING: PricingConfig = {
  houseApartment: {
    enabled: true,
    useFloorWise: true,
    floorPricing: {
      groundFloor: 20,
      floor1: 25,
      floor2: 30,
      floor3: 35,
      moreThan3Mode: 'custom',
      customPrice: 40,
    },
  },
  commercial: { enabled: true, useCustomerSpecific: true, price: 30 },
  other: { enabled: true, useDefaultPrice: false, defaultPrice: 25 },
};

function normalizeConfig(raw: unknown): PricingConfig {
  const base = DEFAULT_PRICING;
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;
  const ha = r.houseApartment ?? {};
  const fp = ha.floorPricing ?? {};
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    houseApartment: {
      enabled: typeof ha.enabled === 'boolean' ? ha.enabled : base.houseApartment.enabled,
      useFloorWise:
        typeof ha.useFloorWise === 'boolean'
          ? ha.useFloorWise
          : base.houseApartment.useFloorWise,
      floorPricing: {
        groundFloor: num(fp.groundFloor, base.houseApartment.floorPricing.groundFloor),
        floor1: num(fp.floor1, base.houseApartment.floorPricing.floor1),
        floor2: num(fp.floor2, base.houseApartment.floorPricing.floor2),
        floor3: num(fp.floor3, base.houseApartment.floorPricing.floor3),
        moreThan3Mode:
          fp.moreThan3Mode === 'use3rdFloor' || fp.moreThan3Mode === 'custom'
            ? fp.moreThan3Mode
            : base.houseApartment.floorPricing.moreThan3Mode,
        customPrice: num(fp.customPrice, base.houseApartment.floorPricing.customPrice),
      },
    },
    commercial: {
      enabled: typeof r.commercial?.enabled === 'boolean' ? r.commercial.enabled : base.commercial.enabled,
      useCustomerSpecific:
        typeof r.commercial?.useCustomerSpecific === 'boolean'
          ? r.commercial.useCustomerSpecific
          : base.commercial.useCustomerSpecific,
      price: num(r.commercial?.price, base.commercial.price),
    },
    other: {
      enabled: typeof r.other?.enabled === 'boolean' ? r.other.enabled : base.other.enabled,
      useDefaultPrice:
        typeof r.other?.useDefaultPrice === 'boolean'
          ? r.other.useDefaultPrice
          : base.other.useDefaultPrice,
      defaultPrice: num(r.other?.defaultPrice, base.other.defaultPrice),
    },
  };
}

/** Load the pricing config saved from the web-login page. */
export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('config')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    return normalizeConfig(data?.config);
  } catch {
    return DEFAULT_PRICING;
  }
}

/** Save the pricing config (upsert on the single config row). */
export async function savePricingConfig(config: PricingConfig): Promise<void> {
  const { error } = await supabase
    .from('pricing_config')
    .upsert({ id: 1, config, updated_at: Math.floor(Date.now() / 1000) });
  if (error) console.error('savePricingConfig failed:', error.message);
}

/**
 * Subscribe to real-time pricing config changes (web login saves).
 * Returns an unsubscribe function.
 */
export function subscribeToPricingConfig(
  onChange: (config: PricingConfig) => void
): () => void {
  const channel = supabase
    .channel('pricing-config-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pricing_config' },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (row && row.config) {
          onChange(normalizeConfig(row.config));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ========================================
   Floor options derived from the config
   ======================================== */

export interface FloorOption {
  value: string; // stored on the address (e.g. "1st Floor")
  label: string;
  price: number;
}

/** Floor list + price for each, straight from the web-login configuration. */
export function getFloorOptions(config: PricingConfig): FloorOption[] {
  const fp = config.houseApartment.floorPricing;
  const moreThan3Price =
    fp.moreThan3Mode === 'use3rdFloor' ? fp.floor3 : fp.customPrice;
  return [
    { value: 'Ground Floor', label: 'Ground Floor', price: fp.groundFloor },
    { value: '1st Floor', label: '1st Floor', price: fp.floor1 },
    { value: '2nd Floor', label: '2nd Floor', price: fp.floor2 },
    { value: '3rd Floor', label: '3rd Floor', price: fp.floor3 },
    { value: 'Custom', label: 'Custom', price: moreThan3Price },
  ];
}
