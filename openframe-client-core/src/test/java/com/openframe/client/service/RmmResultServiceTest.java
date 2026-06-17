package com.openframe.client.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.nats.rmm.model.RmmResultMessage;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RmmResultServiceTest {

    private static final String MACHINE_ID = "machine-42";
    private static final String TENANT_ID = "tenant-1";

    @Mock
    private EventLogsPublisher eventLogsPublisher;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private RmmResultService rmmResultService;

    @BeforeEach
    void setUp() {
        // Real ObjectMapper (valueToTree must work); the publisher + tenant provider are mocked.
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        rmmResultService = new RmmResultService(eventLogsPublisher, tenantIdProvider, new ObjectMapper());
    }

    @Test
    @DisplayName("processResult: publishes a CommonDebeziumMessage (payload.after carries the data incl. tenantId) with the message-type header, keyed by machineId")
    void processResult_publishesDebeziumEnvelopeWithHeader() {
        RmmResultMessage message = RmmResultMessage.builder()
                .executionId("exec-1")
                .machineId(MACHINE_ID)
                .stdout("hey\n")
                .stderr("")
                .exitCode(0)
                .executionTimeMs(12L)
                .timedOut(false)
                .build();

        rmmResultService.processResult(MACHINE_ID, message);

        ArgumentCaptor<CommonDebeziumMessage> envelope = ArgumentCaptor.forClass(CommonDebeziumMessage.class);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> headers = ArgumentCaptor.forClass(Map.class);
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), envelope.capture(), headers.capture());

        // message-type header (so __TypeId__ stays CommonDebeziumMessage via the payload type)
        assertThat(headers.getValue()).containsEntry(KafkaHeader.MESSAGE_TYPE_HEADER, "RMM");

        assertThat(envelope.getValue().getPayload()).isNotNull();
        assertThat(envelope.getValue().getPayload().getOperation()).isEqualTo("c");
        assertThat(envelope.getValue().getPayload().getTimestamp()).isNotNull().isPositive();

        JsonNode after = envelope.getValue().getPayload().getAfter();
        assertThat(after).isNotNull();
        assertThat(after.get("tenantId").asText()).isEqualTo(TENANT_ID);
        assertThat(after.get("machineId").asText()).isEqualTo(MACHINE_ID);
        assertThat(after.get("executionId").asText()).isEqualTo("exec-1");
        assertThat(after.get("stdout").asText()).isEqualTo("hey\n");
        assertThat(after.get("exitCode").asInt()).isZero();
        assertThat(after.get("executionTimeMs").asLong()).isEqualTo(12L);
        assertThat(after.get("timedOut").asBoolean()).isFalse();
        assertThat(after.get("eventTimestamp").asLong()).isPositive();
    }

    @Test
    @DisplayName("processResult: a sparse payload (only executionId) still publishes; absent fields are omitted from payload.after")
    void processResult_sparsePayload() {
        RmmResultMessage message = RmmResultMessage.builder()
                .executionId("exec-2")
                .build();

        rmmResultService.processResult(MACHINE_ID, message);

        ArgumentCaptor<CommonDebeziumMessage> envelope = ArgumentCaptor.forClass(CommonDebeziumMessage.class);
        verify(eventLogsPublisher).publish(eq(MACHINE_ID), envelope.capture(), org.mockito.ArgumentMatchers.anyMap());

        JsonNode after = envelope.getValue().getPayload().getAfter();
        assertThat(after.get("tenantId").asText()).isEqualTo(TENANT_ID);
        assertThat(after.get("executionId").asText()).isEqualTo("exec-2");
        assertThat(after.has("stdout")).isFalse();
        assertThat(after.has("exitCode")).isFalse();
        assertThat(after.has("timedOut")).isFalse();
        assertThat(after.get("eventTimestamp").asLong()).isPositive();
    }
}
