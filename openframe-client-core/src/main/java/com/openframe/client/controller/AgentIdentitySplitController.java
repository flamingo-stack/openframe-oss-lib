package com.openframe.client.controller;

import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.dto.identitysplit.IdentitySplitRequest;
import com.openframe.client.service.identitysplit.AgentIdentitySplitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents")
@ConditionalOnProperty(name = "openframe.agent.identity-split.enabled", havingValue = "true")
@RequiredArgsConstructor
public class AgentIdentitySplitController {

    private static final String MACHINE_ID_HEADER = "X-Machine-Id";
    private static final String CLIENT_SECRET_HEADER = "X-Client-Secret";

    private final AgentIdentitySplitService agentIdentitySplitService;

    @PostMapping("/split")
    public AgentRegistrationResponse split(
            @RequestHeader(MACHINE_ID_HEADER) String machineId,
            @RequestHeader(CLIENT_SECRET_HEADER) String clientSecret,
            @Valid @RequestBody IdentitySplitRequest request
    ) {
        return agentIdentitySplitService.split(machineId, clientSecret, request.getSessionId());
    }
}
