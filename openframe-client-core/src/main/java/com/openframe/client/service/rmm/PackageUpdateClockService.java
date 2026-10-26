package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageupdate.PackageUpdateWire;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"},
        havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateClockService {

    private final DeliveryDispatcher deliveryDispatcher;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final PackageUpdateRequestRepository requestRepository;

    @Value("${openframe.rmm.software.package-update.deadline.batch-size}")
    private int deadlineBatchSize;

    public void forceExpiredDeadlines() {
        Instant now = Instant.now();
        List<PackageUpdateDeviceState> expired = deviceStateRepository.findByStatusAndForcedFalseAndDeadlineAtBefore(
                SoftwareActionStatus.WAITING, now, PageRequest.of(0, deadlineBatchSize));
        for (PackageUpdateDeviceState state : expired) {
            PackageUpdateRequest request = requestRepository
                    .findByTenantIdAndRequestId(state.getTenantId(), state.getRequestId()).orElse(null);
            if (request == null) {
                log.warn("[package-update] deadline passed for requestId={} machineId={} but no request row — skipping",
                        state.getRequestId(), state.getMachineId());
                continue;
            }
            deliveryDispatcher.dispatch(PackageUpdateWire.seed(state.getMachineId(), request.getRequestId(),
                    request.getSource(), request.getPackageManager(), request.getPackageName(),
                    request.getBrewPackageType(), PackageUpdateMode.FORCE, request.getForceCountdownSeconds()));
            state.setForced(true);
            state.setUpdatedAt(now);
            deviceStateRepository.save(state);
            log.info("[package-update] deadline force sent requestId={} machineId={}",
                    request.getRequestId(), state.getMachineId());
        }
    }
}
