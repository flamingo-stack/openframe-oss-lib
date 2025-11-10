package com.openframe.api.controller;

import com.openframe.api.dto.ClientConfigurationResponse;
import com.openframe.api.service.OpenFrameClientConfigurationQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/openframe-client/configuration")
@RequiredArgsConstructor
@Slf4j
public class OpenFrameClientConfigurationController {

    private final OpenFrameClientConfigurationQueryService clientConfigurationQueryService;

    @GetMapping
    public ClientConfigurationResponse getClientConfiguration() {
        return clientConfigurationQueryService.get();
    }
}

