package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.openframe.data.service.presence.UserPresenceService;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import static com.openframe.api.support.CurrentPrincipalSupport.requireHumanUserId;

@DgsComponent
@RequiredArgsConstructor
public class PresenceDataFetcher {

    private final UserPresenceService presenceService;

    // Boolean is the GraphQL idiom for a payload-less mutation: true = accepted, failures surface as GraphQL errors, never as false.
    @DgsMutation
    public boolean recordPresence(@AuthenticationPrincipal AuthPrincipal principal) {
        String userId = requireHumanUserId(principal);
        presenceService.markPresent(userId);
        return true;
    }
}
