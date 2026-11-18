package com.openframe.client.listener.packageadopt;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.rmm.software.SoftwareAdoption;
import com.openframe.data.document.rmm.software.SoftwareAdoptionStatus;
import com.openframe.data.repository.rmm.SoftwareAdoptionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.track.DeliveryDoneEvent;
import com.openframe.delivery.track.DeliveryFailedEvent;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptDeliveryListener {

    private final SoftwareAdoptionRepository softwareAdoptionRepository;
    private final DeliveryTracker deliveryTracker;
    private final TenantIdProvider tenantIdProvider;

    @EventListener
    public void onDeliveryDone(DeliveryDoneEvent event) {
        if (event.getType() != DeliveryType.PACKAGE_ADOPT) {
            return;
        }
        String requestId = event.getTargetId();
        String machineId = event.getMachineId();
        // runs inside the delivery.result listener: a failure here must not reach it
        try {
            String tenantId = tenantIdProvider.getTenantId();
            softwareAdoptionRepository.deleteByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId);
        } catch (Exception e) {
            log.error("[package-adopt] could not remove the finished adoption requestId={} machineId={}", requestId, machineId, e);
        }
    }

    @EventListener
    public void onDeliveryFailed(DeliveryFailedEvent event) {
        if (event.type() != DeliveryType.PACKAGE_ADOPT) {
            return;
        }
        String requestId = event.targetId();
        String machineId = event.machineId();
        DeliveryFailure failure = event.failure();
        // runs inside the delivery sweep or the delivery.result listener: a failure here must not reach them
        try {
            markFailed(requestId, machineId, failure);
        } catch (Exception e) {
            log.error("[package-adopt] could not mark the adoption failed requestId={} machineId={}", requestId, machineId, e);
        }
    }

    private void markFailed(String requestId, String machineId, DeliveryFailure failure) {
        String tenantId = tenantIdProvider.getTenantId();
        Optional<SoftwareAdoption> adoption =
                softwareAdoptionRepository.findByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId);
        if (adoption.isEmpty()) {
            return;
        }
        SoftwareAdoption failed = adoption.get();
        String error = errorOf(requestId, machineId, failure);
        failed.setStatus(SoftwareAdoptionStatus.FAILED);
        failed.setError(error);
        softwareAdoptionRepository.save(failed);
    }

    private String errorOf(String requestId, String machineId, DeliveryFailure failure) {
        String reason = failure.name();
        String agentError = deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, requestId, machineId)
                .map(MachineDelivery::getError)
                .orElse(null);
        return hasText(agentError) ? reason + ": " + agentError : reason;
    }
}
