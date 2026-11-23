package com.openframe.client.service.auth;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.repository.device.MachineRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Refuses device tokens to a deleted machine.
 * <p>
 * The gateway already rejects a deleted machine's access token; without this the agent would get
 * a fresh one from the token endpoint and be rejected again, round after round. DELETED is final: a
 * reinstalled agent registers under a new machine id, so no device ever needs a token for a deleted
 * one. A machine pending deletion still gets tokens, since it has yet to receive its uninstall.
 * The refusal is an {@link IllegalArgumentException}, which the token endpoint answers as 401 with
 * the same body as any other refused credential.
 */
@Slf4j
@Component
public class DeletedMachineTokenGuard {

    static final String MACHINE_DELETED = "Machine is deleted";

    private final MachineRepository machineRepository;
    private final boolean enabled;

    public DeletedMachineTokenGuard(MachineRepository machineRepository,
                                    @Value("${openframe.client.token.reject-deleted-machines:false}") boolean enabled) {
        this.machineRepository = machineRepository;
        this.enabled = enabled;
    }

    /**
     * Throws when the machine is deleted. A machine that is not found passes: only positive evidence
     * refuses, as in the gateway check.
     */
    public void requireNotDeleted(String machineId) {
        if (!enabled || machineId == null) {
            return;
        }
        boolean deleted = machineRepository.findByMachineId(machineId)
                .map(machine -> machine.getStatus() == DeviceStatus.DELETED)
                .orElse(false);
        if (deleted) {
            log.info("Refused a token to deleted machine {}", machineId);
            throw new IllegalArgumentException(MACHINE_DELETED);
        }
    }
}
