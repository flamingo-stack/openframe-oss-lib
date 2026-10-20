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
class TenantSoftwareHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private SoftwareProjector softwareProjector;

    @InjectMocks private TenantSoftwareHandler handler;

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
        return MAPPER.createObjectNode().put("software_title_id", 42).put("hosts_count", 5).put("team_id", 3);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg(null), enriched("t1"));
        verifyNoInteractions(softwareProjector);
    }

    @Test
    void handle_globalStatsRow_isDropped() {
        handler.handle(msg(countRow().put("global_stats", true)), enriched("t1"));
        verifyNoInteractions(softwareProjector);
    }

    @Test
    void handle_withoutResolvedTenant_isDropped() {
        handler.handle(msg(countRow()), enriched(null));
        verifyNoInteractions(softwareProjector);
    }

    @Test
    void handle_missingTitleId_isNoOp() {
        handler.handle(msg(MAPPER.createObjectNode().put("hosts_count", 5)), enriched("t1"));
        verifyNoInteractions(softwareProjector);
    }

    @Test
    void handle_projectsResolvedTenantAndTitle() {
        handler.handle(msg(countRow()), enriched("t1"));
        verify(softwareProjector).project("t1", 42L);
    }
}
