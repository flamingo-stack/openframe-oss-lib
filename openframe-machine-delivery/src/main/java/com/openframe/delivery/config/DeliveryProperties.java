package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

import static java.lang.Boolean.FALSE;
import static java.util.Objects.requireNonNullElse;

@Getter
@Setter
@Validated
@Component
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

    // a type not listed here is off: every environment switches each type on explicitly
    private Map<DeliveryType, Boolean> enabled = new EnumMap<>(DeliveryType.class);

    // first agent version that acks the type; a type not listed here keeps every machine on the old path
    private Map<DeliveryType, String> minAgentVersion = new EnumMap<>(DeliveryType.class);

    public boolean isEnabled(DeliveryType type) {
        return enabled.getOrDefault(type, FALSE);
    }

    public Optional<String> minAgentVersion(DeliveryType type) {
        String version = minAgentVersion.get(type);
        return Optional.ofNullable(version);
    }

    public Policy resolve(DeliveryType type) {
        Policy override = types.get(type);
        if (override == null) {
            return defaults;
        }
        return override.mergeOver(defaults);
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
