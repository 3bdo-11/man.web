import { registerPlugin } from '@capacitor/core';

export interface AppScreenTime {
  packageName: string;
  appName: string;
  minutes: number;
}

export interface ScreenTimeResult {
  totalMinutes: number;
  apps: AppScreenTime[];
}

export interface ScreenTimePlugin {
  hasUsageAccessPermission(): Promise<{ granted: boolean }>;
  requestUsageAccessPermission(): Promise<void>;
  getTodayScreenTime(): Promise<ScreenTimeResult>;
  getWeeklyScreenTime(): Promise<ScreenTimeResult>;
  getMonthlyScreenTime(): Promise<ScreenTimeResult>;
}

export const ScreenTime = registerPlugin<ScreenTimePlugin>('ScreenTimePlugin', {
  web: () => {
    return {
      hasUsageAccessPermission: async () => ({ granted: false }),
      requestUsageAccessPermission: async () => {},
      getTodayScreenTime: async () => ({ totalMinutes: 0, apps: [] }),
      getWeeklyScreenTime: async () => ({ totalMinutes: 0, apps: [] }),
      getMonthlyScreenTime: async () => ({ totalMinutes: 0, apps: [] }),
    };
  },
});
