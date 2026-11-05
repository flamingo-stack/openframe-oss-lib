package com.openframe.client.service.agentregistration.transformer;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.data.service.ToolUrlService;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.FleetTenantHeader;
import com.openframe.sdk.fleetmdm.model.Host;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

import static java.util.Comparator.comparing;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
@Slf4j
public class FleetMdmAgentIdTransformer implements ToolAgentIdTransformer {

    private static final String TOOL_ID = "fleetmdm-server";

    private final IntegratedToolService integratedToolService;
    private final ToolUrlService toolUrlService;

    @Value("${TENANT_ID:}")
    private String tenantId;

    @Value("${openframe.fleet.multi-tenancy.enabled:false}")
    private boolean fleetMultiTenancyEnabled;

    @PostConstruct
    void validateTenantConfig() {
        FleetTenantHeader.validate(fleetMultiTenancyEnabled, tenantId);
    }

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
            FleetMdmClient fleetClient = buildClient();

            return findHostByUuid(fleetClient, machineId, agentToolId)
                    .or(() -> findHostByOsqueryHostId(fleetClient, machineId, agentToolId))
                    .map(host -> processMatchingHost(machineId, agentToolId, host))
                    .orElseGet(() -> processNoMatchingHost(machineId, agentToolId, lastAttempt));
        } catch (Exception e) {
            log.error("Failed to transform Fleet MDM agent tool ID, machineId={}, uuid={}", machineId, agentToolId, e);
            throw new IllegalStateException("Failed to transform Fleet MDM agent tool ID", e);
        }
    }

    private FleetMdmClient buildClient() {
        IntegratedTool integratedTool = integratedToolService.getToolByKey(TOOL_ID)
                .orElseThrow(() -> new IllegalStateException("Found no tool with id " + TOOL_ID));

        ToolUrl toolUrl = toolUrlService.getUrlByToolType(integratedTool, ToolUrlType.API)
                .orElseThrow(() -> new IllegalStateException("Found no api url for tool with id " + TOOL_ID));

        String apiUrl = toolUrl.getUrl() + ":" + toolUrl.getPort();
        String apiToken = integratedTool.getCredentials().getApiKey().getKey();

        return createClient(apiUrl, apiToken);
    }

    protected FleetMdmClient createClient(String apiUrl, String apiToken) {
        return new FleetMdmClient(apiUrl, apiToken, tenantId);
    }

    private Optional<Host> findHostByUuid(FleetMdmClient fleetClient, String machineId, String uuid) {
        List<Host> hosts = fleetClient.searchHosts(uuid, 0, 2);
        logHosts(machineId, uuid, hosts);

        Optional<Host> newestEnrolled = hosts.stream()
                .filter(host -> uuid.equals(host.getUuid()))
                .filter(FleetMdmAgentIdTransformer::hasOsqueryVersion)
                .max(comparing(FleetMdmAgentIdTransformer::lastEnrolledAtOrEmpty));

        newestEnrolled.ifPresent(host -> logUuidMatch(machineId, uuid, host));
        return newestEnrolled;
    }

    // Instance-mode devices (ORBIT_HOST_IDENTIFIER=instance) report an osquery_host_id the host search never matches.
    private Optional<Host> findHostByOsqueryHostId(FleetMdmClient fleetClient, String machineId, String osqueryHostId) {
        Host host = fleetClient.getHostByIdentifier(osqueryHostId);

        Optional<Host> enrolledWithId = Optional.ofNullable(host)
                .filter(candidate -> isEnrolledWithOsqueryHostId(candidate, osqueryHostId))
                .filter(FleetMdmAgentIdTransformer::hasOsqueryVersion);

        enrolledWithId.ifPresent(matched -> logOsqueryHostIdMatch(machineId, osqueryHostId, matched));
        return enrolledWithId;
    }

    private static boolean isEnrolledWithOsqueryHostId(Host host, String osqueryHostId) {
        return osqueryHostId.equals(host.getOsqueryHostId());
    }

    private static boolean hasOsqueryVersion(Host host) {
        return isNotBlank(host.getOsqueryVersion());
    }

    private static String lastEnrolledAtOrEmpty(Host host) {
        String lastEnrolledAt = host.getLastEnrolledAt();
        return isNotBlank(lastEnrolledAt) ? lastEnrolledAt : "";
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

    private void logUuidMatch(String machineId, String uuid, Host host) {
        Long hostId = host.getId();
        String osqueryHostId = host.getOsqueryHostId();
        log.info("Matched host by uuid, machineId={}, uuid={}, host_id={}, osquery_host_id={}", machineId, uuid, hostId, osqueryHostId);
    }

    private void logOsqueryHostIdMatch(String machineId, String osqueryHostId, Host host) {
        Long hostId = host.getId();
        String uuid = host.getUuid();
        log.info("Matched host by osquery_host_id, machineId={}, osquery_host_id={}, host_id={}, uuid={}", machineId, osqueryHostId, hostId, uuid);
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
