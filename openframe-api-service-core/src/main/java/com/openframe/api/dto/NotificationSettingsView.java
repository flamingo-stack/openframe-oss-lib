package com.openframe.api.dto;

import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

// Defaults are collapsed server-side: every group exactly once — the client never re-implements the defaulting rules.
@Getter
@AllArgsConstructor
public class NotificationSettingsView {

    private final boolean enabled;
    private final List<NotificationTypeSetting> typeSettings;

    public static NotificationSettingsView from(NotificationSettings settings) {
        boolean master = settings.isMasterEnabled();
        List<NotificationTypeSetting> groups = new ArrayList<>();
        for (NotificationSettingGroup group : NotificationSettingGroup.values()) {
            boolean groupEnabled = settings.isGroupEnabled(group);
            groups.add(new NotificationTypeSetting(group, groupEnabled));
        }
        return new NotificationSettingsView(master, groups);
    }
}
