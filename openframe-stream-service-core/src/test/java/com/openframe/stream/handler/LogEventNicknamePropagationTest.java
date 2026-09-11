package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.cassandra.repository.UnifiedLogEventRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.IntegratedToolEvent;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

/**
 * The two log sinks must agree: whatever enrichment resolved has to reach both the Cassandra
 * detail row and the Kafka message that Pinot ingests, or the list and detail views disagree.
 */
class LogEventNicknamePropagationTest {

    private static final String TENANT_ID = "tenant-a";
    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";
    private static final String HOSTNAME = "MBP-Oleksandr.lan";
    private static final String NICKNAME = "Reception iMac";

    private static DeserializedDebeziumMessage message() {
        DebeziumMessage.Payload<com.fasterxml.jackson.databind.JsonNode> payload = new DebeziumMessage.Payload<>();
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

    @Test
    @DisplayName("Cassandra sink: hostname and nickname are both written to unified_logs")
    void cassandraHandlerWritesBothNameFields() {
        UnifiedLogEventRepository repository = mock(UnifiedLogEventRepository.class);
        DebeziumCassandraMessageHandler handler = new DebeziumCassandraMessageHandler(
                repository, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator());

        handler.handle(message(), enriched(NICKNAME));

        ArgumentCaptor<UnifiedLogEvent> captor = ArgumentCaptor.forClass(UnifiedLogEvent.class);
        verify(repository).save(captor.capture());
        UnifiedLogEvent saved = captor.getValue();
        assertThat(saved.getHostname()).isEqualTo(HOSTNAME);
        assertThat(saved.getNickname()).isEqualTo(NICKNAME);
    }

    @Test
    @DisplayName("Cassandra sink: a machine with no nickname writes a null nickname, not the hostname")
    void cassandraHandlerWritesNullNicknameWhenAbsent() {
        UnifiedLogEventRepository repository = mock(UnifiedLogEventRepository.class);
        DebeziumCassandraMessageHandler handler = new DebeziumCassandraMessageHandler(
                repository, new ObjectMapper(), new TenantIdRequiredDebeziumEventValidator());

        handler.handle(message(), enriched(null));

        ArgumentCaptor<UnifiedLogEvent> captor = ArgumentCaptor.forClass(UnifiedLogEvent.class);
        verify(repository).save(captor.capture());
        UnifiedLogEvent saved = captor.getValue();
        assertThat(saved.getHostname()).isEqualTo(HOSTNAME);
        assertThat(saved.getNickname()).isNull();
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
