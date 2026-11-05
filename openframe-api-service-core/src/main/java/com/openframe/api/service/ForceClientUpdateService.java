package com.openframe.api.service;

import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUpdateResponse;
import com.openframe.api.dto.force.response.ForceClientUpdateResponseItem;
import com.openframe.api.dto.update.ForceClientUpdateRequest;
import com.openframe.audit.AuditCapture;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
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
    private final DeliveryRouter deliveryRouter;
    private final AuditCapture auditCapture;

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

        ForceAgentStatus outcome = sendToEveryMachine(machineIds.size());
        List<ForceClientUpdateResponseItem> responseItems = machineIds.stream()
                .map(machineId -> buildResponseItem(machineId, outcome))
                .toList();

        ForceClientUpdateResponse response = new ForceClientUpdateResponse();
        response.setItems(responseItems);
        return response;
    }

    private ForceAgentStatus sendToEveryMachine(int machines) {
        try {
            OpenFrameClientConfiguration configuration = loadConfiguration();
            Map<String, Object> details = versionDetails(configuration);
            details.put("machines", machines);
            auditCapture.run(DEVICE_CLIENT_UPDATE, null, details, () -> sendToEveryMachine(configuration));
            return ForceAgentStatus.PROCESSED;
        } catch (RuntimeException e) {
            log.error("Failed to send the client update to every machine", e);
            return ForceAgentStatus.FAILED;
        }
    }

    private void sendToEveryMachine(OpenFrameClientConfiguration configuration) {
        if (!deliveryRouter.dispatch(ClientUpdateDeliverySeed.forEveryMachine(configuration))) {
            throw new InternalException("Client update not carried to every machine");
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
            auditCapture.run(DEVICE_CLIENT_UPDATE, machineId, versionDetails(configuration),
                    () -> sendToMachine(machineId, configuration));
            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (RuntimeException e) {
            log.error("Failed to process force client update message for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private void sendToMachine(String machineId, OpenFrameClientConfiguration configuration) {
        if (!deliveryRouter.dispatch(ClientUpdateDeliverySeed.forMachine(machineId, configuration))) {
            throw new InternalException("Client update not carried for machine " + machineId);
        }
    }

    private static Map<String, Object> versionDetails(OpenFrameClientConfiguration configuration) {
        Map<String, Object> details = new HashMap<>();
        details.put("version", configuration.getVersion());
        return details;
    }

    private OpenFrameClientConfiguration loadConfiguration() {
        return clientConfigurationRepository.findFirstByOrderByCreatedAtDesc()
                .orElseThrow(() -> new IllegalStateException("Not found client configuration"));
    }

    private ForceClientUpdateResponseItem buildResponseItem(String machineId, ForceAgentStatus status) {
        ForceClientUpdateResponseItem responseItem = new ForceClientUpdateResponseItem();
        responseItem.setMachineId(machineId);
        responseItem.setStatus(status);
        return responseItem;
    }
}
