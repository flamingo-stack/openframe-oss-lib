package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.TenantCve;
import com.openframe.data.repository.rmm.software.TenantCveRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import com.openframe.stream.model.fleet.debezium.IntegratedToolEnrichedData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantCveHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private TenantCveRepository tenantCveRepository;

    @InjectMocks private TenantCveHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
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
        handler.handle(msg("c", null, null), enriched("t1"));
        verifyNoInteractions(tenantCveRepository);
    }

    @Test
    void handle_globalStatsRow_isDropped() {
        handler.handle(msg("c", null, countRow().put("global_stats", true)), enriched("t1"));
        verifyNoInteractions(tenantCveRepository);
    }

    @Test
    void handle_withoutResolvedTenant_isDropped() {
        handler.handle(msg("c", null, countRow()), enriched(null));
        verifyNoInteractions(tenantCveRepository);
    }

    @Test
    void handle_blankCve_isNoOp() {
        ObjectNode row = MAPPER.createObjectNode().put("host_count", 4);
        handler.handle(msg("c", null, row), enriched("t1"));
        verifyNoInteractions(tenantCveRepository);
    }

    @Test
    void handle_create_upsertsDeviceCount() {
        when(tenantCveRepository.findByTenantIdAndCveId("t1", "CVE-2024-9")).thenReturn(Optional.empty());

        handler.handle(msg("c", null, countRow()), enriched("t1"));

        ArgumentCaptor<TenantCve> captor = ArgumentCaptor.forClass(TenantCve.class);
        verify(tenantCveRepository).save(captor.capture());
        TenantCve saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getCveId()).isEqualTo("CVE-2024-9");
        assertThat(saved.getDevicesCount()).isEqualTo(4);
        assertThat(saved.getDiscoveredAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void handle_delete_removesRowWithoutSave() {
        handler.handle(msg("d", countRow(), null), enriched("t1"));

        verify(tenantCveRepository).deleteByTenantIdAndCveId("t1", "CVE-2024-9");
        verify(tenantCveRepository, never()).save(any());
    }
}
