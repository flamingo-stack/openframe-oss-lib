package com.openframe.api.controller;

import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/agent/log-key")
@RequiredArgsConstructor
public class AgentLogKeyController {

    private final AgentLogKeyService logKeyService;

    @GetMapping
    public AgentKeyResponse getLogKey() {
        return logKeyService.getLogKey();
    }

}
