package com.openframe.data.service;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentStatus;
import com.openframe.data.repository.toolagent.IntegratedToolAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IntegratedToolAgentService {

    private final IntegratedToolAgentRepository agentRepository;

    public IntegratedToolAgent save(IntegratedToolAgent agent) {
        return agentRepository.save(agent);
    }

    public List<IntegratedToolAgent> getAll() {
        return agentRepository.findAll();
    }

    public List<IntegratedToolAgent> getAllEnabled() {
        return agentRepository.findByStatus(ToolAgentStatus.ENABLED);
    }

    public Optional<IntegratedToolAgent> findById(String id) {
        return agentRepository.findById(id);
    }

    public IntegratedToolAgent getById(String id) {
        return agentRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("No tool agent configuration found by id " + id));
    }

    public List<IntegratedToolAgent> findByReleaseVersionTrue() {
        return agentRepository.findByReleaseVersionTrue();
    }

    public void updateVersionForReleaseAgents(String version) {
        List<IntegratedToolAgent> releaseAgents = findByReleaseVersionTrue();
        releaseAgents.forEach(agent -> {
            agent.setVersion(version);
            save(agent);
        });
        log.info("Updated version to {} for {} release agents", version, releaseAgents.size());
    }
} 