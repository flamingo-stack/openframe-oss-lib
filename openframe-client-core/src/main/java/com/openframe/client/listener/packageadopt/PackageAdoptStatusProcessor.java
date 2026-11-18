package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.State;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptStatusProcessor {

    private final MachineRepository machineRepository;
    private final SoftwareAdoptionRepository softwareAdoptionRepository;
    private final DeliveryTracker deliveryTracker;

    public void process(String machineId, PackageAdoptStatusMessage event) {
        String requestId = event.getRequestId();
        SoftwareAdoption adoption = adoptionOf(machineId, requestId);
        if (adoption == null) {
            log.info("[package-adopt] status {} for requestId={} machineId={} without an adoption of that request — ignored",
                    event.getState(), requestId, machineId);
            return;
        }
        if (event.getState() == State.DONE) {
            complete(adoption);
            return;
        }
        String error = event.getMessage();
        fail(adoption, error);
    }

    public void failUndelivered(String machineId, String requestId, DeliveryFailure failure) {
        SoftwareAdoption adoption = adoptionOf(machineId, requestId);
        if (adoption == null) {
            return;
        }
        if (adoption.getStatus() == SoftwareAdoptionStatus.FAILED) {
            log.info("[package-adopt] delivery {} for requestId={} machineId={}, but the adoption already failed — left as is",
                    failure, requestId, machineId);
            return;
        }
        String error = undeliveredError(requestId, machineId, failure);
        adoption.setStatus(SoftwareAdoptionStatus.FAILED);
        adoption.setError(error);
        softwareAdoptionRepository.save(adoption);
        log.warn("[package-adopt] order not delivered requestId={} machineId={} reason={}", requestId, machineId, failure);
    }

    private SoftwareAdoption adoptionOf(String machineId, String requestId) {
        Machine machine = machineRepository.findByMachineId(machineId).orElse(null);
        if (machine == null) {
            log.warn("[package-adopt] report for unknown machine {} requestId={} — ignoring", machineId, requestId);
            return null;
        }
        String tenantId = machine.getTenantId();
        return softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId).orElse(null);
    }

    private void complete(SoftwareAdoption adoption) {
        String tenantId = adoption.getTenantId();
        String requestId = adoption.getRequestId();
        String machineId = adoption.getMachineId();
        deliveryTracker.done(DeliveryType.PACKAGE_ADOPT, requestId, machineId);
        softwareAdoptionRepository.deleteByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId);
        log.info("[package-adopt] adopted requestId={} machineId={} softwareId={}", requestId, machineId, adoption.getSoftwareId());
    }

    // the record is saved first: the engine's failed event that the closed row raises finds it FAILED and leaves it
    private void fail(SoftwareAdoption adoption, String error) {
        String requestId = adoption.getRequestId();
        String machineId = adoption.getMachineId();
        adoption.setStatus(SoftwareAdoptionStatus.FAILED);
        adoption.setError(error);
        softwareAdoptionRepository.save(adoption);
        deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, requestId, machineId)
                .map(MachineDelivery::getDispatchId)
                .map(dispatchId -> new DeliveryRef(DeliveryType.PACKAGE_ADOPT, requestId, dispatchId))
                .ifPresent(delivery -> deliveryTracker.fail(delivery, machineId, error));
        log.warn("[package-adopt] adoption failed requestId={} machineId={} softwareId={} error={}",
                requestId, machineId, adoption.getSoftwareId(), error);
    }

    private String undeliveredError(String requestId, String machineId, DeliveryFailure failure) {
        String reason = failure.name();
        String agentError = deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, requestId, machineId)
                .map(MachineDelivery::getError)
                .orElse(null);
        return hasText(agentError) ? reason + ": " + agentError : reason;
    }
}
