package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetOperatingSystem;
import com.openframe.data.repository.rmm.software.FleetOperatingSystemRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OperatingSystemCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetOperatingSystemRepository fleetOperatingSystemRepository;
    @Mock private SoftwareCascadeSyncService cascadeSyncService;

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
        verifyNoInteractions(fleetOperatingSystemRepository, cascadeSyncService);
    }

    @Test
    void handle_missingId_isNoOp() {
        handler.handle(msg("c", null, MAPPER.createObjectNode().put("name", "macOS")), null);
        verifyNoInteractions(fleetOperatingSystemRepository, cascadeSyncService);
    }

    @Test
    void handle_delete_removesOsWithoutCascade() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 7), null), null);
        verify(fleetOperatingSystemRepository).deleteByOsId(7L);
        verifyNoInteractions(cascadeSyncService);
    }

    @Test
    void handle_newOs_savesAndEnqueuesCascade() {
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.empty());

        handler.handle(msg("c", null, osRow()), null);

        verify(fleetOperatingSystemRepository).save(any(FleetOperatingSystem.class));
        verify(cascadeSyncService).enqueueOsDetails(7L);
    }

    @Test
    void handle_unchangedDetails_savesButDoesNotEnqueue() {
        FleetOperatingSystem existing = FleetOperatingSystem.builder().osId(7L)
                .name("macOS").version("14.5").platform("darwin").build();
        when(fleetOperatingSystemRepository.findByOsId(7L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, osRow()), null);

        verify(fleetOperatingSystemRepository).save(existing);
        verify(cascadeSyncService, never()).enqueueOsDetails(any());
    }
}
