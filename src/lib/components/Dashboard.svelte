<script lang="ts">
  import { onMount } from 'svelte';
  import { activeProfile, profileManager } from '../profile-manager';
  import { BankingCSVParser, type BankingCSVTable } from '../banking-csv-parser';
  import ProfilePanel from './ProfilePanel.svelte';
  import CSVUpload from './CSVUpload.svelte';
  import BarEarningsExpenses from './BarEarningsExpenses.svelte';
  import type { Profile, CustomSummary } from '../types';

  let csvData: BankingCSVTable | null = null;
  let errorMessage = '';
  let showError = false;
  let isLoading = false;
  let showCSVTools = true;
  let showGraphs = false;
  let graphGroupBy: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily';
  let graphDateStart = '';
  let graphDateEnd = '';

  // Recent transactions search controls
  let searchFromInput = '';
  let searchReasonInput = '';
  let appliedFrom = '';
  let appliedReason = '';

  function applyRecentSearch() {
    appliedFrom = searchFromInput.trim().toLowerCase();
    appliedReason = searchReasonInput.trim().toLowerCase();
  }

  function clearRecentSearch() {
    searchFromInput = '';
    searchReasonInput = '';
    appliedFrom = '';
    appliedReason = '';
  }

  $: hasRecentFilters = Boolean(appliedFrom || appliedReason);
  $: filteredRecentTransactions = recentTransactions.filter(t => {
    const fromMatch = appliedFrom ? (t.from || '').toLowerCase().includes(appliedFrom) : true;
    const reasonMatch = appliedReason ? (t.reason || '').toLowerCase().includes(appliedReason) : true;
    return fromMatch && reasonMatch;
  });

  // Recent transactions options
  let showRouting = false;

  const parser = new BankingCSVParser();

  // Reactive statement to load CSV when active profile changes
  $: if ($activeProfile) {
    if ($activeProfile.csvData) {
      loadProfileCSV();
    } else {
      // Clear data if profile has no CSV
      csvData = null;
      errorMessage = '';
      showError = false;
    }
  }

  onMount(async () => {
    // Small delay to ensure stores and csv parsing settle before computing summaries
    await new Promise((r) => setTimeout(r, 50));
    if ($activeProfile?.csvData) {
      await loadProfileCSV();
    }
  });

  async function loadProfileCSV() {
    if (!$activeProfile?.csvData) return;
    
    isLoading = true;
    try {
      const parsedData = parser.parseBankingData($activeProfile.csvData);
      csvData = parsedData;
      errorMessage = '';
      showError = false;
    } catch (error) {
      console.error('Error loading profile CSV:', error);
      errorMessage = 'Failed to load CSV data for this profile.';
      showError = true;
      csvData = null;
    } finally {
      isLoading = false;
    }
  }

  function handleProfileSwitch(event: CustomEvent) {
    const { profile } = event.detail;
    csvData = null;
    errorMessage = '';
    showError = false;

    if ($activeProfile) {
      if ($activeProfile.csvData) {
        loadProfileCSV();
      }
    }
  }

  function handleCSVUpload(event: CustomEvent) {
    const { profile, data } = event.detail;
    csvData = data;
    errorMessage = '';
    showError = false;
  }

  function handleCSVError(event: CustomEvent) {
    const { error } = event.detail;
    errorMessage = error;
    showError = true;
  }

  function formatAmount(amount: number): string {
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(amount).toLocaleString()}`;
  }

  function formatDate(dateString: string): string {
    const d = parseBankingDate(dateString);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  // Robust parser for banking date format like "07/Aug/2025 23:13" with fallback
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

  // Recent transactions sorted by newest first
  $: recentTransactions = csvData
    ? [...csvData.transactions].sort((a, b) => parseBankingDate(b.date).getTime() - parseBankingDate(a.date).getTime())
    : [];

  // Helpers for summary calculations
  function parseBalanceNumber(balanceStr: string): number {
    if (!balanceStr) return 0;
    const clean = balanceStr.replace(/[$,\s]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  function getYMD(date: Date) {
    return { y: date.getFullYear(), m: date.getMonth(), d: date.getDate() };
  }

  function isSameDay(a: Date, b: Date): boolean {
    const A = getYMD(a);
    const B = getYMD(b);
    return A.y === B.y && A.m === B.m && A.d === B.d;
  }

  // Current Balance: latest transaction's balance
  $: currentBalance = (() => {
    if (!csvData) return 0;
    if (recentTransactions.length === 0) return 0;
    const latest = recentTransactions[0];
    return parseBalanceNumber(latest.balance);
  })();

  function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  function computeDayChange(targetDate: Date) {
    if (!csvData) return { pos: 0, neg: 0, net: 0 };
    const startISO = startOfDay(targetDate).toISOString();
    const endISO = endOfDay(targetDate).toISOString();
    let pos = 0;
    let neg = 0;
    for (const t of csvData.transactions) {
      if (transactionWithinDateRange(t.date, startISO, endISO)) {
        if (t.amount > 0) pos += t.amount;
        else if (t.amount < 0) neg += Math.abs(t.amount);
      }
    }
    return { pos, neg, net: pos - neg };
  }

  // Today and Yesterday changes (explicitly depend on csvData)
  $: todayStats = csvData ? computeDayChange(new Date()) : { pos: 0, neg: 0, net: 0 };
  $: yesterdayStats = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return csvData ? computeDayChange(d) : { pos: 0, neg: 0, net: 0 };
  })();

  // Gambling: From === "LS Bets"
  $: gamblingNet = (() => {
    if (!csvData) return 0;
    return csvData.transactions.reduce((sum, t) => {
      const fromVal = (t.from || '').trim().toLowerCase();
      return fromVal === 'ls bets' ? sum + t.amount : sum;
    }, 0);
  })();

  // Trucking: Reason includes "(Trucking)" OR equals "Purchase of Components"
  $: truckingNet = (() => {
    if (!csvData) return 0;
    return csvData.transactions.reduce((sum, t) => {
      const reason = (t.reason || '').trim().toLowerCase();
      const isTrucking = reason.includes('(trucking)');
      const isPurchaseOfComponents = reason === 'purchase of components';
      return (isTrucking || isPurchaseOfComponents) ? sum + t.amount : sum;
    }, 0);
  })();

  // Trucking work time: sum durations of sessions of trucking-related entries, where
  // a session continues as long as the next trucking-related entry is within 1 hour.
  $: truckingHours = (() => {
    if (!csvData) return 0;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const relatedDates = csvData.transactions
      .filter(t => {
        const reason = (t.reason || '').trim().toLowerCase();
        return reason.includes('(trucking)') || reason === 'purchase of components';
      })
      .map(t => parseBankingDate(t.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (relatedDates.length === 0) return 0;

    let totalMs = 0;
    let sessionStart = relatedDates[0];
    let lastStamp = relatedDates[0];

    for (let i = 1; i < relatedDates.length; i++) {
      const current = relatedDates[i];
      const gap = current.getTime() - lastStamp.getTime();
      if (gap <= ONE_HOUR_MS) {
        // still in the same session
        lastStamp = current;
      } else {
        // close previous session one hour after last stamp
        totalMs += (lastStamp.getTime() + ONE_HOUR_MS) - sessionStart.getTime();
        // start new session
        sessionStart = current;
        lastStamp = current;
      }
    }

    // close final session
    totalMs += (lastStamp.getTime() + ONE_HOUR_MS) - sessionStart.getTime();

    return totalMs / ONE_HOUR_MS;
  })();

  function formatHours(hours: number): string {
    return `${hours.toFixed(1)} hours`;
  }

  // ---------- Custom Summaries ----------
  let newSummaryName = '';
  let newSummaryReasons = '';
  let newSummaryTimeTracking = false;
  let newSummaryTimeReasons = '';
  let newSummaryFroms = '';
  let newSummaryDateStart = '';
  let newSummaryDateEnd = '';
  let showSummaryModal = false;
  let isEditingSummary = false;
  let editingSummaryId: string | null = null;
  let showDeleteModal = false;
  let pendingDeleteId: string | null = null;
  let pendingDeleteName = '';

  $: customSummaries = $activeProfile?.customSummaries || [];

  function normalize(str: string): string {
    return (str || '').trim().toLowerCase();
  }

  function parseReasonsInput(input: string): string[] {
    return input
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  function transactionMatchesReasons(reasonText: string, reasons: string[]): boolean {
    if (!reasons || reasons.length === 0) return true;
    const source = normalize(reasonText);
    return reasons.some(r => source.includes(normalize(r)));
  }

  function transactionMatchesFroms(fromText: string, froms: string[] | undefined): boolean {
    if (!froms || froms.length === 0) return true;
    const source = normalize(fromText);
    return froms.some(f => source.includes(normalize(f)));
  }

  function transactionWithinDateRange(dateStr: string, start?: string, end?: string): boolean {
    const d = parseBankingDate(dateStr);
    if (isNaN(d.getTime())) return false;
    if (start) {
      const s = new Date(start);
      if (!isNaN(s.getTime()) && d < s) return false;
    }
    if (end) {
      const e = new Date(end);
      if (!isNaN(e.getTime()) && d > e) return false;
    }
    return true;
  }

  function computeNetWithFilters({ reasons, froms, dateStart, dateEnd }:
    { reasons?: string[]; froms?: string[]; dateStart?: string; dateEnd?: string }): number {
    if (!csvData) return 0;
    return csvData.transactions.reduce((sum, t) => {
      const match = transactionMatchesReasons(t.reason, reasons || [])
        && transactionMatchesFroms(t.from, froms)
        && transactionWithinDateRange(t.date, dateStart, dateEnd);
      return match ? sum + t.amount : sum;
    }, 0);
  }

  function computeHoursForReasons(reasons: string[], froms?: string[], dateStart?: string, dateEnd?: string): number {
    if (!csvData) return 0;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const relevant = csvData.transactions
      .filter(t => transactionMatchesReasons(t.reason, reasons)
        && transactionMatchesFroms(t.from, froms)
        && transactionWithinDateRange(t.date, dateStart, dateEnd))
      .map(t => parseBankingDate(t.date))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (relevant.length === 0) return 0;
    let totalMs = 0;
    let sessionStart = relevant[0];
    let last = relevant[0];
    for (let i = 1; i < relevant.length; i++) {
      const cur = relevant[i];
      const gap = cur.getTime() - last.getTime();
      if (gap <= ONE_HOUR_MS) {
        last = cur;
      } else {
        totalMs += (last.getTime() + ONE_HOUR_MS) - sessionStart.getTime();
        sessionStart = cur;
        last = cur;
      }
    }
    totalMs += (last.getTime() + ONE_HOUR_MS) - sessionStart.getTime();
    return totalMs / ONE_HOUR_MS;
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  async function addCustomSummary() {
    if (!$activeProfile) return;
    const reasons = parseReasonsInput(newSummaryReasons);
    const froms = parseReasonsInput(newSummaryFroms);
    const timeReasonsArr = parseReasonsInput(newSummaryTimeReasons);
    const summary: CustomSummary = {
      id: generateId(),
      name: newSummaryName.trim() || 'Custom Summary',
      reasons,
      timeTracking: newSummaryTimeTracking,
      ...(newSummaryTimeTracking && timeReasonsArr.length > 0 ? { timeReasons: timeReasonsArr } : {}),
      ...(froms.length > 0 ? { froms } : {}),
      ...(newSummaryDateStart ? { dateStart: newSummaryDateStart } : {}),
      ...(newSummaryDateEnd ? { dateEnd: newSummaryDateEnd } : {}),
    };
    const existing = $activeProfile.customSummaries || [];
    await profileManager.updateProfile($activeProfile.id, { customSummaries: [...existing, summary] });
    resetSummaryForm();
    showSummaryModal = false;
  }

  async function deleteCustomSummary(id: string) {
    if (!$activeProfile) return;
    const existing = $activeProfile.customSummaries || [];
    const filtered = existing.filter(s => s.id !== id);
    await profileManager.updateProfile($activeProfile.id, { customSummaries: filtered });
  }

  function resetSummaryForm() {
    newSummaryName = '';
    newSummaryReasons = '';
    newSummaryTimeTracking = false;
    newSummaryTimeReasons = '';
    newSummaryFroms = '';
    newSummaryDateStart = '';
    newSummaryDateEnd = '';
    isEditingSummary = false;
    editingSummaryId = null;
    showSummaryModal = false;
  }

  function openCreateSummaryModal() {
    resetSummaryForm();
    showSummaryModal = true;
  }

  function openEditSummaryModal(summary: CustomSummary) {
    isEditingSummary = true;
    editingSummaryId = summary.id;
    newSummaryName = summary.name;
    newSummaryReasons = (summary.reasons || []).join(', ');
    newSummaryFroms = (summary.froms || []).join(', ');
    newSummaryDateStart = summary.dateStart || '';
    newSummaryDateEnd = summary.dateEnd || '';
    newSummaryTimeTracking = !!summary.timeTracking;
    newSummaryTimeReasons = (summary.timeReasons || []).join(', ');
    showSummaryModal = true;
  }

  async function saveSummaryModal() {
    if (!$activeProfile) return;
    if (isEditingSummary && editingSummaryId) {
      const existing = $activeProfile.customSummaries || [];
      const reasons = parseReasonsInput(newSummaryReasons);
      const froms = parseReasonsInput(newSummaryFroms);
      const timeReasonsArr = parseReasonsInput(newSummaryTimeReasons);
      const updated = existing.map(s => s.id === editingSummaryId ? {
        ...s,
        name: newSummaryName.trim() || 'Custom Summary',
        reasons,
        timeTracking: newSummaryTimeTracking,
        timeReasons: (newSummaryTimeTracking && timeReasonsArr.length > 0) ? timeReasonsArr : undefined,
        froms: froms.length > 0 ? froms : undefined,
        dateStart: newSummaryDateStart || undefined,
        dateEnd: newSummaryDateEnd || undefined
      } : s);
      await profileManager.updateProfile($activeProfile.id, { customSummaries: updated });
      resetSummaryForm();
      showSummaryModal = false;
    } else {
      await addCustomSummary();
    }
  }

  function openDeleteSummaryModal(summary: CustomSummary) {
    pendingDeleteId = summary.id;
    pendingDeleteName = summary.name;
    showDeleteModal = true;
  }

  function cancelDeleteSummaryModal() {
    showDeleteModal = false;
    pendingDeleteId = null;
    pendingDeleteName = '';
  }

  async function confirmDeleteSummaryModal() {
    if (pendingDeleteId) {
      await deleteCustomSummary(pendingDeleteId);
    }
    cancelDeleteSummaryModal();
  }

  // Shifts: Reason equals "Work Payment"
  $: shiftsNet = (() => {
    if (!csvData) return 0;
    return csvData.transactions.reduce((sum, t) => {
      const reason = (t.reason || '').trim().toLowerCase();
      return reason === 'work payment' ? sum + t.amount : sum;
    }, 0);
  })();

  // Each payment counts as 1 hour
  $: shiftsHours = (() => {
    if (!csvData) return 0;
    return csvData.transactions.reduce((count, t) => {
      const reason = (t.reason || '').trim().toLowerCase();
      return reason === 'work payment' ? count + 1 : count;
    }, 0);
  })();
</script>

<div class="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
  <!-- Left Sidebar - Profile Panel -->
  <aside class="hidden md:block w-72 border-r border-gray-800 bg-gray-900/40 backdrop-blur">
  <ProfilePanel 
    on:profileSwitch={handleProfileSwitch}
    on:profileCreate={handleProfileSwitch}
    on:profileUpdate={handleProfileSwitch}
    on:profileDelete={handleProfileSwitch}
  />
  </aside>

  <!-- Main Content Area -->
  <div class="flex-1 overflow-y-auto p-6 space-y-6">
    <div class="flex items-center justify-between mb-2 pb-4 border-b border-gray-800">
      <h1 class="text-2xl font-bold">World Banking Display</h1>
      {#if $activeProfile}
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-gray-300">
          <span class="w-3 h-3 rounded-full" style="background-color: {$activeProfile.color || '#6366f1'}"></span>
          {$activeProfile.name}
        </div>
      {/if}
    </div>

    <!-- Error Display -->
    {#if showError}
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        {errorMessage}
        <button class="error-close" on:click={() => showError = false}>×</button>
      </div>
    {/if}

    <!-- CSV Upload Section -->
    <div class="section">
      <div class="flex items-center justify-between">
        <h2 class="section-title m-0">CSV Data Management</h2>
        <button class="btn btn-muted text-xs" on:click={() => showCSVTools = !showCSVTools}>{showCSVTools ? 'Hide' : 'Manage'}</button>
      </div>
      {#if showCSVTools}
        <div class="mt-3">
      <CSVUpload 
            compact={true}
        on:csvUploaded={handleCSVUpload}
        on:csvError={handleCSVError}
      />
        </div>
      {/if}
    </div>

    <!-- Data Display Section -->
    {#if csvData && !isLoading}
      <div class="section">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Transaction Summaries</h2>
          <button class="btn btn-primary" on:click={openCreateSummaryModal}>Create Custom Summary</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
          <div class="card p-4">
            <h3 class="card-header">Current Balance</h3>
            <div class="text-xl font-semibold">{formatAmount(currentBalance).slice(1)}</div>
          </div>
          <div class="card p-4">
            <h3 class="card-header">Today</h3>
            <div class="text-xl font-semibold" class:positive={todayStats.net >= 0} class:negative={todayStats.net < 0}>
              {formatAmount(todayStats.net)}
            </div>
            <div class="muted mt-1">+{todayStats.pos.toLocaleString()} / -{todayStats.neg.toLocaleString()}</div>
          </div>
          <div class="card p-4">
            <h3 class="card-header">Yesterday</h3>
            <div class="text-xl font-semibold" class:positive={yesterdayStats.net >= 0} class:negative={yesterdayStats.net < 0}>
              {formatAmount(yesterdayStats.net)}
          </div>
            <div class="muted mt-1">+{yesterdayStats.pos.toLocaleString()} / -{yesterdayStats.neg.toLocaleString()}</div>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <h2 class="section-title">Custom Summaries</h2>
        </div>

        {#if customSummaries.length === 0}
          <p class="muted mt-3">No custom summaries yet.</p>
        {:else}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-3">
            {#each customSummaries as s}
              <div class="card p-4">
                <div class="flex items-center justify-between">
                  <h3 class="card-header !mb-0">{s.name}</h3>
                  <div class="flex items-center gap-2">
                    <button class="icon-btn" aria-label="Edit" title="Edit" on:click={() => openEditSummaryModal(s)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 528.899 528.899" class="w-3 h-3" fill="#7f7f7f" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M328.883,89.125l107.59,107.589l-272.34,272.34L56.604,361.465L328.883,89.125z M518.113,63.177l-47.981-47.981 c-18.543-18.543-48.653-18.543-67.259,0l-45.961,45.961l107.59,107.59l53.611-53.611 C532.495,100.753,532.495,77.559,518.113,63.177z M0.3,512.69c-1.958,8.812,5.998,16.708,14.811,14.565l119.891-29.069 L27.473,390.597L0.3,512.69z"></path>
                      </svg>
                    </button>
                    <button class="icon-btn" aria-label="Delete" title="Delete" on:click={() => openDeleteSummaryModal(s)}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M6 7h12"/>
                        <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"/>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="mt-2 text-xl font-semibold" class:positive={computeNetWithFilters({ reasons: s.reasons, froms: s.froms, dateStart: s.dateStart, dateEnd: s.dateEnd }) >= 0} class:negative={computeNetWithFilters({ reasons: s.reasons, froms: s.froms, dateStart: s.dateStart, dateEnd: s.dateEnd }) < 0}>
                  {formatAmount(computeNetWithFilters({ reasons: s.reasons, froms: s.froms, dateStart: s.dateStart, dateEnd: s.dateEnd }))}
                </div>
                {#if s.timeTracking}
                  <div class="muted text-xs mt-3">worked {formatHours(computeHoursForReasons((s.timeReasons && s.timeReasons.length > 0 ? s.timeReasons : s.reasons), s.froms, s.dateStart, s.dateEnd))}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="text-center muted text-sm mt-3">
          <strong class="text-gray-300">Range:</strong> {csvData.dateRange.start} - {csvData.dateRange.end}
        </div>
      </div>

      <!-- Graphs section Section -->
      <div class="section">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Graphs</h2>
          <button class="btn btn-muted text-xs px-2 py-1" on:click={() => showGraphs = !showGraphs}>{showGraphs ? 'Hide' : 'Show'}</button>
        </div>
        {#if showGraphs}
          <div class="mt-3 space-y-3">
            <div class="card p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="flex flex-col gap-3">
                  <label class="text-sm text-gray-300" for="graph-group-by">Group by</label>
                  <select id="graph-group-by" class="input" bind:value={graphGroupBy}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-3">
                    <label class="text-sm text-gray-300" for="graph-start">Start</label>
                    <input id="graph-start" type="datetime-local" class="input" bind:value={graphDateStart} />
                  </div>
                  <div class="flex flex-col gap-3">
                    <label class="text-sm text-gray-300" for="graph-end">End</label>
                    <input id="graph-end" type="datetime-local" class="input" bind:value={graphDateEnd} />
                  </div>
                </div>
              </div>
            </div>
            <div class="card p-4">
              <BarEarningsExpenses data={csvData} groupBy={graphGroupBy} dateStart={graphDateStart || undefined} dateEnd={graphDateEnd || undefined} />
            </div>
          </div>
        {/if}
      </div>

      <div class="section">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Recent Transactions</h2>
          <label class="inline-flex items-center gap-2 text-sm text-gray-300">
            <input class="rounded border-gray-700 bg-gray-900 text-brand-600 focus:ring-brand-600" type="checkbox" bind:checked={showRouting} /> Show routing
          </label>
        </div>
        <div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-300" for="rt-from">From</label>
            <input id="rt-from" class="input" type="text" bind:value={searchFromInput} placeholder="Search From" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-300" for="rt-reason">Reason</label>
            <input id="rt-reason" class="input" type="text" bind:value={searchReasonInput} placeholder="Search Reason" />
          </div>
          <div class="flex items-end gap-2">
            <button class="btn btn-primary w-full md:w-auto" on:click={applyRecentSearch}>Search</button>
            {#if hasRecentFilters}
              <button class="btn btn-muted w-full md:w-auto" on:click={clearRecentSearch}>Clear</button>
            {/if}
          </div>
        </div>
        <div class="overflow-x-auto mt-3">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-900/60">
              <tr class="text-left text-gray-300 uppercase tracking-wider text-xs">
                <th class="px-3 py-2">Date</th>
                {#if showRouting}
                  <th class="px-3 py-2">Routing</th>
                {/if}
                <th class="px-3 py-2">From</th>
                <th class="px-3 py-2">Reason</th>
                <th class="px-3 py-2">Amount</th>
                <th class="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              {#each filteredRecentTransactions.slice(0, 10) as transaction}
                <tr class="hover:bg-gray-900/30">
                  <td class="px-3 py-2 whitespace-nowrap">{formatDate(transaction.date)}</td>
                  {#if showRouting}
                    <td class="px-3 py-2 whitespace-nowrap font-mono text-gray-400">{transaction.routing}</td>
                  {/if}
                  <td class="px-3 py-2 whitespace-nowrap">{transaction.from}</td>
                  <td class="px-3 py-2">{transaction.reason}</td>
                  <td class="px-3 py-2 whitespace-nowrap" class:positive={transaction.amount > 0} class:negative={transaction.amount < 0}>
                    {@html formatAmount(transaction.amount)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">{formatAmount(parseBalanceNumber(transaction.balance)).slice(1)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        
        {#if filteredRecentTransactions.length > 10}
          <p class="text-center muted text-sm mt-3">
            Showing 10 of {filteredRecentTransactions.length} transactions
          </p>
        {/if}
      </div>
    {:else if isLoading}
      <div class="section">
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading profile data...</p>
        </div>
      </div>
    {:else if !$activeProfile}
      <div class="section">
        <div class="welcome">
          <h2>Welcome to World Banking Display</h2>
          <p>Create a profile to get started with managing your banking CSV data.</p>
          <p>Each profile can store its own CSV data, allowing you to manage multiple accounts or datasets.</p>
        </div>
      </div>
    {:else}
      <div class="section">
        <div class="no-data">
          <h2>No CSV Data</h2>
          <p>Upload a CSV file to see your banking transactions and analytics.</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .error-message {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #381010;
    border: 1px solid #6b1d1d;
    border-radius: 0.5rem;
    color: #ef4444;
    margin-bottom: 2rem;
  }

  .error-icon {
    font-size: 1.25rem;
  }

  .error-close {
    margin-left: auto;
    background: none;
    border: none;
    color: #dc2626;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
  }

  .error-close:hover {
    background: #fee2e2;
  }

  /* styles moved to Tailwind utilities; keeping minimal fallbacks is unnecessary */

  .positive {
    color: #34d399;
    font-weight: 600;
  }

  .negative {
    color: #ec481f;
    font-weight: 600;
  }

  /* .more-transactions removed due to Tailwind utility replacement */

  .loading, .welcome, .no-data { text-align: center; padding: 3rem 1rem; color: #9ca3af; }

  /* cleanup of unused selectors after Tailwind refactor */
  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #6b7280;
    font-size: 0.9rem;
  }
  .icon-btn:hover { color: #ef4444; }

  .loading .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #1f2937;
    border-top: 4px solid #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .welcome h2 { color: #e5e7eb; margin-bottom: 1rem; }
  .welcome p { margin: 0.5rem 0; max-width: 600px; margin-left: auto; margin-right: auto; }
  .no-data h2 { color: #e5e7eb; margin-bottom: 1rem; }
  .no-data p { margin: 0.5rem 0; }
</style>

<!-- Custom Summary Modal -->
{#if showSummaryModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60" role="button" tabindex="0" on:click={resetSummaryForm} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && resetSummaryForm()}></div>
    <div class="relative card w-full max-w-lg p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-100">{isEditingSummary ? 'Edit Summary' : 'Create Summary'}</h3>
        <button class="icon-btn" aria-label="Close" on:click={resetSummaryForm}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>
      <div class="grid gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-300" for="summary-name">Name</label>
          <input id="summary-name" class="input" type="text" bind:value={newSummaryName} placeholder="Summary name" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-300" for="summary-reasons">Reasons (comma-separated)</label>
          <input id="summary-reasons" class="input" type="text" bind:value={newSummaryReasons} placeholder="e.g. Fuel, Repairs" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-300" for="summary-froms">From (comma-separated)</label>
          <input id="summary-froms" class="input" type="text" bind:value={newSummaryFroms} placeholder="e.g. LS Bets, Bank" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-300" for="summary-start">Start date/time (optional)</label>
            <input id="summary-start" class="input" type="datetime-local" bind:value={newSummaryDateStart} />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-300" for="summary-end">End date/time (optional)</label>
            <input id="summary-end" class="input" type="datetime-local" bind:value={newSummaryDateEnd} />
          </div>
        </div>
        <label class="inline-flex items-center gap-2 text-sm text-gray-300" for="summary-track">
          <input id="summary-track" class="rounded border-gray-700 bg-gray-900 text-brand-600 focus:ring-brand-600" type="checkbox" bind:checked={newSummaryTimeTracking} /> Track time
        </label>
        {#if newSummaryTimeTracking}
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-300" for="summary-time-override">Time reasons override (optional)</label>
            <input id="summary-time-override" class="input" type="text" bind:value={newSummaryTimeReasons} placeholder="comma-separated; defaults to Reasons" />
          </div>
        {/if}
      </div>
      <div class="mt-4 flex items-center justify-end gap-2">
        <button class="btn btn-muted" on:click={resetSummaryForm}>Cancel</button>
        <button class="btn btn-primary" on:click={saveSummaryModal} disabled={!newSummaryName.trim()}>Save</button>
      </div>
    </div>
  </div>
{/if}

{#if showDeleteModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60" role="button" tabindex="0" on:click={cancelDeleteSummaryModal} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && cancelDeleteSummaryModal()}></div>
    <div class="relative card w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-100">Delete Summary</h3>
        <button class="icon-btn" aria-label="Close" on:click={cancelDeleteSummaryModal}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>
      <p class="text-sm text-gray-300">Are you sure you want to delete the summary <span class="font-semibold">"{pendingDeleteName}"</span>? This action cannot be undone.</p>
      <div class="mt-4 flex items-center justify-end gap-2">
        <button class="btn btn-muted" on:click={cancelDeleteSummaryModal}>Cancel</button>
        <button class="btn btn-primary" on:click={confirmDeleteSummaryModal}>Delete</button>
      </div>
    </div>
  </div>
{/if}
