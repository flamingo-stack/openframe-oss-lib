package com.openframe.api.service.agentkey;

import com.openframe.core.agentkey.AgentKeyResponse;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toMap;

/**
 * Picks the {@link AgentKeyProvider} for a key type. Every type must have exactly one provider,
 * checked at startup, so a missing or duplicated provider fails the deploy instead of a request.
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
        requireAllTypes(this.providers);
    }

    public AgentKeyResponse current(AgentKeyType type) {
        return providers.get(type).current();
    }

    public AgentKeyResponse rotate(AgentKeyType type) {
        return providers.get(type).rotate();
    }

    private static AgentKeyProvider rejectDuplicate(AgentKeyProvider first, AgentKeyProvider second) {
        throw new IllegalStateException("Two agent key providers for " + first.type());
    }

    private static void requireAllTypes(Map<AgentKeyType, AgentKeyProvider> providers) {
        List<AgentKeyType> missing = Arrays.stream(AgentKeyType.values())
                .filter(type -> !providers.containsKey(type))
                .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException("No agent key provider for " + missing);
        }
    }
}
