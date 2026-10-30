package com.openframe.api.service.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.model.ClientOwnerScope;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientOwnerScopeResolverTest {

    private static final AuthPrincipal AGENT = AuthPrincipal.builder().machineId("machine-1").actorType(ActorType.AGENT).build();
    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private MachineRepository machineRepository;

    @InjectMocks private ClientOwnerScopeResolver resolver;

    @Test
    void resolve_agent_scopeCarriesTheMachinesCurrentOrganization() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-b");
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.of(machine));

        // execution
        Optional<ClientOwnerScope> scope = resolver.resolve(AGENT);

        // verifications
        assertThat(scope).contains(new ClientOwnerScope("machine-1", "org-b"));
    }

    @Test
    void resolve_agentOfUnknownMachine_scopeWithoutOrganization() {
        // setup
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.empty());

        // execution
        Optional<ClientOwnerScope> scope = resolver.resolve(AGENT);

        // verifications
        assertThat(scope).contains(new ClientOwnerScope("machine-1", null));
    }

    @Test
    void forMachine_knownMachine_scopeCarriesItsCurrentOrganization() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-b");
        when(machineRepository.findByMachineId("machine-1")).thenReturn(Optional.of(machine));

        // execution
        ClientOwnerScope scope = resolver.forMachine("machine-1");

        // verifications
        assertThat(scope).isEqualTo(new ClientOwnerScope("machine-1", "org-b"));
    }

    @Test
    void resolve_admin_noScopeAndNoMachineLookup() {
        // execution
        Optional<ClientOwnerScope> scope = resolver.resolve(ADMIN);

        // verifications
        assertThat(scope).isEmpty();
        verifyNoInteractions(machineRepository);
    }
}
