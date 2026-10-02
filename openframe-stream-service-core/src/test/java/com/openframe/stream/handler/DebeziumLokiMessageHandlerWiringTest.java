package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.loki.client.LokiClient;
import com.openframe.data.loki.toolevent.ToolEventLogRepository;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.util.Map;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DebeziumLokiMessageHandlerWiringTest {

    @Mock
    private LokiClient lokiClient;

    @Captor
    private ArgumentCaptor<String> lineCaptor;

    @Test
    void handler_lokiEnabledWithA256KBLineLimit_cutsLongerLinesTo262144Bytes() {
        contextRunner().withPropertyValues("openframe.loki.enabled=true", "openframe.loki.max-line-size=256KB")
                .run(context -> context.getBean(DebeziumLokiMessageHandler.class)
                        .handle(messageWithDetails("a".repeat(300_000)), new IntegratedToolEnrichedData()));

        verify(lokiClient).push(eq(Map.of("job", "tool-events", "tenant_id", "tenant-a", "tool_type", "RMM")),
                eq(1_790_848_800_123_000_000L), lineCaptor.capture(),
                eq(Map.of("tool_event_id", "evt-1", "event_type", "SCRIPT_EXECUTED")));
        assertThat(lineCaptor.getValue().getBytes(UTF_8)).hasSize(262_144);
    }

    @ParameterizedTest
    @ValueSource(strings = {"openframe.loki.enabled=false", "spring.data.cassandra.enabled=true"})
    void handler_lokiNotEnabled_isNotRegistered(String property) {
        contextRunner().withPropertyValues(property, "openframe.loki.max-line-size=256KB")
                .run(context -> assertThat(context).doesNotHaveBean(DebeziumLokiMessageHandler.class));
    }

    private ApplicationContextRunner contextRunner() {
        return new ApplicationContextRunner()
                .withInitializer(context -> context.getBeanFactory()
                        .setConversionService(ApplicationConversionService.getSharedInstance()))
                .withBean(ToolEventLogRepository.class, () -> new ToolEventLogRepository(lokiClient))
                .withBean(ObjectMapper.class, ObjectMapper::new)
                .withBean(DebeziumEventValidator.class, TenantIdRequiredDebeziumEventValidator::new)
                .withUserConfiguration(DebeziumLokiMessageHandler.class);
    }

    private static DeserializedDebeziumMessage messageWithDetails(String details) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .tenantId("tenant-a")
                .integratedToolType(IntegratedToolType.RMM)
                .unifiedEventType(UnifiedEventType.SCRIPT_EXECUTED)
                .toolEventId("evt-1")
                .ingestDay("2026-10-01")
                .eventTimestamp(1_790_848_800_123L)
                .details(details)
                .build();
    }
}
