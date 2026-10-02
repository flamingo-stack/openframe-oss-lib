package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.toolevent.ToolEventLog;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.util.unit.DataSize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;

/**
 * The two log sinks must agree: whatever enrichment resolved has to reach both the Loki
 * detail row and the Kafka message that Pinot ingests, or the list and detail views disagree.
 */
class LogEventNicknamePropagationTest {

    private static final String TENANT_ID = "tenant-a";
    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String HOSTNAME = "MBP-Oleksandr.lan";
    private static final String NICKNAME = "Reception iMac";

    private static DeserializedDebeziumMessage message() {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId(TENANT_ID)
                .toolEventId("evt-1")
                .ingestDay("2026-07-24")
                .integratedToolType(IntegratedToolType.FLEET)
                .unifiedEventType(UnifiedEventType.LOGIN)
                .eventTimestamp(1L)
                .isVisible(true)
                .build();
    }

    private static IntegratedToolEnrichedData enriched(String nickname) {
        IntegratedToolEnrichedData enriched = new IntegratedToolEnrichedData();
        enriched.setTenantId(TENANT_ID);
        enriched.setMachineId(MACHINE_ID);
        enriched.setHostname(HOSTNAME);
        enriched.setNickname(nickname);
        return enriched;
    }

    private static DebeziumLokiMessageHandler lokiHandler(ToolEventLogRepository repository) {
        return new DebeziumLokiMessageHandler(
                repository, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator(), DataSize.ofKilobytes(256));
    }

    @Test
    @DisplayName("Loki sink: hostname and nickname are both written to the saved log")
    void handle_machineWithNickname_writesHostnameAndNicknameToLoki() {
        ToolEventLogRepository repository = spy(new ToolEventLogRepository(mock(LokiClient.class)));

        lokiHandler(repository).handle(message(), enriched(NICKNAME));

        ArgumentCaptor<ToolEventLog> captor = ArgumentCaptor.forClass(ToolEventLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue())
                .extracting(ToolEventLog::getHostname, ToolEventLog::getNickname)
                .containsExactly(HOSTNAME, NICKNAME);
    }

    @Test
    @DisplayName("Loki sink: a machine with no nickname writes a null nickname, not the hostname")
    void handle_machineWithoutNickname_writesNullNicknameToLoki() {
        ToolEventLogRepository repository = spy(new ToolEventLogRepository(mock(LokiClient.class)));

        lokiHandler(repository).handle(message(), enriched(null));

        ArgumentCaptor<ToolEventLog> captor = ArgumentCaptor.forClass(ToolEventLog.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue())
                .extracting(ToolEventLog::getHostname, ToolEventLog::getNickname)
                .containsExactly(HOSTNAME, null);
    }

    @Test
    @DisplayName("Kafka/Pinot sink: hostname and nickname both reach the published message")
    void kafkaHandlerPublishesBothNameFields() {
        OssTenantRetryingKafkaProducer producer = mock(OssTenantRetryingKafkaProducer.class);
        TenantDebeziumKafkaMessageHandler handler = new TenantDebeziumKafkaMessageHandler(
                producer, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator());

        handler.handle(message(), enriched(NICKNAME));

        ArgumentCaptor<IntegratedToolEvent> captor = ArgumentCaptor.forClass(IntegratedToolEvent.class);
        verify(producer).publish(isNull(), anyString(), captor.capture());
        IntegratedToolEvent published = captor.getValue();
        assertThat(published.getHostname()).isEqualTo(HOSTNAME);
        assertThat(published.getNickname()).isEqualTo(NICKNAME);
    }
}
