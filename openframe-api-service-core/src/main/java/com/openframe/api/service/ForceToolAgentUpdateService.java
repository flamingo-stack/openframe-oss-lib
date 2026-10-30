package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceToolAgentUpdateResponseItem;
import com.openframe.api.dto.update.ForceToolAgentUpdateRequest;
import com.openframe.api.dto.update.ForceToolAgentUpdateResponse;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
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
    private final MachineRepository machineRepository;
    private final DeliveryRouter deliveryRouter;

    public ForceToolAgentUpdateResponse process(ForceToolAgentUpdateRequest request) {
        String toolAgentId = request.getToolAgentId();
        List<String> machineIds = request.getMachineIds();
        validateToolAgentId(toolAgentId);
        validateMachineIds(machineIds);

        log.info("Process force tool agent {} update request for machines {}", toolAgentId, machineIds);

        List<ForceToolAgentUpdateResponseItem> responseItems = machineIds.stream()
                .map(machineId -> processMachine(machineId, toolAgentId))
                .toList();

        ForceToolAgentUpdateResponse response = new ForceToolAgentUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    // one hand-off for every machine, the response still lists them
    public ForceToolAgentUpdateResponse processAll(String toolAgentId) {
        validateToolAgentId(toolAgentId);

        log.info("Process force tool agent {} update request for all machines", toolAgentId);

        List<Machine> allMachines = machineRepository.findAll();
        List<String> machineIds = allMachines.stream()
                .map(Machine::getMachineId)
                .toList();
        log.info("Found {} machines to process", machineIds.size());

        ForceAgentStatus outcome = sendToEveryMachine(toolAgentId);
        List<ForceToolAgentUpdateResponseItem> responseItems = machineIds.stream()
                .map(machineId -> buildResponseItem(machineId, toolAgentId, outcome))
                .toList();

        ForceToolAgentUpdateResponse response = new ForceToolAgentUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    private ForceAgentStatus sendToEveryMachine(String toolAgentId) {
        try {
            IntegratedToolAgent toolAgent = loadToolAgent(toolAgentId);
            ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forEveryMachine(toolAgent);
            boolean carried = deliveryRouter.dispatch(seed);
            return outcomeOf(carried);
        } catch (Exception e) {
            log.error("Failed to send the tool agent {} update to every machine", toolAgentId, e);
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
            ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forMachine(machineId, toolAgent);
            boolean carried = deliveryRouter.dispatch(seed);
            ForceAgentStatus outcome = outcomeOf(carried);
            return buildResponseItem(machineId, toolAgentId, outcome);
        } catch (Exception e) {
            log.error("Failed to process force tool agent {} update message for machine {}", toolAgentId, machineId, e);
            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.FAILED);
        }
    }

    private IntegratedToolAgent loadToolAgent(String toolAgentId) {
        return toolAgentRepository.findByKey(toolAgentId)
                .orElseThrow(() -> new IllegalStateException("Not found tool agent configuration for " + toolAgentId));
    }

    private static ForceAgentStatus outcomeOf(boolean carried) {
        return carried ? ForceAgentStatus.PROCESSED : ForceAgentStatus.FAILED;
    }

    private ForceToolAgentUpdateResponseItem buildResponseItem(String machineId, String toolAgentId, ForceAgentStatus status) {
        ForceToolAgentUpdateResponseItem responseItem = new ForceToolAgentUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setToolAgentId(toolAgentId);
        responseItem.setStatus(status);
        return responseItem;
    }
}
