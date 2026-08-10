package com.openframe.api.service;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSetting;
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

    public NotificationSettingsView update(String userId, boolean enabled,
                                           List<NotificationTypeSetting> typeSettings) {
        Map<NotificationSettingGroup, Boolean> groupOverrides = toGroupOverrides(typeSettings);
        settingsRepository.saveSettings(userId, enabled, groupOverrides);
        return get(userId);
    }

    /** Null means "not sent" — a legacy master-only write keeps the stored group overrides. */
    private static Map<NotificationSettingGroup, Boolean> toGroupOverrides(List<NotificationTypeSetting> typeSettings) {
        if (typeSettings == null) {
            return null;
        }
        Map<NotificationSettingGroup, Boolean> overrides = new EnumMap<>(NotificationSettingGroup.class);
        for (NotificationTypeSetting setting : typeSettings) {
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
