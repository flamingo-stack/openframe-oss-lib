package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.EnumMap;
import java.util.Map;

import static java.util.Objects.requireNonNullElse;

@Getter
@Setter
@Validated
@Component
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
@ConfigurationProperties(prefix = "openframe.delivery")
public class DeliveryProperties {

    @Valid
    @NotNull
    private Sweep sweep;

    @Valid
    @NotNull
    private Policy defaults;

    // deliberately not @Valid: a per-type entry lists only the fields it overrides
    private Map<DeliveryType, Policy> types = new EnumMap<>(DeliveryType.class);

    public Policy resolve(DeliveryType type) {
        Policy override = types.get(type);
        if (override == null) {
            return defaults;
        }
        return override.mergeOver(defaults);
    }

    public Policy resolve(MachineDelivery delivery) {
        Policy typePolicy = resolve(delivery.getType());
        Policy rowOverride = new Policy();
        rowOverride.setOfflineBehavior(delivery.getOfflineBehavior());
        rowOverride.setReconnectWindowSeconds(delivery.getReconnectWindowSeconds());
        return rowOverride.mergeOver(typePolicy);
    }

    @Getter
    @Setter
    public static class Sweep {

        @NotNull
        @Positive
        private Integer batchSize;
    }

    @Getter
    @Setter
    public static class Policy {

        @NotNull
        @Positive
        private Long ackThresholdSeconds;
        @NotNull
        @Positive
        private Integer maxAttempts;
        @NotNull
        @Positive
        private Integer backoffMultiplier;
        @NotNull
        @Positive
        private Long maxRetryIntervalSeconds;
        @NotNull
        private DeliveryOfflineBehavior offlineBehavior;
        @NotNull
        @Positive
        private Long reconnectWindowSeconds;
        @NotNull
        @Positive
        private Long resultTimeoutSeconds;
        @NotNull
        @Positive
        private Long ttlSeconds;

        Policy mergeOver(Policy base) {
            Policy merged = new Policy();
            merged.ackThresholdSeconds = requireNonNullElse(ackThresholdSeconds, base.ackThresholdSeconds);
            merged.maxAttempts = requireNonNullElse(maxAttempts, base.maxAttempts);
            merged.backoffMultiplier = requireNonNullElse(backoffMultiplier, base.backoffMultiplier);
            merged.maxRetryIntervalSeconds = requireNonNullElse(maxRetryIntervalSeconds, base.maxRetryIntervalSeconds);
            merged.offlineBehavior = requireNonNullElse(offlineBehavior, base.offlineBehavior);
            merged.reconnectWindowSeconds = requireNonNullElse(reconnectWindowSeconds, base.reconnectWindowSeconds);
            merged.resultTimeoutSeconds = requireNonNullElse(resultTimeoutSeconds, base.resultTimeoutSeconds);
            merged.ttlSeconds = requireNonNullElse(ttlSeconds, base.ttlSeconds);
            return merged;
        }
    }
}
