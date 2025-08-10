<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { profiles, activeProfile, profileManager } from '../profile-manager';
  import type { Profile } from '../types';

  const dispatch = createEventDispatcher<{
    profileSwitch: { profile: Profile };
    profileCreate: { profile: Profile };
    profileUpdate: { profile: Profile };
    profileDelete: { profileId: string };
  }>();

  let showCreateForm = false;
  let newProfileName = '';
  let newProfileDescription = '';
  let newProfileColor = '#3b82f6';
  let editingProfile: Profile | null = null;
  let editName = '';
  let editDescription = '';
  let editColor = '';

  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6b7280'
  ];

  function handleCreateProfile() {
    if (!newProfileName.trim()) return;
    
    profileManager.addProfile({
      name: newProfileName.trim(),
      description: newProfileDescription.trim() || undefined,
      color: newProfileColor,
      csvData: ''
    }).then(profile => {
      dispatch('profileCreate', { profile });
      resetCreateForm();
      showCreateForm = false;
    }).catch(console.error);
  }

  function handleUpdateProfile() {
    if (!editingProfile || !editName.trim()) return;
    
    profileManager.updateProfile(editingProfile.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      color: editColor
    }).then(profile => {
      dispatch('profileUpdate', { profile });
      editingProfile = null;
    }).catch(console.error);
  }

  function handleDeleteProfile(profile: Profile) {
    if (confirm(`Are you sure you want to delete "${profile.name}"? This will also delete all associated CSV data.`)) {
      profileManager.deleteProfile(profile.id).then(() => {
        dispatch('profileDelete', { profileId: profile.id });
      }).catch(console.error);
    }
  }

  function handleSwitchProfile(profile: Profile) {
    profileManager.switchProfile(profile.id).then(() => {
      dispatch('profileSwitch', { profile });
    }).catch(console.error);
  }

  function startEdit(profile: Profile) {
    editingProfile = profile;
    editName = profile.name;
    editDescription = profile.description || '';
    editColor = profile.color || '#3b82f6';
  }

  function cancelEdit() {
    editingProfile = null;
    editName = '';
    editDescription = '';
    editColor = '';
  }

  function resetCreateForm() {
    newProfileName = '';
    newProfileDescription = '';
    newProfileColor = '#3b82f6';
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  function getInitials(name: string): string {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  }
</script>

<div class="h-full flex flex-col">
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/60">
    <h3 class="text-sm font-semibold text-gray-300 uppercase tracking-wider">Profiles</h3>
    <button
      class="w-8 h-8 rounded-full border border-brand-600 text-brand-400 hover:bg-brand-600 hover:text-white transition grid place-items-center"
      on:click={() => showCreateForm = !showCreateForm}
      aria-label="Toggle create profile"
    >
      {#if showCreateForm}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14"/>
        </svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      {/if}
    </button>
  </div>

  <!-- Create Profile Form -->
  {#if showCreateForm}
    <div class="p-4 space-y-3 border-b border-gray-800 bg-gray-900/40">
      <input type="text" placeholder="Profile name" bind:value={newProfileName} class="input" />
      <input type="text" placeholder="Description (optional)" bind:value={newProfileDescription} class="input" />
      <div>
        <label class="text-sm text-gray-400" for="create-color">Color</label>
        <div id="create-color" class="mt-2 flex flex-wrap gap-2">
          {#each colors as color}
            <button
              class={`w-6 h-6 rounded-full ring-2 ${color === newProfileColor ? 'ring-white' : 'ring-transparent'} transition-transform hover:scale-110`}
              style="background-color: {color}"
              on:click={() => newProfileColor = color}
              aria-label={`Choose ${color}`}
            ></button>
          {/each}
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" on:click={handleCreateProfile}>Create</button>
        <button class="btn btn-muted" on:click={() => showCreateForm = false}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Profile List -->
  <div class="flex-1 overflow-y-auto">
    {#each $profiles as profile (profile.id)}
      <div class={`flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-transparent hover:bg-gray-900/40 transition ${$activeProfile?.id === profile.id ? 'bg-gray-900/60 border-l-4 border-brand-600' : ''}`}>
        <!-- Profile Avatar -->
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" style="background-color: {profile.color || '#3b82f6'}">
          {getInitials(profile.name)}
        </div>

        <!-- Profile Info -->
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-gray-100 truncate">{profile.name}</div>
          {#if profile.description}
            <div class="text-xs text-gray-400 truncate">{profile.description}</div>
          {/if}
          <div class="text-xs text-gray-500">
            Created: <span class="font-mono">{formatDate(profile.createdAt)}</span>
          </div>
        </div>

        <!-- Profile Actions -->
        <div class="flex items-center gap-2 flex-shrink-0">
          {#if $activeProfile?.id !== profile.id}
            <button 
              class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              on:click={() => handleSwitchProfile(profile)}
              title="Switch to this profile"
            >
              Switch
            </button>
          {/if}
          
            <button 
            class="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition" aria-label="Edit profile"
            on:click={() => startEdit(profile)}
            title="Edit profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 528.899 528.899" class="w-3 h-3" fill="#7f7f7f" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M328.883,89.125l107.59,107.589l-272.34,272.34L56.604,361.465L328.883,89.125z M518.113,63.177l-47.981-47.981 c-18.543-18.543-48.653-18.543-67.259,0l-45.961,45.961l107.59,107.59l53.611-53.611 C532.495,100.753,532.495,77.559,518.113,63.177z M0.3,512.69c-1.958,8.812,5.998,16.708,14.811,14.565l119.891-29.069 L27.473,390.597L0.3,512.69z"></path>
            </svg>
          </button>
          
          <button 
            class="p-1 rounded hover:bg-gray-800 text-red-400 hover:text-red-300 transition" aria-label="Delete profile"
            on:click={() => handleDeleteProfile(profile)}
            title="Delete profile"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 7h12"/>
              <path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Edit Profile Form -->
      {#if editingProfile?.id === profile.id}
        <div class="p-4 space-y-3 border-b border-gray-800 bg-gray-900/40">
          <input type="text" placeholder="Profile name" bind:value={editName} class="input" />
          <input type="text" placeholder="Description (optional)" bind:value={editDescription} class="input" />
          <div>
            <label class="text-sm text-gray-400" for="edit-color">Color</label>
            <div id="edit-color" class="mt-2 flex flex-wrap gap-2">
              {#each colors as color}
                <button
                  class={`w-6 h-6 rounded-full ring-2 ${color === editColor ? 'ring-white' : 'ring-transparent'} transition-transform hover:scale-110`}
                  style="background-color: {color}"
                  on:click={() => editColor = color}
                  aria-label={`Choose ${color}`}
                ></button>
              {/each}
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" on:click={handleUpdateProfile}>Update</button>
            <button class="btn btn-muted" on:click={cancelEdit}>Cancel</button>
          </div>
        </div>
      {/if}
    {/each}

    {#if $profiles.length === 0}
      <div class="p-6 text-center text-gray-500">
        <p>No profiles yet</p>
        <p class="text-sm text-gray-600">Create your first profile to get started</p>
      </div>
    {/if}
  </div>
</div>

<style></style>
