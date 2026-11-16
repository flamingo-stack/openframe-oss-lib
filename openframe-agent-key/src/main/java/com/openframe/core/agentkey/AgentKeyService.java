package com.openframe.core.agentkey;

import com.openframe.core.exception.NotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * One entry point for every agent key type. A service only serves the types it has a
 * provider for: the registration key lives in the api, so the client and management have the log key only.
 */
@Slf4j
@Service
public class AgentKeyService {

    private final Map<AgentKeyType, AgentKeyProvider> providers = new EnumMap<>(AgentKeyType.class);

    public AgentKeyService(List<AgentKeyProvider> providers) {
        providers.forEach(provider -> {
            AgentKeyProvider previous = this.providers.put(provider.type(), provider);
            if (previous != null) {
                throw new IllegalStateException("Two agent key providers for " + provider.type());
            }
        });
    }

    public AgentKeyResponse current(AgentKeyType type) {
        return providerOf(type).current();
    }

    public AgentKeyResponse rotate(AgentKeyType type) {
        AgentKeyResponse rotated = providerOf(type).rotate();
        log.info("Rotated agent {} key", type.path());
        return rotated;
    }

    private AgentKeyProvider providerOf(AgentKeyType type) {
        AgentKeyProvider provider = providers.get(type);
        if (provider == null) {
            throw new NotFoundException("Agent key type not served here: " + type.path());
        }
        return provider;
    }
}
