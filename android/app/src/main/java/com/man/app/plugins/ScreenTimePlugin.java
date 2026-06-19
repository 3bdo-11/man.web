package com.man.app.plugins;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Process;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Calendar;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "ScreenTimePlugin")
public class ScreenTimePlugin extends Plugin {

    @PluginMethod
    public void hasUsageAccessPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasUsageAccess());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestUsageAccessPermission(PluginCall call) {
        if (!hasUsageAccess()) {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            getActivity().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void getTodayScreenTime(PluginCall call) {
        if (!hasUsageAccess()) {
            call.resolve(buildEmptyResult());
            return;
        }

        long now = System.currentTimeMillis();
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        long dayStart = calendar.getTimeInMillis();

        Log.d("ScreenTime", "dayStart: " + dayStart + " now: " + now);

        call.resolve(queryScreenTime(dayStart, now));
    }

    @PluginMethod
    public void getWeeklyScreenTime(PluginCall call) {
        if (!hasUsageAccess()) {
            call.resolve(buildEmptyResult());
            return;
        }

        int firstWeekday = call.getInt("firstWeekday", 0);
        int calendarDay = firstWeekday + 1;
        if (calendarDay > 7) calendarDay = Calendar.SUNDAY;

        long now = System.currentTimeMillis();
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.DAY_OF_WEEK, calendarDay);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        long weekStart = calendar.getTimeInMillis();

        call.resolve(queryScreenTime(weekStart, now));
    }

    @PluginMethod
    public void getMonthlyScreenTime(PluginCall call) {
        if (!hasUsageAccess()) {
            call.resolve(buildEmptyResult());
            return;
        }

        long now = System.currentTimeMillis();
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.DAY_OF_MONTH, 1);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        long monthStart = calendar.getTimeInMillis();

        call.resolve(queryScreenTime(monthStart, now));
    }

    private Context getAppContext() {
        return getContext().getApplicationContext();
    }

    private boolean hasUsageAccess() {
        try {
            AppOpsManager appOps = (AppOpsManager) getAppContext()
                .getSystemService(Context.APP_OPS_SERVICE);
            if (appOps == null) return false;
            int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                getAppContext().getPackageName()
            );
            return mode == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    private JSObject queryScreenTime(long startTime, long endTime) {
        UsageStatsManager usm = (UsageStatsManager) getAppContext()
            .getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getAppContext().getPackageManager();
        String selfPackage = getAppContext().getPackageName();
        JSArray appList = new JSArray();
        long totalMs = 0;

        Map<String, UsageStats> usageStatsMap = usm.queryAndAggregateUsageStats(startTime, endTime);
        if (usageStatsMap == null) {
            Log.d("ScreenTime", "Raw stats map is null");
            return buildEmptyResult();
        }

        Log.d("ScreenTime", "Raw stats count: " + usageStatsMap.size());
        for (Map.Entry<String, UsageStats> e : usageStatsMap.entrySet()) {
            Log.d("ScreenTime", e.getKey() + " -> " + e.getValue().getTotalTimeInForeground());
        }

        List<Map.Entry<String, UsageStats>> sorted = new java.util.ArrayList<>();
        for (Map.Entry<String, UsageStats> entry : usageStatsMap.entrySet()) {
            sorted.add(entry);
        }
        sorted.sort((a, b) -> Long.compare(b.getValue().getTotalTimeInForeground(), a.getValue().getTotalTimeInForeground()));

        for (Map.Entry<String, UsageStats> entry : sorted) {
            String packageName = entry.getKey();
            if (packageName.equals(selfPackage)) continue;
            UsageStats stats = entry.getValue();
            long foregroundMs = stats.getTotalTimeInForeground();
            if (foregroundMs <= 0) continue;
            totalMs += foregroundMs;

            String appName = packageName;
            try {
                appName = pm.getApplicationLabel(
                    pm.getApplicationInfo(packageName, 0)
                ).toString();
            } catch (PackageManager.NameNotFoundException ignored) {}

            JSObject app = new JSObject();
            app.put("packageName", packageName);
            app.put("appName", appName);
            app.put("minutes", (int) (foregroundMs / 60000));
            appList.put(app);
        }

        JSObject result = new JSObject();
        result.put("totalMinutes", (int) (totalMs / 60000));
        result.put("apps", appList);
        return result;
    }

    private JSObject buildEmptyResult() {
        JSObject result = new JSObject();
        result.put("totalMinutes", 0);
        result.put("apps", new JSArray());
        return result;
    }
}
