package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.CveMetadata;
import com.openframe.data.repository.rmm.software.CveMetadataRepository;
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

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CveMetadataHandlerTest {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Mock private CveMetadataRepository cveMetadataRepository;

    @InjectMocks private CveMetadataHandler handler;

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
        verifyNoInteractions(cveMetadataRepository);
    }

    @Test
    void handle_blankCve_isNoOp() {
        handler.handle(msg("c", null, row().put("cve", "  ")), null);
        verifyNoInteractions(cveMetadataRepository);
    }

    @Test
    void handle_delete_removesWhenPresent() {
        CveMetadata existing = CveMetadata.builder().cveId("CVE-1").build();
        when(cveMetadataRepository.findByCveId("CVE-1")).thenReturn(Optional.of(existing));

        handler.handle(msg("d", row().put("cve", "CVE-1"), null), null);

        verify(cveMetadataRepository).delete(existing);
    }

    @Test
    void handle_delete_whenAbsent_doesNothing() {
        when(cveMetadataRepository.findByCveId("CVE-1")).thenReturn(Optional.empty());

        handler.handle(msg("d", row().put("cve", "CVE-1"), null), null);

        verify(cveMetadataRepository, never()).delete(any());
        verify(cveMetadataRepository, never()).save(any());
    }

    @Test
    void handle_upsert_mapsFieldsAndDerivesSeverityFromCvss() {
        ObjectNode after = row().put("cve", "CVE-2024-9")
                .put("cvss_score", 9.5)
                .put("epss_probability", 0.73)
                .put("cisa_known_exploit", true)
                .put("published", "2024-02-01T00:00:00Z")
                .put("description", "remote code execution");
        when(cveMetadataRepository.findByCveId("CVE-2024-9")).thenReturn(Optional.empty());

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<CveMetadata> captor = ArgumentCaptor.forClass(CveMetadata.class);
        verify(cveMetadataRepository).save(captor.capture());
        CveMetadata saved = captor.getValue();
        assertThat(saved.getCveId()).isEqualTo("CVE-2024-9");
        assertThat(saved.getCvssScore()).isEqualTo(9.5);
        assertThat(saved.getSeverity()).isEqualTo("CRITICAL");   // derived from cvss >= 9.0
        assertThat(saved.getEpssProbability()).isEqualTo(0.73);
        assertThat(saved.getCisaKnownExploit()).isTrue();
        assertThat(saved.getPublishedAt()).isEqualTo(Instant.parse("2024-02-01T00:00:00Z"));
        assertThat(saved.getDescription()).isEqualTo("remote code execution");
        assertThat(saved.getSource()).isEqualTo("fleet_cve_meta");
        assertThat(saved.getCachedAt()).isNotNull();
    }

    @Test
    void handle_upsert_withNoCvss_leavesSeverityNull() {
        ObjectNode after = row().put("cve", "CVE-2024-0");   // Fleet free tier: cve_meta columns null
        when(cveMetadataRepository.findByCveId("CVE-2024-0")).thenReturn(Optional.empty());

        handler.handle(msg("c", null, after), null);

        ArgumentCaptor<CveMetadata> captor = ArgumentCaptor.forClass(CveMetadata.class);
        verify(cveMetadataRepository).save(captor.capture());
        CveMetadata saved = captor.getValue();
        assertThat(saved.getCvssScore()).isNull();
        assertThat(saved.getSeverity()).isNull();
        assertThat(saved.getEpssProbability()).isNull();
        assertThat(saved.getSource()).isEqualTo("fleet_cve_meta");
    }
}
