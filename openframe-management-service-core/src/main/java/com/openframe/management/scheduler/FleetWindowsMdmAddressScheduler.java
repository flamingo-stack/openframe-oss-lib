package com.openframe.management.scheduler;

import com.openframe.data.repository.tool.IntegratedToolRepository;
import com.openframe.management.service.FleetWindowsMdmAddressService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Writes the tenant's public Windows MDM address to its Fleet config. Needs a Fleet image that knows
 * {@code mdm.windows_server_url}: turn it on only where that image runs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.fleet-mdm.windows-mdm-address.enabled", havingValue = "true")
public class FleetWindowsMdmAddressScheduler {

    private static final String FLEETMDM_SERVER = "fleetmdm-server";

    private final IntegratedToolRepository toolRepository;
    private final FleetWindowsMdmAddressService addressService;

    @Scheduled(fixedDelayString = "${openframe.fleet-mdm.windows-mdm-address.scheduler-interval-ms}")
    public void syncWindowsMdmAddress() {
        try {
            toolRepository.findByKey(FLEETMDM_SERVER).ifPresent(addressService::syncIfNeeded);
        } catch (Exception e) {
            log.error("Setting Fleet's Windows MDM address failed, will retry on next tick: {}", e.getMessage(), e);
        }
    }
}
