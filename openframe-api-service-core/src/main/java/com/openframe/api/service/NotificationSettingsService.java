package com.openframe.api.service;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationSettingsService {

    private final NotificationSettingsRepository settingsRepository;

    public NotificationSettingsView get(String userId) {
        NotificationSettings settings = settingsRepository.findByUserId(userId)
                .orElseGet(NotificationSettingsService::defaults);
        return NotificationSettingsView.from(settings);
    }

    public NotificationSettingsView update(String userId, Boolean enabled,
                                           List<NotificationSettingsView.TypeSetting> typeSettings,
                                           Boolean legacyPushEnabled) {
        boolean master = resolveMaster(enabled, legacyPushEnabled);
        Map<NotificationSettingGroup, Boolean> groupOverrides = toGroupOverrides(typeSettings);
        settingsRepository.saveSettings(userId, master, groupOverrides);
        return get(userId);
    }

    private static boolean resolveMaster(Boolean enabled, Boolean legacyPushEnabled) {
        if (enabled != null) {
            return enabled;
        }
        if (legacyPushEnabled != null) {
            return legacyPushEnabled;
        }
        throw new BadRequestException("enabled is required");
    }

    /** Null means "not sent" — a legacy master-only write keeps the stored group overrides. */
    private static Map<NotificationSettingGroup, Boolean> toGroupOverrides(List<NotificationSettingsView.TypeSetting> typeSettings) {
        if (typeSettings == null) {
            return null;
        }
        Map<NotificationSettingGroup, Boolean> overrides = new EnumMap<>(NotificationSettingGroup.class);
        for (NotificationSettingsView.TypeSetting setting : typeSettings) {
            NotificationSettingGroup group = setting.getGroup();
            if (group == null) {
                throw new BadRequestException("typeSettings entries require a group");
            }
            overrides.put(group, setting.isEnabled());
        }
        return overrides;
    }

    private static NotificationSettings defaults() {
        return NotificationSettings.builder().build();
    }
}
