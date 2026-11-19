package com.openframe.api.controller;

import com.openframe.api.service.agentkey.AgentKeyService;
import com.openframe.api.service.agentkey.AgentKeyType;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.data.document.audit.AuditAction;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_ROTATE;
import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_VIEW;
import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_ROTATE;
import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_VIEW;

/**
 * Reads and rotates the tenant's agent keys: {@code /agent/keys/registration} (initialKey)
 * and {@code /agent/keys/log} (logKey). Both hand out or replace a tenant secret, so both take an admin.
 */
@RestController
@PreAuthorize("hasAuthority('ADMIN')")
@RequestMapping("/agent/keys/{type}")
@RequiredArgsConstructor
public class AgentKeyController {

    private final AgentKeyService agentKeyService;
    private final AuditedMethodRunner auditedMethodRunner;

    @GetMapping
    public AgentKeyResponse current(@PathVariable AgentKeyType type) {
        return auditedMethodRunner.run(viewActionOf(type), null, () -> agentKeyService.current(type));
    }

    @PostMapping("/rotate")
    @ResponseStatus(HttpStatus.CREATED)
    public AgentKeyResponse rotate(@PathVariable AgentKeyType type) {
        AuditCall call = AuditCall.of(rotateActionOf(type), null).withCompare(false);
        return auditedMethodRunner.run(call, () -> agentKeyService.rotate(type));
    }

    private static AuditAction viewActionOf(AgentKeyType type) {
        return switch (type) {
            case REGISTRATION -> AGENT_REGISTRATION_SECRET_VIEW;
            case LOG -> AGENT_LOG_KEY_VIEW;
        };
    }

    private static AuditAction rotateActionOf(AgentKeyType type) {
        return switch (type) {
            case REGISTRATION -> AGENT_REGISTRATION_SECRET_ROTATE;
            case LOG -> AGENT_LOG_KEY_ROTATE;
        };
    }
}
