package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionDetailServiceTest {

    private static final String TENANT = "t1";
    private static final String EXEC = "exec-1";

    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private SoftwareBundleOnlineDispatchRepository bundleOnlineDispatchRepository;
    @Mock private SoftwareScheduleOnlineDispatchRepository scheduleOnlineDispatchRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareActionDetailService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareActionDetailService(scriptExecutionRepository,
                bundleOnlineDispatchRepository, scheduleOnlineDispatchRepository, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    @DisplayName("NOW: executed leaves map their status, offline NEW sentinels become SCHEDULED, executed wins")
    void bundleDevices() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("m-success", ExecutionStatus.SUCCESS),
                leaf("m-running", ExecutionStatus.RUNNING)));
        when(bundleOnlineDispatchRepository.findByTenantIdAndBundleId(TENANT, "b1")).thenReturn(List.of(
                bundleSentinel("m-success", DeviceOnlineDispatchStatus.DISPATCHED), // already has a leaf → ignored
                bundleSentinel("m-offline", DeviceOnlineDispatchStatus.NEW),        // still waiting → SCHEDULED
                bundleSentinel("m-skipped", DeviceOnlineDispatchStatus.DISPATCHED)));// dispatched, no leaf (OS skip) → hidden

        List<SoftwareActionDeviceResponse> rows = service.devices(EXEC, "b1", null, null);

        assertThat(rows).extracting(SoftwareActionDeviceResponse::getMachineId)
                .containsExactly("m-success", "m-running", "m-offline");
        assertThat(status(rows, "m-success")).isEqualTo(SoftwareActionStatus.SUCCESS);
        assertThat(status(rows, "m-running")).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
        assertThat(status(rows, "m-offline")).isEqualTo(SoftwareActionStatus.SCHEDULED);
    }

    @Test
    @DisplayName("SCHEDULE: NEW sentinel → SCHEDULED, EXPIRED sentinel → FAILED with reason")
    void scheduleDevices() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("m-done", ExecutionStatus.FAILED)));
        when(scheduleOnlineDispatchRepository.findByTenantIdAndScheduleId(TENANT, "s1")).thenReturn(List.of(
                scheduleSentinel("m-waiting", DeviceOnlineDispatchStatus.NEW),
                scheduleSentinel("m-expired", DeviceOnlineDispatchStatus.EXPIRED)));

        List<SoftwareActionDeviceResponse> rows = service.devices(EXEC, null, "s1", null);

        assertThat(rows).extracting(SoftwareActionDeviceResponse::getMachineId)
                .containsExactly("m-done", "m-waiting", "m-expired");
        assertThat(status(rows, "m-done")).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(status(rows, "m-waiting")).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(status(rows, "m-expired")).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(rows.stream().filter(r -> r.getMachineId().equals("m-expired")).findFirst().orElseThrow().getError())
                .isNotBlank();
    }

    @Test
    @DisplayName("search filters device rows by machineId, case-insensitively")
    void searchFilters() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("alpha", ExecutionStatus.SUCCESS),
                leaf("beta", ExecutionStatus.SUCCESS)));
        lenient().when(bundleOnlineDispatchRepository.findByTenantIdAndBundleId(TENANT, "b1")).thenReturn(List.of());

        List<SoftwareActionDeviceResponse> rows = service.devices(EXEC, "b1", null, "ALPH");

        assertThat(rows).extracting(SoftwareActionDeviceResponse::getMachineId).containsExactly("alpha");
    }

    private static SoftwareActionStatus status(List<SoftwareActionDeviceResponse> rows, String machineId) {
        return rows.stream().filter(r -> r.getMachineId().equals(machineId)).findFirst().orElseThrow().getStatus();
    }

    private static ScriptExecution leaf(String machineId, ExecutionStatus status) {
        return ScriptExecution.builder().machineId(machineId).status(status).build();
    }

    private static SoftwareBundleOnlineDispatch bundleSentinel(String machineId, DeviceOnlineDispatchStatus status) {
        return SoftwareBundleOnlineDispatch.builder().machineId(machineId).status(status).build();
    }

    private static SoftwareScheduleOnlineDispatch scheduleSentinel(String machineId, DeviceOnlineDispatchStatus status) {
        return SoftwareScheduleOnlineDispatch.builder().machineId(machineId).status(status).build();
    }
}
