package com.openframe.api.service.agentkey;

import com.openframe.audit.Audited;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_ROTATE;
import static com.openframe.data.document.audit.AuditAction.AGENT_LOG_KEY_VIEW;

/**
 * The log key agents send to the logs gateway. The newest key is the current one,
 * so rotating adds a key and the gateway stops accepting the previous one.
 */
@Component
@RequiredArgsConstructor
public class LogAgentKeyProvider implements AgentKeyProvider {

    private final AgentLogKeyService logKeyService;

    @Override
    public AgentKeyType type() {
        return AgentKeyType.LOG;
    }

    @Override
    @Audited(action = AGENT_LOG_KEY_VIEW)
    public AgentKeyResponse current() {
        return logKeyService.current();
    }

    @Override
    @Audited(action = AGENT_LOG_KEY_ROTATE, compare = false)
    public AgentKeyResponse rotate() {
        return logKeyService.rotate();
    }
}
