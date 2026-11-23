package com.openframe.client.service.identitysplit;

import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.exception.IdentitySplitNotRequestedException;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.service.agentregistration.AgentRegistrationService;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentIdentitySplitServiceTest {

    private static final String MACHINE = "m-1";
    private static final String SECRET = "secret-1";
    private static final String SESSION = "s-1";

    @Mock
    private OAuthClientRepository oauthClientRepository;
    @Mock
    private ClientSecretValidator clientSecretValidator;
    @Mock
    private MachineRepository machineRepository;
    @Mock
    private MachineIdentityConflictService conflictService;
    @Mock
    private AgentRegistrationService agentRegistrationService;

    private AgentIdentitySplitService service;
    private OAuthClient client;

    @BeforeEach
    void setUp() {
        service = new AgentIdentitySplitService(oauthClientRepository, clientSecretValidator, machineRepository,
                conflictService, agentRegistrationService);
        client = new OAuthClient();
        client.setMachineId(MACHINE);
    }

    @Test
    void split_requestedSession_registersAMachineOfItsOwn() {
        // setup
        Machine shared = new Machine();
        shared.setMachineId(MACHINE);
        AgentRegistrationResponse registered = new AgentRegistrationResponse("m-2", "agent_m-2", "secret-2");
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(client));
        when(conflictService.takeSplitRequest(MACHINE, SESSION)).thenReturn(true);
        when(machineRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(shared));
        when(agentRegistrationService.registerSplit(shared)).thenReturn(registered);

        // execution
        AgentRegistrationResponse response = service.split(MACHINE, SECRET, SESSION);

        // verifications
        assertThat(response).isSameAs(registered);
        verify(clientSecretValidator).validate(client, SECRET);
    }

    @Test
    void split_sessionNotRequested_conflictAndNoMachine() {
        // setup
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(client));
        when(conflictService.takeSplitRequest(MACHINE, SESSION)).thenReturn(false);

        // execution / verifications
        assertThatThrownBy(() -> service.split(MACHINE, SECRET, SESSION))
                .isInstanceOf(IdentitySplitNotRequestedException.class);
        verifyNoInteractions(agentRegistrationService);
    }

    @Test
    void split_wrongSecret_refusedBeforeTheRequestIsTaken() {
        // setup
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.of(client));
        doThrow(new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret"))
                .when(clientSecretValidator).validate(any(), any());

        // execution / verifications
        assertThatThrownBy(() -> service.split(MACHINE, "wrong", SESSION))
                .isInstanceOf(InvalidClientSecretException.class);
        verifyNoInteractions(conflictService, agentRegistrationService);
    }

    @Test
    void split_unknownMachine_invalidSecret() {
        // setup
        when(oauthClientRepository.findByMachineId(MACHINE)).thenReturn(Optional.empty());

        // execution / verifications
        assertThatThrownBy(() -> service.split(MACHINE, SECRET, SESSION))
                .isInstanceOf(InvalidClientSecretException.class);
        verifyNoInteractions(conflictService, agentRegistrationService);
    }
}
