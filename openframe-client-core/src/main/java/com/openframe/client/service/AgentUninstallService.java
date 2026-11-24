package com.openframe.client.service;

import com.openframe.client.event.DeviceUninstalledEvent;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.core.exception.ConflictException;
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

import java.util.Optional;

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

    public void uninstall(String machineId, String clientSecret) {
        Optional<OAuthClient> client = oauthClientRepository.findByMachineId(machineId);
        if (client.isEmpty()) {
            log.info("Uninstall requested for unknown machine {}, treating as already deregistered", machineId);
            return;
        }
        clientSecretValidator.validate(client.get(), clientSecret);

        Optional<Machine> foundMachine = machineRepository.findOnPrimaryByMachineId(machineId);
        if (foundMachine.isEmpty()) {
            log.info("Uninstall requested for machine {} without machine document, treating as already deregistered", machineId);
            return;
        }

        Machine preUninstall = foundMachine.orElseThrow();
        Optional<Machine> deleted = markDeleted(preUninstall);
        if (preUninstall.getStatus() == DeviceStatus.DELETED) {
            log.info("Machine {} is already deleted, schedule cleanup repeated", machineId);
            return;
        }
        deleted.ifPresent(this::finishUninstall);
    }

    private Optional<Machine> markDeleted(Machine expected) {
        try {
            return Optional.of(deletedMachineCleanup.markDeleted(expected));
        } catch (ConflictException conflict) {
            return ignoreUninstallConflictIfDeviceIsGone(expected.getMachineId(), conflict);
        }
    }

    private Optional<Machine> ignoreUninstallConflictIfDeviceIsGone(String machineId, ConflictException conflict) {
        if (machineRepository.findOnPrimaryByMachineId(machineId).isPresent()) {
            throw conflict;
        }
        log.info("Machine {} document is gone, treating as already deregistered", machineId);
        return Optional.empty();
    }

    private void finishUninstall(Machine machine) {
        String machineId = machine.getMachineId();
        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);

        eventPublisher.publishEvent(new DeviceUninstalledEvent(this, machine));

        log.info("Machine {} deregistered on uninstall", machineId);
    }
}
