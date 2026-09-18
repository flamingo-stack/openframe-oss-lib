package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareActionDeviceResponse;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareActionDetailService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final SoftwareBundleOnlineDispatchRepository bundleOnlineDispatchRepository;
    private final SoftwareScheduleOnlineDispatchRepository scheduleOnlineDispatchRepository;
    private final TenantIdProvider tenantIdProvider;

    public List<SoftwareActionDeviceResponse> devices(String executionId, String bundleId, String scheduleId, String search) {
        String tenantId = tenantIdProvider.getTenantId();

        // Devices that already ran — from the execution leaves (keep leaf order, dedupe per machine).
        Map<String, SoftwareActionDeviceResponse> byMachine = new LinkedHashMap<>();
        if (hasText(executionId)) {
            for (ScriptExecution leaf : scriptExecutionRepository.findByTenantIdAndExecutionId(tenantId, executionId)) {
                byMachine.putIfAbsent(leaf.getMachineId(), fromLeaf(leaf));
            }
        }

        // Devices still offline / waiting — from the reconnect sentinels of this action's source.
        addPending(byMachine, tenantId, bundleId, scheduleId);

        return byMachine.values().stream()
                .filter(row -> matchesSearch(row, search))
                .toList();
    }

    private void addPending(Map<String, SoftwareActionDeviceResponse> byMachine, String tenantId,
                            String bundleId, String scheduleId) {
        if (hasText(bundleId)) {
            bundleOnlineDispatchRepository.findByTenantIdAndBundleId(tenantId, bundleId).forEach(s -> {
                if (byMachine.containsKey(s.getMachineId())) {
                    return;
                }
                if (s.getStatus() == DeviceOnlineDispatchStatus.NEW) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.SCHEDULED, null));
                }
                // DISPATCHED without a leaf = the package's OS did not apply to this device → not shown.
            });
        } else if (hasText(scheduleId)) {
            scheduleOnlineDispatchRepository.findByTenantIdAndScheduleId(tenantId, scheduleId).forEach(s -> {
                if (byMachine.containsKey(s.getMachineId())) {
                    return;
                }
                if (s.getStatus() == DeviceOnlineDispatchStatus.NEW) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.SCHEDULED, null));
                } else if (s.getStatus() == DeviceOnlineDispatchStatus.EXPIRED) {
                    byMachine.put(s.getMachineId(), pending(s.getMachineId(), SoftwareActionStatus.FAILED,
                            "Device did not reconnect within the retry window"));
                }
            });
        }
    }

    private static boolean matchesSearch(SoftwareActionDeviceResponse row, String search) {
        if (!hasText(search)) {
            return true;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return row.getMachineId() != null && row.getMachineId().toLowerCase(Locale.ROOT).contains(needle);
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
            case SUCCESS -> SoftwareActionStatus.SUCCESS;
            case FAILED -> SoftwareActionStatus.FAILED;
            case QUEUED, RUNNING -> SoftwareActionStatus.IN_PROGRESS;
        };
    }
}
