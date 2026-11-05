package com.openframe.api.controller;

import com.openframe.core.agentkey.AgentLogKeyResponse;
import com.openframe.audit.Audited;
import com.openframe.core.agentkey.AgentLogKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_VIEW;

@RestController
@RequestMapping("/agent/log-key")
@RequiredArgsConstructor
public class AgentLogKeyController {

    private final AgentLogKeyService logKeyService;

    @GetMapping
    @Audited(action = AGENT_LOG_KEY_VIEW)
    public AgentLogKeyResponse getLogKey() {
        return logKeyService.getLogKey();
    }

}
