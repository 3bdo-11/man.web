export const EVENTS = {
  DATA_UPDATED: 'man_data_updated',
  DATA_UPDATED_PREFIX: 'man_data_updated_',
  SETTINGS_UPDATED: 'man_settings_updated',
  WRITE_START: 'man_write_start',
  WRITE_END: 'man_write_end',
  STORAGE_ERROR: 'storage_error',
} as const;

export const STORAGE_KEYS = {
  RECOVERY_BACKUP: 'man_recovery_backup',
  RECOVERY_BACKUP_AT: 'man_recovery_backup_at',
  APP_DATA_V2: 'man_app_data_v2',
  APP_DATA_V1: 'man_app_data',
  APP_SETTINGS: 'man_app_settings',
  MIGRATION_DONE: 'man_migration_done',
  TIMEZONE: 'man_timezone',
} as const;

export const DB = {
  NAME: 'man_discipline_db',
  VERSION: 1,
  LOGS_STORE: 'daily_logs',
  SETTINGS_STORE: 'settings',
} as const;
