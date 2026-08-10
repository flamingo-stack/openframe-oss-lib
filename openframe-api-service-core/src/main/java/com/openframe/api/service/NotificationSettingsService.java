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
        return NotificationSettingsView.from(settingsRepository.findByUserId(userId)
                .orElseGet(() -> NotificationSettings.builder().build()));
    }

    /**
     * {@code enabled} wins over the legacy {@code pushEnabled} when both arrive; a null
     * {@code typeSettings} means "not sent" and keeps the stored group overrides.
     */
    public NotificationSettingsView update(String userId, Boolean enabled,
                                           List<NotificationSettingsView.TypeSetting> typeSettings,
                                           Boolean legacyPushEnabled) {
        Boolean master = enabled != null ? enabled : legacyPushEnabled;
        if (master == null) {
            throw new BadRequestException("enabled is required");
        }
        settingsRepository.saveSettings(userId, master, toMap(typeSettings));
        return get(userId);
    }

    private static Map<NotificationSettingGroup, Boolean> toMap(List<NotificationSettingsView.TypeSetting> typeSettings) {
        if (typeSettings == null) {
            return null;
        }
        Map<NotificationSettingGroup, Boolean> map = new EnumMap<>(NotificationSettingGroup.class);
        for (NotificationSettingsView.TypeSetting setting : typeSettings) {
            if (setting.group() == null) {
                throw new BadRequestException("typeSettings entries require a group");
            }
            map.put(setting.group(), setting.enabled());
        }
        return map;
    }
}
