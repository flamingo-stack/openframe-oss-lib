package com.openframe.api.service;

import com.openframe.api.dto.toolinstallation.ForceToolInstallationRequest;
import com.openframe.api.dto.toolinstallation.ForceToolInstallationResponse;
import com.openframe.api.dto.toolinstallation.ForceToolInstallationResponseItem;
import com.openframe.api.dto.toolinstallation.ForceToolInstallationStatus;
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

    public ForceToolInstallationResponse install(ForceToolInstallationRequest toolInstallationRequest) {
        String toolAgentId = toolInstallationRequest.getToolAgentId();
        List<String> machineIds = toolInstallationRequest.getMachineIds();

        validateToolAgentId(toolAgentId);
        validateMachineIds(machineIds);

        log.info("Process force tool {} installation request for machines {}", toolAgentId, machineIds);

        List<ForceToolInstallationResponseItem> responseItems = processMachines(machineIds, toolAgentId);

        ForceToolInstallationResponse response = new ForceToolInstallationResponse();
        response.setItems(responseItems);

        return response;
    }

    private List<ForceToolInstallationResponseItem> processMachines(List<String> machineIds, String toolAgentId) {
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

    private ForceToolInstallationResponseItem processMachine(String machineId, String toolAgentId) {
        try {
            IntegratedToolAgent toolAgent = integratedToolAgentService.findById(toolAgentId)
                    .orElseThrow(() -> new IllegalStateException("Not found tool agent configuration for " + toolAgentId));
            toolInstallationService.process(machineId, toolAgent);

            return buildResponseItem(machineId, toolAgentId, ForceToolInstallationStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to process force tool {} installation message for machine {}", toolAgentId, machineId, e);
            return buildResponseItem(machineId, toolAgentId, ForceToolInstallationStatus.FAILED);
        }
    }


    private ForceToolInstallationResponseItem buildResponseItem(String machineId, String toolAgentId, ForceToolInstallationStatus status) {
        ForceToolInstallationResponseItem responseItem = new ForceToolInstallationResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setToolAgentId(toolAgentId);
        responseItem.setStatus(status);

        return responseItem;
    }

}
