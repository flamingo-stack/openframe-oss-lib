package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.SoftwareBundle;
import com.openframe.data.document.rmm.software.SoftwareBundleOnlineDispatch;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareBundleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareBundleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareBundleOnlineDispatchService {

    private static final String FIELD_FIRST_SEEN_AT = "firstSeenAt";

    private final SoftwareBundleOnlineDispatchRepository dispatchRepository;
    private final MachineRepository machineRepository;
    private final SoftwareBundleRepository bundleRepository;
    private final SoftwareBundleOnlineDispatcher bundleDispatcher;

    @Value("${openframe.rmm.software.bundle.online-dispatch.batch-size:500}")
    private int batchSize;

    public void processDevicesBecameOnline() {
        List<SoftwareBundleOnlineDispatch> batch = dispatchRepository.findByStatus(
                DeviceOnlineDispatchStatus.NEW, PageRequest.of(0, batchSize, Sort.by(Sort.Direction.ASC, FIELD_FIRST_SEEN_AT)));
        if (batch.isEmpty()) {
            return;
        }
        log.info("Software bundle online-dispatch tick: processing up to {} pending row(s) (oldest first)", batch.size());

        Instant now = Instant.now();
        Map<String, List<SoftwareBundleOnlineDispatch>> rowsByTenant =
                batch.stream().collect(groupingBy(SoftwareBundleOnlineDispatch::getTenantId));

        List<SoftwareBundleOnlineDispatch> changed = new ArrayList<>();
        for (Map.Entry<String, List<SoftwareBundleOnlineDispatch>> e : rowsByTenant.entrySet()) {
            changed.addAll(processTenant(e.getKey(), e.getValue(), now));
        }

        if (!changed.isEmpty()) {
            dispatchRepository.saveAll(changed);
        }
    }

    private List<SoftwareBundleOnlineDispatch> processTenant(String tenantId,
                                                             List<SoftwareBundleOnlineDispatch> tenantRows, Instant now) {
        Set<String> machineIds = tenantRows.stream()
                .map(SoftwareBundleOnlineDispatch::getMachineId).collect(toSet());
        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(tenantId, machineIds).stream()
                .collect(toMap(Machine::getMachineId, m -> m));

        Set<String> bundleIds = tenantRows.stream()
                .map(SoftwareBundleOnlineDispatch::getBundleId).collect(toSet());
        Map<String, SoftwareBundle> bundlesById = bundleRepository
                .findByTenantIdAndIdIn(tenantId, bundleIds).stream()
                .collect(toMap(SoftwareBundle::getId, b -> b));

        List<SoftwareBundleOnlineDispatch> changed = new ArrayList<>(tenantRows.size());
        for (SoftwareBundleOnlineDispatch row : tenantRows) {
            try {
                Machine machine = machinesById.get(row.getMachineId());
                if (machine == null || machine.getStatus() != DeviceStatus.ONLINE) {
                    continue;
                }

                SoftwareBundle bundle = bundlesById.get(row.getBundleId());
                if (bundle != null) {
                    bundleDispatcher.dispatch(bundle, machine);
                    log.info("Software bundle online-dispatched: machineId={} bundleId={} tenantId={}",
                            row.getMachineId(), row.getBundleId(), tenantId);
                } else {
                    log.warn("Software bundle online-dispatch: bundle missing bundleId={} machineId={} tenantId={} — draining",
                            row.getBundleId(), row.getMachineId(), tenantId);
                }
                row.setStatus(DeviceOnlineDispatchStatus.DISPATCHED);
                row.setDispatchedAt(now);
                changed.add(row);
            } catch (Exception ex) {
                log.error("Software bundle online-dispatch failed: tenantId={} machineId={} bundleId={} (will retry next tick)",
                        row.getTenantId(), row.getMachineId(), row.getBundleId(), ex);
            }
        }
        return changed;
    }
}
