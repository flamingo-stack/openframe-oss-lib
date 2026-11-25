package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateHistoryServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Duration RETENTION = DeviceOsUpdateHistoryEntry.RETENTION;

    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @InjectMocks private DeviceOsUpdateHistoryService service;

    private Machine machine;
    private DeviceOsUpdateHistoryEntry halfRetentionAgo;
    private DeviceOsUpdateHistoryEntry aTenthOfRetentionAgo;
    private DeviceOsUpdateHistoryEntry olderThanRetention;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setTenantId(TENANT_ID);
        machine.setMachineId(MACHINE_ID);
        Instant now = Instant.now();
        halfRetentionAgo = historyEntry("kb-older", now.minus(RETENTION.dividedBy(2)));
        aTenthOfRetentionAgo = historyEntry("kb-recent", now.minus(RETENTION.dividedBy(10)));
        olderThanRetention = historyEntry("kb-old", now.minus(RETENTION).minus(Duration.ofMinutes(1)));
    }

    @Test
    void saveMissing_noReportedEntries_repositoryNotTouchedAndNothingReturned() {
        // setup
        List<DeviceOsUpdateHistoryEntry> noEntries = List.of();

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow = service.saveMissing(machine, noEntries);

        // verifications
        assertThat(storedNow).isEmpty();
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void saveMissing_noneStored_everyEntryWithinTheRetentionSavedAndReturnedAsStored() {
        // setup
        List<DeviceOsUpdateHistoryEntry> saved = List.of(stored(halfRetentionAgo), stored(aTenthOfRetentionAgo));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(halfRetentionAgo.getEntryKey(), aTenthOfRetentionAgo.getEntryKey())))
                .thenReturn(List.of());
        when(deviceOsUpdateHistoryRepository.saveAll(List.of(halfRetentionAgo, aTenthOfRetentionAgo))).thenReturn(saved);

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow =
                service.saveMissing(machine, List.of(halfRetentionAgo, aTenthOfRetentionAgo));

        // verifications
        assertThat(storedNow).isEqualTo(saved);
    }

    @Test
    void saveMissing_everyEntryOlderThanTheRetention_repositoryNotTouchedAndNothingReturned() {
        // setup
        List<DeviceOsUpdateHistoryEntry> onlyOld = List.of(olderThanRetention);

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow = service.saveMissing(machine, onlyOld);

        // verifications
        assertThat(storedNow).isEmpty();
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void saveMissing_entryOlderThanTheRetentionBesideARecentOne_onlyTheRecentOneLookedUpSavedAndReturned() {
        // setup
        List<DeviceOsUpdateHistoryEntry> saved = List.of(stored(aTenthOfRetentionAgo));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(aTenthOfRetentionAgo.getEntryKey()))).thenReturn(List.of());
        when(deviceOsUpdateHistoryRepository.saveAll(List.of(aTenthOfRetentionAgo))).thenReturn(saved);

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow =
                service.saveMissing(machine, List.of(olderThanRetention, aTenthOfRetentionAgo));

        // verifications
        assertThat(storedNow).isEqualTo(saved);
    }

    @Test
    void saveMissing_entryInstalledJustInsideTheRetention_saved() {
        // setup
        DeviceOsUpdateHistoryEntry justInside =
                historyEntry("kb-edge", Instant.now().minus(RETENTION).plus(Duration.ofMinutes(1)));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(justInside.getEntryKey()))).thenReturn(List.of());

        // execution
        service.saveMissing(machine, List.of(justInside));

        // verifications
        verify(deviceOsUpdateHistoryRepository).saveAll(List.of(justInside));
    }

    @Test
    void saveMissing_entryInstalledSixtyDaysAgo_saved() {
        // setup
        DeviceOsUpdateHistoryEntry sixtyDaysAgo = historyEntry("kb-60d", Instant.now().minus(Duration.ofDays(60)));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(sixtyDaysAgo.getEntryKey()))).thenReturn(List.of());

        // execution
        service.saveMissing(machine, List.of(sixtyDaysAgo));

        // verifications
        verify(deviceOsUpdateHistoryRepository).saveAll(List.of(sixtyDaysAgo));
    }

    @Test
    void saveMissing_oneEntryAlreadyStored_onlyTheMissingOneSavedAndReturned() {
        // setup
        DeviceOsUpdateHistoryEntry storedEarlier = stored(halfRetentionAgo);
        storedEarlier.setTitle("Stored by an earlier report");
        List<DeviceOsUpdateHistoryEntry> saved = List.of(stored(aTenthOfRetentionAgo));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(halfRetentionAgo.getEntryKey(), aTenthOfRetentionAgo.getEntryKey())))
                .thenReturn(List.of(storedEarlier));
        when(deviceOsUpdateHistoryRepository.saveAll(List.of(aTenthOfRetentionAgo))).thenReturn(saved);

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow =
                service.saveMissing(machine, List.of(halfRetentionAgo, aTenthOfRetentionAgo));

        // verifications
        assertThat(storedNow).isEqualTo(saved);
    }

    @Test
    void saveMissing_everyEntryAlreadyStored_nothingSavedAndNothingReturned() {
        // setup
        List<DeviceOsUpdateHistoryEntry> nothingToSave = List.of();
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(halfRetentionAgo.getEntryKey(), aTenthOfRetentionAgo.getEntryKey())))
                .thenReturn(List.of(stored(halfRetentionAgo), stored(aTenthOfRetentionAgo)));
        when(deviceOsUpdateHistoryRepository.saveAll(nothingToSave)).thenReturn(nothingToSave);

        // execution
        List<DeviceOsUpdateHistoryEntry> storedNow =
                service.saveMissing(machine, List.of(halfRetentionAgo, aTenthOfRetentionAgo));

        // verifications
        assertThat(storedNow).isEmpty();
        verify(deviceOsUpdateHistoryRepository).saveAll(nothingToSave);
    }

    @Test
    void saveMissing_entryOlderThanTheRetentionBesideARecentOne_oneCountedOutsideRetentionAndTheStoredOnesRecorded() {
        // setup
        List<DeviceOsUpdateHistoryEntry> saved = List.of(stored(aTenthOfRetentionAgo));
        when(deviceOsUpdateHistoryRepository.findByTenantIdAndMachineIdAndEntryKeyIn(
                TENANT_ID, MACHINE_ID, List.of(aTenthOfRetentionAgo.getEntryKey()))).thenReturn(List.of());
        when(deviceOsUpdateHistoryRepository.saveAll(List.of(aTenthOfRetentionAgo))).thenReturn(saved);

        // execution
        service.saveMissing(machine, List.of(olderThanRetention, aTenthOfRetentionAgo));

        // verifications
        verify(deviceOsReportMetrics).recordHistoryOutsideRetention(1L);
        verify(deviceOsReportMetrics).recordHistorySaved(saved);
    }

    @Test
    void saveMissing_everyEntryOlderThanTheRetention_countedOutsideRetentionAndNothingRecordedAsSaved() {
        // setup
        List<DeviceOsUpdateHistoryEntry> onlyOld = List.of(olderThanRetention);

        // execution
        service.saveMissing(machine, onlyOld);

        // verifications
        verify(deviceOsReportMetrics).recordHistoryOutsideRetention(1L);
        verify(deviceOsReportMetrics, never()).recordHistorySaved(List.of());
    }

    private static DeviceOsUpdateHistoryEntry stored(DeviceOsUpdateHistoryEntry reported) {
        DeviceOsUpdateHistoryEntry stored = historyEntry(reported.getIdentifier(), reported.getInstalledAt());
        stored.setId("id-of-" + reported.getIdentifier());
        return stored;
    }

    private static DeviceOsUpdateHistoryEntry historyEntry(String identifier, Instant installedAt) {
        return DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(identifier + "|" + installedAt.toEpochMilli() + "|INSTALL")
                .identifier(identifier)
                .installedAt(installedAt)
                .operation(OsUpdateOperation.INSTALL)
                .build();
    }
}
