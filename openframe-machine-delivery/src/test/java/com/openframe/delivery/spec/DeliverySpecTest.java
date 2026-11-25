package com.openframe.delivery.spec;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class DeliverySpecTest {

    private final DeliverySpec<TestSeed, TestPayload> spec = new DeliverySpec<>() {

        @Override
        public DeliveryType getType() {
            return DeliveryType.TOOL_INSTALLATION;
        }

        @Override
        public Class<TestPayload> getPayloadClass() {
            return TestPayload.class;
        }

        @Override
        public DeliveryRequest<TestPayload> request(TestSeed seed) {
            return null;
        }

        @Override
        public String subject(String machineId) {
            return machineId;
        }
    };

    @Test
    void getDeliverableStatuses_default_managedAndPending() {
        // execution
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();

        // verifications
        assertThat(statuses).containsExactlyInAnyOrder(DeviceStatus.MANAGED, DeviceStatus.PENDING);
    }
}
