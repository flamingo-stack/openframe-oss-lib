package com.openframe.api.service.agentkey;

import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

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
    public AgentKeyResponse current() {
        return logKeyService.current();
    }

    @Override
    public AgentKeyResponse rotate() {
        return logKeyService.rotate();
    }
}
