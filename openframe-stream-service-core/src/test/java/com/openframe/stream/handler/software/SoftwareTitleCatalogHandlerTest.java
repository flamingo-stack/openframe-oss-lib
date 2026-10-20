package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
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

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareTitleCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetSoftwareTitleRepository softwareTitleRepository;
    @Mock private SoftwareRepository softwareRepository;
    @Mock private SoftwareProjector softwareProjector;

    @InjectMocks private SoftwareTitleCatalogHandler handler;

    private DeserializedDebeziumMessage msg(String op, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(op);
        payload.setBefore(before);
        payload.setAfter(after);
        DeserializedDebeziumMessage m = new DeserializedDebeziumMessage();
        m.setPayload(payload);
        return m;
    }

    private ObjectNode titleRow() {
        return MAPPER.createObjectNode().put("id", 42).put("name", "Google Chrome")
                .put("source", "apps").put("browser", "").put("bundle_identifier", "com.google.Chrome");
    }

    @Test
    void handle_nullRow_isNoOp() {
        handler.handle(msg("c", null, null), null);
        verifyNoInteractions(softwareTitleRepository, softwareRepository, softwareProjector);
    }

    @Test
    void handle_delete_removesTitleWithoutReproject() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 42), null), null);
        verify(softwareTitleRepository).deleteBySoftwareTitleId(42L);
        verifyNoInteractions(softwareRepository, softwareProjector);
    }

    @Test
    void handle_newTitle_savesAndReprojectsAffectedTenants() {
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.empty());
        when(softwareRepository.findBySoftwareTitleId(42L)).thenReturn(List.of(
                Software.builder().tenantId("t1").softwareTitleId(42L).build(),
                Software.builder().tenantId("t2").softwareTitleId(42L).build()));

        handler.handle(msg("c", null, titleRow()), null);

        verify(softwareTitleRepository).save(any(FleetSoftwareTitle.class));
        verify(softwareProjector).project("t1", 42L);
        verify(softwareProjector).project("t2", 42L);
    }

    @Test
    void handle_unchangedName_savesButDoesNotReproject() {
        FleetSoftwareTitle existing = FleetSoftwareTitle.builder().softwareTitleId(42L)
                .name("Google Chrome").nameLower("google chrome").source("apps").browser("").build();
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, titleRow()), null);

        verify(softwareTitleRepository).save(existing);
        verifyNoInteractions(softwareRepository, softwareProjector);
    }
}
