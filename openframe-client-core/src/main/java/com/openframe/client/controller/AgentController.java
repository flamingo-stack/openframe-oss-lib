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

    private final AgentRegistrationService agentRegistrationService;

    @PostMapping("/register")
    public ResponseEntity<AgentRegistrationResponse> register(
            @RequestHeader("X-Initial-Key") String initialKey,
            @Valid @RequestBody AgentRegistrationRequest request) {

        AgentRegistrationResponse response = agentRegistrationService.register(initialKey, request);
        return ResponseEntity.ok(response);
    }

}