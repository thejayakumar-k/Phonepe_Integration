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
      groundFloor: 0,
      floor1: 5,
      floor2: 10,
      floor3: 15,
      moreThan3Mode: 'custom',
      customPrice: 20,
    },
  },
  commercial: { enabled: true, useCustomerSpecific: true, price: 30 },
  other: { enabled: true, useDefaultPrice: false, defaultPrice: 20 },
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
    if (error) return DEFAULT_PRICING;
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
  const channelId = `pricing-config-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase
    .channel(channelId)
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
    try {
      supabase.removeChannel(channel);
    } catch {
      // ignore channel cleanup errors
    }
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

export function getFloorOptions(config: PricingConfig): FloorOption[] {
  const fp = config.houseApartment.floorPricing;
  const fmt = (val: number) => (val > 0 ? ` (+₹${val})` : ' (+₹0)');
  return [
    { value: 'Ground Floor', label: `Ground Floor${fmt(fp.groundFloor)}`, price: fp.groundFloor },
    { value: '1st Floor', label: `1st Floor${fmt(fp.floor1)}`, price: fp.floor1 },
    { value: '2nd Floor', label: `2nd Floor${fmt(fp.floor2)}`, price: fp.floor2 },
    { value: '3rd Floor', label: `3rd Floor${fmt(fp.floor3)}`, price: fp.floor3 },
    { value: 'Custom', label: `Custom${fmt(fp.customPrice)}`, price: fp.customPrice },
  ];
}

/** Get floor additional charge from floor string */
export function getFloorCharge(floorValue: string | undefined | null, config: PricingConfig): number {
  if (!floorValue) return 0;
  const val = floorValue.toLowerCase();
  const fp = config.houseApartment.floorPricing;
  if (val.includes('ground') || val === '0' || val.includes('0th')) {
    return fp.groundFloor;
  }
  if (val.includes('1st') || val === '1' || val.includes('1st floor')) {
    return fp.floor1;
  }
  if (val.includes('2nd') || val === '2' || val.includes('2nd floor')) {
    return fp.floor2;
  }
  if (val.includes('3rd') || val === '3' || val.includes('3rd floor')) {
    return fp.floor3;
  }
  return fp.customPrice;
}

/**
 * Calculate effective unit price by adding floor / location additional charges
 * to base product price.
 */
export function calculateUnitPrice(
  basePrice: number,
  address: { addressType?: string; floor?: string } | null | undefined,
  config: PricingConfig
): { unitPrice: number; floorCharge: number } {
  if (!address) return { unitPrice: basePrice, floorCharge: 0 };
  
  if (address.addressType === 'Commercial') {
    const price = config.commercial.price > 0 ? config.commercial.price : basePrice;
    return { unitPrice: price, floorCharge: 0 };
  }
  if (address.addressType === 'Others') {
    const price = config.other.defaultPrice > 0 ? config.other.defaultPrice : basePrice;
    return { unitPrice: price, floorCharge: 0 };
  }

  // Apartment or House -> Base Product Price + Floor Additional Charge
  const floorCharge = getFloorCharge(address.floor, config);
  return { unitPrice: basePrice + floorCharge, floorCharge };
}
