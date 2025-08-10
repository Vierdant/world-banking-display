export interface Profile {
  id: string;
  name: string;
  csvData: string;
  createdAt: string;
  lastActive: string;
  description?: string;
  color?: string;
  customSummaries?: CustomSummary[];
}

export interface CustomSummary {
  id: string;
  name: string;
  reasons: string[]; // reasons to aggregate net amounts for
  timeTracking: boolean; // whether to compute worked hours
  timeReasons?: string[]; // optional override reasons for time tracking; defaults to reasons
  froms?: string[]; // optional: match by From column (case-insensitive substring)
  dateStart?: string; // optional ISO/datetime string for range start (inclusive)
  dateEnd?: string;   // optional ISO/datetime string for range end (inclusive)
}

export interface ProfileManager {
  profiles: any;
  activeProfile: any;
  addProfile(profile: Omit<Profile, 'id' | 'createdAt' | 'lastActive'>): Promise<Profile>;
  updateProfile(id: string, updates: Partial<Profile>): Promise<Profile>;
  deleteProfile(id: string): Promise<void>;
  switchProfile(id: string): Promise<void>;
  getProfile(id: string): Profile | undefined;
  saveProfileData(id: string, csvData: string): Promise<void>;
  /**
   * Save CSV data for a profile. If the profile already has data,
   * merge by appending only transactions that occur strictly after
   * the latest stored transaction date.
   * Returns the persisted CSV, mode used, and count of added rows.
   */
  saveOrMergeProfileData(
    id: string,
    csvData: string
  ): Promise<{ csvData: string; mode: 'merged' | 'replaced'; addedCount: number }>;
}