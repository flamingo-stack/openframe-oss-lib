package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.delivery.DeliveryProperties.Policy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.openframe.delivery.DeliveryTestPolicies.ACK_THRESHOLD;
import static com.openframe.delivery.DeliveryTestPolicies.MAX_ATTEMPTS;
import static com.openframe.delivery.DeliveryTestPolicies.RECONNECT_WINDOW;
import static com.openframe.delivery.DeliveryTestPolicies.RESULT_TIMEOUT;
import static com.openframe.delivery.DeliveryTestPolicies.TTL;
import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPropertiesTest {

    private static final int UNINSTALL_MAX_ATTEMPTS = 5;
    private static final long ROW_RECONNECT_WINDOW = 3_600L;

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
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(RECONNECT_WINDOW);
        assertThat(resolved.getResultTimeoutSeconds()).isEqualTo(RESULT_TIMEOUT);
        assertThat(resolved.getTtlSeconds()).isEqualTo(TTL);
    }

    @Test
    void resolve_typeOverridesOfflineBehavior_overrideWins() {
        // setup
        Policy scripts = new Policy();
        scripts.setOfflineBehavior(ScheduleOfflineBehavior.SKIP);
        properties.setTypes(Map.of(DeliveryType.SCRIPT_SCHEDULE, scripts));

        // execution
        Policy resolved = properties.resolve(DeliveryType.SCRIPT_SCHEDULE);

        // verifications
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.SKIP);
    }

    @Test
    void resolve_rowWithoutOverrides_typePolicyReturned() {
        // setup
        Policy uninstall = new Policy();
        uninstall.setMaxAttempts(UNINSTALL_MAX_ATTEMPTS);
        properties.setTypes(Map.of(DeliveryType.CLIENT_UNINSTALL, uninstall));
        MachineDelivery delivery = MachineDelivery.builder().type(DeliveryType.CLIENT_UNINSTALL).build();

        // execution
        Policy resolved = properties.resolve(delivery);

        // verifications
        assertThat(resolved.getMaxAttempts()).isEqualTo(UNINSTALL_MAX_ATTEMPTS);
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(RECONNECT_WINDOW);
    }

    @Test
    void resolve_rowOverridesOfflineFields_rowWinsOverType() {
        // setup
        Policy scripts = new Policy();
        scripts.setOfflineBehavior(ScheduleOfflineBehavior.SKIP);
        properties.setTypes(Map.of(DeliveryType.SCRIPT_SCHEDULE, scripts));
        MachineDelivery delivery = MachineDelivery.builder()
                .type(DeliveryType.SCRIPT_SCHEDULE)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT)
                .reconnectWindowSeconds(ROW_RECONNECT_WINDOW)
                .build();

        // execution
        Policy resolved = properties.resolve(delivery);

        // verifications
        assertThat(resolved.getOfflineBehavior()).isEqualTo(ScheduleOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(resolved.getReconnectWindowSeconds()).isEqualTo(ROW_RECONNECT_WINDOW);
        assertThat(resolved.getMaxAttempts()).isEqualTo(MAX_ATTEMPTS);
    }
}
