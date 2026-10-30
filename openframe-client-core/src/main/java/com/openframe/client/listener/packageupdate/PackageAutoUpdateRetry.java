package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.nats.packageupdate.PackageUpdateWire;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

// Orders a failed auto-update again: the same request, due later in the delivery engine, so the device keeps one
// history row and the run reads the outcome of its last attempt. The engine's own re-run keeps the sequence, which the
// agent drops as stale once it has finished the request; a new dispatch takes the next one.
@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdateRetry {

    // failures that can pass by themselves; any other stays FAILED until the next version
    private static final Set<String> RETRIED_REASONS = Set.of(Failed.Reason.MANAGER_ERROR.name(), Failed.Reason.TIMEOUT.name(),
            Failed.Reason.CLOSE_FAILED.name(), PackageUpdateDeviceStateReducer.NOT_DELIVERED);

    private final PackageAutoUpdatePolicyRepository policyRepository;
    private final DeliveryDispatcher deliveryDispatcher;

    @Value("${openframe.rmm.software.package-update.retry.max-attempts}")
    private int maxAttempts;

    @Value("${openframe.rmm.software.package-update.retry.backoff-seconds}")
    private long backoffSeconds;

    public void scheduleIfDue(PackageUpdateDeviceState state, PackageUpdateRequest request) {
        if (request == null || !isDue(state, request)) {
            return;
        }
        String machineId = state.getMachineId();
        currentPolicy(request, machineId).ifPresentOrElse(
                policy -> schedule(state, request, policy),
                () -> log.info("[package-update] no retry, the policy is off or a newer version is ordered requestId={} machineId={}",
                        request.getRequestId(), machineId));
    }

    private void schedule(PackageUpdateDeviceState state, PackageUpdateRequest request, PackageAutoUpdatePolicy policy) {
        String machineId = state.getMachineId();
        String requestId = request.getRequestId();
        // written first: a retry the policy does not name could not be withdrawn
        policyRepository.markRetryScheduled(policy.getId(), requestId);
        Instant dueAt = Instant.now().plusSeconds(backoffSeconds);
        PackageUpdateDeliverySeed seed = PackageUpdateWire.seed(machineId, requestId, request.getSource(),
                request.getPackageManager(), request.getPackageName(), request.getBrewPackageType(), request.getMode(),
                request.getForceCountdownSeconds());
        deliveryDispatcher.schedule(seed, dueAt);
        int retries = state.getRetries() + 1;
        state.setRetries(retries);
        // this attempt arms its own deadline
        state.setDeadlineAt(null);
        log.info("[package-update] auto-update retry scheduled requestId={} machineId={} retry={} dueAt={} reason={}",
                requestId, machineId, retries, dueAt, state.getFailedReason());
    }

    // a reason the backend does not know arrives as null, and Set.of refuses to look up null
    private boolean isDue(PackageUpdateDeviceState state, PackageUpdateRequest request) {
        String reason = state.getFailedReason();
        return request.getSource() == PackageUpdateSource.AUTO
                && state.getStatus() == SoftwareActionStatus.FAILED
                && reason != null && RETRIED_REASONS.contains(reason)
                && state.getRetries() + 1 < maxAttempts;
    }

    private Optional<PackageAutoUpdatePolicy> currentPolicy(PackageUpdateRequest request, String machineId) {
        String tenantId = request.getTenantId();
        return policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(tenantId, machineId,
                        request.getPackageManager(), request.getPackageName())
                .filter(PackageAutoUpdatePolicy::isEnabled)
                .filter(policy -> SoftwareExecutionId.forAutoUpdate(tenantId, request.getPackageManager(),
                        request.getPackageName(), policy.getLastVersion()).equals(request.getExecutionId()));
    }
}
