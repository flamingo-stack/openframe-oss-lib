package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.connector.ConnectorBackfill;
import com.openframe.data.document.connector.ConnectorBackfillStatus;
import com.openframe.data.document.connector.ConnectorCheckpoint;
import com.openframe.data.repository.connector.ConnectorBackfillRepository;
import com.openframe.data.repository.connector.ConnectorCheckpointRepository;
import com.openframe.debezium.dto.ConnectorOffsets;
import com.openframe.debezium.dto.ConnectorStatus;
import com.openframe.debezium.service.DebeziumService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConnectorRecreatorTest {

    private static final String BASE = "shared-meshcentral-mongo-connector";
    private static final String OLD_NAME = BASE + "_v1";
    private static final String NEW_NAME = BASE + "_v2";
    private static final Instant LAST_SOURCE_TIME = Instant.parse("2026-10-13T09:00:00Z");
    private static final Duration MARGIN = Duration.ofMinutes(5);
    private static final Duration FALLBACK_LOOKBACK = Duration.ofHours(12);
    private static final Duration CHECKPOINT_MAX_AGE = Duration.ofDays(7);
    private static final Map<String, Object> CONFIG =
            Map.of("connector.class", "io.debezium.connector.mongodb.MongoDbConnector", "snapshot.mode", "no_data");
    private static final Map<String, Object> SPEC = Map.of("name", BASE, "config", CONFIG);

    @Mock private DebeziumService debeziumService;
    @Mock private SourceDialects sourceDialects;
    @Mock private SourceDialect sourceDialect;
    @Mock private ConnectorCheckpointRepository checkpointRepository;
    @Mock private ConnectorBackfillRepository backfillRepository;
    @Mock private UnfilledGapAlerts gapAlerts;

    @Captor private ArgumentCaptor<ConnectorBackfill> backfillCaptor;
    @Captor private ArgumentCaptor<ConnectorOffsets> offsetsCaptor;
    @Captor private ArgumentCaptor<Instant> instantCaptor;

    private ConnectorRecreator recreator;
    private ConnectorOffsets offsets;

    @BeforeEach
    void setUp() {
        GapRecoveryProperties properties = new GapRecoveryProperties();
        properties.setMargin(MARGIN);
        properties.setFallbackLookback(FALLBACK_LOOKBACK);
        properties.setCheckpointMaxAge(CHECKPOINT_MAX_AGE);
        recreator = new ConnectorRecreator(debeziumService, sourceDialects, checkpointRepository, backfillRepository, properties, gapAlerts);
        Map<String, Object> entry = Map.of("partition", Map.of("server_id", "shared.meshcentral"), "offset", Map.of("sec", 1L));
        offsets = new ConnectorOffsets(List.of(entry));
    }

    @Test
    void recreate_offsetsKnown_handedOverWithoutBackfill() {
        // setup
        when(debeziumService.recreationConfig(CONFIG)).thenReturn(CONFIG);
        RecreationRequest request = request(offsets, false);

        // execution
        recreator.recreate(request);

        // verifications
        verify(debeziumService).createStoppedConnector(NEW_NAME, CONFIG);
        verify(debeziumService).alterConnectorOffsets(NEW_NAME, offsets);
        verify(debeziumService).resumeConnector(NEW_NAME);
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
        verifyNoInteractions(sourceDialects);
    }

    @Test
    void isHistoryLost_dialectsRecogniseTrace_true() {
        // setup
        ConnectorStatus status = new ConnectorStatus();
        when(sourceDialects.isHistoryLost(List.of())).thenReturn(true);

        // execution
        boolean historyLost = recreator.isHistoryLost(status);

        // verifications
        assertThat(historyLost).isTrue();
    }

    @Test
    void recreate_historyLost_createdFreshAndBackfillFromLastSourceTimeMinusMargin() {
        // setup
        stubDialect();
        when(sourceDialect.hasSourceTime(offsets)).thenReturn(true);
        when(sourceDialect.sourceTime(offsets)).thenReturn(LAST_SOURCE_TIME);
        RecreationRequest request = request(offsets, true);

        // execution
        recreator.recreate(request);

        // verifications
        verify(debeziumService).createConnector(NEW_NAME, CONFIG);
        verify(debeziumService, never()).createStoppedConnector(NEW_NAME, CONFIG);
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue())
                .extracting(ConnectorBackfill::getBaseName, ConnectorBackfill::getConnectorName,
                        ConnectorBackfill::getGapFrom, ConnectorBackfill::getStatus)
                .containsExactly(BASE, NEW_NAME, LAST_SOURCE_TIME.minus(MARGIN), ConnectorBackfillStatus.PENDING);
    }

    @Test
    void recreate_noOffsetsKnown_backfillFromFallbackLookback() {
        // setup
        stubDialect();
        ConnectorOffsets none = ConnectorOffsets.empty();
        when(sourceDialect.hasSourceTime(none)).thenReturn(false);
        RecreationRequest request = request(none, false);
        Instant expectedGapFrom = Instant.now().minus(FALLBACK_LOOKBACK);

        // execution
        recreator.recreate(request);

        // verifications
        verify(debeziumService).createConnector(NEW_NAME, CONFIG);
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue().getGapFrom()).isCloseTo(expectedGapFrom, within(5, ChronoUnit.SECONDS));
    }

    @Test
    void recreate_offsetAlterRejected_resumedAndBackfillScheduled() {
        // setup
        stubDialect();
        when(sourceDialect.hasSourceTime(offsets)).thenReturn(true);
        when(sourceDialect.sourceTime(offsets)).thenReturn(LAST_SOURCE_TIME);
        doThrow(new HttpClientErrorException(HttpStatus.BAD_REQUEST))
                .when(debeziumService).alterConnectorOffsets(NEW_NAME, offsets);
        RecreationRequest request = request(offsets, false);

        // execution
        recreator.recreate(request);

        // verifications
        verify(debeziumService).resumeConnector(NEW_NAME);
        verify(backfillRepository).save(backfillCaptor.capture());
        assertThat(backfillCaptor.getValue().getGapFrom()).isEqualTo(LAST_SOURCE_TIME.minus(MARGIN));
    }

    @Test
    void recreate_historyLostOnUnsupportedSource_createdWithoutBackfillAndGapAlerted() {
        // setup
        when(debeziumService.recreationConfig(CONFIG)).thenReturn(CONFIG);
        when(sourceDialects.supports(CONFIG)).thenReturn(false);
        RecreationRequest request = request(offsets, true);
        Instant expectedGapFrom = Instant.now().minus(FALLBACK_LOOKBACK);

        // execution
        recreator.recreate(request);

        // verifications
        verify(debeziumService).createConnector(NEW_NAME, CONFIG);
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
        verify(gapAlerts).raise(eq(NEW_NAME), instantCaptor.capture(), eq("No source dialect for the connector class"));
        assertThat(instantCaptor.getValue()).isCloseTo(expectedGapFrom, within(5, ChronoUnit.SECONDS));
    }

    @Test
    void recreate_resumeAfterHandoverFails_newVersionDeletedAndErrorRaised() {
        // setup
        when(debeziumService.recreationConfig(CONFIG)).thenReturn(CONFIG);
        doThrow(new HttpClientErrorException(HttpStatus.CONFLICT)).when(debeziumService).resumeConnector(NEW_NAME);
        RecreationRequest request = request(offsets, false);

        // execution
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> recreator.recreate(request));

        // verifications
        assertThat(ex.getMessage()).contains("Failed to resume handed-over connector " + NEW_NAME);
        verify(debeziumService).deleteConnector(NEW_NAME);
        verify(backfillRepository, never()).save(any(ConnectorBackfill.class));
    }

    @Test
    void isHistoryLost_dialectsDoNotRecogniseTrace_false() {
        // setup
        ConnectorStatus status = new ConnectorStatus();
        when(sourceDialects.isHistoryLost(List.of())).thenReturn(false);

        // execution
        boolean historyLost = recreator.isHistoryLost(status);

        // verifications
        assertThat(historyLost).isFalse();
    }

    @Test
    void lastKnownOffsets_liveOffsetsPresent_liveReturned() {
        // setup
        when(debeziumService.getConnectorOffsets(OLD_NAME)).thenReturn(offsets);

        // execution
        ConnectorOffsets result = recreator.lastKnownOffsets(BASE, OLD_NAME);

        // verifications
        assertThat(result).isSameAs(offsets);
        verify(checkpointRepository, never()).findById(BASE);
    }

    @Test
    void lastKnownOffsets_liveOffsetsEmpty_checkpointReturned() {
        // setup
        when(debeziumService.getConnectorOffsets(OLD_NAME)).thenReturn(ConnectorOffsets.empty());
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.of(checkpoint(Instant.now())));

        // execution
        ConnectorOffsets result = recreator.lastKnownOffsets(BASE, OLD_NAME);

        // verifications
        assertThat(result.getOffsets()).isEqualTo(offsets.getOffsets());
    }

    @Test
    void lastKnownOffsets_noLiveOffsetsNoCheckpoint_empty() {
        // setup
        when(debeziumService.getConnectorOffsets(OLD_NAME)).thenReturn(ConnectorOffsets.empty());
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.empty());

        // execution
        ConnectorOffsets result = recreator.lastKnownOffsets(BASE, OLD_NAME);

        // verifications
        assertThat(result.isEmpty()).isTrue();
    }

    @Test
    void hasFreshCheckpoint_capturedWithinMaxAge_true() {
        // setup
        Instant capturedAt = Instant.now().minus(Duration.ofDays(1));
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.of(checkpoint(capturedAt)));

        // execution
        boolean fresh = recreator.hasFreshCheckpoint(BASE);

        // verifications
        assertThat(fresh).isTrue();
    }

    @Test
    void hasFreshCheckpoint_capturedBeyondMaxAge_false() {
        // setup
        Instant capturedAt = Instant.now().minus(Duration.ofDays(8));
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.of(checkpoint(capturedAt)));

        // execution
        boolean fresh = recreator.hasFreshCheckpoint(BASE);

        // verifications
        assertThat(fresh).isFalse();
    }

    @Test
    void hasFreshCheckpoint_noCheckpoint_false() {
        // setup
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.empty());

        // execution
        boolean fresh = recreator.hasFreshCheckpoint(BASE);

        // verifications
        assertThat(fresh).isFalse();
    }

    @Test
    void restoreFromCheckpoint_checkpointPresent_handedOverFromCheckpointOffsets() {
        // setup
        when(checkpointRepository.findById(BASE)).thenReturn(Optional.of(checkpoint(Instant.now())));
        when(debeziumService.recreationConfig(CONFIG)).thenReturn(CONFIG);

        // execution
        recreator.restoreFromCheckpoint(BASE, NEW_NAME, SPEC);

        // verifications
        verify(debeziumService).createStoppedConnector(NEW_NAME, CONFIG);
        verify(debeziumService).alterConnectorOffsets(eq(NEW_NAME), offsetsCaptor.capture());
        assertThat(offsetsCaptor.getValue().getOffsets()).isEqualTo(offsets.getOffsets());
        verify(debeziumService).resumeConnector(NEW_NAME);
    }

    private void stubDialect() {
        when(debeziumService.recreationConfig(CONFIG)).thenReturn(CONFIG);
        when(sourceDialects.supports(CONFIG)).thenReturn(true);
        when(sourceDialects.dialectFor(CONFIG)).thenReturn(sourceDialect);
    }

    private RecreationRequest request(ConnectorOffsets lastKnown, boolean discardOffsets) {
        return RecreationRequest.builder()
                .baseName(BASE)
                .newName(NEW_NAME)
                .spec(SPEC)
                .lastKnownOffsets(lastKnown)
                .discardOffsets(discardOffsets)
                .build();
    }

    private ConnectorCheckpoint checkpoint(Instant capturedAt) {
        return ConnectorCheckpoint.builder()
                .baseName(BASE)
                .connectorName(OLD_NAME)
                .offsets(offsets.getOffsets())
                .capturedAt(capturedAt)
                .build();
    }
}
