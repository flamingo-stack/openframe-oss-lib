package com.openframe.client.controller;


import com.openframe.client.dto.agent.*;
import com.openframe.client.service.agentregistration.AgentRegistrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agents")
@RequiredArgsConstructor
public class AgentController {

    private static final String INITIAL_KEY_HEADER = "X-Initial-Key";
    private static final String MACHINE_ID_HEADER = "X-Machine-Id";
    private static final String CLIENT_SECRET_HEADER = "X-Client-Secret";

    private final AgentRegistrationService agentRegistrationService;

    @PostMapping("/register")
    public AgentRegistrationResponse register(
            @RequestHeader(INITIAL_KEY_HEADER) String initialKey,
            @Valid @RequestBody AgentRegistrationRequest request
    ) {
        return agentRegistrationService.register(initialKey, request);
    }

    @PostMapping("/reinstall")
    public AgentRegistrationResponse reinstall(
            @RequestHeader(INITIAL_KEY_HEADER) String initialKey,
            @RequestHeader(MACHINE_ID_HEADER) String machineId,
            @RequestHeader(CLIENT_SECRET_HEADER) String clientSecret,
            @Valid @RequestBody AgentRegistrationRequest request
    ) {
        return agentRegistrationService.reinstall(initialKey, machineId, clientSecret, request);
    }

}