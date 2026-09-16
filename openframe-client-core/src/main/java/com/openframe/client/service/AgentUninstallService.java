package com.openframe.client.service;

import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentUninstallService {

    private final OAuthClientRepository oauthClientRepository;
    private final ClientSecretValidator clientSecretValidator;
    private final MachineRepository machineRepository;
    private final ToolConnectionService toolConnectionService;
    private final InstalledAgentService installedAgentService;

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

        machine.setStatus(DeviceStatus.DELETED);
        machineRepository.save(machine);

        toolConnectionService.disconnectAll(machineId);
        installedAgentService.disconnectAll(machineId);

        log.info("Machine {} deregistered on uninstall", machineId);
    }
}
