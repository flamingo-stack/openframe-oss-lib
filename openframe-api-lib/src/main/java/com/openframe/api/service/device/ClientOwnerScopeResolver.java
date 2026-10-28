package com.openframe.api.service.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Optional;

import static com.openframe.api.util.AuthPrincipalUtils.isAgent;

/**
 * Resolves the {@link ClientOwnerScope} of an AGENT principal from the machine's current organization.
 * Reads the machine on every call on purpose: a cached organization would keep showing the previous
 * customer's items for the cache's lifetime after the device moves.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ClientOwnerScopeResolver {

    private final MachineRepository machineRepository;

    /** The scope of an AGENT principal; empty for any other actor, whose reads are not owner-scoped. */
    public Optional<ClientOwnerScope> resolve(AuthPrincipal principal) {
        if (!isAgent(principal)) {
            return Optional.empty();
        }
        String machineId = principal.getMachineId();
        String organizationId = machineRepository.findByMachineId(machineId)
                .map(Machine::getOrganizationId)
                .orElse(null);
        if (organizationId == null) {
            log.debug("No current organization for machine {}; owner scope falls back to machine only", machineId);
        }
        return Optional.of(new ClientOwnerScope(machineId, organizationId));
    }
}
