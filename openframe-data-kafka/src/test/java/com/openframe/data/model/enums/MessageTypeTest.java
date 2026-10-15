package com.openframe.data.model.enums;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import static org.assertj.core.api.Assertions.assertThat;

class MessageTypeTest {

    @ParameterizedTest
    @EnumSource(MessageType.class)
    void getDestinationList_everyToolEventType_savesDetailsBeforePublishingToTheList(MessageType type) {
        assertThat(type.getDestinationList())
                .extracting(Destination::name)
                .startsWith("CASSANDRA_EVENT_LOG", "LOKI_EVENT_LOG", "KAFKA_PINOT");
    }

    @Test
    void remoteSessionAuditEvent_routesAsAMeshCentralEventToTheEventLogAndPinot() {
        // setup
        MessageType type = MessageType.REMOTE_SESSION_AUDIT_EVENT;

        // execution
        IntegratedToolType toolType = type.getIntegratedToolType();

        // verifications
        assertThat(toolType).isEqualTo(IntegratedToolType.MESHCENTRAL);
        assertThat(type.getDataEnrichmentServiceType()).isEqualTo(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
        assertThat(type.getDestinationList())
                .containsExactly(Destination.CASSANDRA_EVENT_LOG, Destination.LOKI_EVENT_LOG, Destination.KAFKA_PINOT);
        assertThat(type.getEventHandlerType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }
}
