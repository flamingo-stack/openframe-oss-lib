package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceSoftwareHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetSoftwareRepository fleetSoftwareRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;
    @Mock private SoftwareProjector softwareProjector;

    @InjectMocks private DeviceSoftwareHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private ObjectNode row() {
        return MAPPER.createObjectNode();
    }

    @Test
    void handle_nullPayload_isNoOp() {
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(null);
        handler.handle(m, null);
        verifyNoInteractions(fleetHostResolver, fleetSoftwareRepository, deviceSoftwareRepository);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(fleetHostResolver, fleetSoftwareRepository, deviceSoftwareRepository);
    }

    @Test
    void handle_missingIds_isNoOp() {
        handler.handle(msg("c", null, row().put("host_id", 100)), null);  // no software_id
        verifyNoInteractions(fleetHostResolver, fleetSoftwareRepository, deviceSoftwareRepository);
    }

    @Test
    void handle_unresolvedHost_skips() {
        when(fleetHostResolver.resolve("100")).thenReturn(null);

        handler.handle(msg("c", null, row().put("host_id", 100).put("software_id", 200)), null);

        verifyNoInteractions(fleetSoftwareRepository);
        verify(deviceSoftwareRepository, never()).save(any());
        verify(deviceSoftwareRepository, never()).deleteByTenantIdAndMachineIdAndSoftwareId(any(), any(), any());
    }

    @Test
    void handle_create_upsertsWithCatalogFields() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200)
                .put("last_opened_at", "2024-05-01T10:00:00Z");
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L))
                .thenReturn(Optional.empty());
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(
                FleetSoftware.builder().softwareTitleId(42L).name("Chrome").version("1.0").source("apps").build()));

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        DeviceSoftware saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getMachineId()).isEqualTo("m1");
        assertThat(saved.getHostId()).isEqualTo(100L);
        assertThat(saved.getSoftwareId()).isEqualTo(200L);
        assertThat(saved.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(saved.getName()).isEqualTo("Chrome");
        assertThat(saved.getVersion()).isEqualTo("1.0");
        assertThat(saved.getSource()).isEqualTo("apps");
        assertThat(saved.getLastSeenAt()).isEqualTo(Instant.parse("2024-05-01T10:00:00Z"));
        assertThat(saved.getUpdatedAt()).isNotNull();
        verify(softwareProjector).project("t1", 42L);
    }

    @Test
    void handle_create_withCatalogMissing_savesCoreFieldsOnly() {
        ObjectNode after = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceSoftwareRepository.findByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L))
                .thenReturn(Optional.empty());
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.empty());

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<DeviceSoftware> captor = ArgumentCaptor.forClass(DeviceSoftware.class);
        verify(deviceSoftwareRepository).save(captor.capture());
        DeviceSoftware saved = captor.getValue();
        assertThat(saved.getSoftwareId()).isEqualTo(200L);
        assertThat(saved.getSoftwareTitleId()).isNull();
        assertThat(saved.getName()).isNull();
        assertThat(saved.getVersion()).isNull();
        verify(softwareProjector).project("t1", null);
    }

    @Test
    void handle_delete_removesRowWithoutSaving() {
        ObjectNode before = row().put("host_id", 100).put("software_id", 200);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("d", before, null), null);

        verify(deviceSoftwareRepository).deleteByTenantIdAndMachineIdAndSoftwareId("t1", "m1", 200L);
        verify(deviceSoftwareRepository, never()).save(any());
        verify(softwareProjector).project("t1", null);
        verifyNoInteractions(fleetSoftwareRepository);
    }
}
