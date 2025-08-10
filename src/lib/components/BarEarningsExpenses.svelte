<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  // @ts-ignore - types provided by chart.js
  import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
  import type { BankingCSVTable } from '../banking-csv-parser';

  Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

  export let data: BankingCSVTable | null = null;
  export let maxBars = 24;
  export let groupBy: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily';
  export let dateStart: string | undefined;
  export let dateEnd: string | undefined;

  let canvasEl: HTMLCanvasElement;
  let chart: Chart | null = null;

  function parseBankingDate(dateStr: string): Date {
    const match = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (match) {
      const [, day, mon, year, hour, minute] = match;
      const months: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      return new Date(parseInt(year), months[mon] ?? 0, parseInt(day), parseInt(hour), parseInt(minute));
    }
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? new Date(0) : fallback;
  }

  function getWeekKey(d: Date): string {
    // ISO week: get Thursday of this week
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7; // 1..7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  function withinRange(d: Date): boolean {
    if (dateStart) {
      const s = new Date(dateStart);
      if (!isNaN(s.getTime()) && d < s) return false;
    }
    if (dateEnd) {
      const e = new Date(dateEnd);
      if (!isNaN(e.getTime()) && d > e) return false;
    }
    return true;
  }

  function keyForDate(d: Date): string {
    switch (groupBy) {
      case 'daily':
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      case 'weekly':
        return getWeekKey(d);
      case 'yearly':
        return `${d.getFullYear()}`;
      case 'monthly':
      default:
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  function sortKeys(keys: string[]): string[] {
    // keys are formatted lexicographically sortable
    return keys.sort();
  }

  function buildDataset(table: BankingCSVTable) {
    const buckets = new Map<string, { earnings: number; expenses: number }>();
    for (const t of table.transactions) {
      const d = parseBankingDate(t.date);
      if (isNaN(d.getTime())) continue;
      if (!withinRange(d)) continue;
      const key = keyForDate(d);
      if (!buckets.has(key)) buckets.set(key, { earnings: 0, expenses: 0 });
      if (t.amount >= 0) buckets.get(key)!.earnings += t.amount; else buckets.get(key)!.expenses += Math.abs(t.amount);
    }
    const keys = sortKeys(Array.from(buckets.keys()));
    const trimmed = keys.slice(-maxBars);
    return {
      labels: trimmed,
      earnings: trimmed.map(k => buckets.get(k)!.earnings),
      expenses: trimmed.map(k => buckets.get(k)!.expenses)
    };
  }

  function render() {
    if (!data || !canvasEl) return;
    const ds = buildDataset(data);
    if (chart) {
      chart.destroy();
      chart = null;
    }
    chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        labels: ds.labels,
        datasets: [
          {
            label: 'Earnings',
            data: ds.earnings,
            borderColor: 'rgb(16, 185, 129)', // emerald-500
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            pointBackgroundColor: 'rgb(16, 185, 129)',
            pointBorderColor: 'rgb(16, 185, 129)',
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
          },
          {
            label: 'Expenses',
            data: ds.expenses,
            borderColor: 'rgb(236, 72, 31)', // custom orange-500
            backgroundColor: 'rgba(236, 72, 31, 0.15)',
            pointBackgroundColor: 'rgb(236, 72, 31)',
            pointBorderColor: 'rgb(236, 72, 31)',
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#e5e7eb'
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: $${Number(ctx.parsed.y).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(55,65,81,0.3)' }
          },
          y: {
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(55,65,81,0.3)' }
          }
        }
      }
    });
  }

  // Re-render when any input changes
  $: {
    const _deps = [data, groupBy, dateStart, dateEnd, maxBars];
    if (data) render();
  }

  onMount(() => { render(); });
  onDestroy(() => { if (chart) chart.destroy(); });
</script>

<div class="w-full h-64 md:h-72 lg:h-80">
  <canvas bind:this={canvasEl}></canvas>
  {#if !data}
    <div class="text-center text-sm text-gray-500 mt-4">No data to display</div>
  {/if}
</div>

<style></style>

