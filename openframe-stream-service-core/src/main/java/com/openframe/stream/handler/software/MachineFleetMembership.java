package com.openframe.stream.handler.software;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.stream.handler.software.FleetHostResolver.FleetHostRef;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

@Component
@ConditionalOnProperty(name = "openframe.fleet.software-cdc.enabled", havingValue = "true")
@RequiredArgsConstructor
public class MachineFleetMembership {

    static final Duration WINDOW = Duration.ofMinutes(1);
    static final long CAPACITY = 100_000;

    private final MachineRepository machineRepository;

    private final Cache<FleetHostRef, Boolean> inFleetByHost = Caffeine.newBuilder()
            .expireAfterWrite(WINDOW)
            .maximumSize(CAPACITY)
            .build();

    public boolean isInFleet(FleetHostRef host) {
        return inFleetByHost.get(host, this::lookUp);
    }

    private Boolean lookUp(FleetHostRef host) {
        String tenantId = host.tenantId();
        String machineId = host.machineId();
        Optional<DeviceStatus> status = machineRepository.findByTenantIdAndMachineId(tenantId, machineId)
                .map(Machine::getStatus);
        return status.filter(MachineFleetMembership::isCounted).isPresent();
    }

    private static boolean isCounted(DeviceStatus status) {
        return !DeviceStatus.FROZEN.contains(status);
    }
}
