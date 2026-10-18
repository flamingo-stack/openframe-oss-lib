package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.FleetSoftwareTitle;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
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
class SoftwareTitleCatalogHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private FleetSoftwareTitleRepository softwareTitleRepository;
    @Mock private TenantSoftwareRepository tenantSoftwareRepository;

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
        verifyNoInteractions(softwareTitleRepository, tenantSoftwareRepository);
    }

    @Test
    void handle_missingId_isNoOp() {
        handler.handle(msg("c", null, MAPPER.createObjectNode().put("name", "x")), null);
        verifyNoInteractions(softwareTitleRepository, tenantSoftwareRepository);
    }

    @Test
    void handle_delete_removesTitleWithoutFanOut() {
        handler.handle(msg("d", MAPPER.createObjectNode().put("id", 42), null), null);
        verify(softwareTitleRepository).deleteBySoftwareTitleId(42L);
        verifyNoInteractions(tenantSoftwareRepository);
    }

    @Test
    void handle_newTitle_savesLowercasesNameAndFansOutToTenantRows() {
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.empty());
        TenantSoftware tenantRow = TenantSoftware.builder().tenantId("t1").softwareTitleId(42L).build();
        when(tenantSoftwareRepository.findBySoftwareTitleId(42L)).thenReturn(List.of(tenantRow));

        handler.handle(msg("c", null, titleRow()), null);

        ArgumentCaptor<FleetSoftwareTitle> saved = ArgumentCaptor.forClass(FleetSoftwareTitle.class);
        verify(softwareTitleRepository).save(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("Google Chrome");
        assertThat(saved.getValue().getNameLower()).isEqualTo("google chrome");
        assertThat(saved.getValue().getBundleIdentifier()).isEqualTo("com.google.Chrome");

        ArgumentCaptor<List<TenantSoftware>> fanned = ArgumentCaptor.forClass(List.class);
        verify(tenantSoftwareRepository).saveAll(fanned.capture());
        assertThat(fanned.getValue().get(0).getName()).isEqualTo("Google Chrome");
        assertThat(fanned.getValue().get(0).getNameLower()).isEqualTo("google chrome");
    }

    @Test
    void handle_unchangedName_savesButSkipsFanOut() {
        FleetSoftwareTitle existing = FleetSoftwareTitle.builder().softwareTitleId(42L)
                .name("Google Chrome").nameLower("google chrome").source("apps").browser("").build();
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.of(existing));

        handler.handle(msg("c", null, titleRow()), null);

        verify(softwareTitleRepository).save(existing);
        verifyNoInteractions(tenantSoftwareRepository);
    }

    @Test
    void handle_changedName_withNoTenantRows_doesNotSaveAll() {
        when(softwareTitleRepository.findBySoftwareTitleId(42L)).thenReturn(Optional.empty());
        when(tenantSoftwareRepository.findBySoftwareTitleId(42L)).thenReturn(List.of());

        handler.handle(msg("c", null, titleRow()), null);

        verify(tenantSoftwareRepository, never()).saveAll(any());
    }
}
