package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import com.openframe.api.dto.update.ForceToolAgentUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.publisher.ToolAgentUpdateUpdatePublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.ObjectUtils.isEmpty;
import static org.apache.zookeeper.common.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceToolAgentUpdateService {

    private final IntegratedToolAgentRepository toolAgentRepository;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdateUpdatePublisher;
    private final MachineRepository machineRepository;

    public ForceToolAgentUpdateResponse process(ForceToolAgentUpdateRequest request) {
        String toolAgentId = request.getToolAgentId();
        List<String> machineIds = request.getMachineIds();

        validateToolAgentId(toolAgentId);
        validateMachineIds(machineIds);

        log.info("Process force tool agent {} update request for machines {}", toolAgentId, machineIds);

        List<ForceToolAgentUpdateResponseItem> responseItems = processMachines(machineIds, toolAgentId);

        ForceToolAgentUpdateResponse response = new ForceToolAgentUpdateResponse();
        response.setItems(responseItems);

        return response;
    }

    public ForceToolAgentUpdateResponse processAll(String toolAgentId) {
        validateToolAgentId(toolAgentId);

        log.info("Process force tool agent {} update request for all machines", toolAgentId);

        List<Machine> allMachines = machineRepository.findAll();
        List<String> machineIds = allMachines.stream()
                .map(Machine::getMachineId)
                .toList();

        log.info("Found {} machines to process", machineIds.size());

        List<ForceToolAgentUpdateResponseItem> responseItems = processMachines(machineIds, toolAgentId);

        ForceToolAgentUpdateResponse response = new ForceToolAgentUpdateResponse();
        response.setItems(responseItems);

        return response;
    }

    private List<ForceToolAgentUpdateResponseItem> processMachines(List<String> machineIds, String toolAgentId) {
        return machineIds.stream()
                .map(machineId -> processMachine(machineId, toolAgentId))
                .toList();
    }

    private void validateToolAgentId(String toolAgentId) {
        if (isBlank(toolAgentId)) {
            throw new IllegalArgumentException("No tool agent id provided");
        }
    }

    private void validateMachineIds(List<String> machineIds) {
        if (isEmpty(machineIds)) {
            throw new IllegalArgumentException("No machine ids provided");
        }
    }

    private ForceToolAgentUpdateResponseItem processMachine(String machineId, String toolAgentId) {
        try {
            IntegratedToolAgent toolAgent = toolAgentRepository.findById(toolAgentId)
                    .orElseThrow(() -> new IllegalStateException("Not found tool agent configuration for " + toolAgentId));
            toolAgentUpdateUpdatePublisher.publish(toolAgent);

            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to process force tool agent {} update message for machine {}", toolAgentId, machineId, e);
            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.FAILED);
        }
    }

    private ForceToolAgentUpdateResponseItem buildResponseItem(String machineId, String toolAgentId, ForceAgentStatus status) {
        ForceToolAgentUpdateResponseItem responseItem = new ForceToolAgentUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setToolAgentId(toolAgentId);
        responseItem.setStatus(status);

        return responseItem;
    }
}

