package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceOperatingSystem;
import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.repository.rmm.software.DeviceOperatingSystemRepository;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatingSystemCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private DeviceOperatingSystemRepository deviceOperatingSystemRepository;

    @InjectMocks private OperatingSystemCatalogHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private ObjectNode osRow() {
        return MAPPER.createObjectNode().put("id", 7).put("name", "macOS").put("version", "14.5")
                .put("platform", "darwin");
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(fleetOperatingSystemRepository, deviceOperatingSystemRepository);
    }

    @Test
    void handle_missingId_isNoOp() {
        handler.handle(msg("c", null, MAPPER.createObjectNode().put("name", "macOS")), null);
        verifyNoInteractions(fleetOperatingSystemRepository, deviceOperatingSystemRepository);
    }

    @Test
    void handle_delete_removesOsWithoutFanOut() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 7), null), null);
        verify(fleetOperatingSystemRepository).deleteByOsId(7L);
        verifyNoInteractions(deviceOperatingSystemRepository);
    }

    @Test
    void handle_newOs_savesAndFansOutToDeviceRows() {
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.empty());
        DeviceOperatingSystem deviceRow = DeviceOperatingSystem.builder().tenantId("t1").machineId("m1").osId(7L).build();
        when(deviceOperatingSystemRepository.findByOsId(7L)).thenReturn(List.of(deviceRow));

        handler.handle(msg("c", null, osRow()), null);

        verify(fleetOperatingSystemRepository).save(any(FleetOperatingSystem.class));
        ArgumentCaptor<List<DeviceOperatingSystem>> captor = ArgumentCaptor.forClass(List.class);
        verify(deviceOperatingSystemRepository).saveAll(captor.capture());
        DeviceOperatingSystem fanned = captor.getValue().get(0);
        assertThat(fanned.getName()).isEqualTo("macOS");
        assertThat(fanned.getVersion()).isEqualTo("14.5");
        assertThat(fanned.getPlatform()).isEqualTo("darwin");
    }

    @Test
    void handle_unchangedDetails_savesButSkipsFanOut() {
        FleetOperatingSystem existing = FleetOperatingSystem.builder().osId(7L)
                .name("macOS").version("14.5").platform("darwin").build();
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, osRow()), null);

        verify(fleetOperatingSystemRepository).save(existing);
        verifyNoInteractions(deviceOperatingSystemRepository);
    }

    @Test
    void handle_changedDetails_withNoDeviceRows_doesNotSaveAll() {
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.empty());
        when(deviceOperatingSystemRepository.findByOsId(7L)).thenReturn(List.of());

        handler.handle(msg("c", null, osRow()), null);

        verify(deviceOperatingSystemRepository, never()).saveAll(any());
    }
}
