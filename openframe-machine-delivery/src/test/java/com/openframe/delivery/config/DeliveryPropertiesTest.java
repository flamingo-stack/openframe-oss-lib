package com.openframe.delivery.config;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.config.DeliveryProperties.BackoffOverride;
import com.openframe.delivery.config.DeliveryProperties.Policy;
import com.openframe.delivery.config.DeliveryProperties.PolicyOverride;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;

import static com.openframe.delivery.config.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.config.DeliveryTestPolicies.JITTER;
import static com.openframe.delivery.config.DeliveryTestPolicies.MAX_RETRY_INTERVAL;
import static com.openframe.delivery.config.DeliveryTestPolicies.RECONNECT_WINDOW;
import static com.openframe.delivery.config.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.config.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPropertiesTest {

    private static final int UNINSTALL_MAX_ATTEMPTS = 5;

    private static final double UNINSTALL_BACKOFF_MULTIPLIER = 2.0;

    private static final long APPROVAL_ACK_THRESHOLD = 2L;

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
        PolicyOverride uninstall = new PolicyOverride();
        uninstall.setMaxAttempts(UNINSTALL_MAX_ATTEMPTS);
        properties.setTypes(Map.of(DeliveryType.CLIENT_UNINSTALL, uninstall));

        // execution
        Policy resolved = properties.resolve(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(resolved.getMaxAttempts()).isEqualTo(UNINSTALL_MAX_ATTEMPTS);
        assertThat(resolved.getAckThresholdSeconds()).isEqualTo(ACK_THRESHOLD);
        assertThat(resolved.getBackoff()).isSameAs(properties.getDefaults().getBackoff());
        assertThat(resolved.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(RECONNECT_WINDOW);
        assertThat(resolved.getResultTimeoutSeconds()).isEqualTo(RESULT_TIMEOUT);
        assertThat(resolved.getTtlSeconds()).isEqualTo(TTL);
    }

    @Test
    void resolve_typeOverridesBackoffMultiplierOnly_capAndJitterFromDefaults() {
        // setup
        BackoffOverride growing = new BackoffOverride();
        growing.setMultiplier(UNINSTALL_BACKOFF_MULTIPLIER);
        PolicyOverride uninstall = new PolicyOverride();
        uninstall.setBackoff(growing);
        properties.setTypes(Map.of(DeliveryType.CLIENT_UNINSTALL, uninstall));

        // execution
        Policy resolved = properties.resolve(DeliveryType.CLIENT_UNINSTALL);

        // verifications
        assertThat(resolved.getBackoff().getMultiplier()).isEqualTo(UNINSTALL_BACKOFF_MULTIPLIER);
        assertThat(resolved.getBackoff().getMaxIntervalSeconds()).isEqualTo(MAX_RETRY_INTERVAL);
        assertThat(resolved.getBackoff().getJitter()).isEqualTo(JITTER);
    }

    @Test
    void resolve_typeOverridesOfflineBehavior_overrideWins() {
        // setup
        PolicyOverride scripts = new PolicyOverride();
        scripts.setOfflineBehavior(DeliveryOfflineBehavior.SKIP);
        properties.setTypes(Map.of(DeliveryType.SCRIPT_SCHEDULE, scripts));

        // execution
        Policy resolved = properties.resolve(DeliveryType.SCRIPT_SCHEDULE);

        // verifications
        assertThat(resolved.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.SKIP);
    }
    @Test
    void fastTypes_noTypeAckedFasterThanTheSweep_empty() {
        // setup
        properties.setEnabled(Map.of(DeliveryType.TOOL_INSTALLATION, true));

        // execution
        Set<DeliveryType> fast = properties.fastTypes();

        // verifications
        assertThat(fast).isEmpty();
    }

    @Test
    void fastTypes_enabledTypeAckedFasterThanTheSweep_thatTypeOnly() {
        // setup
        PolicyOverride approval = new PolicyOverride();
        approval.setAckThresholdSeconds(APPROVAL_ACK_THRESHOLD);
        properties.setTypes(Map.of(DeliveryType.REMOTE_ACCESS_REQUEST, approval));
        properties.setEnabled(Map.of(DeliveryType.REMOTE_ACCESS_REQUEST, true, DeliveryType.TOOL_INSTALLATION, true));

        // execution
        Set<DeliveryType> fast = properties.fastTypes();

        // verifications
        assertThat(fast).containsExactly(DeliveryType.REMOTE_ACCESS_REQUEST);
    }

    @Test
    void fastTypes_fastTypeSwitchedOff_empty() {
        // setup
        PolicyOverride approval = new PolicyOverride();
        approval.setAckThresholdSeconds(APPROVAL_ACK_THRESHOLD);
        properties.setTypes(Map.of(DeliveryType.REMOTE_ACCESS_REQUEST, approval));

        // execution
        Set<DeliveryType> fast = properties.fastTypes();

        // verifications
        assertThat(fast).isEmpty();
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
