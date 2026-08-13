package com.openframe.api.service;

import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSetting;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.data.document.notification.NotificationContentPolicy;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.data.repository.notification.NotificationContentPolicyRepository;
import com.openframe.data.repository.notification.NotificationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static com.openframe.data.document.notification.NotificationSettingsPolicy.isGroupEnabled;
import static com.openframe.data.document.notification.NotificationSettingsPolicy.isMasterEnabled;

@Service
@RequiredArgsConstructor
public class NotificationSettingsService {

    private final NotificationSettingsRepository settingsRepository;
    private final NotificationContentPolicyRepository contentPolicyRepository;

    public NotificationSettingsView get(String userId) {
        NotificationSettings settings = settingsRepository.findByUserId(userId)
                .orElseGet(NotificationSettingsService::defaults);
        return toView(settings, contentSuppressed());
    }

    public NotificationSettingsView update(String userId, boolean enabled,
                                           List<NotificationTypeSetting> typeSettings) {
        Set<NotificationSettingGroup> mutedGroups = toMutedGroups(typeSettings);
        settingsRepository.saveSettings(userId, enabled, mutedGroups);
        return get(userId);
    }

    public NotificationSettingsView updateContentSuppression(String userId, Boolean suppressed) {
        if (suppressed == null) {
            throw new BadRequestException("suppressed is required");
        }
        NotificationContentPolicy policy = contentPolicyRepository.findFirstBy()
                .orElseGet(NotificationContentPolicy::new);
        policy.setContentSuppressed(suppressed);
        contentPolicyRepository.save(policy);
        return get(userId);
    }

    private boolean contentSuppressed() {
        return contentPolicyRepository.findFirstBy()
                .map(NotificationContentPolicy::isContentSuppressed)
                .orElse(false);
    }

    /** Null means "not sent" — a legacy master-only write keeps the stored muted set. */
    private static Set<NotificationSettingGroup> toMutedGroups(List<NotificationTypeSetting> typeSettings) {
        if (typeSettings == null) {
            return null;
        }
        Set<NotificationSettingGroup> muted = EnumSet.noneOf(NotificationSettingGroup.class);
        for (NotificationTypeSetting setting : typeSettings) {
            NotificationSettingGroup group = setting.getGroup();
            if (group == null) {
                throw new BadRequestException("typeSettings entries require a group");
            }
            if (!setting.isEnabled()) {
                muted.add(group);
            }
        }
        return muted;
    }

    private static NotificationSettingsView toView(NotificationSettings settings, boolean contentSuppressed) {
        boolean master = isMasterEnabled(settings);
        List<NotificationTypeSetting> groups = new ArrayList<>();
        for (NotificationSettingGroup group : NotificationSettingGroup.values()) {
            boolean groupEnabled = isGroupEnabled(settings, group);
            groups.add(new NotificationTypeSetting(group, groupEnabled));
        }
        return new NotificationSettingsView(master, groups, contentSuppressed);
    }

    private static NotificationSettings defaults() {
        return NotificationSettings.builder().build();
    }
}
