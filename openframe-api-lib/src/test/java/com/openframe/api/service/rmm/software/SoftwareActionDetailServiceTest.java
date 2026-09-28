package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareActionDetailServiceTest {

    private static final String TENANT = "t1";
    private static final String EXEC = "exec-1";

    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private SoftwareBundleOnlineDispatchRepository bundleOnlineDispatchRepository;
    @Mock private SoftwareScheduleOnlineDispatchRepository scheduleOnlineDispatchRepository;
    @Mock private SoftwareScheduleMachineAssignedRepository scheduleMachineAssignedRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    private SoftwareActionDetailService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareActionDetailService(scriptExecutionRepository, bundleOnlineDispatchRepository,
                scheduleOnlineDispatchRepository, scheduleMachineAssignedRepository, machineRepository,
                organizationRepository, tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        // Enrichment always runs; default to no machine metadata unless a test provides it.
        lenient().when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("NOW: leaves map their status, offline NEW sentinels become SCHEDULED, OS-skip is hidden")
    void bundleDevices() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("m-success", ExecutionStatus.SUCCESS),
                leaf("m-running", ExecutionStatus.RUNNING)));
        when(bundleOnlineDispatchRepository.findByTenantIdAndBundleId(TENANT, "b1")).thenReturn(List.of(
                bundleSentinel("m-offline", DeviceOnlineDispatchStatus.NEW),
                bundleSentinel("m-skipped", DeviceOnlineDispatchStatus.DISPATCHED)));

        List<SoftwareActionDeviceResponse> rows = service.devices(EXEC, "b1", null, null, null);

        assertThat(rows).extracting(SoftwareActionDeviceResponse::getMachineId)
                .containsExactlyInAnyOrder("m-success", "m-running", "m-offline");
        assertThat(status(rows, "m-success")).isEqualTo(SoftwareActionStatus.COMPLETED);
        assertThat(status(rows, "m-running")).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
        assertThat(status(rows, "m-offline")).isEqualTo(SoftwareActionStatus.SCHEDULED);
    }

    @Test
    @DisplayName("SCHEDULE: assigned machines seed SCHEDULED; EXPIRED sentinel → FAILED; leaf wins")
    void scheduleDevices() {
        when(scheduleMachineAssignedRepository.findByTenantIdAndSoftwareScheduleId(TENANT, "s1")).thenReturn(List.of(
                assigned("m-a"), assigned("m-b"), assigned("m-done")));
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("m-done", ExecutionStatus.FAILED)));
        when(scheduleOnlineDispatchRepository.findByTenantIdAndScheduleId(TENANT, "s1")).thenReturn(List.of(
                scheduleSentinel("m-a", DeviceOnlineDispatchStatus.NEW),
                scheduleSentinel("m-b", DeviceOnlineDispatchStatus.EXPIRED)));

        List<SoftwareActionDeviceResponse> rows = service.devices(EXEC, null, "s1", null, null);

        assertThat(rows).extracting(SoftwareActionDeviceResponse::getMachineId)
                .containsExactlyInAnyOrder("m-a", "m-b", "m-done");
        assertThat(status(rows, "m-a")).isEqualTo(SoftwareActionStatus.SCHEDULED);
        assertThat(status(rows, "m-b")).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(status(rows, "m-done")).isEqualTo(SoftwareActionStatus.FAILED);
    }

    @Test
    @DisplayName("enrich + filters: hostname/customer resolved; status / customer / search narrow the rows")
    void enrichAndFilter() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionId(TENANT, EXEC)).thenReturn(List.of(
                leaf("alpha", ExecutionStatus.SUCCESS),
                leaf("beta", ExecutionStatus.SUCCESS),
                leaf("gamma", ExecutionStatus.FAILED)));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of(
                machine("alpha", "alpha-host", "org-1"),
                machine("beta", "beta-host", "org-2"),
                machine("gamma", "gamma-host", "org-1")));
        when(organizationRepository.findByOrganizationIdIn(any())).thenReturn(List.of(
                org("org-1", "Acme"), org("org-2", "Globex")));

        List<SoftwareActionDeviceResponse> all = service.devices(EXEC, null, null, null, null);
        assertThat(all).hasSize(3);
        SoftwareActionDeviceResponse alpha = all.stream().filter(r -> r.getMachineId().equals("alpha")).findFirst().orElseThrow();
        assertThat(alpha.getHostname()).isEqualTo("alpha-host");
        assertThat(alpha.getOrganizationId()).isEqualTo("org-1");
        assertThat(alpha.getOrganizationName()).isEqualTo("Acme");

        List<SoftwareActionDeviceResponse> completed = service.devices(EXEC, null, null, filter(List.of(SoftwareActionStatus.COMPLETED), null), null);
        assertThat(completed).extracting(SoftwareActionDeviceResponse::getMachineId).containsExactlyInAnyOrder("alpha", "beta");

        List<SoftwareActionDeviceResponse> org1 = service.devices(EXEC, null, null, filter(null, List.of("org-1")), null);
        assertThat(org1).extracting(SoftwareActionDeviceResponse::getMachineId).containsExactlyInAnyOrder("alpha", "gamma");

        List<SoftwareActionDeviceResponse> search = service.devices(EXEC, null, null, null, "BETA-HOST");
        assertThat(search).extracting(SoftwareActionDeviceResponse::getMachineId).containsExactly("beta");
    }

    private static SoftwareActionDeviceFilterInput filter(List<SoftwareActionStatus> statuses, List<String> organizationIds) {
        SoftwareActionDeviceFilterInput f = new SoftwareActionDeviceFilterInput();
        f.setStatuses(statuses);
        f.setOrganizationIds(organizationIds);
        return f;
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

    private static SoftwareScheduleMachineAssigned assigned(String machineId) {
        SoftwareScheduleMachineAssigned a = new SoftwareScheduleMachineAssigned();
        a.setMachineId(machineId);
        return a;
    }

    private static Machine machine(String machineId, String hostname, String organizationId) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setHostname(hostname);
        m.setOrganizationId(organizationId);
        return m;
    }

    private static Organization org(String organizationId, String name) {
        return Organization.builder().organizationId(organizationId).name(name).build();
    }
}
