package com.openframe.api.controller;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.api.service.AgentRegistrationSecretService;
import com.openframe.audit.Audited;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_ROTATE;
import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_VIEW;

@RestController
@RequestMapping("/agent/registration-secret")
@RequiredArgsConstructor
@Slf4j
public class AgentRegistrationSecretController {

    private final AgentRegistrationSecretService secretService;

    @GetMapping("/active")
    @Audited(action = AGENT_REGISTRATION_SECRET_VIEW, details = "secretId=#result.id")
    public AgentRegistrationSecretResponse getActiveSecret() {
        return secretService.getActiveSecret();
    }

    @GetMapping
    @Audited(action = AGENT_REGISTRATION_SECRET_VIEW, details = "secretIds=#result.![id]")
    public List<AgentRegistrationSecretResponse> getAllSecrets() {
        return secretService.getAllSecrets();
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    @Audited(action = AGENT_REGISTRATION_SECRET_ROTATE, details = "newSecretId=#result.id", compare = false)
    public AgentRegistrationSecretResponse generateNewSecret() {
        log.info("Generating new agent registration key");
        return secretService.generateNewSecret();
    }
} 