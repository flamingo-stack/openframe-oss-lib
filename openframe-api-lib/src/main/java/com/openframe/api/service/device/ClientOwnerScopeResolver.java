package com.openframe.api.service.device;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import static com.openframe.api.util.AuthPrincipalUtils.isAgent;
import static org.springframework.util.StringUtils.hasText;

// Builds the ClientOwnerScope of a device from its machine, read on every call: a cached organization would keep
// showing the previous customer's items for the cache's lifetime after the device moves.
@Component
@Slf4j
@RequiredArgsConstructor
public class ClientOwnerScopeResolver {

    private final MachineRepository machineRepository;

    // Only AGENT tokens are owner-scoped; admins read everything.
    public boolean isOwnerScoped(AuthPrincipal principal) {
        return isAgent(principal);
    }

    // An AGENT token without a machineId would match the owners that have none, i.e. every admin item: refused.
    public ClientOwnerScope scopeOf(AuthPrincipal principal) {
        String machineId = principal.getMachineId();
        if (!hasText(machineId)) {
            throw new ForbiddenException(ErrorCode.FORBIDDEN, "AGENT token without machineId");
        }
        return forMachine(machineId);
    }

    // For deliveries that have no principal (notifications).
    public ClientOwnerScope forMachine(String machineId) {
        if (!hasText(machineId)) {
            throw new IllegalArgumentException("machineId is required for a client owner scope");
        }
        String organizationId = machineRepository.findByMachineId(machineId)
                .map(Machine::getOrganizationId)
                .orElse(null);
        if (organizationId == null) {
            log.debug("No current organization for machine {}; owner scope falls back to machine only", machineId);
        }
        return new ClientOwnerScope(machineId, organizationId);
    }
}
