package com.openframe.api.service.device;

import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.device.chocolatey.ChocolateyDecision;
import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.machine.MachineUpdate;
import com.openframe.data.service.machine.MachineWriteResult;
import com.openframe.data.service.machine.MachineWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.data.service.machine.MachineFields.CHOCOLATEY_DECISION;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChocolateyDecisionService {

    private static final String UPGRADE_BLOCKED = "UPGRADE_BLOCKED";

    private final MachineRepository machineRepository;
    private final MachineWriter machineWriter;
    private final TenantIdProvider tenantIdProvider;

    public Machine set(String machineId, ChocolateyAdminOption option, String decidedBy) {
        String tenantId = tenantIdProvider.getTenantId();
        Machine machine = machineRepository.findByTenantIdAndMachineId(tenantId, machineId)
                .orElseThrow(() -> notFound(machineId));
        MachineChocolatey chocolatey = machine.getChocolatey();
        if (chocolatey == null || chocolatey.getStatus() != ChocolateyStatus.ACTION_REQUIRED) {
            throw new BadRequestException("Chocolatey on device " + machineId + " requires no action");
        }
        ChocolateyDecision decision = decisionOf(option, chocolatey.getReason(), decidedBy);
        MachineUpdate update = machineUpdate().set(CHOCOLATEY_DECISION, decision);
        MachineWriteResult written = machineWriter.update(machineId, update)
                .orElseThrow(() -> notFound(machineId));
        log.info("Chocolatey decision stored: machineId={} option={} reason={} decidedBy={}",
                machineId, option, decision.getReason(), decidedBy);
        return written.after();
    }

    private static ChocolateyDecision decisionOf(ChocolateyAdminOption option, String reason, String decidedBy) {
        boolean upgradeRetryPending = option == ChocolateyAdminOption.ADMIN_FIXES && UPGRADE_BLOCKED.equals(reason);
        return ChocolateyDecision.builder()
                .option(option)
                .reason(reason)
                .decidedAt(Instant.now())
                .decidedBy(decidedBy)
                .upgradeRetryPending(upgradeRetryPending)
                .build();
    }

    private static DeviceNotFoundException notFound(String machineId) {
        return new DeviceNotFoundException("Device not found: " + machineId);
    }
}
