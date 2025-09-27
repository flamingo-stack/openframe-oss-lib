package com.openframe.data.service;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentStatus;
import com.openframe.data.repository.mongo.IntegratedToolAgentRepository;
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
} 