import { createClient } from '@supabase/supabase-js';
import {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  SupportedSymbol,
  calculateLotSizeSafe,
  calculateGrossPnLSafe,
  calculateCommissionSafe,
  calculateSwapSafe,
  calculateRequiredMarginSafe,
  roundCents,
  roundPrice,
} from './tradingMath';

export const SUPABASE_URL = 'https://xhqvlqygqvyniuiqjjzx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_8sLROvIDtB-WfqqSNkWsfw_2dAmTJLS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Profile {
  id: string;
  display_name: string | null;
  starting_capital: number;
  role?: string;
}

export interface Trade {
  id: string;
  user_id: string;
  symbol: SupportedSymbol;
  side: 'buy' | 'sell';
  entry: number;
  sl: number;
  tp: number;
  lot: number;
  risk_pct: number;
  capital_at_open: number;
  status: 'open' | 'closed';
  exit_price?: number | null;
  pnl?: number | null;
  commission?: number | null;
  swap?: number | null;
  close_reason?: 'manual' | 'sl' | 'tp' | null;
  notes?: string | null;
  strategy?: string | null;
  entry_reason?: string | null;
  exit_reason?: string | null;
  emotions?: string | null;
  mistakes?: string | null;
  screenshot_url?: string | null;
  updated_at?: string | null;
  opened_at: string;
  closed_at?: string | null;
  // Live runtime enrichment
  currentPrice?: number;
  hasVerifiedQuote?: boolean;
  quoteTimestamp?: string | null;
  grossPnl?: number;
  floatingPnl?: number;
  marginRequired?: number;
}

export {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  calculateLotSizeSafe,
  calculateGrossPnLSafe,
  calculateCommissionSafe,
  calculateSwapSafe,
  calculateRequiredMarginSafe,
  roundCents,
  roundPrice,
};
export type { SupportedSymbol };

export const CONTRACT_SIZES: Record<SupportedSymbol, number> = {
  XAUUSD: INSTRUMENT_SPECS.XAUUSD.contractSize,
  NASDAQ: INSTRUMENT_SPECS.NASDAQ.contractSize,
  BTCUSD: INSTRUMENT_SPECS.BTCUSD.contractSize,
  EURUSD: INSTRUMENT_SPECS.EURUSD.contractSize,
  GBPUSD: INSTRUMENT_SPECS.GBPUSD.contractSize,
  USDJPY: INSTRUMENT_SPECS.USDJPY.contractSize,
  US30: INSTRUMENT_SPECS.US30.contractSize,
  USOIL: INSTRUMENT_SPECS.USOIL.contractSize,
};
