package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.software.CascadeSyncType;
import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSoftware;
import com.openframe.data.document.rmm.software.FleetSoftwareCve;
import com.openframe.data.document.rmm.software.SoftwareCascadeSync;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareCveRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareCascadeSyncRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SoftwareCascadeSyncService {

    private final SoftwareCascadeSyncRepository cascadeRepository;
    private final DeviceCveWriter deviceCveWriter;
    private final DeviceCveRepository deviceCveRepository;
    private final FleetSoftwareRepository fleetSoftwareRepository;
    private final FleetSoftwareCveRepository fleetSoftwareCveRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjector softwareProjector;
    private final VulnerabilityProjector vulnerabilityProjector;

    @Value("${openframe.rmm.software.cascade.batch-size:500}")
    private int batchSize;

    public void enqueueSoftwareCve(Long softwareId) {
        enqueue(CascadeSyncType.SOFTWARE_CVE, softwareId);
    }

    public void enqueueSoftwareDetails(Long softwareId) {
        enqueue(CascadeSyncType.SOFTWARE_DETAILS, softwareId);
    }

    private void enqueue(CascadeSyncType type, Long softwareId) {
        if (softwareId == null) {
            return;
        }
        cascadeRepository.save(SoftwareCascadeSync.builder()
                .id(SoftwareCascadeSync.idFor(type, softwareId))
                .type(type)
                .softwareId(softwareId)
                .status(DeviceOnlineDispatchStatus.NEW)
                .createdAt(Instant.now())
                .build());
    }


    public void processBatch() {
        List<SoftwareCascadeSync> batch = cascadeRepository.findByStatus(DeviceOnlineDispatchStatus.NEW,
                PageRequest.of(0, batchSize, Sort.by(Sort.Direction.ASC, "createdAt")));
        if (batch.isEmpty()) {
            return;
        }
        log.info("[software-cdc] cascade sweep: processing up to {} item(s) (oldest first)", batch.size());
        Instant now = Instant.now();
        List<SoftwareCascadeSync> done = batch.stream().filter(item -> execute(item))
                .peek(item -> {
                    item.setStatus(DeviceOnlineDispatchStatus.PROCESSED);
                    item.setProcessedAt(now);
                })
                .toList();
        if (!done.isEmpty()) {
            cascadeRepository.saveAll(done);
        }
    }

    private boolean execute(SoftwareCascadeSync item) {
        try {
            switch (item.getType()) {
                case SOFTWARE_CVE -> executeSoftwareCve(item.getSoftwareId());
                case SOFTWARE_DETAILS -> executeSoftwareDetails(item.getSoftwareId());
            }
            return true;
        } catch (RuntimeException e) {
            // Leave it NEW so the next sweep retries; a persistent failure keeps logging but won't block the batch.
            log.error("[software-cdc] cascade {} failed for {} — will retry", item.getType(), item.getId(), e);
            return false;
        }
    }

    private void executeSoftwareCve(Long softwareId) {
        if (softwareId == null) {
            return;
        }
        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId).orElse(null);
        Long titleId = software == null ? null : software.getSoftwareTitleId();
        String version = software == null ? null : software.getVersion();
        List<FleetSoftwareCve> catalog = fleetSoftwareCveRepository.findBySoftwareId(softwareId);
        Set<String> catalogCves = catalog.stream().map(FleetSoftwareCve::getCve).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Set<String> affectedTenants = new HashSet<>();
        Set<String> touchedCves = new HashSet<>(catalogCves);
        for (DeviceSoftware ds : deviceSoftwareRepository.findBySoftwareId(softwareId)) {
            for (FleetSoftwareCve sc : catalog) {
                deviceCveWriter.upsert(ds.getTenantId(), ds.getMachineId(), ds.getHostId(), sc.getCve(), softwareId,
                        titleId != null ? titleId : ds.getSoftwareTitleId(),
                        version != null ? version : ds.getVersion(), sc.getResolvedInVersion());
            }
            // Drop device_cve rows for CVEs that are no longer in the software's catalog.
            for (DeviceCve existing : deviceCveRepository
                    .findByTenantIdAndMachineIdAndSoftwareId(ds.getTenantId(), ds.getMachineId(), softwareId)) {
                if (!catalogCves.contains(existing.getCveId())) {
                    touchedCves.add(existing.getCveId());
                    deviceCveRepository.delete(existing);
                }
            }
            affectedTenants.add(ds.getTenantId());
        }
        for (String tenant : affectedTenants) {
            softwareProjector.project(tenant, titleId);
            touchedCves.forEach(cve -> vulnerabilityProjector.project(tenant, cve));
        }
    }

    private void executeSoftwareDetails(Long softwareId) {
        if (softwareId == null) {
            return;
        }
        FleetSoftware software = fleetSoftwareRepository.findBySoftwareId(softwareId).orElse(null);
        if (software == null) {
            return;
        }
        List<DeviceSoftware> rows = deviceSoftwareRepository.findBySoftwareId(softwareId);
        if (rows.isEmpty()) {
            return;
        }
        Instant now = Instant.now();
        for (DeviceSoftware row : rows) {
            row.setSoftwareTitleId(software.getSoftwareTitleId());
            row.setName(software.getName());
            row.setVersion(software.getVersion());
            row.setSource(software.getSource());
            row.setUpdatedAt(now);
        }
        FanOut.saveInChunks(rows, deviceSoftwareRepository::saveAll);
        rows.stream().map(DeviceSoftware::getTenantId).filter(Objects::nonNull).distinct()
                .forEach(tenant -> softwareProjector.project(tenant, software.getSoftwareTitleId()));
    }
}
