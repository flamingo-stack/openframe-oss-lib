package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.api.dto.force.response.ForceClientUninstallResponseItem;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.publisher.ClientUninstallNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;
import static org.apache.commons.lang3.ObjectUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceClientUninstallService {

    private final ClientUninstallNatsPublisher clientUninstallNatsPublisher;
    private final MachineRepository machineRepository;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

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
            Optional<Machine> foundMachine = machineRepository.findByMachineId(machineId);
            if (foundMachine.isEmpty()) {
                log.warn("Skipping client uninstall for unknown machine {}", machineId);
                return buildResponseItem(machineId, ForceAgentStatus.FAILED);
            }

            Machine machine = foundMachine.get();
            if (machine.getStatus() == DELETED) {
                log.warn("Skipping client uninstall for already deleted machine {}", machineId);
                return buildResponseItem(machineId, ForceAgentStatus.FAILED);
            }

            if (deliveryProperties.isEnabled(DeliveryType.CLIENT_UNINSTALL)) {
                dispatch(machine);
                return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
            }

            clientUninstallNatsPublisher.publish(machineId);

            markPendingDeletion(machine);

            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (Exception e) {
            log.error("Failed to publish client uninstall command for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    // the machine leaves service when the agent acknowledges (client-service, on DeliveryAckedEvent), not here: the sweep
    // needs its real status to retry. PENDING_DELETION therefore means an uninstall is already on the machine
    private void dispatch(Machine machine) {
        String machineId = machine.getMachineId();
        if (machine.getStatus() == PENDING_DELETION) {
            log.info("Client uninstall already in progress for machine {}", machineId);
            return;
        }
        deliveryDispatcher.dispatch(new ClientUninstallDeliverySeed(machineId));
    }

    private void markPendingDeletion(Machine machine) {
        if (machine.getStatus() == PENDING_DELETION) {
            return;
        }
        machine.setStatus(PENDING_DELETION);
        machineRepository.save(machine);
        log.info("Machine {} marked PENDING_DELETION", machine.getMachineId());
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
