package com.openframe.client.service.rmm.osupdate;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsStateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String STORED_ID = "6aff19c07ce86a3f0386ff82";
    private static final Long STORED_VERSION = 7L;
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant STORED_RECEIVED_AT = Instant.parse("2026-11-20T03:14:03.120Z");
    private static final Instant REBOOT_PENDING_SINCE = Instant.parse("2026-11-18T07:02:11Z");

    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceOsReportMetrics deviceOsReportMetrics;

    @InjectMocks private DeviceOsStateService service;

    private DeviceOsState reportedState;
    private DeviceOsState storedState;

    @BeforeEach
    void setUp() {
        reportedState = DeviceOsState.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .osBuild("26100.4061")
                .rebootPending(OsRebootPending.YES)
                .receivedAt(RECEIVED_AT)
                .build();
        storedState = DeviceOsState.builder()
                .id(STORED_ID)
                .version(STORED_VERSION)
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .osBuild("26100.3915")
                .osVersion("only in the stored state")
                .receivedAt(STORED_RECEIVED_AT)
                .build();
    }

    @Test
    void saveIfNotOlder_deviceWithoutAState_reportedStateSavedAsNewAndApplied() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        boolean applied = service.saveIfNotOlder(reportedState);

        // verifications
        assertThat(applied).isTrue();
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState)
                .extracting(DeviceOsState::getId, DeviceOsState::getVersion, DeviceOsState::getReceivedAt)
                .containsExactly(null, null, RECEIVED_AT);
    }

    @Test
    void saveIfNotOlder_storedStateOlder_reportedStateSavedWithTheStoredIdAndVersion() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        boolean applied = service.saveIfNotOlder(reportedState);

        // verifications
        assertThat(applied).isTrue();
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState)
                .extracting(DeviceOsState::getId, DeviceOsState::getVersion, DeviceOsState::getReceivedAt,
                        DeviceOsState::getOsBuild, DeviceOsState::getOsVersion)
                .containsExactly(STORED_ID, STORED_VERSION, RECEIVED_AT, "26100.4061", null);
    }

    @Test
    void saveIfNotOlder_storedStateOfTheSameMoment_appliedAgain() {
        // setup
        storedState.setReceivedAt(RECEIVED_AT);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        boolean applied = service.saveIfNotOlder(reportedState);

        // verifications
        assertThat(applied).isTrue();
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState)
                .extracting(DeviceOsState::getId, DeviceOsState::getVersion)
                .containsExactly(STORED_ID, STORED_VERSION);
    }

    @Test
    void saveIfNotOlder_storedStateNewer_nothingSavedAndNotApplied() {
        // setup
        storedState.setReceivedAt(RECEIVED_AT.plusMillis(1));
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        boolean applied = service.saveIfNotOlder(reportedState);

        // verifications
        assertThat(applied).isFalse();
        verify(deviceOsStateRepository, never()).save(reportedState);
        assertThat(reportedState)
                .extracting(DeviceOsState::getId, DeviceOsState::getVersion, DeviceOsState::getRebootPendingSince)
                .containsExactly(null, null, null);
    }

    @Test
    void saveIfNotOlder_deviceWithoutAState_countedAsAFirstReport() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsReportMetrics).recordFirstReport(OsPlatform.WINDOWS);
        verify(deviceOsReportMetrics, never())
                .recordReportInterval(OsPlatform.WINDOWS, STORED_RECEIVED_AT, RECEIVED_AT);
    }

    @Test
    void saveIfNotOlder_storedStateOlder_intervalSinceTheStoredReportRecorded() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsReportMetrics).recordReportInterval(OsPlatform.WINDOWS, STORED_RECEIVED_AT, RECEIVED_AT);
        verify(deviceOsReportMetrics, never()).recordFirstReport(OsPlatform.WINDOWS);
    }

    @Test
    void saveIfNotOlder_storedStateNewer_noMetricRecorded() {
        // setup
        storedState.setReceivedAt(RECEIVED_AT.plusMillis(1));
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verifyNoInteractions(deviceOsReportMetrics);
    }

    @Test
    void saveIfNotOlder_rebootPendingFirstReportedByADeviceWithoutAState_sinceIsTheTimeOfThisReport() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState.getRebootPendingSince()).isEqualTo(RECEIVED_AT);
    }

    @Test
    void saveIfNotOlder_rebootPendingFirstReportedAfterAStateWithoutIt_sinceIsTheTimeOfThisReport() {
        // setup
        storedState.setRebootPending(OsRebootPending.NO);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState.getRebootPendingSince()).isEqualTo(RECEIVED_AT);
    }

    @Test
    void saveIfNotOlder_rebootStillPending_sinceOfTheStoredStateKept() {
        // setup
        storedState.setRebootPending(OsRebootPending.YES);
        storedState.setRebootPendingSince(REBOOT_PENDING_SINCE);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState.getRebootPendingSince()).isEqualTo(REBOOT_PENDING_SINCE);
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = OsRebootPending.class, names = {"NO", "UNKNOWN"})
    void saveIfNotOlder_rebootNoLongerReportedAsPending_sinceCleared(OsRebootPending rebootPending) {
        // setup
        reportedState.setRebootPending(rebootPending);
        reportedState.setRebootPendingSince(RECEIVED_AT);
        storedState.setRebootPending(OsRebootPending.YES);
        storedState.setRebootPendingSince(REBOOT_PENDING_SINCE);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState.getRebootPendingSince()).isNull();
    }

    @ParameterizedTest
    @NullSource
    @EnumSource(value = OsRebootPending.class, names = {"NO", "UNKNOWN"})
    void saveIfNotOlder_firstReportWithoutAPendingReboot_noSince(OsRebootPending rebootPending) {
        // setup
        reportedState.setRebootPending(rebootPending);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        service.saveIfNotOlder(reportedState);

        // verifications
        verify(deviceOsStateRepository).save(reportedState);
        assertThat(reportedState.getRebootPendingSince()).isNull();
    }

    @Test
    void saveIfNotOlder_storedStateReplacedByAnotherReportMeanwhile_optimisticLockingFailurePropagates() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(storedState));
        when(deviceOsStateRepository.save(reportedState))
                .thenThrow(new OptimisticLockingFailureException("state was replaced meanwhile"));

        // execution
        OptimisticLockingFailureException ex =
                assertThrows(OptimisticLockingFailureException.class, () -> service.saveIfNotOlder(reportedState));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("state was replaced meanwhile");
    }

    @Test
    void saveIfNotOlder_firstStateInsertedByAnotherReportMeanwhile_duplicateKeyPropagates() {
        // setup
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());
        when(deviceOsStateRepository.save(reportedState)).thenThrow(new DuplicateKeyException("tenant_machine"));

        // execution
        DuplicateKeyException ex =
                assertThrows(DuplicateKeyException.class, () -> service.saveIfNotOlder(reportedState));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("tenant_machine");
    }
}
