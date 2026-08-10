package com.openframe.api.dto;

import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

// Defaults are collapsed server-side: every group exactly once — the client never re-implements the defaulting rules.
@Getter
@AllArgsConstructor
public class NotificationSettingsView {

    private final boolean enabled;
    private final List<TypeSetting> typeSettings;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TypeSetting {
        private NotificationSettingGroup group;
        private boolean enabled;
    }

    public static NotificationSettingsView from(NotificationSettings settings) {
        boolean master = settings.isMasterEnabled();
        List<TypeSetting> groups = new ArrayList<>();
        for (NotificationSettingGroup group : NotificationSettingGroup.values()) {
            boolean groupEnabled = settings.isGroupEnabled(group);
            groups.add(new TypeSetting(group, groupEnabled));
        }
        return new NotificationSettingsView(master, groups);
    }
}
