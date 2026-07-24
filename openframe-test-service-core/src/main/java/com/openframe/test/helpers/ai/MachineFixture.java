package com.openframe.test.helpers.ai;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.config.MachineConfig;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import lombok.extern.slf4j.Slf4j;

/**
 * Preconditions for a device scenario. The AI agent's {@code NativeBulkCommandRunner} filters to ONLINE
 * machines and fails "No online machines found" otherwise — an offline target produces an assistant-level
 * error that looks like a behavioral bug. So we check up front and abort as infra: an offline or
 * unreachable box is not a failure of the assistant.
 */
@Slf4j
public class MachineFixture {

    /**
     * Resolves the configured target machine, asserts it is enrolled and ONLINE, and confirms the SSH
     * channel reaches it. Returns the {@link Machine} for downstream fixtures.
     *
     * @throws InfraFailureException if the machine is unknown, offline, or SSH-unreachable
     */
    public static Machine requireOnlineTarget(SshMachineVerifier ssh) {
        String machineId = MachineConfig.getMachineId();

        Machine device = DeviceApi.getDevice(machineId);
        if (device == null) {
            throw new InfraFailureException("Target machine " + machineId + " is not enrolled in this tenant");
        }
        if (device.getStatus() != DeviceStatus.ONLINE) {
            throw new InfraFailureException("Target machine " + machineId + " is not ONLINE (status="
                    + device.getStatus() + ") — cannot dispatch a command to it");
        }

        // Reachability probe: any SSH transport failure surfaces as InfraFailureException here.
        String hostname = ssh.hostname();
        if (hostname.isBlank()) {
            throw new InfraFailureException("SSH reached the target but 'hostname' returned no output");
        }
        log.info("Target machine {} is ONLINE and SSH-reachable (hostname={})", machineId, hostname);
        return device;
    }
}
