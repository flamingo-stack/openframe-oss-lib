package com.openframe.data.document.notification;

import java.util.Set;

/** Defaulting rules: absence means enabled — only listing a group in mutedGroups mutes it. */
public final class NotificationSettingsPolicy {

    private NotificationSettingsPolicy() {
    }

    public static boolean isMasterEnabled(NotificationSettings settings) {
        Boolean enabled = settings.getEnabled();
        return enabled == null || enabled;
    }

    public static boolean isGroupEnabled(NotificationSettings settings, NotificationSettingGroup group) {
        Set<NotificationSettingGroup> mutedGroups = settings.getMutedGroups();
        return group == null || mutedGroups == null || !mutedGroups.contains(group);
    }

    public static boolean isEnabledFor(NotificationSettings settings, NotificationSettingGroup group) {
        boolean master = isMasterEnabled(settings);
        boolean groupEnabled = isGroupEnabled(settings, group);
        return master && groupEnabled;
    }
}
