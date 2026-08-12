'use client';

import { Chart as ChartJS, registerables, type ChartConfiguration } from 'chart.js';
import { useEffect, useRef } from 'react';

ChartJS.register(...registerables);
ChartJS.defaults.font.family = "'Manrope', system-ui, sans-serif";
ChartJS.defaults.color = '#68756d';
ChartJS.defaults.borderColor = '#e7ece7';

export const PALETTE = [
  '#0e7c5b',
  '#e89b18',
  '#2f6fd0',
  '#cf4433',
  '#7c5cd6',
  '#12a5b8',
  '#d6708f',
  '#7a8a3a',
];

/**
 * Renders a Chart.js chart and tears it down on unmount, so route changes never
 * leave an orphaned canvas behind (the job `destroyCharts()` did in the original).
 */
export function Chart({
  config,
  height = 250,
}: {
  config: ChartConfiguration;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const chart = new ChartJS(canvas, configRef.current);
    return () => chart.destroy();
    // Re-create whenever the serialised config changes.
  }, [JSON.stringify(config)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="chart-box" style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
