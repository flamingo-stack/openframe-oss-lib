package com.openframe.client.service.identitysplit;

import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.exception.IdentitySplitNotRequestedException;
import com.openframe.client.exception.InvalidClientSecretException;
import com.openframe.client.exception.MachineNotFoundException;
import com.openframe.client.service.agentregistration.AgentRegistrationService;
import com.openframe.client.service.validator.ClientSecretValidator;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import static com.openframe.core.exception.ErrorCode.CLIENT_SECRET_INVALID;

@Service
@ConditionalOnProperty(name = "openframe.agent.identity-split.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class AgentIdentitySplitService {

    private final OAuthClientRepository oauthClientRepository;
    private final ClientSecretValidator clientSecretValidator;
    private final MachineRepository machineRepository;
    private final MachineIdentityConflictService conflictService;
    private final AgentRegistrationService agentRegistrationService;

    public AgentRegistrationResponse split(String machineId, String clientSecret, String sessionId) {
        OAuthClient client = oauthClientRepository.findByMachineId(machineId)
                .orElseThrow(() -> new InvalidClientSecretException(CLIENT_SECRET_INVALID, "Invalid client secret"));
        clientSecretValidator.validate(client, clientSecret);

        if (!conflictService.takeSplitRequest(machineId, sessionId)) {
            log.warn("Identity split of machine {} by session {} was not requested", machineId, sessionId);
            throw new IdentitySplitNotRequestedException("No identity split was requested for this session");
        }

        Machine shared = machineRepository.findByMachineId(machineId)
                .orElseThrow(() -> new MachineNotFoundException("Machine not found: " + machineId));
        AgentRegistrationResponse response = agentRegistrationService.registerSplit(shared);
        log.info("Session {} of machine {} registered as machine {}", sessionId, machineId, response.getMachineId());
        return response;
    }
}
