package com.openframe.api.controller;

import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentKeyService;
import com.openframe.core.agentkey.AgentKeyType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

    @GetMapping
    public AgentKeyResponse current(@PathVariable String type) {
        return agentKeyService.current(AgentKeyType.fromPath(type));
    }

    @PostMapping("/rotate")
    @ResponseStatus(HttpStatus.CREATED)
    public AgentKeyResponse rotate(@PathVariable String type) {
        return agentKeyService.rotate(AgentKeyType.fromPath(type));
    }
}
