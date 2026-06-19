import { registerPlugin } from '@capacitor/core';

export interface SettingsHelperPlugin {
  openNotificationSettings(): Promise<void>;
  openUsageAccessSettings(): Promise<void>;
}

export const SettingsHelper = registerPlugin<SettingsHelperPlugin>('SettingsHelper');
