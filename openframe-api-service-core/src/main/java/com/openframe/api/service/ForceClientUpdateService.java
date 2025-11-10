package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceClientUpdateResponse;
import com.openframe.api.dto.force.response.ForceClientUpdateResponseItem;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.update.ForceClientUpdateRequest;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.OpenFrameClientUpdatePublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.ObjectUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceClientUpdateService {

    private final OpenFrameClientConfigurationRepository clientConfigurationRepository;
    private final OpenFrameClientUpdatePublisher clientUpdateService;
    private final MachineRepository machineRepository;

    public ForceClientUpdateResponse process(ForceClientUpdateRequest request) {
        List<String> machineIds = request.getMachineId();

        validateMachineIds(machineIds);

        log.info("Process force client update request for machines {}", machineIds);

        List<ForceClientUpdateResponseItem> responseItems = processMachines(machineIds);

        ForceClientUpdateResponse response = new ForceClientUpdateResponse();
        response.setItems(responseItems);

        return response;
    }

    public ForceClientUpdateResponse processAll() {
        log.info("Process force client update request for all machines");

        List<Machine> allMachines = machineRepository.findAll();
        List<String> machineIds = allMachines.stream()
                .map(Machine::getMachineId)
                .toList();

        log.info("Found {} machines to process", machineIds.size());

        List<ForceClientUpdateResponseItem> responseItems = processMachines(machineIds);

        ForceClientUpdateResponse response = new ForceClientUpdateResponse();
        response.setItems(responseItems);

        return response;
    }

    private List<ForceClientUpdateResponseItem> processMachines(List<String> machineIds) {
        return machineIds.stream()
                .map(this::processMachine)
                .toList();
    }

    private void validateMachineIds(List<String> machineIds) {
        if (isEmpty(machineIds)) {
            throw new IllegalArgumentException("No machine ids provided");
        }
    }

    private ForceClientUpdateResponseItem processMachine(String machineId) {
        try {
            OpenFrameClientConfiguration configuration = clientConfigurationRepository.findFirstByOrderByCreatedAtDesc()
                    .orElseThrow(() -> new IllegalStateException("Not found client configuration"));
            clientUpdateService.publish(configuration);

            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to process force client update message for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private ForceClientUpdateResponseItem buildResponseItem(String machineId, ForceAgentStatus status) {
        ForceClientUpdateResponseItem responseItem = new ForceClientUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setStatus(status);

        return responseItem;
    }

}

