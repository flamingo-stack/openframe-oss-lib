package com.openframe.test.helpers.ai;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.config.MachineConfig;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.generator.DeviceGenerator;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

/**
 * Preconditions for a device scenario. The AI agent's {@code NativeBulkCommandRunner} filters to ONLINE
 * machines and fails "No online machines found" otherwise — an offline target produces an assistant-level
 * error that looks like a behavioral bug. So we check up front and abort as infra: an offline or
 * unreachable box is not a failure of the assistant.
 *
 * <p>The target is identified by <em>hostname</em> (the same name used to target the assistant in the
 * prompt), so no machine id is needed: we pull the tenant's ONLINE device set and require the target to
 * be in it, then confirm the SSH channel reaches the same box.
 */
@Slf4j
public class MachineFixture {

    /**
     * Resolves the configured target by hostname, asserts it is present in the tenant's ONLINE device set,
     * and confirms the SSH channel reaches it. Returns the {@link Machine} for downstream use.
     *
     * @throws InfraFailureException if the machine is not among the ONLINE devices or is SSH-unreachable
     */
    public static Machine requireOnlineTarget(SshMachineVerifier ssh) {
        return requireOnline(MachineConfig.getHostname(), ssh);
    }

    /**
     * Asserts the named machine is present in the tenant's ONLINE device set and reachable over the given
     * SSH channel. Returns the {@link Machine}. Used for both the primary and control boxes in multi-host
     * cases.
     */
    public static Machine requireOnline(String hostname, SshMachineVerifier ssh) {
        Machine device = onlineDeviceByHostname(hostname);
        if (device == null) {
            throw new InfraFailureException("Machine '" + hostname
                    + "' is not among the ONLINE devices in this tenant — cannot dispatch a command to it");
        }

        // Reachability probe: any SSH transport failure surfaces as InfraFailureException here.
        String reachedHostname = ssh.hostname();
        if (reachedHostname.isBlank()) {
            throw new InfraFailureException("SSH reached '" + hostname + "' but 'hostname' returned no output");
        }
        log.info("Machine {} is ONLINE and SSH-reachable (ssh hostname={})", hostname, reachedHostname);
        return device;
    }

    /** The ONLINE device whose hostname matches (case-insensitive), or {@code null} if none is online. */
    private static Machine onlineDeviceByHostname(String hostname) {
        List<Machine> online = DeviceApi.getDevices(DeviceGenerator.onlineDevicesFilter());
        return online.stream()
                .filter(m -> hostname.equalsIgnoreCase(m.getHostname()))
                .findFirst()
                .orElse(null);
    }
}
