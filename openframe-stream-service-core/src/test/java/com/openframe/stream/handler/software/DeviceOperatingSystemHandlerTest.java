package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceOperatingSystem;
import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
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

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOperatingSystemHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetHostResolver fleetHostResolver;
    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private DeviceOperatingSystemRepository deviceOperatingSystemRepository;

    @InjectMocks private DeviceOperatingSystemHandler handler;

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
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(fleetHostResolver, fleetOperatingSystemRepository, deviceOperatingSystemRepository);
    }

    @Test
    void handle_missingHostId_isNoOp() {
        handler.handle(msg("c", null, row().put("os_id", 7)), null);   // host_id is required, os_id is not
        verifyNoInteractions(fleetHostResolver, fleetOperatingSystemRepository, deviceOperatingSystemRepository);
    }

    @Test
    void handle_unresolvedHost_skips() {
        when(fleetHostResolver.resolve("100")).thenReturn(null);

        handler.handle(msg("c", null, row().put("host_id", 100).put("os_id", 7)), null);

        verifyNoInteractions(fleetOperatingSystemRepository);
        verify(deviceOperatingSystemRepository, never()).save(any());
        verify(deviceOperatingSystemRepository, never()).deleteByTenantIdAndMachineId(any(), any());
    }

    @Test
    void handle_create_upsertsWithCatalogFields() {
        ObjectNode after = row().put("host_id", 100).put("os_id", 7);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceOperatingSystemRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.empty());
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.of(
                FleetOperatingSystem.builder().osId(7L).name("macOS").version("14.5").platform("darwin").build()));

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<DeviceOperatingSystem> captor = ArgumentCaptor.forClass(DeviceOperatingSystem.class);
        verify(deviceOperatingSystemRepository).save(captor.capture());
        DeviceOperatingSystem saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo("t1");
        assertThat(saved.getMachineId()).isEqualTo("m1");
        assertThat(saved.getHostId()).isEqualTo(100L);
        assertThat(saved.getOsId()).isEqualTo(7L);
        assertThat(saved.getName()).isEqualTo("macOS");
        assertThat(saved.getVersion()).isEqualTo("14.5");
        assertThat(saved.getPlatform()).isEqualTo("darwin");
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void handle_create_withNullOsId_savesWithoutCatalogLookup() {
        ObjectNode after = row().put("host_id", 100);   // no os_id
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceOperatingSystemRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.empty());

        handler.handle(msg("c", null, after), null);

        verifyNoInteractions(fleetOperatingSystemRepository);
        ArgumentCaptor<DeviceOperatingSystem> captor = ArgumentCaptor.forClass(DeviceOperatingSystem.class);
        verify(deviceOperatingSystemRepository).save(captor.capture());
        DeviceOperatingSystem saved = captor.getValue();
        assertThat(saved.getHostId()).isEqualTo(100L);
        assertThat(saved.getOsId()).isNull();
        assertThat(saved.getName()).isNull();
    }

    @Test
    void handle_create_withCatalogMissing_savesCoreFieldsOnly() {
        ObjectNode after = row().put("host_id", 100).put("os_id", 7);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));
        when(deviceOperatingSystemRepository.findByTenantIdAndMachineId("t1", "m1")).thenReturn(Optional.empty());
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.empty());

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<DeviceOperatingSystem> captor = ArgumentCaptor.forClass(DeviceOperatingSystem.class);
        verify(deviceOperatingSystemRepository).save(captor.capture());
        assertThat(captor.getValue().getOsId()).isEqualTo(7L);
        assertThat(captor.getValue().getName()).isNull();
    }

    @Test
    void handle_delete_removesDeviceOsWithoutSaving() {
        ObjectNode before = row().put("host_id", 100).put("os_id", 7);
        when(fleetHostResolver.resolve("100")).thenReturn(new FleetHostRef("t1", "m1"));

        handler.handle(msg("d", before, null), null);

        verify(deviceOperatingSystemRepository).deleteByTenantIdAndMachineId("t1", "m1");
        verify(deviceOperatingSystemRepository, never()).save(any());
        verifyNoInteractions(fleetOperatingSystemRepository);
    }
}
