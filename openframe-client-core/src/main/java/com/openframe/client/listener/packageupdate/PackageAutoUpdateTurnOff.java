package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareExecutionId;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

// Turns a device's auto-update off once its update finds the package gone from the device.
@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageAutoUpdateTurnOff {

    private static final String TURNED_OFF_BY = "package-auto-update";

    private final PackageAutoUpdatePolicyRepository policyRepository;

    public void turnOffIfPackageRemoved(PackageUpdateDeviceState state, PackageUpdateRequest request) {
        if (request == null || request.getSource() != PackageUpdateSource.AUTO
                || !Failed.Reason.NOT_INSTALLED.name().equals(state.getFailedReason())) {
            return;
        }
        String machineId = state.getMachineId();
        currentPolicy(request, machineId).ifPresent(policy -> turnOff(policy, request, machineId));
    }

    private void turnOff(PackageAutoUpdatePolicy policy, PackageUpdateRequest request, String machineId) {
        String policyId = policy.getId();
        String lastVersion = policy.getLastVersion();
        Instant now = Instant.now();
        if (policyRepository.disable(policyId, lastVersion, TURNED_OFF_BY, now) == 0) {
            log.info("[package-update] auto-update left on, the policy moved on since the report requestId={} machineId={}",
                    request.getRequestId(), machineId);
            return;
        }
        log.info("[package-update] auto-update turned off, the package is not on the device requestId={} machineId={} package={}/{}",
                request.getRequestId(), machineId, request.getPackageManager(), request.getPackageName());
    }

    // the policy still on and still at the version this request ordered; one ordered anew or re-enabled since is left alone
    private Optional<PackageAutoUpdatePolicy> currentPolicy(PackageUpdateRequest request, String machineId) {
        String tenantId = request.getTenantId();
        return policyRepository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(tenantId, machineId,
                        request.getPackageManager(), request.getPackageName())
                .filter(PackageAutoUpdatePolicy::isEnabled)
                .filter(policy -> SoftwareExecutionId.forAutoUpdate(tenantId, request.getPackageManager(),
                        request.getPackageName(), policy.getLastVersion()).equals(request.getExecutionId()));
    }
}
