package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.service.NotificationSettingsService;
import com.openframe.api.support.CurrentPrincipalSupport;
import com.openframe.data.document.notification.NotificationSettings;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@DgsComponent
@RequiredArgsConstructor
public class NotificationSettingsDataFetcher {

    private final NotificationSettingsService notificationSettingsService;

    @DgsQuery
    public NotificationSettings notificationSettings(@AuthenticationPrincipal AuthPrincipal principal) {
        return notificationSettingsService.get(CurrentPrincipalSupport.requireHumanUserId(principal));
    }

    @DgsMutation
    public NotificationSettings updateNotificationSettings(@InputArgument Boolean pushEnabled,
                                                           @AuthenticationPrincipal AuthPrincipal principal) {
        return notificationSettingsService.update(CurrentPrincipalSupport.requireHumanUserId(principal), pushEnabled);
    }
}
