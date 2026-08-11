package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.NotificationSettingsView;
import com.openframe.api.dto.NotificationTypeSetting;
import com.openframe.api.service.NotificationSettingsService;
import com.openframe.api.support.CurrentPrincipalSupport;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

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
    public NotificationSettingsView updateNotificationSettings(
            @InputArgument Boolean enabled,
            @InputArgument(collectionType = NotificationTypeSetting.class)
            List<NotificationTypeSetting> typeSettings,
            @AuthenticationPrincipal AuthPrincipal principal) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        return notificationSettingsService.update(userId, enabled, typeSettings);
    }

    @DgsMutation
    @PreAuthorize("hasAnyAuthority('ADMIN', 'OWNER')")
    public NotificationSettingsView updateNotificationContentSuppression(
            @InputArgument Boolean suppressed,
            @AuthenticationPrincipal AuthPrincipal principal) {
        String userId = CurrentPrincipalSupport.requireHumanUserId(principal);
        return notificationSettingsService.updateContentSuppression(userId, suppressed);
    }
}
