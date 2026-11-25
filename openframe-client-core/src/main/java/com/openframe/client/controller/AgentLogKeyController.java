package com.openframe.client.controller;

import com.openframe.client.service.AgentLogKeyFetchService;
import com.openframe.core.agentkey.AgentKeyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/agent/log-key")
@RequiredArgsConstructor
public class AgentLogKeyController {

    private final AgentLogKeyFetchService logKeyFetchService;

    @GetMapping
    public AgentKeyResponse getLogKey() {
        return logKeyFetchService.fetch();
    }
}
