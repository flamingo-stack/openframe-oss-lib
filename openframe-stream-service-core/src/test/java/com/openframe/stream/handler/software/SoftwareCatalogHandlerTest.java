package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
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
class SoftwareCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetSoftwareRepository fleetSoftwareRepository;
    @Mock private SoftwareCascadeSyncService cascadeSyncService;

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
        verifyNoInteractions(fleetSoftwareRepository, cascadeSyncService);
    }

    @Test
    void handle_missingId_isNoOp() {
        handler.handle(msg("c", null, MAPPER.createObjectNode().put("name", "Chrome")), null);
        verifyNoInteractions(fleetSoftwareRepository, cascadeSyncService);
    }

    @Test
    void handle_delete_removesCatalogEntryWithoutCascade() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 200), null), null);
        verify(fleetSoftwareRepository).deleteBySoftwareId(200L);
        verifyNoInteractions(cascadeSyncService);
    }

    @Test
    void handle_newEntry_savesAndEnqueuesCascade() {
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.empty());

        handler.handle(msg("c", null, softwareRow()), null);

        verify(fleetSoftwareRepository).save(any(FleetSoftware.class));
        verify(cascadeSyncService).enqueueSoftwareDetails(200L);
    }

    @Test
    void handle_unchangedDetails_savesButDoesNotEnqueue() {
        FleetSoftware existing = FleetSoftware.builder().softwareId(200L).softwareTitleId(42L)
                .name("Chrome").version("1.0").source("apps").build();
        when(fleetSoftwareRepository.findBySoftwareId(200L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, softwareRow()), null);

        verify(fleetSoftwareRepository).save(existing);
        verify(cascadeSyncService, never()).enqueueSoftwareDetails(any());
    }
}
