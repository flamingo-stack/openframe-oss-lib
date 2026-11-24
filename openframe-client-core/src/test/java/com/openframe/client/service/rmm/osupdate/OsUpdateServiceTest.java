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
    void saveMissing_noReportedUpdates_repositoryNotTouched() {
        // setup
        List<OsUpdate> noUpdates = List.of();

        // execution
        service.saveMissing(noUpdates);

        // verifications
        verifyNoInteractions(osUpdateRepository);
    }

    @Test
    void saveMissing_noneStored_everyReportedUpdateSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());

        // execution
        service.saveMissing(List.of(first, second));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(second);
    }

    @Test
    void saveMissing_missingUpdate_savedWithTheClassificationOfTheClassifier() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());
        when(osUpdateClassifier.classify(first)).thenReturn(OsUpdateClassification.SECURITY);
        when(osUpdateClassifier.classify(second)).thenReturn(OsUpdateClassification.DRIVER);

        // execution
        service.saveMissing(List.of(first, second));

        // verifications
        verify(osUpdateRepository, times(2)).save(osUpdateCaptor.capture());
        assertThat(osUpdateCaptor.getAllValues())
                .extracting(OsUpdate::getIdentifier, OsUpdate::getClassification)
                .containsExactly(tuple("kb-1", OsUpdateClassification.SECURITY), tuple("kb-2", OsUpdateClassification.DRIVER));
    }

    @Test
    void saveMissing_updateAlreadyStored_notClassifiedAgain() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1"))).thenReturn(List.of(first));

        // execution
        service.saveMissing(List.of(first));

        // verifications
        verifyNoInteractions(osUpdateClassifier);
    }

    @Test
    void saveMissing_oneAlreadyStored_onlyTheMissingOnesSavedAndTheStoredOneNotRewritten() {
        // setup
        OsUpdate storedSecond = osUpdate("kb-2", "Described by an earlier report");
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2", "kb-3"))).thenReturn(List.of(storedSecond));

        // execution
        service.saveMissing(List.of(first, second, third));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(third);
        verify(osUpdateRepository, never()).save(second);
        verify(osUpdateRepository, never()).save(storedSecond);
    }

    @Test
    void saveMissing_everyUpdateAlreadyStored_nothingSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of(first, second));

        // execution
        service.saveMissing(List.of(first, second));

        // verifications
        verify(osUpdateRepository, never()).save(first);
        verify(osUpdateRepository, never()).save(second);
    }

    @Test
    void saveMissing_macUpdates_storedOnesLookedUpOnTheirOwnPlatform() {
        // setup
        first.setPlatform(OsPlatform.MACOS);
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.MACOS, List.of("kb-1")))
                .thenReturn(List.of());

        // execution
        service.saveMissing(List.of(first));

        // verifications
        verify(osUpdateRepository).save(first);
    }

    @Test
    void saveMissing_oneUpdateStoredByAnotherDeviceMeanwhile_duplicateKeySwallowedAndTheOthersStillSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2", "kb-3"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));
        when(osUpdateRepository.save(second)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));

        // execution
        service.saveMissing(List.of(first, second, third));

        // verifications
        verify(osUpdateRepository).save(first);
        verify(osUpdateRepository).save(second);
        verify(osUpdateRepository).save(third);
    }

    @Test
    void saveMissing_saveFailsForAnotherReason_failurePropagatesSoTheReportIsDeliveredAgain() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DataAccessResourceFailureException("mongo is away"));
        List<OsUpdate> reported = List.of(first, second);

        // execution
        DataAccessResourceFailureException ex =
                assertThrows(DataAccessResourceFailureException.class, () -> service.saveMissing(reported));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("mongo is away");
        verify(osUpdateRepository, never()).save(second);
    }

    @Test
    void saveMissing_twoUpdatesSaved_eachCountedOnItsPlatform() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1", "kb-2"))).thenReturn(List.of());

        // execution
        service.saveMissing(List.of(first, second));

        // verifications
        verify(deviceOsReportMetrics, times(2)).recordOsUpdateSaved(OsPlatform.WINDOWS);
    }

    @Test
    void saveMissing_updateStoredByAnotherDeviceMeanwhile_notCountedAsSaved() {
        // setup
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1"))).thenReturn(List.of());
        when(osUpdateRepository.save(first)).thenThrow(new DuplicateKeyException("tenant_platform_identifier"));

        // execution
        service.saveMissing(List.of(first));

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
