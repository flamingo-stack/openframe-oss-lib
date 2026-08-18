package com.openframe.client.service;

import com.openframe.data.exception.UserNotFoundException;
import com.openframe.data.document.installedagents.UserInstalledAgent;
import com.openframe.data.repository.installedagents.UserInstalledAgentRepository;
import com.openframe.data.repository.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserInstalledAgentService {

    private final UserInstalledAgentRepository userInstalledAgentRepository;
    private final UserRepository userRepository;

    @Transactional
    public void upsertInstalledAgent(String userId, String agentType, String version) {
        validateUserId(userId);
        validateAgentType(agentType);
        validateUserExists(userId);

        log.info("User installed agent processing: userId={}, agentType={}, version={}", userId, agentType, version);

        userInstalledAgentRepository
                .findByUserIdAndAgentType(userId, agentType)
                .ifPresentOrElse(
                        installedAgent -> updateExistingInstalledAgent(installedAgent, version, userId, agentType),
                        () -> addNewInstalledAgent(userId, agentType, version)
                );
    }

    private void updateExistingInstalledAgent(
            UserInstalledAgent installedAgent,
            String version,
            String userId,
            String agentType
    ) {
        installedAgent.setVersion(version);
        installedAgent.setUpdatedAt(Instant.now().toString());
        userInstalledAgentRepository.save(installedAgent);

        log.info("Updated existing user installed agent: userId={} agentType={} version={}",
                userId, agentType, version);
    }

    private void addNewInstalledAgent(String userId, String agentType, String version) {
        UserInstalledAgent installedAgent = new UserInstalledAgent();
        installedAgent.setUserId(userId);
        installedAgent.setAgentType(agentType);
        installedAgent.setVersion(version);

        String now = Instant.now().toString();
        installedAgent.setCreatedAt(now);
        installedAgent.setUpdatedAt(now);

        userInstalledAgentRepository.save(installedAgent);

        log.info("Saved new user installed agent: userId={} agentType={} version={}",
                userId, agentType, version);
    }

    private void validateUserExists(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new UserNotFoundException(userId);
        }
    }

    private void validateUserId(String userId) {
        if (userId == null || userId.trim().isEmpty()) {
            throw new IllegalArgumentException("User ID cannot be empty");
        }
    }

    private void validateAgentType(String agentType) {
        if (agentType == null || agentType.trim().isEmpty()) {
            throw new IllegalArgumentException("Agent type cannot be empty");
        }
    }
}
