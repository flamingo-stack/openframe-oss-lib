package com.openframe.api.relay;

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
import com.openframe.graphql.node.NodeLoader;
import com.openframe.graphql.relay.NodeType;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiNodeLoaderConfigurationTest {

    private static final String RAW_ID = "665f1c2ab3e4d5f6a7b8c9d0";
    private static final String MACHINE_ID = "machine-1";
    private static final String ORGANIZATION_ID = "organization-1";

    @Mock private DeviceService deviceService;
    @Mock private OrganizationService organizationService;
    @Mock private ToolService toolService;
    @Mock private TagService tagService;
    @Mock private ToolConnectionService toolConnectionService;
    @Mock private InstalledAgentService installedAgentService;
    @Mock private ScriptService scriptService;
    @Mock private ScriptExecutionService scriptExecutionService;
    @Mock private ScheduleScriptService scheduleScriptService;
    @Mock private ScheduleRunService scheduleRunService;
    @Mock private UserService userService;
    @Mock private TenantRepository tenantRepository;
    @Mock private SoftwareBundleService softwareBundleService;
    @Mock private TicketService ticketService;
    @Mock private ObjectProvider<TenantRepository> tenantRepositories;
    @Mock private ObjectProvider<SoftwareBundleService> softwareBundleServices;
    @Mock private ObjectProvider<TicketService> ticketServices;

    @InjectMocks private ApiNodeLoaderConfiguration configuration;

    private AuthPrincipal principal;

    @BeforeEach
    void setUp() {
        principal = AuthPrincipal.builder().id("agent-1").machineId(MACHINE_ID).actorType(ActorType.AGENT).build();
    }

    @Test
    void nodeLoaders_everyBean_declaresItsNodeTypeAndClass() {
        // execution
        List<NodeLoader<?>> loaders = allLoaders();

        // verifications
        assertThat(loaders)
                .extracting(NodeLoader::type, NodeLoader::nodeClass)
                .containsExactlyInAnyOrder(
                        tuple(NodeType.MACHINE, Machine.class),
                        tuple(NodeType.ORGANIZATION, Organization.class),
                        tuple(NodeType.INTEGRATED_TOOL, IntegratedTool.class),
                        tuple(NodeType.TAG, Tag.class),
                        tuple(NodeType.TOOL_CONNECTION, ToolConnection.class),
                        tuple(NodeType.INSTALLED_AGENT, InstalledAgent.class),
                        tuple(NodeType.SCRIPT, ScriptResponse.class),
                        tuple(NodeType.SCRIPT_EXECUTION, ScriptExecutionResponse.class),
                        tuple(NodeType.SCRIPT_SCHEDULE, ScriptScheduleResponse.class),
                        tuple(NodeType.SCHEDULE_RUN, ScheduleRunResponse.class),
                        tuple(NodeType.TENANT, Tenant.class),
                        tuple(NodeType.SOFTWARE_BUNDLE, SoftwareBundleResponse.class),
                        tuple(NodeType.TICKET, Ticket.class),
                        tuple(NodeType.USER, UserResponse.class));
    }

    @Test
    void machineNodeLoader_machineId_foundThroughDeviceService() {
        // setup
        Machine machine = new Machine();
        when(deviceService.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        NodeLoader<Machine> loader = configuration.machineNodeLoader(deviceService);

        // execution
        Optional<Machine> found = loader.find(principal, MACHINE_ID);

        // verifications
        assertThat(found).containsSame(machine);
    }

    @Test
    void organizationNodeLoader_organizationId_foundThroughOrganizationService() {
        // setup
        Organization organization = Organization.builder().build();
        when(organizationService.getOrganizationByOrganizationId(ORGANIZATION_ID)).thenReturn(Optional.of(organization));
        NodeLoader<Organization> loader = configuration.organizationNodeLoader(organizationService);

        // execution
        Optional<Organization> found = loader.find(principal, ORGANIZATION_ID);

        // verifications
        assertThat(found).containsSame(organization);
    }

    @Test
    void integratedToolNodeLoader_rawId_foundThroughToolService() {
        // setup
        IntegratedTool tool = IntegratedTool.builder().build();
        when(toolService.findById(RAW_ID)).thenReturn(Optional.of(tool));
        NodeLoader<IntegratedTool> loader = configuration.integratedToolNodeLoader(toolService);

        // execution
        Optional<IntegratedTool> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(tool);
    }

    @Test
    void tagNodeLoader_rawId_foundThroughTagService() {
        // setup
        Tag tag = Tag.builder().build();
        when(tagService.findById(RAW_ID)).thenReturn(Optional.of(tag));
        NodeLoader<Tag> loader = configuration.tagNodeLoader(tagService);

        // execution
        Optional<Tag> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(tag);
    }

    @Test
    void toolConnectionNodeLoader_rawId_foundThroughToolConnectionService() {
        // setup
        ToolConnection connection = new ToolConnection();
        when(toolConnectionService.findById(RAW_ID)).thenReturn(Optional.of(connection));
        NodeLoader<ToolConnection> loader = configuration.toolConnectionNodeLoader(toolConnectionService);

        // execution
        Optional<ToolConnection> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(connection);
    }

    @Test
    void installedAgentNodeLoader_rawId_foundThroughInstalledAgentService() {
        // setup
        InstalledAgent agent = InstalledAgent.builder().build();
        when(installedAgentService.getInstalledAgent(RAW_ID)).thenReturn(Optional.of(agent));
        NodeLoader<InstalledAgent> loader = configuration.installedAgentNodeLoader(installedAgentService);

        // execution
        Optional<InstalledAgent> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(agent);
    }

    @Test
    void scriptNodeLoader_rawId_foundThroughScriptService() {
        // setup
        ScriptResponse script = ScriptResponse.builder().build();
        when(scriptService.findById(RAW_ID)).thenReturn(Optional.of(script));
        NodeLoader<ScriptResponse> loader = configuration.scriptNodeLoader(scriptService);

        // execution
        Optional<ScriptResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(script);
    }

    @Test
    void scriptExecutionNodeLoader_rawId_foundThroughScriptExecutionService() {
        // setup
        ScriptExecutionResponse execution = ScriptExecutionResponse.builder().build();
        when(scriptExecutionService.findById(RAW_ID)).thenReturn(Optional.of(execution));
        NodeLoader<ScriptExecutionResponse> loader = configuration.scriptExecutionNodeLoader(scriptExecutionService);

        // execution
        Optional<ScriptExecutionResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(execution);
    }

    @Test
    void scriptScheduleNodeLoader_rawId_foundThroughScheduleScriptService() {
        // setup
        ScriptScheduleResponse schedule = ScriptScheduleResponse.builder().build();
        when(scheduleScriptService.findById(RAW_ID)).thenReturn(Optional.of(schedule));
        NodeLoader<ScriptScheduleResponse> loader = configuration.scriptScheduleNodeLoader(scheduleScriptService);

        // execution
        Optional<ScriptScheduleResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(schedule);
    }

    @Test
    void scheduleRunNodeLoader_rawId_foundThroughScheduleRunService() {
        // setup
        ScheduleRunResponse run = ScheduleRunResponse.builder().build();
        when(scheduleRunService.findById(RAW_ID)).thenReturn(Optional.of(run));
        NodeLoader<ScheduleRunResponse> loader = configuration.scheduleRunNodeLoader(scheduleRunService);

        // execution
        Optional<ScheduleRunResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(run);
    }

    @Test
    void tenantNodeLoader_repositoryDeployed_tenantFromTheRepository() {
        // setup
        Tenant tenant = Tenant.builder().id(RAW_ID).build();
        when(tenantRepositories.getIfAvailable()).thenReturn(tenantRepository);
        when(tenantRepository.findById(RAW_ID)).thenReturn(Optional.of(tenant));
        NodeLoader<Tenant> loader = configuration.tenantNodeLoader(tenantRepositories);

        // execution
        Optional<Tenant> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(tenant);
    }

    @Test
    void tenantNodeLoader_noRepositoryDeployed_empty() {
        // setup
        when(tenantRepositories.getIfAvailable()).thenReturn(null);
        NodeLoader<Tenant> loader = configuration.tenantNodeLoader(tenantRepositories);

        // execution
        Optional<Tenant> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void softwareBundleNodeLoader_serviceDeployed_bundleFromTheService() {
        // setup
        SoftwareBundleResponse bundle = SoftwareBundleResponse.builder().build();
        when(softwareBundleServices.getIfAvailable()).thenReturn(softwareBundleService);
        when(softwareBundleService.findById(RAW_ID)).thenReturn(Optional.of(bundle));
        NodeLoader<SoftwareBundleResponse> loader = configuration.softwareBundleNodeLoader(softwareBundleServices);

        // execution
        Optional<SoftwareBundleResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(bundle);
    }

    @Test
    void softwareBundleNodeLoader_noServiceDeployed_empty() {
        // setup
        when(softwareBundleServices.getIfAvailable()).thenReturn(null);
        NodeLoader<SoftwareBundleResponse> loader = configuration.softwareBundleNodeLoader(softwareBundleServices);

        // execution
        Optional<SoftwareBundleResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void ticketNodeLoader_serviceDeployed_ticketScopedToTheCaller() {
        // setup
        Ticket ticket = Ticket.builder().id(RAW_ID).build();
        when(ticketServices.getIfAvailable()).thenReturn(ticketService);
        when(ticketService.getTicket(principal, RAW_ID)).thenReturn(Optional.of(ticket));
        NodeLoader<Ticket> loader = configuration.ticketNodeLoader(ticketServices);

        // execution
        Optional<Ticket> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(ticket);
    }

    @Test
    void ticketNodeLoader_noServiceDeployed_empty() {
        // setup
        when(ticketServices.getIfAvailable()).thenReturn(null);
        NodeLoader<Ticket> loader = configuration.ticketNodeLoader(ticketServices);

        // execution
        Optional<Ticket> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).isEmpty();
    }

    @Test
    void userNodeLoader_knownUser_firstUserOfTheLookup() {
        // setup
        UserResponse user = UserResponse.builder().id(RAW_ID).build();
        when(userService.getUsersByIds(List.of(RAW_ID))).thenReturn(List.of(user));
        NodeLoader<UserResponse> loader = configuration.userNodeLoader(userService);

        // execution
        Optional<UserResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).containsSame(user);
    }

    @Test
    void userNodeLoader_unknownUser_empty() {
        // setup
        when(userService.getUsersByIds(List.of(RAW_ID))).thenReturn(List.of());
        NodeLoader<UserResponse> loader = configuration.userNodeLoader(userService);

        // execution
        Optional<UserResponse> found = loader.find(principal, RAW_ID);

        // verifications
        assertThat(found).isEmpty();
    }

    private List<NodeLoader<?>> allLoaders() {
        return List.of(
                configuration.machineNodeLoader(deviceService),
                configuration.organizationNodeLoader(organizationService),
                configuration.integratedToolNodeLoader(toolService),
                configuration.tagNodeLoader(tagService),
                configuration.toolConnectionNodeLoader(toolConnectionService),
                configuration.installedAgentNodeLoader(installedAgentService),
                configuration.scriptNodeLoader(scriptService),
                configuration.scriptExecutionNodeLoader(scriptExecutionService),
                configuration.scriptScheduleNodeLoader(scheduleScriptService),
                configuration.scheduleRunNodeLoader(scheduleRunService),
                configuration.tenantNodeLoader(tenantRepositories),
                configuration.softwareBundleNodeLoader(softwareBundleServices),
                configuration.ticketNodeLoader(ticketServices),
                configuration.userNodeLoader(userService));
    }
}
