package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.openframe.delivery.config.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.config.DeliveryTestPolicies.BACKOFF_MULTIPLIER;
import static com.openframe.delivery.config.DeliveryTestPolicies.MAX_RETRY_INTERVAL;
import static com.openframe.delivery.config.DeliveryTestPolicies.RECONNECT_WINDOW;
import static com.openframe.delivery.config.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPropertiesTest {

    private static final int UNINSTALL_MAX_ATTEMPTS = 5;

    private DeliveryProperties properties;

    @BeforeEach
    void setUp() {
        properties = DeliveryTestPolicies.properties();
    }

    @Test
    void resolve_typeWithoutOverride_defaultsReturned() {
        // setup
        Policy defaults = properties.getDefaults();

        // execution
        Policy resolved = properties.resolve(DeliveryType.TOOL_INSTALLATION);

        // verifications
        assertThat(resolved).isSameAs(defaults);
    }

    @Test
    void resolve_typeOverridesOneField_otherFieldsFromDefaults() {
        // setup
        Policy uninstall = new Policy();
        uninstall.setMaxAttempts(UNINSTALL_MAX_ATTEMPTS);
        properties.setTypes(Map.of(DeliveryType.CLIENT_UNINSTALL, uninstall));

        // execution
        Policy resolved = properties.resolve(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(resolved.getMaxAttempts()).isEqualTo(UNINSTALL_MAX_ATTEMPTS);
        assertThat(resolved.getAckThresholdSeconds()).isEqualTo(ACK_THRESHOLD);
        assertThat(resolved.getBackoffMultiplier()).isEqualTo(BACKOFF_MULTIPLIER);
        assertThat(resolved.getMaxRetryIntervalSeconds()).isEqualTo(MAX_RETRY_INTERVAL);
        assertThat(resolved.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(RECONNECT_WINDOW);
        assertThat(resolved.getResultTimeoutSeconds()).isEqualTo(RESULT_TIMEOUT);
        assertThat(resolved.getTtlSeconds()).isEqualTo(TTL);
    }

    @Test
    void resolve_typeOverridesOfflineBehavior_overrideWins() {
        // setup
        Policy scripts = new Policy();
        scripts.setOfflineBehavior(DeliveryOfflineBehavior.SKIP);
        properties.setTypes(Map.of(DeliveryType.SCRIPT_SCHEDULE, scripts));

        // execution
        Policy resolved = properties.resolve(DeliveryType.SCRIPT_SCHEDULE);

        // verifications
        assertThat(resolved.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.SKIP);
    }
    @Test
    void isEnabled_typeNotListed_false() {
        // setup
        properties.setEnabled(Map.of());

        // execution
        boolean enabled = properties.isEnabled(DeliveryType.TOOL_INSTALLATION);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void isEnabled_typeListedOff_false() {
        // setup
        properties.setEnabled(Map.of(DeliveryType.TOOL_INSTALLATION, false));

        // execution
        boolean enabled = properties.isEnabled(DeliveryType.TOOL_INSTALLATION);

        // verifications
        assertThat(enabled).isFalse();
    }

    @Test
    void isEnabled_typeListedOn_true() {
        // setup
        properties.setEnabled(Map.of(DeliveryType.TOOL_INSTALLATION, true));

        // execution
        boolean enabled = properties.isEnabled(DeliveryType.TOOL_INSTALLATION);

        // verifications
        assertThat(enabled).isTrue();
    }
}
