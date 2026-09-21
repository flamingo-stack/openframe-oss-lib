package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionDeviceFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleMachineAssigned;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareActionDetailService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final SoftwareBundleOnlineDispatchRepository bundleOnlineDispatchRepository;
    private final SoftwareScheduleOnlineDispatchRepository scheduleOnlineDispatchRepository;
    private final SoftwareScheduleMachineAssignedRepository scheduleMachineAssignedRepository;
    private final MachineRepository machineRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantIdProvider tenantIdProvider;

    public List<SoftwareActionDeviceResponse> devices(String executionId, String bundleId, String scheduleId,
                                                      SoftwareActionDeviceFilterInput filter, String search) {
        String tenantId = tenantIdProvider.getTenantId();
        Map<String, SoftwareActionDeviceResponse> byMachine = new LinkedHashMap<>();

        // 1. Baseline: a schedule's full target set as SCHEDULED (not-yet-fired schedules have no leaves).
        if (hasText(scheduleId)) {
            for (SoftwareScheduleMachineAssigned a : scheduleMachineAssignedRepository
                    .findByTenantIdAndSoftwareScheduleId(tenantId, scheduleId)) {
                byMachine.putIfAbsent(a.getMachineId(), pending(a.getMachineId(), SoftwareActionStatus.SCHEDULED, null));
            }
        }

        // 2. Overlay reconnect sentinels (offline devices armed at fire time) — EXPIRED overrides the baseline.
        addPending(byMachine, tenantId, bundleId, scheduleId);

        // 3. Overlay execution leaves — the real outcome wins over any pending state.
        if (hasText(executionId)) {
            for (ScriptExecution leaf : scriptExecutionRepository.findByTenantIdAndExecutionId(tenantId, executionId)) {
                byMachine.put(leaf.getMachineId(), fromLeaf(leaf));
            }
        }

        enrichWithCustomer(tenantId, byMachine);

        return byMachine.values().stream()
                .filter(row -> matchesStatus(row, filter))
                .filter(row -> matchesCustomer(row, filter))
                .filter(row -> matchesSearch(row, search))
                .toList();
    }

    private void addPending(Map<String, SoftwareActionDeviceResponse> byMachine, String tenantId,
                            String bundleId, String scheduleId) {
        if (hasText(bundleId)) {
            bundleOnlineDispatchRepository.findByTenantIdAndBundleId(tenantId, bundleId).forEach(s -> {
                if (s.getStatus() == DeviceOnlineDispatchStatus.NEW) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.SCHEDULED, null));
                }
                // DISPATCHED without a leaf = the package's OS did not apply to this device → not shown.
            });
        } else if (hasText(scheduleId)) {
            scheduleOnlineDispatchRepository.findByTenantIdAndScheduleId(tenantId, scheduleId).forEach(s -> {
                if (s.getStatus() == DeviceOnlineDispatchStatus.NEW) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.SCHEDULED, null));
                } else if (s.getStatus() == DeviceOnlineDispatchStatus.EXPIRED) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.FAILED,
                            "Device did not reconnect within the retry window"));
                }
            });
        }
    }

    // Batch-load hostname and customer in two queries, not per row.
    private void enrichWithCustomer(String tenantId, Map<String, SoftwareActionDeviceResponse> byMachine) {
        if (byMachine.isEmpty()) {
            return;
        }
        Map<String, Machine> machines = new HashMap<>();
        machineRepository.findByTenantIdAndMachineIdIn(tenantId, byMachine.keySet())
                .forEach(m -> machines.put(m.getMachineId(), m));

        Set<String> organizationIds = new HashSet<>();
        machines.values().forEach(m -> {
            if (m.getOrganizationId() != null) {
                organizationIds.add(m.getOrganizationId());
            }
        });
        Map<String, String> organizationNames = new HashMap<>();
        if (!organizationIds.isEmpty()) {
            organizationRepository.findByOrganizationIdIn(organizationIds)
                    .forEach(o -> organizationNames.put(o.getOrganizationId(), o.getName()));
        }

        byMachine.forEach((machineId, row) -> {
            Machine m = machines.get(machineId);
            if (m != null) {
                row.setHostname(m.getHostname());
                row.setOrganizationId(m.getOrganizationId());
                row.setOrganizationName(organizationNames.get(m.getOrganizationId()));
            }
        });
    }

    private static boolean matchesStatus(SoftwareActionDeviceResponse row, SoftwareActionDeviceFilterInput filter) {
        if (filter == null || filter.getStatuses() == null || filter.getStatuses().isEmpty()) {
            return true;
        }
        return filter.getStatuses().contains(row.getStatus());
    }

    private static boolean matchesCustomer(SoftwareActionDeviceResponse row, SoftwareActionDeviceFilterInput filter) {
        if (filter == null || filter.getOrganizationIds() == null || filter.getOrganizationIds().isEmpty()) {
            return true;
        }
        return row.getOrganizationId() != null && filter.getOrganizationIds().contains(row.getOrganizationId());
    }

    private static boolean matchesSearch(SoftwareActionDeviceResponse row, String search) {
        if (!hasText(search)) {
            return true;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return contains(row.getHostname(), needle) || contains(row.getMachineId(), needle);
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }

    private static SoftwareActionDeviceResponse fromLeaf(ScriptExecution leaf) {
        return SoftwareActionDeviceResponse.builder()
                .machineId(leaf.getMachineId())
                .status(deviceStatus(leaf.getStatus()))
                .exitCode(leaf.getExitCode())
                .stdout(leaf.getStdout())
                .stdoutTruncated(leaf.getStdoutTruncated())
                .stderr(leaf.getStderr())
                .stderrTruncated(leaf.getStderrTruncated())
                .error(leaf.getError())
                .dispatchedAt(leaf.getDispatchedAt())
                .finishedAt(leaf.getFinishedAt())
                .build();
    }

    private static SoftwareActionDeviceResponse pending(String machineId, SoftwareActionStatus status, String error) {
        return SoftwareActionDeviceResponse.builder()
                .machineId(machineId)
                .status(status)
                .error(error)
                .build();
    }

    private static SoftwareActionStatus deviceStatus(ExecutionStatus status) {
        if (status == null) {
            return SoftwareActionStatus.IN_PROGRESS;
        }
        return switch (status) {
            case SUCCESS -> SoftwareActionStatus.COMPLETED;
            case FAILED -> SoftwareActionStatus.FAILED;
            case QUEUED, RUNNING -> SoftwareActionStatus.IN_PROGRESS;
        };
    }
}
