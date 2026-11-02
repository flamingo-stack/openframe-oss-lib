package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareOnDeviceResponse;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.nats.packageupdate.PackageAutoUpdateRetryWithdrawal;
import com.openframe.data.repository.rmm.PackageAutoUpdatePolicyRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;

import static java.util.stream.Collectors.collectingAndThen;
import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toList;

// AUTO-UPDATE of a Software, from the policies linked to it: ON while any of them keeps the package updated,
// OFF once all are turned off, null when it has none.
@Slf4j
@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class SoftwareAutoUpdateService {

    private final PackageAutoUpdatePolicyRepository policyRepository;
    private final TenantIdProvider tenantIdProvider;
    private final PackageAutoUpdateRetryWithdrawal retryWithdrawal;

    public void turnOff(String softwareId, String actor) {
        String tenantId = tenantIdProvider.getTenantId();
        long turnedOff = policyRepository.disableBySoftwareId(tenantId, softwareId, actor);
        // read after the update: from here on a failed device schedules no retry, so none can slip past this
        policyRepository.findByTenantIdAndSoftwareIdIn(tenantId, List.of(softwareId))
                .forEach(policy -> retryWithdrawal.withdraw(policy, "auto-update turned off"));
        log.info("Auto-update turned off softwareId={} policies={} actor={}", softwareId, turnedOff, actor);
    }

    public void applyToSoftware(List<SoftwareResponse> rows) {
        List<String> softwareIds = ids(rows, SoftwareResponse::getId);
        if (softwareIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndSoftwareIdIn(tenantIdProvider.getTenantId(), softwareIds),
                PackageAutoUpdatePolicy::getSoftwareId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(row.getId())));
    }

    public void applyToSoftwareOnDevice(String machineId, List<SoftwareResponse> rows) {
        List<String> softwareIds = ids(rows, SoftwareResponse::getId);
        if (softwareIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndMachineIdAndSoftwareIdIn(tenantIdProvider.getTenantId(), machineId,
                        softwareIds),
                PackageAutoUpdatePolicy::getSoftwareId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(row.getId())));
    }

    public void applyToDevices(String softwareId, List<SoftwareOnDeviceResponse> rows) {
        List<String> machineIds = ids(rows, SoftwareAutoUpdateService::machineId);
        if (machineIds.isEmpty()) {
            return;
        }
        Map<String, SoftwareAutoUpdateStatus> statuses = statusBy(
                policyRepository.findByTenantIdAndSoftwareIdAndMachineIdIn(tenantIdProvider.getTenantId(), softwareId,
                        machineIds),
                PackageAutoUpdatePolicy::getMachineId);
        rows.forEach(row -> row.setAutoUpdate(statuses.get(machineId(row))));
    }

    private static String machineId(SoftwareOnDeviceResponse row) {
        return row.getDevice() == null ? null : row.getDevice().getMachineId();
    }

    private static <T> List<String> ids(List<T> rows, Function<T, String> id) {
        return rows.stream().map(id).filter(Objects::nonNull).distinct().toList();
    }

    private static Map<String, SoftwareAutoUpdateStatus> statusBy(List<PackageAutoUpdatePolicy> policies,
                                                                  Function<PackageAutoUpdatePolicy, String> key) {
        return policies.stream().collect(groupingBy(key, collectingAndThen(toList(), SoftwareAutoUpdateService::statusOf)));
    }

    private static SoftwareAutoUpdateStatus statusOf(List<PackageAutoUpdatePolicy> policies) {
        return policies.stream().anyMatch(PackageAutoUpdatePolicy::isEnabled)
                ? SoftwareAutoUpdateStatus.ON
                : SoftwareAutoUpdateStatus.OFF;
    }
}
