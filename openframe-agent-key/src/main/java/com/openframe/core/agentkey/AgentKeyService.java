package com.openframe.core.agentkey;

import com.openframe.core.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;

/**
 * One entry point for every agent key type. A service only serves the types it has a
 * provider for: the registration key lives in the api, so the client and management have the log key only.
 */
@Service
public class AgentKeyService {

    private final Map<AgentKeyType, AgentKeyProvider> providers;

    public AgentKeyService(List<AgentKeyProvider> providers) {
        this.providers = providers.stream().collect(toMap(
                AgentKeyProvider::type,
                identity(),
                AgentKeyService::rejectDuplicate,
                () -> new EnumMap<>(AgentKeyType.class)));
    }

    public AgentKeyResponse current(AgentKeyType type) {
        return providerOf(type).current();
    }

    public AgentKeyResponse rotate(AgentKeyType type) {
        return providerOf(type).rotate();
    }

    private AgentKeyProvider providerOf(AgentKeyType type) {
        return Optional.ofNullable(providers.get(type))
                .orElseThrow(() -> new NotFoundException("Agent key type not served here: " + type.path()));
    }

    private static AgentKeyProvider rejectDuplicate(AgentKeyProvider first, AgentKeyProvider second) {
        throw new IllegalStateException("Two agent key providers for " + first.type());
    }
}
