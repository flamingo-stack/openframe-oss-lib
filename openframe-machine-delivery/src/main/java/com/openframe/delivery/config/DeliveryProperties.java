package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.util.Arrays;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

import static java.lang.Boolean.FALSE;
import static java.util.Objects.requireNonNullElse;
import static java.util.concurrent.TimeUnit.SECONDS;
import static java.util.stream.Collectors.toSet;

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

    // a per-type entry lists only the fields it overrides, so it is a class without constraints: the binder validates
    // every nested object it binds on that object's own annotations, @Valid or not
    private Map<DeliveryType, PolicyOverride> types = new EnumMap<>(DeliveryType.class);

    // a type not listed here is off: every environment switches each type on explicitly
    private Map<DeliveryType, Boolean> enabled = new EnumMap<>(DeliveryType.class);

    // Kafka topic client-service reads dispatches from; set where the Kafka hand-off or its consumer runs
    private String dispatchTopic;

    public boolean isEnabled(DeliveryType type) {
        return enabled.getOrDefault(type, FALSE);
    }

    public Policy resolve(DeliveryType type) {
        PolicyOverride override = types.get(type);
        if (override == null) {
            return defaults;
        }
        return override.mergeOver(defaults);
    }

    // a type acked faster than the sweep comes round is re-published by the sweep's fast pass, on its own clock
    public Set<DeliveryType> fastTypes() {
        return Arrays.stream(DeliveryType.values())
                .filter(this::isEnabled)
                .filter(this::isFasterThanTheSweep)
                .collect(toSet());
    }

    private boolean isFasterThanTheSweep(DeliveryType type) {
        Policy policy = resolve(type);
        long ackThresholdSeconds = policy.getAckThresholdSeconds();
        long ackThresholdMillis = SECONDS.toMillis(ackThresholdSeconds);
        return ackThresholdMillis < sweep.getInterval();
    }

    @Getter
    @Setter
    public static class Sweep {

        @NotNull
        @Positive
        private Long interval;

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

        @Valid
        @NotNull
        private Backoff backoff;

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
    }

    // the wait before a re-publish: ack-threshold × multiplier^attempt, never above max-interval, then spread by
    // ±jitter. multiplier 1 is the NATS way, the same wait every time; a type that wants to grow sets its own
    @Getter
    @Setter
    public static class Backoff {

        @NotNull
        @DecimalMin("1.0")
        private Double multiplier;

        @NotNull
        @Positive
        private Long maxIntervalSeconds;

        @NotNull
        @DecimalMin("0.0")
        @DecimalMax("1.0")
        private Double jitter;
    }

    @Getter
    @Setter
    public static class PolicyOverride {

        private Long ackThresholdSeconds;
        private Integer maxAttempts;
        private BackoffOverride backoff;
        private DeliveryOfflineBehavior offlineBehavior;
        private Long reconnectWindowSeconds;
        private Long resultTimeoutSeconds;
        private Long ttlSeconds;

        Policy mergeOver(Policy base) {
            Policy merged = new Policy();
            merged.setAckThresholdSeconds(requireNonNullElse(ackThresholdSeconds, base.getAckThresholdSeconds()));
            merged.setMaxAttempts(requireNonNullElse(maxAttempts, base.getMaxAttempts()));
            merged.setBackoff(backoff == null ? base.getBackoff() : backoff.mergeOver(base.getBackoff()));
            merged.setOfflineBehavior(requireNonNullElse(offlineBehavior, base.getOfflineBehavior()));
            merged.setReconnectWindowSeconds(requireNonNullElse(reconnectWindowSeconds, base.getReconnectWindowSeconds()));
            merged.setResultTimeoutSeconds(requireNonNullElse(resultTimeoutSeconds, base.getResultTimeoutSeconds()));
            merged.setTtlSeconds(requireNonNullElse(ttlSeconds, base.getTtlSeconds()));
            return merged;
        }
    }

    @Getter
    @Setter
    public static class BackoffOverride {

        private Double multiplier;
        private Long maxIntervalSeconds;
        private Double jitter;

        Backoff mergeOver(Backoff base) {
            Backoff merged = new Backoff();
            merged.setMultiplier(requireNonNullElse(multiplier, base.getMultiplier()));
            merged.setMaxIntervalSeconds(requireNonNullElse(maxIntervalSeconds, base.getMaxIntervalSeconds()));
            merged.setJitter(requireNonNullElse(jitter, base.getJitter()));
            return merged;
        }
    }
}
