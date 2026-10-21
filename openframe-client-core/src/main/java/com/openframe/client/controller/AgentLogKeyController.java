package com.openframe.client.controller;

import com.openframe.client.dto.AgentLogKeyResponse;
import com.openframe.client.service.AgentLogKeyService;
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
    public AgentLogKeyResponse getLogKey() {
        return logKeyService.getLogKey();
    }

}
