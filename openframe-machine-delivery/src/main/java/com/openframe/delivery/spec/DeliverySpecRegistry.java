package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.function.Function.identity;
import static java.util.stream.Collectors.toUnmodifiableMap;

@Slf4j
@Component
public class DeliverySpecRegistry {

    private final Map<DeliveryType, DeliverySpec<?, ?>> byType;
    private final Set<DeliveryType> types;

    // ObjectProvider, not List: a service with zero specs on the classpath must still boot.
    // toUnmodifiableMap throws IllegalStateException on a duplicate type — the wanted fail-fast.
    public DeliverySpecRegistry(ObjectProvider<DeliverySpec<?, ?>> specs) {
        this.byType = specs.stream()
                .collect(toUnmodifiableMap(DeliverySpec::getType, identity()));
        Set<DeliveryType> inEnumOrder = EnumSet.noneOf(DeliveryType.class);
        inEnumOrder.addAll(byType.keySet());
        this.types = Collections.unmodifiableSet(inEnumOrder);
        log.info("Registered {} delivery spec(s): {}", byType.size(), types);
    }

    @SuppressWarnings("unchecked")
    public <S extends DeliverySeed, P> Optional<DeliverySpec<S, P>> find(DeliveryType type) {
        DeliverySpec<S, P> spec = (DeliverySpec<S, P>) byType.get(type);
        return Optional.ofNullable(spec);
    }

    public <S extends DeliverySeed, P> DeliverySpec<S, P> require(DeliveryType type) {
        Optional<DeliverySpec<S, P>> spec = find(type);
        return spec.orElseThrow(() -> new IllegalArgumentException("No spec registered for delivery type: " + type.name()));
    }

    public Set<DeliveryType> types() {
        return types;
    }
}
