package com.openframe.api.service;

import com.openframe.api.dto.force.request.ForceClientUninstallRequest;
import com.openframe.api.dto.force.response.ForceAgentStatus;
import com.openframe.api.dto.force.response.ForceClientUninstallResponse;
import com.openframe.api.dto.force.response.ForceClientUninstallResponseItem;
import com.openframe.audit.AuditCapture;
import com.openframe.core.exception.BaseException;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.InternalException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.DEVICE_UNINSTALL_REQUEST;
import static com.openframe.data.document.device.DeviceStatus.DELETED;
import static com.openframe.data.document.device.DeviceStatus.PENDING_DELETION;
import static org.apache.commons.lang3.ObjectUtils.isEmpty;

@Service
@RequiredArgsConstructor
@Slf4j
public class ForceClientUninstallService {

    private final MachineRepository machineRepository;
    private final DeliveryRouter deliveryRouter;
    private final AuditCapture auditCapture;

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
            auditCapture.run(DEVICE_UNINSTALL_REQUEST, machineId, () -> uninstall(machineId));
            return buildResponseItem(machineId, ForceAgentStatus.PROCESSED);
        } catch (BaseException e) {
            log.warn("Skipping client uninstall for machine {}: {}", machineId, e.getMessage());
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        } catch (RuntimeException e) {
            log.error("Failed to publish client uninstall command for machine {}", machineId, e);
            return buildResponseItem(machineId, ForceAgentStatus.FAILED);
        }
    }

    private void uninstall(String machineId) {
        Machine machine = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new NotFoundException(ErrorCode.DEVICE_NOT_FOUND, "Unknown machine " + machineId));
        if (machine.getStatus() == DELETED) {
            throw new ConflictException("Machine " + machineId + " is already deleted");
        }
        if (!deliveryRouter.dispatch(new ClientUninstallDeliverySeed(machineId))) {
            throw new InternalException("Client uninstall command not carried for machine " + machineId);
        }
        markPendingDeletion(machine);
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
