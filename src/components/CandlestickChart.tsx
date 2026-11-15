import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  IPriceLine,
} from 'lightweight-charts';
import { CandleData, calculateEMA } from '../lib/indicators';
import {
  INSTRUMENT_SPECS,
  SupportedSymbol,
  SupportedTimeframe,
  isSupportedSymbol,
} from '../lib/tradingMath';
import { FairValueGap, LiquidityPool, OrderBlock } from '../lib/analysisEngine';
import { Language, translations } from '../lib/i18n';

export type ChartMode = 'tradingview' | 'backend';
export type TradingViewChartStyle = '1' | '8' | '9' | '2';

interface CandlestickChartProps {
  candles: CandleData[];
  symbol: SupportedSymbol | string;
  timeframe: SupportedTimeframe | string;
  theme: 'dark' | 'light';
  lang: Language;
  chartMode?: ChartMode;
  chartStyle?: TradingViewChartStyle;
  showDrawingTools?: boolean;
  showEMAs?: boolean;
  showLevels?: boolean;
  supportLevels?: number[];
  resistanceLevels?: number[];
  pivot?: number;
  orderBlocks?: OrderBlock[];
  fairValueGaps?: FairValueGap[];
  liquidityPools?: LiquidityPool[];
  dataSource?: string;
  fillHeight?: boolean;
  livePrice?: number;
}

export const TRADINGVIEW_SYMBOL_MAP: Record<string, { tvSymbol: string; feedLabel: string }> =
  Object.fromEntries(
    Object.entries(INSTRUMENT_SPECS).map(([sym, spec]) => [
      sym,
      { tvSymbol: spec.tvSymbol, feedLabel: spec.tvFeedLabel },
    ])
  );

const TRADINGVIEW_INTERVAL_MAP: Record<string, string> = {
  M5: '5',
  M15: '15',
  H1: '60',
  H4: '240',
  D1: 'D',
  W1: 'W',
  MN: 'M',
};

const CandlestickChartInner: React.FC<CandlestickChartProps> = ({
  candles,
  symbol,
  timeframe,
  theme,
  lang,
  chartMode = 'tradingview',
  chartStyle = '1',
  showDrawingTools = true,
  showEMAs = true,
  showLevels = true,
  supportLevels = [],
  resistanceLevels = [],
  pivot,
  orderBlocks = [],
  fairValueGaps = [],
  liquidityPools = [],
  dataSource,
  fillHeight = false,
  livePrice,
}) => {
  const t = translations[lang];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const lwContainerRef = useRef<HTMLDivElement>(null);

  // Persistent Lightweight Charts refs to eliminate chart-destruction lag on tick/tab updates
  const lwChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const lastCandleRef = useRef<CandleData | null>(null);
  const fitDoneKeyRef = useRef<string>('');

  const [tvLoaded, setTvLoaded] = useState(false);
  const [tvTimedOut, setTvTimedOut] = useState(false);

  const spec = isSupportedSymbol(symbol) ? INSTRUMENT_SPECS[symbol] : null;
  const tvMeta = spec
    ? { tvSymbol: spec.tvSymbol, feedLabel: spec.tvFeedLabel }
    : { tvSymbol: 'OANDA:XAUUSD', feedLabel: symbol };
  const tvInterval = TRADINGVIEW_INTERVAL_MAP[timeframe] || '60';
  const hasCandles = candles.length > 0;

  const tvLocale = lang === 'ar' ? 'ar_AE' : 'en';
  const tvWidgetSrc = useMemo(() => {
    const config = {
      autosize: true,
      symbol: tvMeta.tvSymbol,
      interval: tvInterval,
      timezone: 'Etc/UTC',
      theme: theme === 'dark' ? 'dark' : 'light',
      style: chartStyle,
      backgroundColor: theme === 'dark' ? '#0c0c0e' : '#ffffff',
      gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      allow_symbol_change: false,
      details: false,
      hotlist: false,
      withdateranges: true,
      hide_side_toolbar: !showDrawingTools,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      support_host: 'https://www.tradingview.com',
      width: '100%',
      height: '100%',
      utm_source: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      utm_medium: 'widget',
      utm_campaign: 'advanced-chart',
    };
    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=${encodeURIComponent(
      tvLocale
    )}#${encodeURIComponent(JSON.stringify(config))}`;
  }, [tvMeta.tvSymbol, tvInterval, theme, chartStyle, tvLocale, showDrawingTools]);

  // Mode 1: Sync TradingView iframe dimensions smoothly on container resize without injecting cross-origin <script>
  useEffect(() => {
    if (chartMode !== 'tradingview' || !tvContainerRef.current) return;
    const container = tvContainerRef.current;

    const syncIframeDimensions = () => {
      const rect = container.getBoundingClientRect();
      const iframe = container.querySelector('iframe');
      if (iframe && rect.width > 0 && rect.height > 0) {
        iframe.setAttribute('width', `${Math.floor(rect.width)}px`);
        iframe.setAttribute('height', `${Math.floor(rect.height)}px`);
      }
    };

    syncIframeDimensions();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncIframeDimensions())
        : null;
    resizeObserver?.observe(container);
    if (wrapperRef.current) resizeObserver?.observe(wrapperRef.current);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [chartMode, tvWidgetSrc]);

  useEffect(() => {
    if (chartMode !== 'tradingview') return;
    setTvLoaded(false);
    setTvTimedOut(false);
    const timer = setTimeout(() => {
      setTvTimedOut(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [chartMode, tvWidgetSrc]);

  // Mode 2A: Create / Destroy Lightweight Chart instance only when container lifecycle or theme/precision changes
  useEffect(() => {
    if (chartMode !== 'backend' || !hasCandles || !lwContainerRef.current) return;

    const isDark = theme === 'dark';
    const bg = isDark ? '#0c0c0e' : '#ffffff';
    const textColor = isDark ? '#a1a1aa' : '#52525b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const borderColor = isDark ? '#27272a' : '#e4e4e7';

    const precision = spec ? spec.decimals : 2;
    const minMove = spec ? spec.pipSize : 0.01;

    const chart = createChart(lwContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 1,
        },
        horzLine: {
          color: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
          width: 1,
          style: 1,
        },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      width: lwContainerRef.current.clientWidth,
      height: lwContainerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
      priceFormat: {
        type: 'price',
        precision,
        minMove,
      },
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#0ea5e9',
      lineWidth: 1,
      title: 'EMA 20',
      priceFormat: { type: 'price', precision, minMove },
      lastValueVisible: false,
    });
    const ema50Series = chart.addSeries(LineSeries, {
      color: '#d97706',
      lineWidth: 1,
      title: 'EMA 50',
      priceFormat: { type: 'price', precision, minMove },
      lastValueVisible: false,
    });
    const ema200Series = chart.addSeries(LineSeries, {
      color: '#7c3aed',
      lineWidth: 2,
      title: 'EMA 200',
      priceFormat: { type: 'price', precision, minMove },
      lastValueVisible: false,
    });

    lwChartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    ema200SeriesRef.current = ema200Series;
    priceLinesRef.current = [];
    fitDoneKeyRef.current = '';

    const resizeObserver = new ResizeObserver(() => {
      if (lwContainerRef.current && lwChartRef.current) {
        lwChartRef.current.applyOptions({
          width: lwContainerRef.current.clientWidth,
          height: lwContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(lwContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      priceLinesRef.current = [];
      candleSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      ema200SeriesRef.current = null;
      lastCandleRef.current = null;
      if (lwChartRef.current) {
        lwChartRef.current.remove();
        lwChartRef.current = null;
      }
    };
  }, [chartMode, hasCandles, theme, symbol, spec]);

  // Mode 2B: Update series data & structural SMC price lines in place without destroying chart instance
  useEffect(() => {
    if (
      chartMode !== 'backend' ||
      !lwChartRef.current ||
      !candleSeriesRef.current ||
      candles.length === 0
    ) {
      return;
    }

    const candleSeries = candleSeriesRef.current;

    const sorted = [...candles]
      .sort((a, b) => a.time - b.time)
      .filter((c, idx, arr) => idx === 0 || c.time > arr[idx - 1].time);

    candleSeries.setData(
      sorted.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    lastCandleRef.current = sorted.length > 0 ? { ...sorted[sorted.length - 1] } : null;

    // Update EMAs cleanly in place
    if (showEMAs && sorted.length >= 20) {
      const closes = sorted.map((c) => c.close);
      const ema20 = calculateEMA(closes, 20);
      ema20SeriesRef.current?.setData(
        sorted.slice(19).map((c, i) => ({ time: c.time as any, value: ema20[i + 19] }))
      );

      if (sorted.length >= 50) {
        const ema50 = calculateEMA(closes, 50);
        ema50SeriesRef.current?.setData(
          sorted.slice(49).map((c, i) => ({ time: c.time as any, value: ema50[i + 49] }))
        );
      } else {
        ema50SeriesRef.current?.setData([]);
      }

      if (sorted.length >= 200) {
        const ema200 = calculateEMA(closes, 200);
        ema200SeriesRef.current?.setData(
          sorted.slice(199).map((c, i) => ({ time: c.time as any, value: ema200[i + 199] }))
        );
      } else {
        ema200SeriesRef.current?.setData([]);
      }
    } else {
      ema20SeriesRef.current?.setData([]);
      ema50SeriesRef.current?.setData([]);
      ema200SeriesRef.current?.setData([]);
    }

    // Clear prior structural price lines cleanly
    for (const line of priceLinesRef.current) {
      try {
        candleSeries.removePriceLine(line);
      } catch {
        // Ignore stale price line
      }
    }
    priceLinesRef.current = [];

    if (showLevels) {
      supportLevels.forEach((sup, idx) => {
        if (sup > 0) {
          priceLinesRef.current.push(
            candleSeries.createPriceLine({
              price: sup,
              color: '#16a34a',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `S${idx + 1}`,
            })
          );
        }
      });

      resistanceLevels.forEach((res, idx) => {
        if (res > 0) {
          priceLinesRef.current.push(
            candleSeries.createPriceLine({
              price: res,
              color: '#dc2626',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: `R${idx + 1}`,
            })
          );
        }
      });

      if (pivot && pivot > 0) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: pivot,
            color: '#0284c7',
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: 'Pivot',
          })
        );
      }

      liquidityPools.slice(0, 4).forEach((lp) => {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: lp.price,
            color: lp.kind === 'BSL' || lp.kind === 'EQH' ? '#f59e0b' : '#8b5cf6',
            lineWidth: 1,
            lineStyle: 3,
            axisLabelVisible: true,
            title: lp.kind,
          })
        );
      });

      orderBlocks.slice(-2).forEach((ob) => {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: ob.midpoint,
            color: ob.direction === 'bullish' ? '#10b981' : '#f43f5e',
            lineWidth: 1,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `${ob.direction === 'bullish' ? 'Bull' : 'Bear'} OB`,
          })
        );
      });

      fairValueGaps.slice(-2).forEach((fvg) => {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: fvg.midpoint,
            color: '#06b6d4',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${fvg.direction === 'bullish' ? 'Bull' : 'Bear'} FVG`,
          })
        );
      });
    }

    const fitKey = `${symbol}:${timeframe}:${theme}`;
    if (fitDoneKeyRef.current !== fitKey) {
      lwChartRef.current.timeScale().fitContent();
      fitDoneKeyRef.current = fitKey;
    }
  }, [
    chartMode,
    candles,
    symbol,
    timeframe,
    theme,
    showEMAs,
    showLevels,
    supportLevels,
    resistanceLevels,
    pivot,
    orderBlocks,
    fairValueGaps,
    liquidityPools,
  ]);

  // Mode 2C: Sync live quote ticks onto the active forming candle in real time
  useEffect(() => {
    if (
      chartMode !== 'backend' ||
      !candleSeriesRef.current ||
      !lastCandleRef.current ||
      livePrice === undefined ||
      !Number.isFinite(livePrice) ||
      livePrice <= 0
    ) {
      return;
    }

    const last = lastCandleRef.current;
    // Guard against stale/cross-venue outlier jumps (>5% on non-crypto single tick)
    if (Math.abs(livePrice - last.close) / Math.max(last.close, 1e-8) > 0.08) {
      return;
    }

    const updated: CandleData = {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    };
    lastCandleRef.current = updated;

    try {
      candleSeriesRef.current.update({
        time: updated.time as any,
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
      });
    } catch {
      // Ignore out-of-order series update edge cases
    }
  }, [chartMode, livePrice]);

  const stageClasses = fillHeight
    ? 'w-full min-w-0 flex-1 min-h-[420px]'
    : 'w-full min-w-0 h-[480px] sm:h-[580px] md:h-[660px] lg:h-[720px] xl:h-[760px]';

  return (
    <div
      ref={wrapperRef}
      className={`w-full min-w-0 flex flex-col ${fillHeight ? 'h-full' : ''}`}
    >
      {chartMode === 'tradingview' ? (
        <div
          ref={tvContainerRef}
          dir="ltr"
          data-testid="tradingview-chart-container"
          className={`tradingview-widget-container relative ${stageClasses} overflow-hidden bg-white dark:bg-[#0c0c0e]`}
        >
          {!tvLoaded && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/90 dark:bg-[#0c0c0e]/90 pointer-events-none px-4 text-center">
              <div className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-emerald-500 animate-spin" />
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {tvTimedOut
                  ? lang === 'ar'
                    ? 'استغرق تحميل مخطط TradingView وقتاً أطول من المعتاد — يمكنك التبديل إلى مخطط التحليل الكمي / SMC في الأعلى.'
                    : 'TradingView chart is taking longer than expected — you can switch to the Quant / SMC chart above.'
                  : lang === 'ar'
                  ? 'جارٍ تحميل مخطط TradingView...'
                  : 'Loading TradingView chart...'}
              </span>
            </div>
          )}
          <iframe
            key={tvWidgetSrc}
            title="advanced chart TradingView widget"
            lang={tvLocale}
            src={tvWidgetSrc}
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              setTvLoaded(true);
              setTvTimedOut(false);
            }}
            className="w-full h-full border-0 block select-none"
            scrolling="no"
            allowFullScreen
          />
        </div>
      ) : candles.length === 0 ? (
        <div
          className={`${stageClasses} flex items-center justify-center text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-[#0c0c0e] px-4 text-center`}
        >
          {t.noCandlesAvailable}
        </div>
      ) : (
        <div className={`relative w-full min-w-0 ${fillHeight ? 'flex-1 flex flex-col' : ''}`}>
          <div className="absolute top-3 start-4 z-10 flex flex-wrap items-center gap-3 text-[11px] bg-white/90 dark:bg-black/80 px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/10 pointer-events-none">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
              {symbol} · {timeframe}
            </span>
            {showEMAs && (
              <>
                {candles.length >= 20 && <span className="text-sky-600 dark:text-sky-400 font-medium" dir="ltr">EMA 20</span>}
                {candles.length >= 50 && <span className="text-amber-600 dark:text-amber-400 font-medium" dir="ltr">EMA 50</span>}
                {candles.length >= 200 && (
                  <span className="text-violet-600 dark:text-violet-400 font-medium" dir="ltr">EMA 200</span>
                )}
              </>
            )}
          </div>
          <div
            ref={lwContainerRef}
            dir="ltr"
            data-testid="quant-chart-container"
            className={`${stageClasses} overflow-hidden bg-white dark:bg-[#0c0c0e]`}
          />
        </div>
      )}

      {/* Feed Provenance Bar */}
      <div className="px-3 py-1 border-t border-black/5 dark:border-white/10 bg-zinc-50/80 dark:bg-[#101013] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
        <span dir="ltr">{chartMode === 'tradingview' ? tvMeta.feedLabel : dataSource || symbol}</span>
        <span>
          {chartMode === 'tradingview'
            ? t.tvChartProvenanceBadge
            : t.backendChartProvenanceBadge}
        </span>
      </div>
    </div>
  );
};

export const CandlestickChart = React.memo(CandlestickChartInner);
