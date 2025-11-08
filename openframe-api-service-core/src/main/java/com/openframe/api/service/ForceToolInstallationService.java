package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceToolInstallationRequest;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponse;
import com.openframe.api.dto.force.response.ForceToolAgentInstallationResponseItem;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolInstallationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static org.apache.commons.lang3.ObjectUtils.isEmpty;
import static org.apache.zookeeper.common.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceToolInstallationService {

    private final IntegratedToolAgentService integratedToolAgentService;
    private final ToolInstallationService toolInstallationService;
    private final MachineRepository machineRepository;

    public ForceToolAgentInstallationResponse process(ForceToolInstallationRequest request) {
        String toolAgentId = request.getToolAgentId();
        List<String> machineIds = request.getMachineIds();

        validateToolAgentId(toolAgentId);
        validateMachineIds(machineIds);

        log.info("Process force tool {} installation request for machines {}", toolAgentId, machineIds);

        List<ForceToolAgentInstallationResponseItem> responseItems = processMachines(machineIds, toolAgentId);

        ForceToolAgentInstallationResponse response = new ForceToolAgentInstallationResponse();
        response.setItems(responseItems);

        return response;
    }

    public ForceToolAgentInstallationResponse processAll(String toolAgentId) {
        validateToolAgentId(toolAgentId);

        log.info("Process force tool {} installation request for all machines", toolAgentId);

        List<Machine> allMachines = machineRepository.findAll();
        List<String> machineIds = allMachines.stream()
                .map(Machine::getMachineId)
                .toList();

        log.info("Found {} machines to process", machineIds.size());

        List<ForceToolAgentInstallationResponseItem> responseItems = processMachines(machineIds, toolAgentId);

        ForceToolAgentInstallationResponse response = new ForceToolAgentInstallationResponse();
        response.setItems(responseItems);

        return response;
    }

    private List<ForceToolAgentInstallationResponseItem> processMachines(List<String> machineIds, String toolAgentId) {
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

    private ForceToolAgentInstallationResponseItem processMachine(String machineId, String toolAgentId) {
        try {
            IntegratedToolAgent toolAgent = integratedToolAgentService.findById(toolAgentId)
                    .orElseThrow(() -> new IllegalStateException("Not found tool agent configuration for " + toolAgentId));
            toolInstallationService.process(machineId, toolAgent);

            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to process force tool {} installation message for machine {}", toolAgentId, machineId, e);
            return buildResponseItem(machineId, toolAgentId, ForceAgentStatus.FAILED);
        }
    }


    private ForceToolAgentInstallationResponseItem buildResponseItem(String machineId, String toolAgentId, ForceAgentStatus status) {
        ForceToolAgentInstallationResponseItem responseItem = new ForceToolAgentInstallationResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setToolAgentId(toolAgentId);
        responseItem.setStatus(status);

        return responseItem;
    }
}
