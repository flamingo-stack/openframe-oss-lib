package com.openframe.api.dto;

import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

import static com.openframe.data.document.notification.NotificationSettingsPolicy.isGroupEnabled;
import static com.openframe.data.document.notification.NotificationSettingsPolicy.isMasterEnabled;

// Defaults are collapsed server-side: every group exactly once — the client never re-implements the defaulting rules.
@Getter
@AllArgsConstructor
public class NotificationSettingsView {

    private final boolean enabled;
    private final List<NotificationTypeSetting> typeSettings;

    public static NotificationSettingsView from(NotificationSettings settings) {
        boolean master = isMasterEnabled(settings);
        List<NotificationTypeSetting> groups = new ArrayList<>();
        for (NotificationSettingGroup group : NotificationSettingGroup.values()) {
            boolean groupEnabled = isGroupEnabled(settings, group);
            groups.add(new NotificationTypeSetting(group, groupEnabled));
        }
        return new NotificationSettingsView(master, groups);
    }
}
