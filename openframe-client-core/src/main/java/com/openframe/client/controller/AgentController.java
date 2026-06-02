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
    public ResponseEntity<AgentRegistrationResponse> register(
            @RequestHeader(INITIAL_KEY_HEADER) String initialKey,
            @Valid @RequestBody AgentRegistrationRequest request) {

        AgentRegistrationResponse response = agentRegistrationService.register(initialKey, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reinstall")
    public ResponseEntity<AgentRegistrationResponse> reinstall(
            @RequestHeader(MACHINE_ID_HEADER) String machineId,
            @RequestHeader(CLIENT_SECRET_HEADER) String clientSecret,
            @Valid @RequestBody AgentRegistrationRequest request) {

        AgentRegistrationResponse response = agentRegistrationService.reinstall(machineId, clientSecret, request);
        return ResponseEntity.ok(response);
    }

}