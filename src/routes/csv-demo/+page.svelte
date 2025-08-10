<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    BankingCSVParser, 
    bankingUtils, 
    type BankingCSVTable, 
    type BankingTransaction 
  } from '../../lib';

  let csvData: BankingCSVTable | null = null;
  let loading = false;
  let error: string | null = null;
  let searchTerm = '';
  let selectedType: 'all' | 'deposits' | 'withdrawals' = 'all';
  let sortBy = 'date';
  let sortAscending = true;

  // Initialize parser
  const parser = new BankingCSVParser();

  // Load example.csv on mount
  onMount(async () => {
    try {
      loading = true;
      const response = await fetch('/example.csv');
      const content = await response.text();
      csvData = parser.parseBankingData(content);
    } catch (err) {
      error = `Failed to load example.csv: ${err}`;
    } finally {
      loading = false;
    }
  });

  // Handle file upload
  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    try {
      loading = true;
      error = null;
      csvData = await bankingUtils.parseBankingFile(file);
    } catch (err) {
      error = `Failed to parse file: ${err}`;
    } finally {
      loading = false;
    }
  }

  // Get filtered and sorted transactions
  $: filteredTransactions = csvData ? (() => {
    let transactions = csvData.transactions;
    
    // Filter by type
    if (selectedType !== 'all') {
      transactions = parser.getTransactionsByType(csvData, selectedType);
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchResults = parser.searchRows(csvData as any, searchTerm);
      transactions = searchResults.map(row => ({
        transactionId: row['TransactionID'] || row[''] || '',
        from: row['From'] || '',
        routing: row['Routing'] || '',
        reason: row['Reason'] || '',
        amount: parser['parseAmount'](row['Amount'] || ''),
        balance: row['Balance'] || '',
        date: row['Date'] || '',
        rawRow: row
      }));
    }
    
    // Sort
    if (sortBy === 'date') {
      transactions = transactions.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortAscending ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
      });
    } else if (sortBy === 'amount') {
      transactions = transactions.sort((a, b) => 
        sortAscending ? a.amount - b.amount : b.amount - a.amount
      );
    }
    
    return transactions;
  })() : [];

  // Format amount for display
  function formatAmount(amount: number): string {
    const sign = amount >= 0 ? '+' : '';
    const color = amount >= 0 ? 'text-green-600' : 'text-red-600';
    return `<span class="${color}">${sign}$${Math.abs(amount).toLocaleString()}</span>`;
  }

  // Format date for display
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>CSV Parser Demo - World Banking Display</title>
</svelte:head>

<main class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold text-center mb-8">CSV Parser Demo</h1>
  
  <!-- File Upload -->
  <div class="mb-8 p-6 bg-gray-50 rounded-lg">
    <h2 class="text-xl font-semibold mb-4">Upload CSV File</h2>
    <input 
      type="file" 
      accept=".csv" 
      on:change={handleFileUpload}
      class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
    />
    <p class="text-sm text-gray-600 mt-2">Or use the example.csv file that's already loaded</p>
  </div>

  <!-- Loading and Error States -->
  {#if loading}
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-gray-600">Loading CSV data...</p>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
      <strong>Error:</strong> {error}
    </div>
  {:else if csvData}
    <!-- Summary Statistics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="text-sm font-medium text-gray-500">Total Transactions</h3>
        <p class="text-2xl font-bold text-gray-900">{csvData.totalTransactions}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="text-sm font-medium text-gray-500">Net Change</h3>
        <p class="text-2xl font-bold {csvData.summary.netChange >= 0 ? 'text-green-600' : 'text-red-600'}">
          {csvData.summary.netChange >= 0 ? '+' : ''}${csvData.summary.netChange.toLocaleString()}
        </p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="text-sm font-medium text-gray-500">Total Deposits</h3>
        <p class="text-2xl font-bold text-green-600">${csvData.summary.deposits.toLocaleString()}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="text-sm font-medium text-gray-500">Total Withdrawals</h3>
        <p class="text-2xl font-bold text-red-600">${csvData.summary.withdrawals.toLocaleString()}</p>
      </div>
    </div>

    <!-- Filters and Controls -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input 
            type="text" 
            bind:value={searchTerm}
            placeholder="Search transactions..."
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select 
            bind:value={selectedType}
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Transactions</option>
            <option value="deposits">Deposits Only</option>
            <option value="withdrawals">Withdrawals Only</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
          <select 
            bind:value={sortBy}
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </select>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Order</label>
          <button 
            on:click={() => sortAscending = !sortAscending}
            class="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortAscending ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
      </div>
    </div>

    <!-- Transactions Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Routing</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredTransactions as transaction}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{transaction.transactionId}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{transaction.from}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{transaction.routing}</td>
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{transaction.reason}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{@html formatAmount(transaction.amount)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{transaction.balance}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(transaction.date)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      {#if filteredTransactions.length === 0}
        <div class="text-center py-8 text-gray-500">
          No transactions found matching your criteria.
        </div>
      {/if}
    </div>

    <!-- Export Button -->
    <div class="mt-6 text-center">
      <button 
        on:click={() => {
          if (csvData) {
            const csvContent = parser.exportBankingData(csvData);
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'banking-data-export.csv';
            a.click();
            URL.revokeObjectURL(url);
          }
        }}
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Export to CSV
      </button>
    </div>
  {:else}
    <div class="text-center py-8 text-gray-500">
      No CSV data loaded. Please upload a file or wait for the example data to load.
    </div>
  {/if}
</main>

<style>
  /* Add any additional custom styles here */
</style>
