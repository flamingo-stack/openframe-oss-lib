package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.client.metrics.OsUpdateEnrichmentMetrics;
import com.openframe.client.service.rmm.osupdate.enrichment.OsUpdateEnricher;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");

    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private OsUpdateClassifier osUpdateClassifier;
    @Mock private StoredOsUpdateRefresher storedOsUpdateRefresher;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;
    @Mock private ObjectProvider<OsUpdateEnricher> osUpdateEnrichers;
    @Mock private OsUpdateEnrichmentMetrics osUpdateEnrichmentMetrics;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private OsUpdateEnricher windowsOsUpdateEnricher;

    @Captor private ArgumentCaptor<OsUpdate> osUpdateCaptor;

    @InjectMocks private OsUpdateService service;

    private OsUpdate first;
    private OsUpdate second;
    private OsUpdate third;

    @BeforeEach
    void setUp() {
        first = osUpdate("kb-1", "First update");
        second = osUpdate("kb-2", "Second update");
        third = osUpdate("kb-3", "Third update");
    }

    @Test
    void saveReported_noReportedUpdates_repositoryNotTouched() {
        // setup
        List<OsUpdate> noUpdates = List.of();

        // execution
        service.saveReported(noUpdates);

        // verifications
        verifyNoInteractions(osUpdateRepository);
    }

    @Test
    void saveReported_noneStored_everyReportedUpdateSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());

        // execution
        service.saveReported(List.of(first, second));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(second);
    }

    @Test
    void saveReported_missingUpdate_savedWithTheClassificationOfTheClassifier() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());
        when(osUpdateClassifier.classify(first)).thenReturn(OsUpdateClassification.SECURITY);
        when(osUpdateClassifier.classify(second)).thenReturn(OsUpdateClassification.DRIVER);

        // execution
        service.saveReported(List.of(first, second));

        // verifications
        verify(osUpdateRepository, times(2)).save(osUpdateCaptor.capture());
        assertThat(osUpdateCaptor.getAllValues())
                .extracting(OsUpdate::getIdentifier, OsUpdate::getClassification)
                .containsExactly(tuple("kb-1", OsUpdateClassification.SECURITY), tuple("kb-2", OsUpdateClassification.DRIVER));
    }

    @Test
    void saveReported_storedUpdateTheRefresherLeavesUnchanged_notSavedAndNotCounted() {
        // setup
        OsUpdate storedFirst = osUpdate("kb-1", "Described by an earlier report");
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1"))).thenReturn(List.of(storedFirst));
        when(storedOsUpdateRefresher.refresh(storedFirst, first)).thenReturn(false);

        // execution
        service.saveReported(List.of(first));

        // verifications
        verify(osUpdateRepository, never()).saveAll(anyList());
        verify(osUpdateRepository, never()).save(any());
        verifyNoInteractions(deviceOsReportMetrics, osUpdateClassifier);
    }

    @Test
    void saveReported_storedUpdatesTheRefresherChanged_onlyTheChangedSavedTogetherAndCountedAsReclassified() {
        // setup
        OsUpdate storedFirst = osUpdate("kb-1", "Described by an earlier report");
        OsUpdate storedSecond = osUpdate("kb-2", "Described by an earlier report");
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2", "kb-3")))
                .thenReturn(List.of(storedFirst, storedSecond));
        when(storedOsUpdateRefresher.refresh(storedFirst, first)).thenReturn(true);
        when(storedOsUpdateRefresher.refresh(storedSecond, second)).thenReturn(false);

        // execution
        service.saveReported(List.of(first, second, third));

        // verifications
        verify(osUpdateRepository).saveAll(List.of(storedFirst));
        verify(osUpdateRepository).save(third);
        verify(deviceOsReportMetrics).recordOsUpdateReclassified(OsPlatform.WINDOWS);
    }

    @Test
    void saveReported_sameStoredUpdateTwiceInOneReport_savedOnce() {
        // setup
        OsUpdate storedFirst = osUpdate("kb-1", "Described by an earlier report");
        OsUpdate firstAgain = osUpdate("kb-1", "First update");
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-1"))).thenReturn(List.of(storedFirst));
        when(storedOsUpdateRefresher.refresh(storedFirst, first)).thenReturn(true);

        // execution
        service.saveReported(List.of(first, firstAgain));

        // verifications
        verify(osUpdateRepository).saveAll(List.of(storedFirst));
    }

    @Test
    void saveReported_oneAlreadyStored_onlyTheMissingOnesSavedAndTheStoredOneNotRewritten() {
        // setup
        OsUpdate storedSecond = osUpdate("kb-2", "Described by an earlier report");
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2", "kb-3"))).thenReturn(List.of(storedSecond));

        // execution
        service.saveReported(List.of(first, second, third));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(third);
        verify(osUpdateRepository, never()).save(second);
        verify(osUpdateRepository, never()).save(storedSecond);
    }

    @Test
    void saveReported_everyUpdateAlreadyStored_nothingSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of(first, second));

        // execution
        service.saveReported(List.of(first, second));

        // verifications
        verify(osUpdateRepository, never()).save(first);
        verify(osUpdateRepository, never()).save(second);
    }

    @Test
    void saveReported_macUpdates_storedOnesLookedUpOnTheirOwnPlatform() {
        // setup
        first.setPlatform(OsPlatform.MACOS);
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.MACOS, List.of("kb-1")))
                .thenReturn(List.of());

        // execution
        service.saveReported(List.of(first));

        // verifications
        verify(osUpdateRepository).save(first);
    }

    @Test
    void saveReported_oneUpdateStoredByAnotherDeviceMeanwhile_duplicateKeySwallowedAndTheOthersStillSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2", "kb-3"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));
        when(osUpdateRepository.save(second)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));

        // execution
        service.saveReported(List.of(first, second, third));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(second);
        verify(osUpdateRepository).save(third);
    }

    @Test
    void saveReported_saveFailsForAnotherReason_failurePropagatesSoTheReportIsDeliveredAgain() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DataAccessResourceFailureException("mongo is away"));
        List<OsUpdate> reported = List.of(first, second);

        // execution
        DataAccessResourceFailureException ex =
                assertThrows(DataAccessResourceFailureException.class, () -> service.saveReported(reported));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("mongo is away");
        verify(osUpdateRepository, never()).save(second);
    }

    @Test
    void saveReported_twoUpdatesSaved_eachCountedOnItsPlatform() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());

        // execution
        service.saveReported(List.of(first, second));

        // verifications
        verify(deviceOsReportMetrics, times(2)).recordOsUpdateSaved(OsPlatform.WINDOWS);
    }

    @Test
    void saveReported_updateStoredByAnotherDeviceMeanwhile_notCountedAsSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));

        // execution
        service.saveReported(List.of(first));

        // verifications
        verifyNoInteractions(deviceOsReportMetrics);
    }

    private static final Instant ENRICHED_BEFORE = Instant.parse("2026-11-24T10:25:00Z");

    @Test
    void enrichNotEnrichedSince_windowsAndMac_windowsEnrichedMacCheckedBothSaved() {
        // setup
        OsUpdate windows = osUpdate("kb-1", "2026-11 Cumulative Update");
        OsUpdate mac = osUpdate("mac-1", "macOS Tahoe 26.2");
        mac.setPlatform(OsPlatform.MACOS);
        givenStale(windows, mac);
        when(windowsOsUpdateEnricher.applicableTo(any())).thenAnswer(invocation ->
                invocation.<OsUpdate>getArgument(0).getPlatform() == OsPlatform.WINDOWS);
        doAnswer(invocation -> {
            invocation.<List<OsUpdate>>getArgument(0).forEach(osUpdate -> {
                osUpdate.setCvssScore(9.8);
                osUpdate.setEnrichedAt(invocation.getArgument(1));
            });
            return null;
        }).when(windowsOsUpdateEnricher).enrich(anyList(), any());

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 500);

        // verifications
        verify(windowsOsUpdateEnricher).enrich(eq(List.of(windows)), any());
        verify(osUpdateRepository).save(windows);
        verify(osUpdateRepository).save(mac);
        assertThat(windows.getCvssScore()).isEqualTo(9.8);
        assertThat(mac.getEnrichedAt()).isNotNull().isEqualTo(windows.getEnrichedAt());
        verify(osUpdateEnrichmentMetrics).recordNoData(OsPlatform.MACOS);
    }

    @Test
    void enrichNotEnrichedSince_sourceDown_uncheckedUpdatesNotSaved() {
        // setup
        OsUpdate windows = osUpdate("kb-1", "2026-11 Cumulative Update");
        givenStale(windows);
        when(windowsOsUpdateEnricher.applicableTo(windows)).thenReturn(true);

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 500);

        // verifications
        verify(osUpdateRepository, never()).save(any());
        assertThat(windows.getEnrichedAt()).isNull();
    }

    @Test
    void enrichNotEnrichedSince_enricherThrows_updatesLeftForTheNextRun() {
        // setup
        OsUpdate windows = osUpdate("kb-1", "2026-11 Cumulative Update");
        OsUpdate mac = osUpdate("mac-1", "macOS Tahoe 26.2");
        mac.setPlatform(OsPlatform.MACOS);
        givenStale(windows, mac);
        when(windowsOsUpdateEnricher.applicableTo(any())).thenAnswer(invocation ->
                invocation.<OsUpdate>getArgument(0).getPlatform() == OsPlatform.WINDOWS);
        doAnswer(invocation -> {
            invocation.<List<OsUpdate>>getArgument(0).forEach(osUpdate -> osUpdate.setEnrichedAt(invocation.getArgument(1)));
            throw new IllegalStateException("bug");
        }).when(windowsOsUpdateEnricher).enrich(anyList(), any());

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 500);

        // verifications
        verify(osUpdateRepository).save(mac);
        verify(osUpdateRepository, never()).save(windows);
        assertThat(windows.getEnrichedAt()).isNull();
    }

    @Test
    void enrichNotEnrichedSince_nothingStale_nothingSaved() {
        // setup
        givenStale();

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 500);

        // verifications
        verify(osUpdateRepository, never()).save(any());
        verify(osUpdateEnrichmentMetrics).recordRun(any());
    }

    @Test
    void enrichNotEnrichedSince_entryChangedMeanwhile_skippedOthersSaved() {
        // setup
        OsUpdate changed = osUpdate("kb-1", "Changed by a report");
        changed.setPlatform(OsPlatform.MACOS);
        OsUpdate unchanged = osUpdate("kb-2", "Unchanged");
        unchanged.setPlatform(OsPlatform.MACOS);
        givenStale(changed, unchanged);
        when(osUpdateRepository.save(changed)).thenThrow(new OptimisticLockingFailureException("changed"));

        // execution
        service.enrichNotEnrichedSince(ENRICHED_BEFORE, 500);

        // verifications
        verify(osUpdateRepository).save(unchanged);
    }

    private void givenStale(OsUpdate... staleOsUpdates) {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findEnrichedBefore(TENANT_ID, ENRICHED_BEFORE, PageRequest.of(0, 500)))
                .thenReturn(List.of(staleOsUpdates));
        when(osUpdateEnrichers.orderedStream()).thenAnswer(invocation -> Stream.of(windowsOsUpdateEnricher));
    }

    private static OsUpdate osUpdate(String identifier, String displayName) {
        return OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .displayName(displayName)
                .firstSeenAt(RECEIVED_AT)
                .build();
    }
}
