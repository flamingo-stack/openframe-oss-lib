package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
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
class TenantSoftwareHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private TenantSoftwareRepository tenantSoftwareRepository;
    @Mock private FleetSoftwareTitleRepository softwareTitleRepository;
    @Mock private TenantSoftwareCveAggregator tenantSoftwareCveAggregator;

    @InjectMocks private TenantSoftwareHandler handler;

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
        return MAPPER.createObjectNode().put("software_title_id", 42).put("hosts_count", 5).put("team_id", 3);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), enriched("t1"));
        verifyNoInteractions(tenantSoftwareRepository, softwareTitleRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void handle_globalStatsRow_isDropped() {
        ObjectNode row = countRow().put("global_stats", true);
        handler.handle(msg("c", null, row), enriched("t1"));
        verifyNoInteractions(tenantSoftwareRepository, softwareTitleRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void handle_withoutResolvedTenant_isDropped() {
        handler.handle(msg("c", null, countRow()), enriched(null));
        verifyNoInteractions(tenantSoftwareRepository, softwareTitleRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void handle_missingTitleId_isNoOp() {
        ObjectNode row = MAPPER.createObjectNode().put("hosts_count", 5);
        handler.handle(msg("c", null, row), enriched("t1"));
        verifyNoInteractions(tenantSoftwareRepository, softwareTitleRepository, tenantSoftwareCveAggregator);
    }

    @Test
    void handle_create_upsertsDeviceCountWithTitleDetailsAndRecomputes() {
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.of(
                FleetSoftwareTitle.builder().softwareTitleId(42L).name("Google Chrome").nameLower("google chrome")
                        .source("apps").browser("").build()));

        handler.handle(msg("c", null, countRow()), enriched("t1"));

        ArgumentCaptor<TenantSoftware> captor = ArgumentCaptor.forClass(TenantSoftware.class);
        verify(tenantSoftwareRepository).save(captor.capture());
        TenantSoftware saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getDevicesCount()).isEqualTo(5);
        assertThat(saved.getName()).isEqualTo("Google Chrome");
        assertThat(saved.getNameLower()).isEqualTo("google chrome");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getUpdatedAt()).isNotNull();
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);
    }

    @Test
    void handle_create_withTitleMissing_savesCountOnlyAndRecomputes() {
        when(tenantSoftwareRepository.findByTenantIdAndSoftwareTitleId("t1", 42L)).thenReturn(Optional.empty());
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.empty());

        handler.handle(msg("c", null, countRow()), enriched("t1"));

        ArgumentCaptor<TenantSoftware> captor = ArgumentCaptor.forClass(TenantSoftware.class);
        verify(tenantSoftwareRepository).save(captor.capture());
        assertThat(captor.getValue().getDevicesCount()).isEqualTo(5);
        assertThat(captor.getValue().getName()).isNull();
        verify(tenantSoftwareCveAggregator).recompute("t1", 42L);
    }

    @Test
    void handle_delete_removesRowWithoutSaveOrRecompute() {
        ObjectNode before = countRow();
        handler.handle(msg("d", before, null), enriched("t1"));

        verify(tenantSoftwareRepository).deleteByTenantIdAndSoftwareTitleId("t1", 42L);
        verify(tenantSoftwareRepository, never()).save(any());
        verifyNoInteractions(softwareTitleRepository, tenantSoftwareCveAggregator);
    }
}
