package com.openframe.stream.handler.software;

import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class TenantCveHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private VulnerabilityProjector vulnerabilityProjector;

    @InjectMocks private TenantCveHandler handler;

    private DeserializedDebeziumMessage msg(JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation("c");
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private IntegratedToolEnrichedData enriched(String tenantId) {
        return IntegratedToolEnrichedData.builder().tenantId(tenantId).build();
    }

    private ObjectNode countRow() {
        return MAPPER.createObjectNode().put("cve", "CVE-2024-9").put("host_count", 4).put("team_id", 3);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg(null), enriched("t1"));
        verifyNoInteractions(vulnerabilityProjector);
    }

    @Test
    void handle_globalStatsRow_isDropped() {
        handler.handle(msg(countRow().put("global_stats", true)), enriched("t1"));
        verifyNoInteractions(vulnerabilityProjector);
    }

    @Test
    void handle_withoutResolvedTenant_isDropped() {
        handler.handle(msg(countRow()), enriched(null));
        verifyNoInteractions(vulnerabilityProjector);
    }

    @Test
    void handle_blankCve_isNoOp() {
        handler.handle(msg(MAPPER.createObjectNode().put("host_count", 4)), enriched("t1"));
        verifyNoInteractions(vulnerabilityProjector);
    }

    @Test
    void handle_projectsResolvedTenantAndCve() {
        handler.handle(msg(countRow()), enriched("t1"));
        verify(vulnerabilityProjector).project("t1", "CVE-2024-9");
    }
}
