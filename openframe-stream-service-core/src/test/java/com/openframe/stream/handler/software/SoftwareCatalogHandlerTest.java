package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
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
class SoftwareCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetSoftwareRepository fleetSoftwareRepository;
    @Mock private DeviceSoftwareRepository deviceSoftwareRepository;

    @InjectMocks private SoftwareCatalogHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private ObjectNode softwareRow() {
        return MAPPER.createObjectNode().put("id", 200).put("name", "Chrome").put("version", "1.0")
                .put("source", "apps").put("title_id", 42);
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(fleetSoftwareRepository, deviceSoftwareRepository);
    }

    @Test
    void handle_missingId_isNoOp() {
        handler.handle(msg("c", null, MAPPER.createObjectNode().put("name", "Chrome")), null);
        verifyNoInteractions(fleetSoftwareRepository, deviceSoftwareRepository);
    }

    @Test
    void handle_delete_removesCatalogEntryWithoutFanOut() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 200), null), null);
        verify(fleetSoftwareRepository).deleteBySoftwareId(200L);
        verifyNoInteractions(deviceSoftwareRepository);
    }

    @Test
    void handle_newEntry_savesAndFansOutToDeviceRows() {
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.empty());
        DeviceSoftware deviceRow = DeviceSoftware.builder().tenantId("t1").machineId("m1").softwareId(200L).build();
        when(deviceSoftwareRepository.findBySoftwareId(200L)).thenReturn(List.of(deviceRow));

        handler.handle(msg("c", null, softwareRow()), null);

        verify(fleetSoftwareRepository).save(any(FleetSoftware.class));
        ArgumentCaptor<List<DeviceSoftware>> captor = ArgumentCaptor.forClass(List.class);
        verify(deviceSoftwareRepository).saveAll(captor.capture());
        DeviceSoftware fanned = captor.getValue().get(0);
        assertThat(fanned.getSoftwareTitleId()).isEqualTo(42L);
        assertThat(fanned.getName()).isEqualTo("Chrome");
        assertThat(fanned.getVersion()).isEqualTo("1.0");
        assertThat(fanned.getSource()).isEqualTo("apps");
    }

    @Test
    void handle_unchangedDetails_savesButSkipsFanOut() {
        FleetSoftware existing = FleetSoftware.builder().softwareId(200L).softwareTitleId(42L)
                .name("Chrome").version("1.0").source("apps").build();
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, softwareRow()), null);

        verify(fleetSoftwareRepository).save(existing);
        verifyNoInteractions(deviceSoftwareRepository);   // nothing changed -> no fan-out
    }

    @Test
    void handle_changedDetails_withNoDeviceRows_doesNotSaveAll() {
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.empty());
        when(deviceSoftwareRepository.findBySoftwareId(200L)).thenReturn(List.of());

        handler.handle(msg("c", null, softwareRow()), null);

        verify(deviceSoftwareRepository, never()).saveAll(any());
    }
}
