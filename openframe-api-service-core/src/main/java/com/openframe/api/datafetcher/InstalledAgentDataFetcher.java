package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.installedagent.InstalledAgentFilterInput;
import com.openframe.api.dto.installedagent.InstalledAgentList;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.data.document.installedagents.InstalledAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.stream.Collectors;

@DgsComponent
@Slf4j
@RequiredArgsConstructor
public class InstalledAgentDataFetcher {

    private final InstalledAgentService installedAgentService;

    @DgsQuery
    public InstalledAgentList installedAgents(
            @InputArgument InstalledAgentFilterInput filter,
            @InputArgument String search) {
        
        log.debug("Fetching installed agents with filter: {}, search: {}", filter, search);
        
        List<InstalledAgent> agents = installedAgentService.getAllInstalledAgents();
        
        // Apply filters if provided
        if (filter != null) {
            agents = applyFilters(agents, filter);
        }
        
        // Apply search if provided
        if (search != null && !search.isEmpty()) {
            agents = applySearch(agents, search);
        }
        
        InstalledAgentList result = new InstalledAgentList();
        result.setAgents(agents);
        return result;
    }
    
    private List<InstalledAgent> applyFilters(List<InstalledAgent> agents, InstalledAgentFilterInput filter) {
        return agents.stream()
                .filter(agent -> {
                    if (filter.getMachineId() != null && !filter.getMachineId().equals(agent.getMachineId())) {
                        return false;
                    }
                    if (filter.getAgentType() != null && !filter.getAgentType().equals(agent.getAgentType())) {
                        return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }
    
    private List<InstalledAgent> applySearch(List<InstalledAgent> agents, String search) {
        String searchLower = search.toLowerCase();
        return agents.stream()
                .filter(agent -> 
                    agent.getAgentType().toLowerCase().contains(searchLower) ||
                    agent.getVersion().toLowerCase().contains(searchLower) ||
                    agent.getMachineId().toLowerCase().contains(searchLower)
                )
                .collect(Collectors.toList());
    }
}

