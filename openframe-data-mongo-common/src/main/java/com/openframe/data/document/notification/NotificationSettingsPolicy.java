package com.openframe.data.document.notification;

import java.util.Map;

/** Defaulting rules: absent field or absent group key means enabled — only an explicit false mutes. */
public final class NotificationSettingsPolicy {

    private NotificationSettingsPolicy() {
    }

    public static boolean isMasterEnabled(NotificationSettings settings) {
        Boolean enabled = settings.getEnabled();
        return enabled == null || enabled;
    }

    public static boolean isGroupEnabled(NotificationSettings settings, NotificationSettingGroup group) {
        Map<NotificationSettingGroup, Boolean> typeSettings = settings.getTypeSettings();
        return group == null || typeSettings == null || typeSettings.getOrDefault(group, true);
    }

    public static boolean isEnabledFor(NotificationSettings settings, NotificationSettingGroup group) {
        boolean master = isMasterEnabled(settings);
        boolean groupEnabled = isGroupEnabled(settings, group);
        return master && groupEnabled;
    }
}
