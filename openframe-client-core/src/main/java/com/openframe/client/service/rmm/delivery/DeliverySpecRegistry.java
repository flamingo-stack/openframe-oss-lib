package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

@Slf4j
@Component
public class DeliverySpecRegistry {

    private final Map<DeliveryKind, DeliverySpec<?>> byKind;

    // ObjectProvider, not List: a service with zero specs on the classpath must still boot.
    // toUnmodifiableMap throws IllegalStateException on a duplicate kind — the wanted fail-fast.
    public DeliverySpecRegistry(ObjectProvider<DeliverySpec<?>> specs) {
        this.byKind = specs.stream()
                .collect(toUnmodifiableMap(DeliverySpec::getKind, identity()));
        Set<DeliveryKind> registered = byKind.keySet();
        Set<DeliveryKind> sortedKinds = new TreeSet<>(registered);
        log.info("Registered {} delivery spec(s): {}", byKind.size(), sortedKinds);
    }

    public DeliverySpec<?> require(DeliveryKind kind) {
        DeliverySpec<?> spec = byKind.get(kind);
        if (spec == null) {
            throw new IllegalArgumentException("No spec registered for delivery kind: " + kind.name());
        }
        return spec;
    }

    public Set<DeliveryKind> kinds() {
        return byKind.keySet();
    }
}
