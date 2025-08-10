<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { activeProfile, profileManager } from '../profile-manager';
  import { BankingCSVParser, bankingUtils, type BankingCSVTable } from '../banking-csv-parser';
  import type { Profile } from '../types';

  const dispatch = createEventDispatcher<{
    csvUploaded: { profile: Profile; data: BankingCSVTable };
    csvError: { error: string };
  }>();

  let isDragging = false;
  let isProcessing = false;
  let dragCounter = 0;
  let fileInput: HTMLInputElement;

  const parser = new BankingCSVParser();

  export let compact = false;

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter++;
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDragging = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    dragCounter = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      await processFile(target.files[0]);
    }
  }

  async function processFile(file: File) {
    if (!$activeProfile) {
      dispatch('csvError', { error: 'No active profile. Please create or select a profile first.' });
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      dispatch('csvError', { error: 'Please select a CSV file.' });
      return;
    }

    isProcessing = true;

    try {
      const content = await file.text();
      
      // Validate CSV content
      if (!bankingUtils.isValidBankingCSV(content)) {
        throw new Error('Invalid banking CSV format. Please check your file structure.');
      }

      // Parse the CSV
      const csvData = parser.parseBankingData(content);
      
      // Save or merge into active profile
      const result = await profileManager.saveOrMergeProfileData($activeProfile.id, content);

      // Use the persisted data after merge/replace for downstream parsing
      const finalData = parser.parseBankingData(result.csvData);
      dispatch('csvUploaded', { profile: $activeProfile, data: finalData });
      
      // Reset file input
      if (fileInput) {
        fileInput.value = '';
      }
      
    } catch (error) {
      console.error('Error processing CSV:', error);
      dispatch('csvError', { 
        error: error instanceof Error ? error.message : 'Failed to process CSV file.' 
      });
    } finally {
      isProcessing = false;
    }
  }

  function openFileDialog() {
    fileInput?.click();
  }

  function handleKeyActivate(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFileDialog();
    }
  }
</script>

{#if compact}
<div class="flex items-center gap-2">
  <input
    bind:this={fileInput}
    type="file"
    accept=".csv"
    on:change={handleFileSelect}
    style="display: none;"
  />
  <button class="btn btn-primary" on:click={openFileDialog} disabled={isProcessing}>
    {#if isProcessing}Processing...{:else}{$activeProfile?.csvData ? 'Update CSV' : 'Upload CSV'}{/if}
  </button>
  {#if $activeProfile && !$activeProfile.csvData}
    <span class="text-xs text-gray-500">No data yet</span>
  {/if}
</div>
{:else}
<div 
  class={`section ${isDragging ? 'ring-2 ring-brand-600 ring-offset-2 ring-offset-gray-950' : ''} ${isProcessing ? 'opacity-75' : ''}`}
  on:dragenter={handleDragEnter}
  on:dragleave={handleDragLeave}
  on:dragover={handleDragOver}
  on:drop={handleDrop}
  role="region"
  aria-label="CSV upload dropzone"
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".csv"
    on:change={handleFileSelect}
    style="display: none;"
  />

  {#if !$activeProfile}
    <div class="text-center text-gray-400">
      <div class="text-3xl mb-2">👤</div>
      <h3 class="text-lg font-semibold text-gray-200">No Active Profile</h3>
      <p class="text-sm">Please create or select a profile to upload CSV data.</p>
    </div>
  {:else}
    <div class="w-full text-center">
      <div class="flex items-center justify-center gap-3 mb-4 p-3 rounded-lg bg-gray-900/40 border border-gray-800">
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style="background-color: {$activeProfile.color || '#3b82f6'}">
          {$activeProfile.name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div class="text-left">
          <h3 class="text-gray-100 font-semibold">{$activeProfile.name}</h3>
          {#if $activeProfile.description}
            <p class="text-sm text-gray-400">{$activeProfile.description}</p>
          {/if}
        </div>
      </div>

      <div class="p-6 border-2 border-dashed border-gray-800 rounded-lg bg-gray-900/30 cursor-pointer hover:border-brand-600 transition" on:click={openFileDialog} role="button" tabindex="0" on:keydown={handleKeyActivate}>
        {#if isProcessing}
          <div class="flex flex-col items-center">
            <div class="spinner"></div>
            <p class="text-sm text-gray-400">Processing CSV...</p>
          </div>
        {:else}
          <div class="text-3xl mb-2">📁</div>
          <h4 class="text-gray-100 font-semibold">Upload CSV File</h4>
          <p class="text-sm text-gray-400">Drag and drop your CSV file here, or click to browse</p>
          <p class="text-xs text-gray-500 italic">Supports banking transaction CSV format</p>
        {/if}
      </div>

      {#if $activeProfile.csvData}
        <div class="mt-4 p-3 bg-emerald-900/20 border border-emerald-800 rounded-lg">
          <h4 class="text-emerald-300 font-medium">Current Data</h4>
          <p class="text-sm text-emerald-400">Profile has CSV data loaded</p>
          <button class="btn btn-muted mt-2" on:click={openFileDialog}>Update Data</button>
        </div>
      {/if}
    </div>
  {/if}
</div>
{/if}

<style>
  .spinner { width: 32px; height: 32px; border: 3px solid #1f2937; border-top: 3px solid #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
