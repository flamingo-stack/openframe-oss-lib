package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUpdateResponse;
import com.openframe.api.dto.force.response.ForceClientUpdateResponseItem;
import com.openframe.api.dto.update.ForceClientUpdateRequest;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeviceCommandSender;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_CLIENT_UPDATE;
import static org.springframework.util.CollectionUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceClientUpdateService {

    private final OpenFrameClientConfigurationRepository clientConfigurationRepository;
    private final MachineRepository machineRepository;
    private final DeviceCommandSender deviceCommandSender;

    public ForceClientUpdateResponse process(ForceClientUpdateRequest request) {
        List<String> machineIds = request.getMachineId();
        validateMachineIds(machineIds);

        log.info("Process force client update request for machines {}", machineIds);

        List<ForceClientUpdateResponseItem> responseItems = machineIds.stream()
                .map(this::processMachine)
                .toList();

        ForceClientUpdateResponse response = new ForceClientUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    // one hand-off for every machine, the response still lists them
    public ForceClientUpdateResponse processAll() {
        log.info("Process force client update request for all machines");

        List<Machine> allMachines = machineRepository.findAll();
        List<String> machineIds = allMachines.stream()
                .map(Machine::getMachineId)
                .toList();
        log.info("Found {} machines to process", machineIds.size());

        ForceAgentStatus outcome = sendToEveryMachine();
        List<ForceClientUpdateResponseItem> responseItems = machineIds.stream()
                .map(machineId -> buildResponseItem(machineId, outcome))
                .toList();

        ForceClientUpdateResponse response = new ForceClientUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    private ForceAgentStatus sendToEveryMachine() {
        try {
            OpenFrameClientConfiguration configuration = loadConfiguration();
            Map<String, Object> details = detailsOf(configuration);
            boolean carried = deviceCommandSender.send(DEVICE_CLIENT_UPDATE, null, details,
                    () -> ClientUpdateDeliverySeed.forEveryMachine(configuration));
            return outcomeOf(carried);
        } catch (Exception e) {
            log.error("Failed to send the client update to every machine", e);
            return ForceAgentStatus.FAILED;
        }
    }

    private void validateMachineIds(List<String> machineIds) {
        if (isEmpty(machineIds)) {
            throw new IllegalArgumentException("No machine ids provided");
        }
    }

    private ForceClientUpdateResponseItem processMachine(String machineId) {
        try {
            OpenFrameClientConfiguration configuration = loadConfiguration();
            Map<String, Object> details = detailsOf(configuration);
            boolean carried = deviceCommandSender.send(DEVICE_CLIENT_UPDATE, machineId, details,
                    () -> ClientUpdateDeliverySeed.forMachine(machineId, configuration));
            ForceAgentStatus outcome = outcomeOf(carried);
            return buildResponseItem(machineId, outcome);
        } catch (Exception e) {
            log.error("Failed to process force client update message for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private OpenFrameClientConfiguration loadConfiguration() {
        return clientConfigurationRepository.findFirstByOrderByCreatedAtDesc()
                .orElseThrow(() -> new IllegalStateException("Not found client configuration"));
    }

    private static Map<String, Object> detailsOf(OpenFrameClientConfiguration configuration) {
        Map<String, Object> details = new HashMap<>();
        details.put("version", configuration.getVersion());
        return details;
    }

    private static ForceAgentStatus outcomeOf(boolean carried) {
        return carried ? ForceAgentStatus.PROCESSED : ForceAgentStatus.FAILED;
    }

    private ForceClientUpdateResponseItem buildResponseItem(String machineId, ForceAgentStatus status) {
        ForceClientUpdateResponseItem responseItem = new ForceClientUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setStatus(status);
        return responseItem;
    }
}
