package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsPendingUpdateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant DISCOVERED_AT = Instant.parse("2026-11-18T07:02:11Z");
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");

    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @InjectMocks private DeviceOsPendingUpdateService service;

    private Machine machine;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setTenantId(TENANT_ID);
        machine.setMachineId(MACHINE_ID);
    }

    @Test
    void replacePendingUpdates_nothingStored_everyReportedUpdateSavedAsItCame() {
        // setup
        List<DeviceOsPendingUpdate> reported = List.of(reported("kb-1"), reported("kb-2"));
        List<DeviceOsPendingUpdate> expectedSaved = List.of(reported("kb-1"), reported("kb-2"));
        stubStored(List.of());

        // execution
        service.replacePendingUpdates(machine, reported);

        // verifications
        verify(deviceOsPendingUpdateRepository).deleteAll(List.of());
        verify(deviceOsPendingUpdateRepository).saveAll(expectedSaved);
    }

    @Test
    void replacePendingUpdates_storedUpdateReportedAgainUnchanged_notWrittenAtAll() {
        // setup
        stubStored(List.of(stored("id-1", "kb-1")));

        // execution
        service.replacePendingUpdates(machine, List.of(reported("kb-1")));

        // verifications
        verify(deviceOsPendingUpdateRepository).deleteAll(List.of());
        verify(deviceOsPendingUpdateRepository).saveAll(List.of());
    }

    @Test
    void replacePendingUpdates_storedUpdateNoLongerReported_deletedAndNothingSaved() {
        // setup
        DeviceOsPendingUpdate gone = stored("id-2", "kb-2");
        stubStored(List.of(stored("id-1", "kb-1"), gone));

        // execution
        service.replacePendingUpdates(machine, List.of(reported("kb-1")));

        // verifications
        verify(deviceOsPendingUpdateRepository).deleteAll(List.of(gone));
        verify(deviceOsPendingUpdateRepository).saveAll(List.of());
    }

    @Test
    void replacePendingUpdates_deviceReportsAnEmptyList_everyStoredUpdateDeleted() {
        // setup
        List<DeviceOsPendingUpdate> stored = List.of(stored("id-1", "kb-1"), stored("id-2", "kb-2"));
        List<DeviceOsPendingUpdate> nothingReported = List.of();
        stubStored(stored);

        // execution
        service.replacePendingUpdates(machine, nothingReported);

        // verifications
        verify(deviceOsPendingUpdateRepository).deleteAll(stored);
        verify(deviceOsPendingUpdateRepository).saveAll(List.of());
    }

    @Test
    void replacePendingUpdates_storedUpdateReportedWithOtherValues_savedUnderTheStoredIdWithTheStoredDiscoveredAt() {
        // setup
        DeviceOsPendingUpdate changed = reported("kb-1");
        changed.setDownloaded(true);
        changed.setMacosPresence(MacosUpdatePresence.HELD_OVER);
        DeviceOsPendingUpdate expectedSaved = stored("id-1", "kb-1");
        expectedSaved.setDownloaded(true);
        expectedSaved.setMacosPresence(MacosUpdatePresence.HELD_OVER);
        stubStored(List.of(stored("id-1", "kb-1")));

        // execution
        service.replacePendingUpdates(machine, List.of(changed));

        // verifications
        verify(deviceOsPendingUpdateRepository).deleteAll(List.of());
        verify(deviceOsPendingUpdateRepository).saveAll(List.of(expectedSaved));
    }

    @Test
    void replacePendingUpdates_storedUpdateThatLostAValue_savedWithoutIt() {
        // setup
        DeviceOsPendingUpdate storedDownloaded = stored("id-1", "kb-1");
        storedDownloaded.setDownloaded(true);
        DeviceOsPendingUpdate expectedSaved = stored("id-1", "kb-1");
        stubStored(List.of(storedDownloaded));

        // execution
        service.replacePendingUpdates(machine, List.of(reported("kb-1")));

        // verifications
        verify(deviceOsPendingUpdateRepository).saveAll(List.of(expectedSaved));
    }

    @Test
    void replacePendingUpdates_removedNewChangedAndUnchangedInOneReport_goneDeletedFirstThenOnlyNewAndChangedSaved() {
        // setup
        DeviceOsPendingUpdate gone = stored("id-gone", "kb-gone");
        DeviceOsPendingUpdate changed = reported("kb-changed");
        changed.setDownloaded(true);
        DeviceOsPendingUpdate expectedChanged = stored("id-changed", "kb-changed");
        expectedChanged.setDownloaded(true);
        DeviceOsPendingUpdate expectedNew = reported("kb-new");
        List<DeviceOsPendingUpdate> reported = List.of(reported("kb-unchanged"), changed, reported("kb-new"));
        stubStored(List.of(gone, stored("id-unchanged", "kb-unchanged"), stored("id-changed", "kb-changed")));
        InOrder inOrder = inOrder(deviceOsPendingUpdateRepository);

        // execution
        service.replacePendingUpdates(machine, reported);

        // verifications
        inOrder.verify(deviceOsPendingUpdateRepository).deleteAll(List.of(gone));
        inOrder.verify(deviceOsPendingUpdateRepository).saveAll(List.of(expectedChanged, expectedNew));
    }

    @Test
    void replacePendingUpdates_twoNewOneChangedOneRemovedOneUnchanged_writtenCountsRecordedPerKind() {
        // setup
        DeviceOsPendingUpdate changed = reported("kb-changed");
        changed.setDownloaded(true);
        List<DeviceOsPendingUpdate> reported =
                List.of(reported("kb-unchanged"), changed, reported("kb-new-1"), reported("kb-new-2"));
        stubStored(List.of(
                stored("id-gone", "kb-gone"),
                stored("id-unchanged", "kb-unchanged"),
                stored("id-changed", "kb-changed")));

        // execution
        service.replacePendingUpdates(machine, reported);

        // verifications
        verify(deviceOsReportMetrics).recordPendingUpdatesWritten(2L, 1L, 1L);
    }

    @Test
    void replacePendingUpdates_storedUpdateReportedAgainUnchanged_zeroCountsRecorded() {
        // setup
        List<DeviceOsPendingUpdate> reported = List.of(reported("kb-1"));
        stubStored(List.of(stored("id-1", "kb-1")));

        // execution
        service.replacePendingUpdates(machine, reported);

        // verifications
        verify(deviceOsReportMetrics).recordPendingUpdatesWritten(0L, 0L, 0L);
    }

    private void stubStored(List<DeviceOsPendingUpdate> stored) {
        when(deviceOsPendingUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(
                TENANT_ID, MACHINE_ID)).thenReturn(stored);
    }

    private static DeviceOsPendingUpdate reported(String identifier) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .discoveredAt(RECEIVED_AT)
                .build();
    }

    private static DeviceOsPendingUpdate stored(String id, String identifier) {
        return DeviceOsPendingUpdate.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .discoveredAt(DISCOVERED_AT)
                .build();
    }
}
