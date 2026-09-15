package com.openframe.client.service.rmm.delivery;

import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
@ConditionalOnProperty(name = "openframe.rmm.delivery.enabled", havingValue = "true")
@ConfigurationProperties(prefix = "openframe.rmm.delivery")
public class DeliveryProperties {

    @Valid
    @NotNull
    private Policy defaults;

    // deliberately not @Valid: a per-kind entry lists only the fields it overrides
    private Map<DeliveryKind, Policy> kinds = new EnumMap<>(DeliveryKind.class);

    public Policy resolve(DeliveryKind kind) {
        Policy override = kinds.get(kind);
        if (override == null) {
            return defaults;
        }
        return override.mergeOver(defaults);
    }

    // row-level overrides come from ScheduleScript (per-schedule offline behaviour) and win over the kind policy
    public Policy resolve(MachineDelivery delivery) {
        Policy kindPolicy = resolve(delivery.getKind());
        Policy rowOverride = new Policy();
        rowOverride.setOfflineBehavior(delivery.getOfflineBehavior());
        rowOverride.setReconnectWindowSeconds(delivery.getReconnectWindowSeconds());
        return rowOverride.mergeOver(kindPolicy);
    }

    @Getter
    @Setter
    public static class Policy {

        @NotNull
        private Long ackThresholdSeconds;
        @NotNull
        private Integer maxAttempts;
        @NotNull
        private ScheduleOfflineBehavior offlineBehavior;
        @NotNull
        private Long reconnectWindowSeconds;
        @NotNull
        private Long resultTimeoutSeconds;
        @NotNull
        private Long ttlSeconds;

        Policy mergeOver(Policy base) {
            Policy merged = new Policy();
            merged.ackThresholdSeconds = requireNonNullElse(ackThresholdSeconds, base.ackThresholdSeconds);
            merged.maxAttempts = requireNonNullElse(maxAttempts, base.maxAttempts);
            merged.offlineBehavior = requireNonNullElse(offlineBehavior, base.offlineBehavior);
            merged.reconnectWindowSeconds = requireNonNullElse(reconnectWindowSeconds, base.reconnectWindowSeconds);
            merged.resultTimeoutSeconds = requireNonNullElse(resultTimeoutSeconds, base.resultTimeoutSeconds);
            merged.ttlSeconds = requireNonNullElse(ttlSeconds, base.ttlSeconds);
            return merged;
        }
    }
}
