package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
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
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateClockService {

    private final DeliveryDispatcher deliveryDispatcher;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final PackageUpdateRequestRepository requestRepository;

    @Value("${openframe.rmm.software.package-update.deadline.batch-size}")
    private int deadlineBatchSize;

    @Value("${openframe.rmm.software.package-update.retry.batch-size}")
    private int retryBatchSize;

    @Value("${openframe.rmm.software.package-update.retry.max-attempts}")
    private int maxAttempts;

    @Value("${openframe.rmm.software.package-update.retry.backoff-seconds}")
    private long backoffSeconds;

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

    public void retryFailedAutoUpdates() {
        Instant now = Instant.now();
        List<PackageUpdateRequest> failed = requestRepository.findBySourceAndStatus(
                PackageUpdateSource.AUTO, SoftwareActionStatus.FAILED, PageRequest.of(0, retryBatchSize));
        for (PackageUpdateRequest request : failed) {
            if (request.getAttempts() >= maxAttempts) {
                continue;   // exhausted — leave FAILED for an admin to act on
            }
            if (request.getUpdatedAt() != null && request.getUpdatedAt().plusSeconds(backoffSeconds).isAfter(now)) {
                continue;   // still backing off
            }
            List<PackageUpdateDeviceState> toRetry = deviceStateRepository
                    .findByTenantIdAndRequestId(request.getTenantId(), request.getRequestId()).stream()
                    .filter(s -> s.getStatus() == SoftwareActionStatus.FAILED
                            && !Failed.Reason.SUPERSEDED.name().equals(s.getFailedReason()))
                    .toList();
            if (toRetry.isEmpty()) {
                continue;
            }
            for (PackageUpdateDeviceState state : toRetry) {
                deliveryDispatcher.dispatch(PackageUpdateWire.seed(state.getMachineId(), request.getRequestId(),
                        request.getSource(), request.getPackageManager(), request.getPackageName(),
                        request.getBrewPackageType(), request.getMode(), request.getForceCountdownSeconds()));
                resetForRetry(state, now);
                deviceStateRepository.save(state);
            }
            request.setAttempts(request.getAttempts() + 1);
            request.setStatus(SoftwareActionStatus.SCHEDULED);
            request.setUpdatedAt(now);
            requestRepository.save(request);
            log.info("[package-update] AUTO retry attempt={} requestId={} devices={}",
                    request.getAttempts(), request.getRequestId(), toRetry.size());
        }
    }

    private void resetForRetry(PackageUpdateDeviceState state, Instant now) {
        state.setStatus(SoftwareActionStatus.SCHEDULED);
        state.setForced(false);
        state.setDeadlineAt(null);
        state.setLastEventId(null);
        state.setLastEventAt(null);
        state.setFailedReason(null);
        state.setFailedMessage(null);
        state.setExitCode(null);
        state.setUpdatedAt(now);
    }
}
