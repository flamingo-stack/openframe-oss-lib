package com.openframe.client.controller;

import com.openframe.client.dto.agent.AgentFeatureFlagsResponse;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/agent/feature-flags")
@RequiredArgsConstructor
public class AgentFeatureFlagsController {

    private final OpenFrameClientConfigurationService openFrameClientConfigurationService;

    @GetMapping
    public AgentFeatureFlagsResponse getFeatureFlags() {
        return new AgentFeatureFlagsResponse(openFrameClientConfigurationService.getFeatureFlags());
    }
}
