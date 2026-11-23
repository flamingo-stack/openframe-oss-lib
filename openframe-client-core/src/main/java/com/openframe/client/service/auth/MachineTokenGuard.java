package com.openframe.client.service.auth;

import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.exception.TenantBlockedException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

/**
 * Refuses device tokens to a deleted machine, and to a machine of a blocked tenant.
 * <p>
 * The gateway already rejects such a machine's access token; without this the agent would get a
 * fresh one from the token endpoint and be rejected again, round after round.
 * <ul>
 *   <li>DELETED is final: a reinstalled agent registers under a new machine id, so no device ever
 *       needs a token for a deleted one. The refusal is a {@link MachineDeletedException}, answered
 *       with {@code 410 Gone}: the agent counts consecutive 410s, stops its tools, backs off and
 *       uninstalls itself, where a 401 would keep it retrying every minute. A machine pending
 *       deletion still gets tokens, since it has yet to receive its uninstall.</li>
 *   <li>A tenant block is undone by an unblock. The refusal is a {@link TenantBlockedException},
 *       answered with {@code 403 Forbidden}: the agent pauses and backs off, and gets a token again
 *       once the tenant is unblocked.</li>
 * </ul>
 * A machine or tenant that is not found passes: only positive evidence refuses, as in the gateway
 * check.
 */
@Slf4j
@Component
public class MachineTokenGuard {

    static final String MACHINE_DELETED = "Machine is deleted";
    static final String TENANT_BLOCKED = "Tenant is blocked";

    private final MachineRepository machineRepository;
    private final TenantRepository tenantRepository;
    private final boolean enabled;

    public MachineTokenGuard(MachineRepository machineRepository,
                             TenantRepository tenantRepository,
                             @Value("${openframe.client.token.reject-deleted-machines:false}") boolean enabled) {
        this.machineRepository = machineRepository;
        this.tenantRepository = tenantRepository;
        this.enabled = enabled;
    }

    /**
     * Throws when the machine is deleted or its tenant is blocked.
     */
    public void requireTokenAllowed(String machineId) {
        if (!enabled || machineId == null) {
            return;
        }
        Optional<Machine> machine = machineRepository.findByMachineId(machineId);
        if (machine.map(found -> found.getStatus() == DeviceStatus.DELETED).orElse(false)) {
            log.info("Refused a token to deleted machine {}", machineId);
            throw new MachineDeletedException(MACHINE_DELETED);
        }
        String tenantId = machine.map(Machine::getTenantId).orElse(null);
        if (isBlocked(tenantId)) {
            log.info("Refused a token to machine {} of blocked tenant {}", machineId, tenantId);
            throw new TenantBlockedException(TENANT_BLOCKED);
        }
    }

    private boolean isBlocked(String tenantId) {
        return hasText(tenantId) && tenantRepository.findById(tenantId)
                .map(tenant -> tenant.getStatus() == TenantStatus.BLOCKED)
                .orElse(false);
    }
}
