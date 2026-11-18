package com.openframe.client.listener.packageadopt;

import com.openframe.client.listener.packageupdate.PackageUpdateDeviceStateReducer;
import com.openframe.client.listener.packageupdate.PackageUpdateExecutionRecorder;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.State;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageAdoptStatusProcessor {

    static final String ADOPTED_SUMMARY = "Adopted.";
    static final String FAILED_ERROR = "Adoption failed";

    private final MachineRepository machineRepository;
    private final PackageUpdateRequestRepository packageUpdateRequestRepository;
    private final PackageUpdateDeviceStateRepository packageUpdateDeviceStateRepository;
    private final PackageUpdateExecutionRecorder packageUpdateExecutionRecorder;
    private final DeliveryTracker deliveryTracker;

    public void process(String machineId, PackageAdoptStatusMessage event) {
        String requestId = event.getRequestId();
        PackageUpdateRequest request = adoptRequestOf(machineId, requestId);
        if (request == null) {
            log.info("[package-adopt] status {} for requestId={} machineId={} without an adopt request — ignored",
                    event.getState(), requestId, machineId);
            return;
        }
        if (event.getState() == State.DONE) {
            complete(request, machineId);
            return;
        }
        String message = event.getMessage();
        String error = hasText(message) ? message : FAILED_ERROR;
        fail(request, machineId, error);
    }

    public void failByEngine(PackageUpdateRequest request, String machineId, String error) {
        String requestId = request.getRequestId();
        if (!failInProgress(request, machineId, error)) {
            log.info("[package-adopt] engine failure for requestId={} machineId={} not adopting any more — ignored",
                    requestId, machineId);
            return;
        }
        log.warn("[package-adopt] adoption failed by the engine requestId={} machineId={} softwareId={} error={}",
                requestId, machineId, request.getSoftwareId(), error);
    }

    private PackageUpdateRequest adoptRequestOf(String machineId, String requestId) {
        Machine machine = machineRepository.findByMachineId(machineId).orElse(null);
        if (machine == null) {
            log.warn("[package-adopt] report for unknown machine {} requestId={} — ignoring", machineId, requestId);
            return null;
        }
        String tenantId = machine.getTenantId();
        return packageUpdateRequestRepository.findByTenantIdAndRequestId(tenantId, requestId)
                .filter(request -> request.getAction() == SoftwareAction.ADOPT)
                .orElse(null);
    }

    private void complete(PackageUpdateRequest request, String machineId) {
        String requestId = request.getRequestId();
        boolean completed = packageUpdateDeviceStateRepository.finishInProgress(request.getTenantId(), requestId,
                machineId, SoftwareActionStatus.COMPLETED, null);
        if (!completed) {
            log.info("[package-adopt] DONE for requestId={} machineId={} that is not adopting any more — ignored",
                    requestId, machineId);
            return;
        }
        packageUpdateExecutionRecorder.recordDone(request, machineId, ADOPTED_SUMMARY);
        rollUp(request);
        deliveryTracker.done(DeliveryType.PACKAGE_ADOPT, requestId, machineId);
        log.info("[package-adopt] adopted requestId={} machineId={} softwareId={}", requestId, machineId,
                request.getSoftwareId());
    }

    private void fail(PackageUpdateRequest request, String machineId, String error) {
        String requestId = request.getRequestId();
        if (!failInProgress(request, machineId, error)) {
            log.info("[package-adopt] FAILED for requestId={} machineId={} that is not adopting any more — ignored",
                    requestId, machineId);
            return;
        }
        deliveryTracker.find(DeliveryType.PACKAGE_ADOPT, requestId, machineId)
                .map(MachineDelivery::getDispatchId)
                .map(dispatchId -> new DeliveryRef(DeliveryType.PACKAGE_ADOPT, requestId, dispatchId))
                .ifPresent(delivery -> deliveryTracker.fail(delivery, machineId, error));
        log.warn("[package-adopt] adoption failed requestId={} machineId={} softwareId={} error={}",
                requestId, machineId, request.getSoftwareId(), error);
    }

    private boolean failInProgress(PackageUpdateRequest request, String machineId, String error) {
        boolean failed = packageUpdateDeviceStateRepository.finishInProgress(request.getTenantId(),
                request.getRequestId(), machineId, SoftwareActionStatus.FAILED, error);
        if (failed) {
            packageUpdateExecutionRecorder.recordFailed(request, machineId, error);
            rollUp(request);
        }
        return failed;
    }

    public void rollUp(PackageUpdateRequest request) {
        String tenantId = request.getTenantId();
        String requestId = request.getRequestId();
        List<PackageUpdateDeviceState> all = packageUpdateDeviceStateRepository.findByTenantIdAndRequestId(tenantId, requestId);
        SoftwareActionStatus rolled = PackageUpdateDeviceStateReducer.rollUpStatus(all);
        if (rolled == null || rolled == request.getStatus()) {
            return;
        }
        log.info("[package-adopt] request status requestId={} {} -> {}", requestId, request.getStatus(), rolled);
        request.setStatus(rolled);
        request.setUpdatedAt(Instant.now());
        packageUpdateRequestRepository.save(request);
    }
}
