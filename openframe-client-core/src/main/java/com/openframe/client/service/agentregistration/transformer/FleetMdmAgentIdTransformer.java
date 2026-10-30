package com.openframe.client.service.agentregistration.transformer;

import com.openframe.client.service.agentregistration.fleet.FleetHostFactsWriter;
import com.openframe.client.service.agentregistration.fleet.FleetMdmClients;
import com.openframe.data.document.tool.ToolType;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
@Slf4j
public class FleetMdmAgentIdTransformer implements ToolAgentIdTransformer {

    private final FleetMdmClients fleetMdmClients;
    private final FleetHostFactsWriter fleetHostFactsWriter;

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
            FleetMdmClient fleetClient = fleetMdmClients.client();

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
                    .max(Comparator.comparing(host -> isNotBlank(host.getLastEnrolledAt()) ? host.getLastEnrolledAt() : ""))
                    .map(host -> {
                        logOsqueryHostIdMatch(machineId, agentToolId, host);
                        return processMatchingHost(machineId, agentToolId, host);
                    })
                    .orElseGet(() -> processNoMatchingHost(machineId, agentToolId, lastAttempt));
        } catch (Exception e) {
            log.error("Failed to transform Fleet MDM agent tool ID, machineId={}, uuid={}", machineId, agentToolId, e);
            throw new IllegalStateException("Failed to transform Fleet MDM agent tool ID", e);
        }
    }

    private String processMatchingHost(String machineId, String agentToolId, Host host) {
        String transformedAgentToolId = String.valueOf(host.getId());
        log.info("Transformed Fleet MDM agent tool ID, machineId={}, uuid={}, host_id={}", machineId, agentToolId, transformedAgentToolId);
        fillHostFacts(machineId, host);
        return transformedAgentToolId;
    }

    // The facts come for free with the lookup; failing to store them must never fail the tool connection
    private void fillHostFacts(String machineId, Host host) {
        try {
            fleetHostFactsWriter.fill(machineId, host);
        } catch (Exception e) {
            log.warn("Failed to fill Fleet host facts, machineId={}, host_id={}", machineId, host.getId(), e);
        }
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
