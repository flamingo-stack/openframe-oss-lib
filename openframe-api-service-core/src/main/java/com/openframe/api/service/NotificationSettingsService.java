package com.openframe.api.service;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationSettingsService {

    private final NotificationSettingsRepository settingsRepository;

    public NotificationSettings get(String userId) {
        return settingsRepository.findByUserId(userId)
                .orElseGet(() -> NotificationSettings.builder().build());
    }

    public NotificationSettings update(String userId, Boolean pushEnabled) {
        if (pushEnabled == null) {
            throw new BadRequestException("pushEnabled is required");
        }
        settingsRepository.setPushEnabled(userId, pushEnabled);
        return NotificationSettings.builder().pushEnabled(pushEnabled).build();
    }
}
