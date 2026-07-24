package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.service.PushDeviceService;
import com.openframe.api.support.CurrentPrincipalSupport;
import com.openframe.data.document.push.PushPlatform;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@DgsComponent
@RequiredArgsConstructor
public class PushDeviceDataFetcher {

    private final PushDeviceService pushDeviceService;

    @DgsMutation
    public boolean registerPushDevice(@InputArgument String token,
                                      @InputArgument PushPlatform platform,
                                      @AuthenticationPrincipal AuthPrincipal principal) {
        return pushDeviceService.register(CurrentPrincipalSupport.requireHumanUserId(principal), token, platform);
    }

    @DgsMutation
    public boolean unregisterPushDevice(@InputArgument String token,
                                        @AuthenticationPrincipal AuthPrincipal principal) {
        return pushDeviceService.unregister(CurrentPrincipalSupport.requireHumanUserId(principal), token);
    }
}
