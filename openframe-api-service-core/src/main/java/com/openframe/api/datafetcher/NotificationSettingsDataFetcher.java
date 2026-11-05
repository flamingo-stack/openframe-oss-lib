package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSettingInput;
import com.openframe.api.service.NotificationSettingsService;
import com.openframe.api.support.CurrentPrincipalSupport;
import com.openframe.audit.Audited;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.NOTIFICATION_SETTINGS_UPDATE;

@DgsComponent
@RequiredArgsConstructor
public class NotificationSettingsDataFetcher {

    private final NotificationSettingsService notificationSettingsService;

    @DgsQuery
    public NotificationSettingsView notificationSettings(@AuthenticationPrincipal AuthPrincipal principal) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        return notificationSettingsService.get(userId);
    }

    @DgsMutation
    @Audited(action = NOTIFICATION_SETTINGS_UPDATE, targetId = "#principal.id", compare = false,
            details = {"enabled=#enabled", "typeSettings=#typeSettings"})
    public NotificationSettingsView updateNotificationSettings(
            @InputArgument Boolean enabled,
            @InputArgument(collectionType = NotificationTypeSettingInput.class)
            List<NotificationTypeSettingInput> typeSettings,
            @AuthenticationPrincipal AuthPrincipal principal) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        return notificationSettingsService.update(userId, enabled, typeSettings);
    }
}
