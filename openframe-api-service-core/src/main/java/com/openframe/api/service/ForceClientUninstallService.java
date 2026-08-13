package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.api.dto.force.response.ForceClientUninstallResponseItem;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.ObjectUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceClientUninstallService {

    private final ClientUninstallNatsPublisher clientUninstallNatsPublisher;
    private final MachineRepository machineRepository;

    public ForceClientUninstallResponse process(ForceClientUninstallRequest request) {
        List<String> machineIds = request.getMachineIds();

        validateMachineIds(machineIds);

        log.info("Process force client uninstall request for machines {}", machineIds);

        List<ForceClientUninstallResponseItem> responseItems = machineIds.stream()
                .map(this::processMachine)
                .toList();

        ForceClientUninstallResponse response = new ForceClientUninstallResponse();
        response.setItems(responseItems);

        return response;
    }

    private ForceClientUninstallResponseItem processMachine(String machineId) {
        try {
            if (machineRepository.findByMachineId(machineId).isEmpty()) {
                log.warn("Skipping client uninstall for unknown machine {}", machineId);
                return buildResponseItem(machineId, ForceAgentStatus.FAILED);
            }

            clientUninstallNatsPublisher.publish(machineId);

            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to publish client uninstall command for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private void validateMachineIds(List<String> machineIds) {
        if (isEmpty(machineIds)) {
            throw new IllegalArgumentException("No machine ids provided");
        }
    }

    private ForceClientUninstallResponseItem buildResponseItem(String machineId, ForceAgentStatus status) {
        ForceClientUninstallResponseItem responseItem = new ForceClientUninstallResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setStatus(status);

        return responseItem;
    }

}
