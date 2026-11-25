package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSettingInput;
import com.openframe.api.service.NotificationSettingsService;
import com.openframe.api.support.CurrentPrincipalSupport;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.notification.NotificationSettingGroup;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.NOTIFICATION_SETTINGS_UPDATE;

@DgsComponent
@RequiredArgsConstructor
public class NotificationSettingsDataFetcher {

    private final NotificationSettingsService notificationSettingsService;
    private final AuditedMethodRunner auditedMethodRunner;

    @DgsQuery
    public NotificationSettingsView notificationSettings(@AuthenticationPrincipal AuthPrincipal principal) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        return notificationSettingsService.get(userId);
    }

    @DgsMutation
    public NotificationSettingsView updateNotificationSettings(
            @InputArgument Boolean enabled,
            @InputArgument(collectionType = NotificationTypeSettingInput.class)
            List<NotificationTypeSettingInput> typeSettings,
            @AuthenticationPrincipal AuthPrincipal principal) {
        AuditCall auditCall = AuditCall.of(NOTIFICATION_SETTINGS_UPDATE, principal.getId())
                .withCompare(false)
                .withDetailsFromResult(result -> result == null ? askedDetailsOf(enabled, typeSettings) : null)
                .withChangesFromResult(result -> changesOf((SavedSettings) result));
        return auditedMethodRunner.run(auditCall, () -> save(principal, enabled, typeSettings)).after();
    }

    private static Map<String, Object> askedDetailsOf(Boolean enabled,
                                                      List<NotificationTypeSettingInput> typeSettings) {
        List<NotificationSettingGroup> mutedGroups = typeSettings == null ? null : askedMutedGroupsOf(typeSettings);
        Map<String, Object> asked = new HashMap<>();
        asked.put("enabled", enabled);
        asked.put("mutedGroups", mutedGroups);
        return asked;
    }

    private static List<NotificationSettingGroup> askedMutedGroupsOf(List<NotificationTypeSettingInput> typeSettings) {
        return typeSettings.stream()
                .filter(setting -> !setting.isEnabled())
                .map(NotificationTypeSettingInput::getGroup)
                .toList();
    }

    private SavedSettings save(AuthPrincipal principal, Boolean enabled,
                               List<NotificationTypeSettingInput> typeSettings) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        NotificationSettingsView before = auditedMethodRunner.isEnabled()
                ? notificationSettingsService.get(userId) : null;
        return new SavedSettings(before, notificationSettingsService.update(userId, enabled, typeSettings));
    }

    private static Map<String, AuditChange> changesOf(SavedSettings saved) {
        Map<String, AuditChange> changes = new LinkedHashMap<>();
        boolean enabledBefore = saved.before().isEnabled();
        boolean enabledAfter = saved.after().isEnabled();
        if (enabledBefore != enabledAfter) {
            changes.put("enabled", new AuditChange(enabledBefore, enabledAfter));
        }
        List<String> mutedBefore = mutedGroupsOf(saved.before());
        List<String> mutedAfter = mutedGroupsOf(saved.after());
        if (!mutedBefore.equals(mutedAfter)) {
            changes.put("mutedGroups", new AuditChange(mutedBefore, mutedAfter));
        }
        return changes;
    }

    private static List<String> mutedGroupsOf(NotificationSettingsView settings) {
        return settings.getTypeSettings().stream()
                .filter(setting -> !setting.isEnabled())
                .map(setting -> setting.getGroup().name())
                .toList();
    }

    private record SavedSettings(NotificationSettingsView before, NotificationSettingsView after) {
    }
}
