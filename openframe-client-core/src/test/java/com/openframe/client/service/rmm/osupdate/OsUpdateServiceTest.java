package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
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
