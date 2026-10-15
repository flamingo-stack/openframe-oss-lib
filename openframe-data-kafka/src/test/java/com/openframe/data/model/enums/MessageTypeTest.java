package com.openframe.data.model.enums;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MessageTypeTest {

    @Test
    void remoteSessionAuditEvent_routesAsAMeshCentralEventToTheEventLogAndPinot() {
        // setup
        MessageType type = MessageType.REMOTE_SESSION_AUDIT_EVENT;

        // execution
        IntegratedToolType toolType = type.getIntegratedToolType();

        // verifications
        assertThat(toolType).isEqualTo(IntegratedToolType.MESHCENTRAL);
        assertThat(type.getDataEnrichmentServiceType()).isEqualTo(DataEnrichmentServiceType.INTEGRATED_TOOLS_EVENTS);
        assertThat(type.getDestinationList()).containsExactly(Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT);
        assertThat(type.getEventHandlerType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }

    @Test
    void meshCentralEvent_routesToTheEventLogPinotAndTheTenantRemoteSessionEvent() {
        // setup
        MessageType type = MessageType.MESHCENTRAL_EVENT;

        // execution
        List<Destination> destinations = type.getDestinationList();

        // verifications
        assertThat(destinations).containsExactly(
                Destination.CASSANDRA_EVENT_LOG, Destination.KAFKA_PINOT, Destination.TENANT_REMOTE_SESSION_EVENT);
        assertThat(type.getEventHandlerType()).isEqualTo(EventHandlerType.COMMON_TYPE);
    }
}
