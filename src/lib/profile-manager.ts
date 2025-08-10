import { writable, derived } from 'svelte/store';
import type { Profile, ProfileManager } from './types';
import { loadProfiles, saveProfiles } from './utils/platform';
import { BankingCSVParser, type BankingCSVTable } from './banking-csv-parser';

class ProfileManagerService implements ProfileManager {
  private _profiles = writable<Profile[]>([]);
  private _activeProfile = writable<Profile | null>(null);
  private parser = new BankingCSVParser();

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const profiles = await loadProfiles();
      this._profiles.set(profiles);
      
      // Set the last active profile or the first one
      const lastActive = profiles.find(p => p.lastActive) || profiles[0];
      if (lastActive) {
        this._activeProfile.set(lastActive);
      }
    } catch (error) {
      console.error('Failed to initialize profile manager:', error);
    }
  }

  get profiles() {
    return this._profiles;
  }

  get activeProfile() {
    return this._activeProfile;
  }

  async addProfile(profileData: Omit<Profile, 'id' | 'createdAt' | 'lastActive'>): Promise<Profile> {
    const newProfile: Profile = {
      ...profileData,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    const profiles = await this.getProfilesArray();
    profiles.push(newProfile);
    await this.saveProfilesArray(profiles);
    
    this._profiles.set(profiles);
    return newProfile;
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const profiles = await this.getProfilesArray();
    const index = profiles.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new Error(`Profile with id ${id} not found`);
    }

    profiles[index] = { ...profiles[index], ...updates };
    await this.saveProfilesArray(profiles);
    
    this._profiles.set(profiles);
    
    // Update active profile if it's the one being updated
    const activeProfile = await this.getActiveProfileArray();
    if (activeProfile?.id === id) {
      this._activeProfile.set(profiles[index]);
    }
    
    return profiles[index];
  }

  async deleteProfile(id: string): Promise<void> {
    const profiles = await this.getProfilesArray();
    const filteredProfiles = profiles.filter(p => p.id !== id);
    
    await this.saveProfilesArray(filteredProfiles);
    this._profiles.set(filteredProfiles);
    
    // If we deleted the active profile, switch to another one
    const activeProfile = await this.getActiveProfileArray();
    if (activeProfile?.id === id) {
      const newActive = filteredProfiles[0] || null;
      this._activeProfile.set(newActive);
    }
  }

  async switchProfile(id: string): Promise<void> {
    const profiles = await this.getProfilesArray();
    const profile = profiles.find(p => p.id === id);
    
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`);
    }

    // Update lastActive for the previous active profile
    const currentActive = await this.getActiveProfileArray();
    if (currentActive) {
      await this.updateProfile(currentActive.id, { lastActive: new Date().toISOString() });
    }

    // Set new active profile and update its lastActive
    await this.updateProfile(id, { lastActive: new Date().toISOString() });
    this._activeProfile.set(profile);
  }

  getProfile(id: string): Profile | undefined {
    let profiles: Profile[] = [];
    this._profiles.subscribe(p => profiles = p)();
    return profiles.find(p => p.id === id);
  }

  async saveProfileData(id: string, csvData: string): Promise<void> {
    await this.updateProfile(id, { csvData });
  }

  /**
   * Save or merge CSV data for a profile. If existing data is present, append
   * only transactions with a date strictly greater than the latest stored date.
   * Returns the persisted CSV string, mode, and number of added rows.
   */
  async saveOrMergeProfileData(
    id: string,
    incomingCSV: string
  ): Promise<{ csvData: string; mode: 'merged' | 'replaced'; addedCount: number }> {
    const profile = this.getProfile(id);
    const nowIso = new Date().toISOString();
    if (!profile || !profile.csvData) {
      // No existing data; save as-is
      await this.updateProfile(id, { csvData: incomingCSV, lastActive: nowIso });
      return { csvData: incomingCSV, mode: 'replaced', addedCount: 0 };
    }

    // Parse existing and incoming data
    const existingBanking = this.parser.parseBankingData(profile.csvData);
    const incomingBanking = this.parser.parseBankingData(incomingCSV);

    // Compute latest date in existing data
    const parseBankingDate = (dateStr: string): Date => {
      const match = dateStr.match(/(\d{2})\/(\w{3})\/(\d{4})\s+(\d{2}):(\d{2})/);
      if (match) {
        const [, day, mon, year, hour, minute] = match;
        const months: Record<string, number> = {
          Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
          Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
        };
        return new Date(parseInt(year), months[mon] ?? 0, parseInt(day), parseInt(hour), parseInt(minute));
      }
      return new Date(dateStr);
    };

    let latestExistingDate = new Date(0);
    for (const t of existingBanking.transactions) {
      if (!t.date) continue;
      const d = parseBankingDate(t.date);
      if (!isNaN(d.getTime()) && d > latestExistingDate) latestExistingDate = d;
    }

    // Filter incoming transactions strictly after latest existing date
    const incomingAfter = incomingBanking.transactions
      .filter(t => {
        if (!t.date) return false;
        const d = parseBankingDate(t.date);
        return !isNaN(d.getTime()) && d > latestExistingDate;
      })
      .sort((a, b) => parseBankingDate(a.date).getTime() - parseBankingDate(b.date).getTime());

    if (incomingAfter.length === 0) {
      // Nothing to add; keep existing CSV
      await this.updateProfile(id, { lastActive: nowIso });
      return { csvData: profile.csvData, mode: 'merged', addedCount: 0 };
    }

    // Build merged CSV using normalized headers and rows
    const existingGeneric = this.parser.parse(profile.csvData);
    const mergedRows = existingGeneric.rows.concat(incomingAfter.map(t => t.rawRow));
    const mergedTable = {
      headers: existingGeneric.headers,
      rows: mergedRows,
      totalRows: mergedRows.length,
    };
    const mergedCSV = this.parser.exportToCSV(mergedTable);

    await this.updateProfile(id, { csvData: mergedCSV, lastActive: nowIso });
    return { csvData: mergedCSV, mode: 'merged', addedCount: incomingAfter.length };
  }

  // Helper methods to work with stores
  private async getProfilesArray(): Promise<Profile[]> {
    return new Promise(resolve => {
      this._profiles.subscribe(profiles => resolve(profiles))();
    });
  }

  private async getActiveProfileArray(): Promise<Profile | null> {
    return new Promise(resolve => {
      this._activeProfile.subscribe(profile => resolve(profile))();
    });
  }

  private async saveProfilesArray(profiles: Profile[]): Promise<void> {
    await saveProfiles(profiles);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // CSV-specific methods
  async parseProfileCSV(profileId: string): Promise<BankingCSVTable | null> {
    const profile = this.getProfile(profileId);
    if (!profile || !profile.csvData) {
      return null;
    }

    try {
      return this.parser.parseBankingData(profile.csvData);
    } catch (error) {
      console.error('Failed to parse CSV for profile:', profileId, error);
      return null;
    }
  }

  async getActiveProfileCSV(): Promise<BankingCSVTable | null> {
    const activeProfile = await this.getActiveProfileArray();
    if (!activeProfile) return null;
    
    return this.parseProfileCSV(activeProfile.id);
  }
}

// Create and export the singleton instance
export const profileManager = new ProfileManagerService();

// Export derived stores for easy access
export const profiles = profileManager.profiles;
export const activeProfile = profileManager.activeProfile;

// Export the manager instance
export { ProfileManagerService };
