package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.config.MachineConfig;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.generator.DeviceGenerator;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Retires earlier enrolments of the box this run just installed.
 *
 * <p>Every pipeline run enrols the same physical machine again and leaves the previous row behind, so
 * a long-lived tenant accumulates rows that share one hostname. They are not cosmetic: the assistant
 * refuses to act on an ambiguous target, and correctly —
 *
 * <pre>Three enrolled devices share the hostname vm115982, so I can't safely assume which one you mean</pre>
 *
 * cost eight Mingo cases on qa and stage on 2026-09-25, and left {@code DeviceRemoteTest} unable to find
 * an ONLINE row among the duplicates.
 *
 * <p><b>Scope is deliberately narrow: only this run's target hostname, and only rows that are not
 * ONLINE.</b> These tenants are shared with people whose laptops sit OFFLINE for weeks — qa's had four
 * such — and none of that is the pipeline's to retire. Keeping every ONLINE row also means a second
 * live machine on the same name is left for a human to look at rather than silently deleted.
 *
 * <p>Status change, never a hard delete: filter counts come from Pinot and a delete carries no
 * tombstone, so a removed document strands the row. {@link DeviceApi#deleteDevice} is the PATCH to
 * {@code DELETED}.
 *
 * <p>Runs after the install, so the fresh enrolment is already ONLINE and survives.
 */
@Tag("oss")
@DisplayName("Stale device cleanup")
@Slf4j
public class StaleDeviceCleanupTest extends BaseTest {

    @Tag("stale-devices")
    @Test
    @DisplayName("Retire earlier enrolments of this run's box")
    public void retireStaleEnrolmentsOfTheTargetBox() {
        String hostname = MachineConfig.getHostname();
        assumeTrue(hostname != null && !hostname.isBlank(),
                "No target machine configured for this run, so there is no hostname to de-duplicate");

        List<Machine> sameHostname = DeviceApi.getDevices(DeviceGenerator.listedStatusesDevicesFilter()).stream()
                .filter(machine -> hostname.equalsIgnoreCase(machine.getHostname()))
                .toList();
        log.info("{} device row(s) carry the hostname {}", sameHostname.size(), hostname);

        List<Machine> stale = sameHostname.stream()
                .filter(machine -> DeviceStatus.ONLINE != machine.getStatus())
                .toList();
        for (Machine machine : stale) {
            log.info("Retiring earlier enrolment {} ({}, last seen {})",
                    machine.getMachineId(), machine.getStatus(), machine.getLastSeen());
            DeviceApi.deleteDevice(machine);
        }

        List<Machine> remaining = DeviceApi.getDevices(DeviceGenerator.listedStatusesDevicesFilter()).stream()
                .filter(machine -> hostname.equalsIgnoreCase(machine.getHostname()))
                .toList();
        assertThat(remaining)
                .as("Only live enrolments of %s should remain; %d were retired", hostname, stale.size())
                .allMatch(machine -> DeviceStatus.ONLINE == machine.getStatus());
    }
}
