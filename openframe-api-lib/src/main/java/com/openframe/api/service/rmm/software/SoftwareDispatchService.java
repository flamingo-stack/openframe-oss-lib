package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.SoftwareNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@ConditionalOnProperty("spring.cloud.stream.enabled")
@RequiredArgsConstructor
public class SoftwareDispatchService {

    private final DeviceService deviceService;
    private final ScriptExecutionService scriptExecutionService;
    private final SoftwareNatsPublisher softwareNatsPublisher;

    public String dispatch(ScriptResponse script, List<String> machineIds, List<String> args, String initiatedBy,
                           ExecutionSource source, PackageManagerType packageManager, String packageName,
                           SoftwareAction action) {
        verifyMachines(machineIds);

        String executionId = UUID.randomUUID().toString();

        scriptExecutionService.createSoftwareBatch(executionId, script.getId(), machineIds,
                script.getPrivilegeLevel(), script.getDefaultTimeoutSeconds(), initiatedBy, source,
                packageManager, packageName, action);

        List<String> tokenizedArgs = ScriptArgsTokenizer.tokenize(args);

        machineIds.forEach(machineId -> softwareNatsPublisher.publishSoftware(machineId,
                ScriptMessage.builder()
                        .executionId(executionId)
                        .scriptId(script.getId())
                        .machineId(machineId)
                        .code(script.getScriptBody())
                        .shell(script.getShell())
                        .privilegeLevel(script.getPrivilegeLevel())
                        .args(tokenizedArgs)
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .build()));

        log.info("Dispatched software execution executionId={} scriptId={} machines={} shell={} privilegeLevel={}",
                executionId, script.getId(), machineIds.size(), script.getShell(), script.getPrivilegeLevel());
        return executionId;
    }

    private void verifyMachines(List<String> machineIds) {
        machineIds.forEach(this::verifyMachine);
    }

    private void verifyMachine(String machineId) {
        Machine machine = deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId));
        if (!DeviceStatus.DISPATCH_ELIGIBLE.contains(machine.getStatus())) {
            throw new BadRequestException(
                    "Machine is not in a dispatchable state (must be ONLINE or OFFLINE): " + machineId);
        }
    }
}
