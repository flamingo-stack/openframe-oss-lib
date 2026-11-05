package com.openframe.client.service;

import com.openframe.audit.AuditCapture;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.DEVICE_UNINSTALL;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentUninstallService {

    private final OAuthClientRepository oauthClientRepository;
    private final ClientSecretValidator clientSecretValidator;
    private final MachineRepository machineRepository;
    private final ToolConnectionService toolConnectionService;
    private final InstalledAgentService installedAgentService;
    private final DeletedMachineCleanup deletedMachineCleanup;
    private final ApplicationEventPublisher eventPublisher;
    private final AuditCapture auditCapture;
    private final AuditRecorder auditRecorder;

    public void uninstall(String machineId, String clientSecret) {
        Optional<OAuthClient> client = oauthClientRepository.findByMachineId(machineId);
        if (client.isEmpty()) {
            log.info("Uninstall requested for unknown machine {}, treating as already deregistered", machineId);
            return;
        }
        clientSecretValidator.validate(client.get(), clientSecret);

        Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.info("Uninstall requested for machine {} without machine document, treating as already deregistered", machineId);
            return;
        }

        Machine machine = foundMachine.get();
        if (machine.getStatus() == DeviceStatus.DELETED) {
            log.info("Machine {} is already deleted, uninstall is a no-op", machineId);
            return;
        }
        AuditContext device = auditRecorder.context(AuditActor.fromAgent(machineId, List.of(), machine.getTenantId()));
        auditRecorder.within(device, () -> auditCapture.run(DEVICE_UNINSTALL, machineId, () -> deregister(machine)));
    }

    private void deregister(Machine machine) {
        String machineId = machine.getMachineId();
        machine.setStatus(DeviceStatus.DELETED);
        machineRepository.save(machine);

        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);
        deletedMachineCleanup.removeFromSchedules(machine.getTenantId(), machineId);

        eventPublisher.publishEvent(new DeviceUninstalledEvent(this, machine));

        log.info("Machine {} deregistered on uninstall", machineId);
    }
}
