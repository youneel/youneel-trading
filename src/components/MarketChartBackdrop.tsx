import React, { useEffect, useRef } from 'react';

interface CandleSample {
  o: number;
  h: number;
  l: number;
  c: number;
  bull: boolean;
}

/**
 * Generates deterministic, purely decorative candlestick geometry along a smooth
 * harmonic wave. Never represents or displays real/simulated market prices or signals.
 */
function sampleDecorativeCandle(index: number): CandleSample {
  const s1 = Math.sin(index * 0.23) * 0.22;
  const s2 = Math.cos(index * 0.09 + 1.1) * 0.16;
  const s3 = Math.sin(index * 0.57 + 2.4) * 0.07;
  const base = 0.5 + s1 + s2 + s3;

  const prev1 = Math.sin((index - 1) * 0.23) * 0.22;
  const prev2 = Math.cos((index - 1) * 0.09 + 1.1) * 0.16;
  const prev3 = Math.sin((index - 1) * 0.57 + 2.4) * 0.07;
  const prev = 0.5 + prev1 + prev2 + prev3;

  const wickUp = 0.025 + Math.abs(Math.sin(index * 1.37)) * 0.055;
  const wickDown = 0.025 + Math.abs(Math.cos(index * 1.19)) * 0.055;
  const high = Math.max(base, prev) + wickUp;
  const low = Math.min(base, prev) - wickDown;

  return {
    o: prev,
    c: base,
    h: high,
    l: low,
    bull: base >= prev,
  };
}

export const MarketChartBackdrop: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const plane = planeRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;
    let isDark = document.documentElement.classList.contains('dark');
    let isPageVisible = !document.hidden;
    let isInViewport = true;
    let rafId = 0;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Smooth pointer parallax targets (desktop mouse only)
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;
    let scrollTimeOffset = 140;
    let lastTimestamp = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(320, Math.floor(rect.width));
      height = Math.max(360, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (offset: number) => {
      ctx.clearRect(0, 0, width, height);

      const isMobile = width < 640;
      const spacing = isMobile ? 22 : width < 1024 ? 19 : 17;
      const candleWidth = isMobile ? 7 : 6;
      const chartTop = height * 0.1;
      const chartHeight = height * 0.78;

      // 1. Subtle architectural horizontal & vertical grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.045)' : 'rgba(15, 23, 42, 0.045)';
      const rows = 7;
      for (let r = 1; r < rows; r++) {
        const y = chartTop + (chartHeight / rows) * r;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const colStep = spacing * 6;
      const colShift = (offset * 0.35) % colStep;
      for (let x = -colShift; x <= width + colStep; x += colStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 2. Far background depth layer: subdued drifting candlesticks + graphite/blue wave
      const farParallax = currentTiltY * 14;
      const farStep = spacing * 1.45;
      const farStartIdx = Math.floor((offset * 0.45) / farStep) - 2;
      const farVisibleCount = Math.ceil(width / farStep) + 5;

      ctx.beginPath();
      let farStarted = false;
      for (let i = 0; i <= farVisibleCount; i++) {
        const idx = farStartIdx + i;
        const x = idx * farStep - offset * 0.45 + farParallax;
        const c = sampleDecorativeCandle(idx + 31);
        const yClose = chartTop + chartHeight * (1 - (c.c * 0.72 + 0.16));

        // Faint background candle silhouette
        const yOpen = chartTop + chartHeight * (1 - (c.o * 0.72 + 0.16));
        const yHigh = chartTop + chartHeight * (1 - (c.h * 0.72 + 0.16));
        const yLow = chartTop + chartHeight * (1 - (c.l * 0.72 + 0.16));

        ctx.fillStyle = isDark
          ? c.bull
            ? 'rgba(56, 189, 248, 0.055)'
            : 'rgba(100, 116, 139, 0.055)'
          : c.bull
          ? 'rgba(14, 165, 233, 0.06)'
          : 'rgba(100, 116, 139, 0.06)';
        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(2, Math.abs(yClose - yOpen));
        ctx.fillRect(x - 2, bodyTop, 4, bodyH);
        ctx.fillRect(x - 0.5, yHigh, 1, Math.max(2, yLow - yHigh));

        if (!farStarted) {
          ctx.moveTo(x, yClose);
          farStarted = true;
        } else {
          ctx.lineTo(x, yClose);
        }
      }

      // 3. Soft ambient market wave (muted blue-slate curve + gradient wash beneath)
      ctx.beginPath();
      const waveStep = 14;
      for (let x = -waveStep; x <= width + waveStep; x += waveStep) {
        const phase = (x + offset * 0.8 + currentTiltY * 22) * 0.0085;
        const y =
          chartTop +
          chartHeight * 0.52 +
          Math.sin(phase) * (chartHeight * 0.14) +
          Math.cos(phase * 0.47 + 0.7) * (chartHeight * 0.09);
        if (x === -waveStep) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(2, 132, 199, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.lineTo(width + waveStep, height);
      ctx.lineTo(-waveStep, height);
      ctx.closePath();
      const waveGrad = ctx.createLinearGradient(0, chartTop + chartHeight * 0.25, 0, height);
      waveGrad.addColorStop(0, isDark ? 'rgba(56, 189, 248, 0.075)' : 'rgba(2, 132, 199, 0.055)');
      waveGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = waveGrad;
      ctx.fill();

      // 4. Mid-plane continuous candlestick layer (muted emerald & crimson)
      const midParallax = currentTiltY * 26;
      const startIdx = Math.floor(offset / spacing) - 2;
      const visibleCount = Math.ceil(width / spacing) + 5;

      const trendPoints: Array<{ x: number; y: number }> = [];

      for (let i = 0; i <= visibleCount; i++) {
        const idx = startIdx + i;
        const x = idx * spacing - offset + midParallax;
        const sample = sampleDecorativeCandle(idx);

        const mapY = (val: number) =>
          chartTop + chartHeight * (1 - (val * 0.84 + 0.08)) + currentTiltX * 16;

        const yO = mapY(sample.o);
        const yC = mapY(sample.c);
        const yH = mapY(sample.h);
        const yL = mapY(sample.l);

        trendPoints.push({ x, y: yC });

        const wickColor = isDark
          ? sample.bull
            ? 'rgba(16, 185, 129, 0.26)'
            : 'rgba(244, 63, 94, 0.24)'
          : sample.bull
          ? 'rgba(5, 150, 105, 0.18)'
          : 'rgba(225, 29, 72, 0.16)';

        const bodyColor = isDark
          ? sample.bull
            ? 'rgba(16, 185, 129, 0.18)'
            : 'rgba(244, 63, 94, 0.16)'
          : sample.bull
          ? 'rgba(5, 150, 105, 0.14)'
          : 'rgba(225, 29, 72, 0.12)';

        // Wick
        ctx.fillStyle = wickColor;
        ctx.fillRect(Math.round(x) - 0.5, yH, 1.2, Math.max(2, yL - yH));

        // Body
        const top = Math.min(yO, yC);
        const h = Math.max(3, Math.abs(yC - yO));
        ctx.fillStyle = bodyColor;
        ctx.fillRect(Math.round(x - candleWidth / 2), top, candleWidth, h);

        // Crisp subtle top rim highlight on bullish/bearish bodies
        ctx.fillStyle = wickColor;
        ctx.fillRect(Math.round(x - candleWidth / 2), top, candleWidth, 1);
      }

      // 5. Subtle moving price ribbon connecting candle closes
      if (trendPoints.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < trendPoints.length; i++) {
          const p = trendPoints[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(5, 150, 105, 0.16)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    };

    const tick = (now: number) => {
      if (!isPageVisible || !isInViewport || reducedMotion) {
        rafId = 0;
        return;
      }

      const dt = lastTimestamp ? Math.min((now - lastTimestamp) / 1000, 0.05) : 0.016;
      lastTimestamp = now;

      // Calm continuous ambient drift (~14px/s)
      scrollTimeOffset += dt * 14;

      // Smooth pointer parallax easing
      currentTiltX += (targetTiltX - currentTiltX) * Math.min(1, dt * 4);
      currentTiltY += (targetTiltY - currentTiltY) * Math.min(1, dt * 4);

      if (plane) {
        const rotX = 16 + currentTiltX * 3.5;
        const rotY = -3 + currentTiltY * 4.5;
        plane.style.transform = `perspective(1200px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(1.16)`;
      }

      drawFrame(scrollTimeOffset);
      rafId = requestAnimationFrame(tick);
    };

    const startOrStopLoop = () => {
      if (reducedMotion || !isPageVisible || !isInViewport) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (reducedMotion) {
          if (plane) {
            plane.style.transform = 'perspective(1200px) rotateX(14deg) rotateY(-2deg) scale(1.12)';
          }
          drawFrame(scrollTimeOffset);
        }
        return;
      }
      if (!rafId) {
        lastTimestamp = 0;
        rafId = requestAnimationFrame(tick);
      }
    };

    resize();
    drawFrame(scrollTimeOffset);
    startOrStopLoop();

    const handlePointerMove = (e: PointerEvent) => {
      if (reducedMotion || e.pointerType !== 'mouse') return;
      const nx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      const ny = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      targetTiltY = Math.max(-1, Math.min(1, nx));
      targetTiltX = Math.max(-1, Math.min(1, ny));
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      startOrStopLoop();
    };

    const handleMotionChange = () => {
      reducedMotion = motionQuery.matches;
      startOrStopLoop();
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resize();
            if (reducedMotion) drawFrame(scrollTimeOffset);
          })
        : null;
    resizeObserver?.observe(container);

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              isInViewport = entries.some((entry) => entry.isIntersecting);
              startOrStopLoop();
            },
            { threshold: 0.01 }
          )
        : null;
    intersectionObserver?.observe(container);

    const themeObserver = new MutationObserver(() => {
      const nextDark = document.documentElement.classList.contains('dark');
      if (nextDark !== isDark) {
        isDark = nextDark;
        drawFrame(scrollTimeOffset);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none select-none absolute inset-x-0 top-0 h-[760px] sm:h-[860px] z-0 overflow-hidden"
    >
      {/* Static atmospheric charcoal & subtle blue-emerald depth fallback */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_62%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.07),rgba(15,23,42,0.4)_48%,#0c0c0e_85%)]"
      />
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full blur-3xl opacity-40 dark:opacity-35 bg-gradient-to-r from-sky-500/15 via-emerald-500/10 to-slate-500/15"
      />

      {/* 3D Perspective Plane */}
      <div
        ref={planeRef}
        className="absolute inset-0 origin-center will-change-transform"
        style={{
          transform: 'perspective(1200px) rotateX(16deg) rotateY(-3deg) scale(1.16)',
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full block opacity-90" />
      </div>

      {/* Measured contrast & edge scrim so foreground hero text and live market cards stay razor sharp */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#f5f5f7]/35 via-transparent to-[#f5f5f7] dark:from-[#0c0c0e]/45 dark:via-[#0c0c0e]/25 dark:to-[#0c0c0e]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(245,245,247,0.72)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_32%,rgba(12,12,14,0.8)_100%)]" />
    </div>
  );
};
