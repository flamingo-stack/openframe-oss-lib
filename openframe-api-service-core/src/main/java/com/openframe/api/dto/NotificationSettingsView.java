package com.openframe.api.dto;

import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;

import java.util.Arrays;
import java.util.List;

/**
 * The resolved contract shape: absent document/keys are already collapsed to their defaults, every
 * group present exactly once — the client renders state, it never re-implements the defaulting rules.
 */
public record NotificationSettingsView(boolean enabled,
                                       List<TypeSetting> typeSettings,
                                       boolean pushEnabled) {

    public record TypeSetting(NotificationSettingGroup group, boolean enabled) {
    }

    public static NotificationSettingsView from(NotificationSettings settings) {
        boolean master = settings.masterEnabled();
        List<TypeSetting> groups = Arrays.stream(NotificationSettingGroup.values())
                .map(group -> new TypeSetting(group, settings.groupEnabled(group)))
                .toList();
        return new NotificationSettingsView(master, groups, master);
    }
}
