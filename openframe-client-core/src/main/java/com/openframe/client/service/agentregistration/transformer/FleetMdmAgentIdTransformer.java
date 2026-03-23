package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.ToolUrlService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
@Slf4j
public class FleetMdmAgentIdTransformer implements ToolAgentIdTransformer {

    private static final String TOOL_ID = "fleetmdm-server";

    private final IntegratedToolService integratedToolService;
    private final ToolUrlService toolUrlService;

    @Override
    public ToolType getToolType() {
        return ToolType.FLEET_MDM;
    }

    // TODO: have normal fleetmdm-agent mdm openframe sdk that get url and api key from the box.
    //  Use it here and at other places.
    // TODO: revise logic or full architecture:
    @Override
    public String transform(String machineId, String agentToolId, boolean lastAttempt) {
        if (isBlank(agentToolId)) {
            log.warn("Agent tool ID is blank for Fleet MDM, machineId={}", machineId);
            return agentToolId;
        }

        try {
            IntegratedTool integratedTool = integratedToolService.getToolById(TOOL_ID)
                    .orElseThrow(() -> new IllegalStateException("Found no tool with id " + TOOL_ID));
            
            ToolUrl toolUrl = toolUrlService.getUrlByToolType(integratedTool, ToolUrlType.API)
                    .orElseThrow(() -> new IllegalStateException("Found no api url for tool with id " + TOOL_ID));

            String apiUrl = toolUrl.getUrl() + ":" + toolUrl.getPort();
            String apiToken = integratedTool.getCredentials().getApiKey().getKey();

            FleetMdmClient fleetClient = new FleetMdmClient(apiUrl, apiToken);

            List<Host> hosts = fleetClient.searchHosts(agentToolId, 0, 2);
            
            if (hosts.isEmpty()) {
                throw new IllegalStateException("No hosts found in Fleet MDM for UUID: " + agentToolId);
            }
            logHosts(machineId, agentToolId, hosts);

            List<Host> uuidMatched = hosts.stream()
                    .filter(host -> agentToolId.equals(host.getUuid()))
                    .toList();

            return uuidMatched.stream()
                    .filter(host -> agentToolId.equals(host.getUuid()))
                    .filter(host -> isNotBlank(host.getOsqueryVersion()))
                    .peek(host -> logOsqueryHostIdMatch(machineId, agentToolId, host))
                    .findFirst()
                    .map(host -> processMatchingHost(machineId, agentToolId, host))
                    .orElseGet(() -> processNoMatchingHost(machineId, agentToolId, lastAttempt));
        } catch (Exception e) {
            log.error("Failed to transform Fleet MDM agent tool ID, machineId={}, uuid={}", machineId, agentToolId, e);
            throw new IllegalStateException("Failed to transform Fleet MDM agent tool ID", e);
        }
    }

    private String processMatchingHost(String machineId, String agentToolId, Host host) {
        String transformedAgentToolId = String.valueOf(host.getId());
        log.info("Transformed Fleet MDM agent tool ID, machineId={}, uuid={}, host_id={}", machineId, agentToolId, transformedAgentToolId);
        return transformedAgentToolId;
    }

    private String processNoMatchingHost(String machineId, String agentToolId, boolean lastAttempt) {
        log.warn("No matching host found, machineId={}, uuid={}", machineId, agentToolId);
        if (!lastAttempt) {
            throw new IllegalStateException("No valid fleetmdm-agent mdm host found with machineId=" + machineId + ", uuid=" + agentToolId);
        }
        log.info("Use uuid to fix it manually, machineId={}, uuid={}", machineId, agentToolId);
        return agentToolId;
    }

    private void logOsqueryHostIdMatch(String machineId, String uuid, Host host) {
        Long hostId = host.getId();
        String osqueryHostId = host.getOsqueryHostId();
        log.info("Matched host by osquery_host_id, machineId={}, uuid={}, host_id={}, osquery_host_id={}", machineId, uuid, hostId, osqueryHostId);
    }

    private void logHosts(String machineId, String uuid, List<Host> hosts) {
        String hostsInfo = buildHostInfo(hosts);
        log.info("Fleet hosts search result, machineId={}, uuid={}\n{}", machineId, uuid, hostsInfo);
    }

    private String buildHostInfo(List<Host> hosts) {
        return hosts.stream()
                .map(Host::toString)
                .collect(Collectors.joining("\n"));
    }
}
