package com.openframe.client.service;

import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditContext;
import com.openframe.audit.AuditRecorder;
import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.data.service.rmm.DeletedMachineCleanup;
import com.openframe.data.service.rmm.DeletedMachineCleanup.LifecycleChange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.DEVICE_UNINSTALL;

/** Deregisters an authenticated agent and revokes the device's schedule memberships. */
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
    private final AuditedMethodRunner auditedMethodRunner;
    private final AuditRecorder auditRecorder;

    public void uninstall(String machineId, String clientSecret) {
        Optional<OAuthClient> client = oauthClientRepository.findByMachineId(machineId);
        if (client.isEmpty()) {
            log.info("Uninstall requested for unknown machine {}, treating as already deregistered", machineId);
            return;
        }
        clientSecretValidator.validate(client.get(), clientSecret, "uninstall");

        Optional<Machine> foundMachine = machineRepository.findOnPrimaryByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.info("Uninstall requested for machine {} without machine document, treating as already deregistered", machineId);
            return;
        }

        Machine preUninstall = foundMachine.orElseThrow();
        if (preUninstall.getStatus() == DeviceStatus.DELETED) {
            markDeleted(preUninstall);
            log.info("Machine {} is already deleted, schedule cleanup repeated", machineId);
            return;
        }
        AuditActor agent = AuditActor.fromAgent(machineId, List.of(client.get().getRoles()), preUninstall.getTenantId());
        AuditContext device = auditRecorder.context(agent);
        auditRecorder.runInContext(device, () -> auditedMethodRunner.run(DEVICE_UNINSTALL, machineId,
                () -> markDeleted(preUninstall).ifPresent(this::finishUninstall)));
    }

    private Optional<LifecycleChange> markDeleted(Machine expected) {
        try {
            return Optional.of(deletedMachineCleanup.markDeleted(expected));
        } catch (ConflictException conflict) {
            return ignoreUninstallConflictIfDeviceIsGone(expected.getMachineId(), conflict);
        }
    }

    private Optional<LifecycleChange> ignoreUninstallConflictIfDeviceIsGone(String machineId, ConflictException conflict) {
        if (machineRepository.findOnPrimaryByMachineId(machineId).isPresent()) {
            throw conflict;
        }
        log.info("Machine {} document is gone, treating as already deregistered", machineId);
        return Optional.empty();
    }

    private void finishUninstall(LifecycleChange deleted) {
        Machine machine = deleted.machine();
        String machineId = machine.getMachineId();
        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);
        auditRecorder.recordAll(deleted.scheduleRemovals());

        eventPublisher.publishEvent(new DeviceUninstalledEvent(this, machine));

        log.info("Machine {} deregistered on uninstall", machineId);
    }
}
