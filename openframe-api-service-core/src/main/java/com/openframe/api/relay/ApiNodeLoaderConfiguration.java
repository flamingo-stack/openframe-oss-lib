package com.openframe.api.relay;

import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.rmm.execution.ScriptExecutionResponse;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.software.SoftwareBundleResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.rmm.software.SoftwareBundleService;
import com.openframe.api.service.ticket.TicketService;
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.node.LookupNodeLoader;
import com.openframe.graphql.node.NodeLoader;
import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.AuthPrincipal;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Optional;

@Configuration
public class ApiNodeLoaderConfiguration {

    @Bean
    public NodeLoader<Machine> machineNodeLoader(DeviceService deviceService) {
        return LookupNodeLoader.byRawId(NodeType.MACHINE, Machine.class, deviceService::findByMachineId);
    }

    @Bean
    public NodeLoader<Organization> organizationNodeLoader(OrganizationService organizationService) {
        return LookupNodeLoader.byRawId(NodeType.ORGANIZATION, Organization.class,
                organizationService::getOrganizationByOrganizationId);
    }

    @Bean
    public NodeLoader<IntegratedTool> integratedToolNodeLoader(ToolService toolService) {
        return LookupNodeLoader.byRawId(NodeType.INTEGRATED_TOOL, IntegratedTool.class, toolService::findById);
    }

    @Bean
    public NodeLoader<Tag> tagNodeLoader(TagService tagService) {
        return LookupNodeLoader.byRawId(NodeType.TAG, Tag.class, tagService::findById);
    }

    @Bean
    public NodeLoader<ToolConnection> toolConnectionNodeLoader(ToolConnectionService toolConnectionService) {
        return LookupNodeLoader.byRawId(NodeType.TOOL_CONNECTION, ToolConnection.class, toolConnectionService::findById);
    }

    @Bean
    public NodeLoader<InstalledAgent> installedAgentNodeLoader(InstalledAgentService installedAgentService) {
        return LookupNodeLoader.byRawId(NodeType.INSTALLED_AGENT, InstalledAgent.class,
                installedAgentService::getInstalledAgent);
    }

    @Bean
    public NodeLoader<ScriptResponse> scriptNodeLoader(ScriptService scriptService) {
        return LookupNodeLoader.byRawId(NodeType.SCRIPT, ScriptResponse.class, scriptService::findById);
    }

    @Bean
    public NodeLoader<ScriptExecutionResponse> scriptExecutionNodeLoader(ScriptExecutionService scriptExecutionService) {
        return LookupNodeLoader.byRawId(NodeType.SCRIPT_EXECUTION, ScriptExecutionResponse.class,
                scriptExecutionService::findById);
    }

    @Bean
    public NodeLoader<ScriptScheduleResponse> scriptScheduleNodeLoader(ScheduleScriptService scheduleScriptService) {
        return LookupNodeLoader.byRawId(NodeType.SCRIPT_SCHEDULE, ScriptScheduleResponse.class,
                scheduleScriptService::findById);
    }

    @Bean
    public NodeLoader<ScheduleRunResponse> scheduleRunNodeLoader(ScheduleRunService scheduleRunService) {
        return LookupNodeLoader.byRawId(NodeType.SCHEDULE_RUN, ScheduleRunResponse.class, scheduleRunService::findById);
    }

    // Tenant, SoftwareBundle and Ticket beans exist only in some deployments: without one the node is null.
    @Bean
    public NodeLoader<Tenant> tenantNodeLoader(ObjectProvider<TenantRepository> tenantRepository) {
        return LookupNodeLoader.byRawId(NodeType.TENANT, Tenant.class, rawId -> findTenant(tenantRepository, rawId));
    }

    @Bean
    public NodeLoader<SoftwareBundleResponse> softwareBundleNodeLoader(
            ObjectProvider<SoftwareBundleService> softwareBundleService) {
        return LookupNodeLoader.byRawId(NodeType.SOFTWARE_BUNDLE, SoftwareBundleResponse.class,
                rawId -> findSoftwareBundle(softwareBundleService, rawId));
    }

    @Bean
    public NodeLoader<Ticket> ticketNodeLoader(ObjectProvider<TicketService> ticketService) {
        return LookupNodeLoader.byPrincipalAndRawId(NodeType.TICKET, Ticket.class,
                (principal, rawId) -> findTicket(ticketService, principal, rawId));
    }

    @Bean
    public NodeLoader<UserResponse> userNodeLoader(UserService userService) {
        return LookupNodeLoader.byRawId(NodeType.USER, UserResponse.class, rawId -> findUser(userService, rawId));
    }

    // Accepted and revoked invitations are not nodes: the invitations list shows open ones only.
    @Bean
    public NodeLoader<InvitationResponse> invitationNodeLoader(InvitationService invitationService) {
        return LookupNodeLoader.byRawId(NodeType.INVITATION, InvitationResponse.class,
                invitationService::findOpenInvitation);
    }

    private static Optional<Tenant> findTenant(ObjectProvider<TenantRepository> tenantRepository, String rawId) {
        TenantRepository repository = tenantRepository.getIfAvailable();
        return Optional.ofNullable(repository)
                .flatMap(tenants -> tenants.findById(rawId));
    }

    private static Optional<SoftwareBundleResponse> findSoftwareBundle(
            ObjectProvider<SoftwareBundleService> softwareBundleService, String rawId) {
        SoftwareBundleService service = softwareBundleService.getIfAvailable();
        return Optional.ofNullable(service)
                .flatMap(bundles -> bundles.findById(rawId));
    }

    private static Optional<Ticket> findTicket(ObjectProvider<TicketService> ticketService, AuthPrincipal principal,
                                               String rawId) {
        TicketService service = ticketService.getIfAvailable();
        return Optional.ofNullable(service)
                .flatMap(tickets -> tickets.getTicket(principal, rawId));
    }

    private static Optional<UserResponse> findUser(UserService userService, String rawId) {
        List<String> ids = List.of(rawId);
        List<UserResponse> users = userService.getUsersByIds(ids);
        return users.stream().findFirst();
    }
}
