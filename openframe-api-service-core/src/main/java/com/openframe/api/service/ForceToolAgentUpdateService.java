package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import com.openframe.api.dto.update.ForceToolAgentUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateResponse;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.publisher.ToolAgentUpdateUpdatePublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.ObjectUtils.isEmpty;
import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceToolAgentUpdateService {

    private final IntegratedToolAgentRepository toolAgentRepository;
    private final ToolAgentUpdateUpdatePublisher toolAgentUpdateUpdatePublisher;
    private final MachineRepository machineRepository;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

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
        List<ForceToolAgentUpdateResponseItem> responseItems = isToolUpdateDeliveryEnabled()
                ? rollOutToEveryMachine(machineIds, toolAgentId)
                : processMachines(machineIds, toolAgentId);
        ForceToolAgentUpdateResponse response = new ForceToolAgentUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    private List<ForceToolAgentUpdateResponseItem> processMachines(List<String> machineIds, String toolAgentId) {
        return machineIds.stream()
                .map(machineId -> processMachine(machineId, toolAgentId))
                .toList();
    }

    // one hand-off for every machine: client-service walks the machines, the response still lists them
    private List<ForceToolAgentUpdateResponseItem> rollOutToEveryMachine(List<String> machineIds, String toolAgentId) {
        ForceAgentStatus outcome = handOverToEveryMachine(toolAgentId);
        return machineIds.stream()
                .map(machineId -> buildResponseItem(machineId, toolAgentId, outcome))
                .toList();
    }

    private ForceAgentStatus handOverToEveryMachine(String toolAgentId) {
        try {
            IntegratedToolAgent toolAgent = loadToolAgent(toolAgentId);
            deliveryDispatcher.dispatch(ToolUpdateDeliverySeed.forEveryMachine(toolAgent));
            return ForceAgentStatus.PROCESSED;
        } catch (Exception e) {
            log.error("Failed to hand the tool agent {} update for every machine to the delivery engine", toolAgentId, e);
            return ForceAgentStatus.FAILED;
        }
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
            IntegratedToolAgent toolAgent = loadToolAgent(toolAgentId);
            if (isToolUpdateDeliveryEnabled()) {
                deliveryDispatcher.dispatch(ToolUpdateDeliverySeed.forMachine(machineId, toolAgent));
            } else {
                toolAgentUpdateUpdatePublisher.send(toolAgent);
            }
            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to process force tool agent {} update message for machine {}", toolAgentId, machineId, e);
            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.FAILED);
        }
    }

    private IntegratedToolAgent loadToolAgent(String toolAgentId) {
        return toolAgentRepository.findByKey(toolAgentId)
                .orElseThrow(() -> new IllegalStateException("Not found tool agent configuration for " + toolAgentId));
    }

    private boolean isToolUpdateDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.TOOL_UPDATE);
    }

    private ForceToolAgentUpdateResponseItem buildResponseItem(String machineId, String toolAgentId, ForceAgentStatus status) {
        ForceToolAgentUpdateResponseItem responseItem = new ForceToolAgentUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setToolAgentId(toolAgentId);
        responseItem.setStatus(status);
        return responseItem;
    }
}
