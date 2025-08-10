<script lang="ts">
  import { onMount } from 'svelte';
  import { profileManager, profiles, activeProfile } from '$lib/profile-manager';
  import { BankingCSVParser, bankingUtils } from '$lib/banking-csv-parser';
  import type { Profile } from '$lib/types';

  let demoCSV = `"","From","Routing","Reason","Amount","Balance","Date"
"12345","Demo Bank","123456789","Sample Transaction","+$100","1000","01/Jan/2025 10:00"
"12346","Demo Bank","123456789","Another Transaction","-$50","950","01/Jan/2025 11:00"`;

  let currentProfile: Profile | null = null;
  let parsedData: any = null;
  let errorMessage = '';

  const parser = new BankingCSVParser();

  onMount(async () => {
    // Create a demo profile if none exist
    if ($profiles.length === 0) {
      await createDemoProfile();
    }
  });

  async function createDemoProfile() {
    try {
      const profile = await profileManager.addProfile({
        name: 'Demo Profile',
        description: 'A demo profile for testing',
        color: '#3b82f6',
        csvData: demoCSV
      });
      
      await profileManager.switchProfile(profile.id);
      currentProfile = profile;
      await parseCSV();
    } catch (error) {
      console.error('Error creating demo profile:', error);
      errorMessage = 'Failed to create demo profile';
    }
  }

  async function parseCSV() {
    if (!currentProfile?.csvData) return;
    
    try {
      parsedData = parser.parseBankingData(currentProfile.csvData);
      errorMessage = '';
    } catch (error) {
      console.error('Error parsing CSV:', error);
      errorMessage = 'Failed to parse CSV data';
      parsedData = null;
    }
  }

  async function updateCSV() {
    if (!currentProfile) return;
    
    try {
      await profileManager.saveProfileData(currentProfile.id, demoCSV);
      await profileManager.updateProfile(currentProfile.id, { csvData: demoCSV });
      currentProfile = await profileManager.getProfile(currentProfile.id) || null;
      await parseCSV();
    } catch (error) {
      console.error('Error updating CSV:', error);
      errorMessage = 'Failed to update CSV data';
    }
  }

  function formatAmount(amount: number): string {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}$${Math.abs(amount).toLocaleString()}`;
  }
</script>

<svelte:head>
  <title>Profile System Demo - World Banking Display</title>
</svelte:head>

<div class="demo-container">
  <header class="demo-header">
    <h1>Profile System Demo</h1>
    <p>This demo shows how the profile system integrates with the CSV parser</p>
  </header>

  <div class="demo-content">
    <div class="demo-section">
      <h2>Current Profile</h2>
      {#if currentProfile}
        <div class="profile-info">
          <div class="profile-avatar" style="background-color: {currentProfile.color}">
            {currentProfile.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div class="profile-details">
            <h3>{currentProfile.name}</h3>
            {#if currentProfile.description}
              <p>{currentProfile.description}</p>
            {/if}
            <p class="meta">Created: {new Date(currentProfile.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      {:else}
        <p>No profile selected</p>
      {/if}
    </div>

    <div class="demo-section">
      <h2>Demo CSV Data</h2>
      <p>This is sample CSV data that will be parsed:</p>
      <pre class="csv-preview">{demoCSV}</pre>
      <button class="btn btn-primary" on:click={updateCSV} disabled={!currentProfile}>
        Update Profile with Demo Data
      </button>
    </div>

    {#if errorMessage}
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        {errorMessage}
      </div>
    {/if}

    {#if parsedData}
      <div class="demo-section">
        <h2>Parsed Data</h2>
        <div class="data-summary">
          <div class="summary-item">
            <strong>Total Transactions:</strong> {parsedData.totalTransactions}
          </div>
          <div class="summary-item">
            <strong>Net Change:</strong> 
            <span class:positive={parsedData.summary.netChange >= 0} class:negative={parsedData.summary.netChange < 0}>
              {formatAmount(parsedData.summary.netChange)}
            </span>
          </div>
          <div class="summary-item">
            <strong>Deposits:</strong> <span class="positive">+${parsedData.summary.deposits.toLocaleString()}</span>
          </div>
          <div class="summary-item">
            <strong>Withdrawals:</strong> <span class="negative">-${parsedData.summary.withdrawals.toLocaleString()}</span>
          </div>
        </div>

        <h3>Transactions</h3>
        <div class="transactions">
          {#each parsedData.transactions as transaction}
            <div class="transaction-item">
              <div class="transaction-date">{transaction.date}</div>
              <div class="transaction-from">{transaction.from}</div>
              <div class="transaction-reason">{transaction.reason}</div>
              <div class="transaction-amount" class:positive={transaction.amount > 0} class:negative={transaction.amount < 0}>
                {formatAmount(transaction.amount)}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <div class="demo-section">
      <h2>Profile Management</h2>
      <p>Use the main dashboard to:</p>
      <ul>
        <li>Create new profiles</li>
        <li>Switch between profiles</li>
        <li>Upload CSV files to specific profiles</li>
        <li>View profile-specific data</li>
      </ul>
      <a href="/" class="btn btn-secondary">Go to Main Dashboard</a>
    </div>
  </div>
</div>

<style>
  .demo-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .demo-header {
    text-align: center;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid #e2e8f0;
  }

  .demo-header h1 {
    margin: 0 0 1rem 0;
    color: #1e293b;
    font-size: 2.5rem;
    font-weight: 700;
  }

  .demo-header p {
    margin: 0;
    color: #6b7280;
    font-size: 1.1rem;
  }

  .demo-content {
    display: grid;
    gap: 2rem;
  }

  .demo-section {
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .demo-section h2 {
    margin: 0 0 1rem 0;
    color: #1e293b;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .demo-section h3 {
    margin: 1.5rem 0 1rem 0;
    color: #374151;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .profile-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.5rem;
  }

  .profile-avatar {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.25rem;
  }

  .profile-details h3 {
    margin: 0 0 0.5rem 0;
    color: #1e293b;
    font-size: 1.25rem;
  }

  .profile-details p {
    margin: 0.25rem 0;
    color: #6b7280;
  }

  .profile-details .meta {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .csv-preview {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    overflow-x: auto;
    margin-bottom: 1rem;
    white-space: pre-wrap;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
    text-align: center;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-secondary {
    background: #6b7280;
    color: white;
  }

  .btn-secondary:hover {
    background: #4b5563;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
  }

  .error-icon {
    font-size: 1.25rem;
  }

  .data-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .summary-item {
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.375rem;
    border: 1px solid #e2e8f0;
  }

  .positive {
    color: #059669;
    font-weight: 600;
  }

  .negative {
    color: #dc2626;
    font-weight: 600;
  }

  .transactions {
    display: grid;
    gap: 0.75rem;
  }

  .transaction-item {
    display: grid;
    grid-template-columns: 1fr 2fr 2fr 1fr;
    gap: 1rem;
    padding: 0.75rem;
    background: #f8fafc;
    border-radius: 0.375rem;
    border: 1px solid #e2e8f0;
    font-size: 0.875rem;
  }

  .transaction-item > div {
    display: flex;
    align-items: center;
  }

  .transaction-date {
    color: #6b7280;
    font-weight: 500;
  }

  .transaction-from {
    color: #1e293b;
    font-weight: 500;
  }

  .transaction-reason {
    color: #374151;
  }

  .transaction-amount {
    font-weight: 600;
    text-align: right;
  }

  ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin: 0.5rem 0;
    color: #374151;
  }
</style>
