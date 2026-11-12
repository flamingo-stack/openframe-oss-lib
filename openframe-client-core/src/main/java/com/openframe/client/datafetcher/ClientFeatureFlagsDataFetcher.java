package com.openframe.client.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.openframe.client.dto.agent.ClientFeatureFlagResponse;
import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;

import java.util.List;
import java.util.Map;

@DgsComponent
@RequiredArgsConstructor
public class ClientFeatureFlagsDataFetcher {

    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;

    @DgsQuery
    public List<ClientFeatureFlagResponse> clientFeatureFlags() {
        Map<String, ClientFeatureFlag> flags = openFrameClientConfigurationService.getFeatureFlags();
        return flags.entrySet().stream()
                .map(entry -> toResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    private ClientFeatureFlagResponse toResponse(String name, ClientFeatureFlag flag) {
        boolean enabled = flag.isEnabled();
        String minVersion = flag.getMinVersion();
        return new ClientFeatureFlagResponse(name, enabled, minVersion);
    }
}
