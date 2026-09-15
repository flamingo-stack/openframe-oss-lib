package com.openframe.client.service.rmm.delivery;

import com.openframe.client.service.rmm.delivery.DeliveryProperties.Policy;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPropertiesTest {

    private static final long DEFAULT_ACK_THRESHOLD = 30L;
    private static final int DEFAULT_MAX_ATTEMPTS = 3;
    private static final long DEFAULT_RECONNECT_WINDOW = 86_400L;
    private static final long DEFAULT_RESULT_TIMEOUT = 600L;
    private static final long DEFAULT_TTL = 604_800L;
    private static final int UNINSTALL_MAX_ATTEMPTS = 5;

    private DeliveryProperties properties;

    @BeforeEach
    void setUp() {
        Policy defaults = new Policy();
        defaults.setAckThresholdSeconds(DEFAULT_ACK_THRESHOLD);
        defaults.setMaxAttempts(DEFAULT_MAX_ATTEMPTS);
        defaults.setOfflineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        defaults.setReconnectWindowSeconds(DEFAULT_RECONNECT_WINDOW);
        defaults.setResultTimeoutSeconds(DEFAULT_RESULT_TIMEOUT);
        defaults.setTtlSeconds(DEFAULT_TTL);
        properties = new DeliveryProperties();
        properties.setDefaults(defaults);
    }

    @Test
    void resolve_kindWithoutOverride_defaultsReturned() {
        // setup
        Policy defaults = properties.getDefaults();

        // execution
        Policy resolved = properties.resolve(DeliveryKind.TOOL_INSTALLATION);

        // verifications
        assertThat(resolved).isSameAs(defaults);
    }

    @Test
    void resolve_kindOverridesOneField_otherFieldsFromDefaults() {
        // setup
        Policy uninstall = new Policy();
        uninstall.setMaxAttempts(UNINSTALL_MAX_ATTEMPTS);
        properties.setKinds(Map.of(DeliveryKind.CLIENT_UNINSTALL, uninstall));

        // execution
        Policy resolved = properties.resolve(DeliveryKind.CLIENT_UNINSTALL);

        // verifications
        assertThat(resolved.getMaxAttempts()).isEqualTo(UNINSTALL_MAX_ATTEMPTS);
        assertThat(resolved.getAckThresholdSeconds()).isEqualTo(DEFAULT_ACK_THRESHOLD);
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(DEFAULT_RECONNECT_WINDOW);
        assertThat(resolved.getResultTimeoutSeconds()).isEqualTo(DEFAULT_RESULT_TIMEOUT);
        assertThat(resolved.getTtlSeconds()).isEqualTo(DEFAULT_TTL);
    }

    @Test
    void resolve_kindOverridesOfflineBehavior_overrideWins() {
        // setup
        Policy scripts = new Policy();
        scripts.setOfflineBehavior(ScheduleOfflineBehavior.SKIP);
        properties.setKinds(Map.of(DeliveryKind.SCRIPT_SCHEDULE, scripts));

        // execution
        Policy resolved = properties.resolve(DeliveryKind.SCRIPT_SCHEDULE);

        // verifications
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.SKIP);
    }
}
