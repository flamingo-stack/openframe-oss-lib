package com.openframe.api.datafetcher;

import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.dto.device.DeviceEnrollmentResponse;
import com.openframe.api.dto.device.MachinePackageManagersResponse;
import com.openframe.api.dto.device.MachineTag;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.ChocolateyDecisionService;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.FleetVulnerabilityStatusService;
import com.openframe.api.service.TagService;
import com.openframe.api.dataloader.MachineTagDataLoader;
import com.openframe.api.dataloader.UnreadNotificationDataLoader;
import com.openframe.api.dataloader.UnreadNotificationKey;
import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.api.service.NotificationRecipientResolver;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.data.config.ClientVersionThreshold;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;
import com.openframe.data.document.device.chocolatey.ChocolateyAdminOption;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.UnsupportedTool;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import graphql.GraphQLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import org.dataloader.DataLoader;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceDataFetcherTest {

    private static final String USER_ID = "user-1";

    @Mock private DeviceService deviceService;
    @Mock private DeviceFilterService deviceFilterService;
    @Mock private TagService tagService;
    @Mock private GraphQLDeviceMapper mapper;
    @Mock private FleetVulnerabilityStatusService fleetVulnerabilityStatusService;
    @Mock private NotificationRecipientResolver recipientResolver;
    @Mock private ToolOsSupportService toolOsSupportService;
    @Mock private ChocolateyDecisionService chocolateyDecisionService;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();
    @Spy private ClientVersionThreshold clientVersionThreshold = new ClientVersionThreshold("1.6.0");

    @InjectMocks private DeviceDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("userId", USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @ParameterizedTest
    @EnumSource(ChocolateyAdminOption.class)
    void setChocolateyDecision_option_storedForTheCurrentUserAndTheUpdatedMachineReturned(ChocolateyAdminOption option) {
        // setup
        Machine updated = new Machine();
        updated.setMachineId("m1");
        when(chocolateyDecisionService.set("m1", option, USER_ID)).thenReturn(updated);

        // execution
        Machine result = fetcher.setChocolateyDecision("m1", option);

        // verifications
        assertThat(result).isSameAs(updated);
        verify(chocolateyDecisionService).set("m1", option, USER_ID);
    }

    @Test
    void packageManagers_machine_mappedFromTheWholeMachineSoChocolateyIsIncluded() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        MachinePackageManagersResponse mapped = MachinePackageManagersResponse.builder()
                .choco(PackageManagerState.PRESENT)
                .build();
        when(dfe.getSource()).thenReturn(machine);
        when(mapper.toPackageManagers(machine)).thenReturn(mapped);

        // execution
        MachinePackageManagersResponse result = fetcher.packageManagers(dfe);

        // verifications
        assertThat(result).isSameAs(mapped);
    }

    @Test
    @DisplayName("updateDeviceNickname: delegates to DeviceService.updateNickname and returns the updated device")
    void updateDeviceNickname_delegates() {
        Machine updated = new Machine();
        updated.setMachineId("m1");
        updated.setNickname("Reception iMac");
        when(deviceService.updateNickname("m1", "Reception iMac")).thenReturn(updated);

        Machine result = fetcher.updateDeviceNickname("m1", "Reception iMac");

        assertThat(result).isSameAs(updated);
        assertThat(result.getNickname()).isEqualTo("Reception iMac");
        verify(deviceService).updateNickname("m1", "Reception iMac");
    }

    @Test
    @DisplayName("updateDeviceNickname: passes a null nickname through to clear it")
    void updateDeviceNickname_null() {
        Machine updated = new Machine();
        updated.setMachineId("m1");
        when(deviceService.updateNickname("m1", null)).thenReturn(updated);

        Machine result = fetcher.updateDeviceNickname("m1", null);

        assertThat(result.getNickname()).isNull();
        verify(deviceService).updateNickname("m1", null);
    }

    @Test
    @DisplayName("connectivity: reads the machine's telemetryStatus, not its lifecycle status")
    void connectivity_readsTelemetryStatus() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        machine.setTelemetryStatus(TelemetryStatus.OFFLINE);
        when(dfe.getSource()).thenReturn(machine);

        // execution
        TelemetryStatus result = fetcher.connectivity(dfe);

        // verifications
        assertThat(result).isEqualTo(TelemetryStatus.OFFLINE);
    }

    @Test
    @DisplayName("connectivity: null until the first heartbeat")
    void connectivity_nullBeforeFirstHeartbeat() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        when(dfe.getSource()).thenReturn(machine);

        // execution
        TelemetryStatus result = fetcher.connectivity(dfe);

        // verifications
        assertThat(result).isNull();
    }

    @ParameterizedTest
    @MethodSource("clientOutdatedCases")
    void clientOutdated_agentVersionKeyAgainstThreshold_outdatedOnlyBelow(Long agentVersionKey, boolean expected) {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        machine.setAgentVersionKey(agentVersionKey);
        when(dfe.getSource()).thenReturn(machine);

        // execution
        boolean result = fetcher.clientOutdated(dfe);

        // verifications
        assertThat(result).isEqualTo(expected);
    }

    @Test
    void unsupportedTools_machineBelowMinimum_serviceListReturned() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        List<AgentWithToolType> agents = List.of(new AgentWithToolType(new IntegratedToolAgent(), ToolType.FLEET_MDM));
        List<UnsupportedTool> unsupported = List.of(new UnsupportedTool("fleetmdm-agent", ToolType.FLEET_MDM, "13.0", "11.7.10"));
        when(dfe.getSource()).thenReturn(machine);
        when(dfe.getGraphQlContext()).thenReturn(GraphQLContext.newContext().build());
        when(toolOsSupportService.agentsWithMinOsVersion()).thenReturn(agents);
        when(toolOsSupportService.unsupportedTools(machine, agents)).thenReturn(unsupported);

        // execution
        List<UnsupportedTool> result = fetcher.unsupportedTools(dfe);

        // verifications
        assertThat(result).isSameAs(unsupported);
    }

    @Test
    void unsupportedTools_severalMachinesInOneRequest_agentsLoadedOnce() {
        // setup
        Machine first = new Machine();
        first.setMachineId("m1");
        Machine second = new Machine();
        second.setMachineId("m2");
        List<AgentWithToolType> agents = List.of(new AgentWithToolType(new IntegratedToolAgent(), ToolType.FLEET_MDM));
        when(dfe.getSource()).thenReturn(first, second);
        when(dfe.getGraphQlContext()).thenReturn(GraphQLContext.newContext().build());
        when(toolOsSupportService.agentsWithMinOsVersion()).thenReturn(agents);
        when(toolOsSupportService.unsupportedTools(first, agents)).thenReturn(List.of());
        when(toolOsSupportService.unsupportedTools(second, agents)).thenReturn(List.of());

        // execution
        fetcher.unsupportedTools(dfe);
        fetcher.unsupportedTools(dfe);

        // verifications
        verify(toolOsSupportService).agentsWithMinOsVersion();
        verify(toolOsSupportService).unsupportedTools(second, agents);
    }

    @Test
    void unsupportedTools_separateRequests_agentsLoadedPerRequest() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        List<AgentWithToolType> agents = List.of();
        when(dfe.getSource()).thenReturn(machine);
        when(dfe.getGraphQlContext()).thenReturn(GraphQLContext.newContext().build(), GraphQLContext.newContext().build());
        when(toolOsSupportService.agentsWithMinOsVersion()).thenReturn(agents);
        when(toolOsSupportService.unsupportedTools(machine, agents)).thenReturn(List.of());

        // execution
        fetcher.unsupportedTools(dfe);
        fetcher.unsupportedTools(dfe);

        // verifications
        verify(toolOsSupportService, times(2)).agentsWithMinOsVersion();
    }

    private static Stream<Arguments> clientOutdatedCases() {
        return Stream.of(
                Arguments.of(null, false),
                Arguments.of(1_000_005_000_009L, true),
                Arguments.of(1_000_006_000_000L, false),
                Arguments.of(1_000_006_000_001L, false));
    }

    @Test
    @DisplayName("toolConnectionVulnerabilitiesUpdatedAt: FLEET_MDM connection delegates to the status service")
    void toolConnectionVulnerabilitiesUpdatedAt_fleetMdm_delegatesToService() {
        Instant lastRunAt = Instant.parse("2026-08-26T09:31:13Z");
        ToolConnection connection = new ToolConnection();
        connection.setToolType(ToolType.FLEET_MDM);
        when(dfe.getSource()).thenReturn(connection);
        when(fleetVulnerabilityStatusService.getLastCompletedVulnerabilityRunAt()).thenReturn(lastRunAt);

        Instant result = fetcher.toolConnectionVulnerabilitiesUpdatedAt(dfe);

        assertThat(result).isEqualTo(lastRunAt);
        verify(fleetVulnerabilityStatusService).getLastCompletedVulnerabilityRunAt();
    }

    @Test
    @DisplayName("toolConnectionVulnerabilitiesUpdatedAt: non-Fleet connection returns null without calling the service")
    void toolConnectionVulnerabilitiesUpdatedAt_meshcentral_nullWithoutServiceCall() {
        ToolConnection connection = new ToolConnection();
        connection.setToolType(ToolType.MESHCENTRAL);
        when(dfe.getSource()).thenReturn(connection);

        Instant result = fetcher.toolConnectionVulnerabilitiesUpdatedAt(dfe);

        assertThat(result).isNull();
        verify(fleetVulnerabilityStatusService, never()).getLastCompletedVulnerabilityRunAt();
    }

    @Test
    @DisplayName("enrollment: loads the machine's tool connections through toolConnectionDataLoader and maps them")
    void enrollment_loadsToolConnectionsForTheMachineAndMaps() throws Exception {
        Machine machine = new Machine();
        machine.setMachineId("m1");
        List<ToolConnection> connections = List.of(new ToolConnection());
        DeviceEnrollmentResponse mapped = DeviceEnrollmentResponse.builder().ready(true).build();
        when(dfe.getSource()).thenReturn(machine);
        @SuppressWarnings("unchecked")
        DataLoader<String, List<ToolConnection>> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader("toolConnectionDataLoader");
        when(loader.load("m1")).thenReturn(CompletableFuture.completedFuture(connections));
        when(mapper.toEnrollment(machine, connections)).thenReturn(mapped);

        DeviceEnrollmentResponse result = fetcher.enrollment(dfe).get();

        assertThat(result).isSameAs(mapped);
        verify(mapper).toEnrollment(machine, connections);
    }

    @Test
    @DisplayName("directory fields: resolved through the mapper, so a null never reaches the non-null schema fields")
    void directoryFields_resolvedThroughTheMapper() {
        Machine machine = new Machine();
        machine.setMachineId("m1");
        when(dfe.getSource()).thenReturn(machine);
        when(mapper.toDirectorySources(machine)).thenReturn(List.of(DirectorySource.MICROSOFT_365));
        when(mapper.toDirectoryUserLink(machine)).thenReturn(DirectoryUserLink.PRIMARY);
        when(mapper.toDirectoryUserIds(machine)).thenReturn(List.of("acc-1"));

        assertThat(fetcher.directorySources(dfe)).containsExactly(DirectorySource.MICROSOFT_365);
        assertThat(fetcher.directoryUserLink(dfe)).isEqualTo(DirectoryUserLink.PRIMARY);
        assertThat(fetcher.directoryUserIds(dfe)).containsExactly("acc-1");
    }

    @Test
    @DisplayName("unreadNotificationCount: loads the current user's count for (DEVICE, machineId) through the unread notification loader")
    void unreadNotificationCount_loadsTheCurrentUsersDeviceCountThroughTheLoader() throws Exception {
        Machine machine = new Machine();
        machine.setMachineId("m1");
        when(dfe.getSource()).thenReturn(machine);
        when(recipientResolver.current()).thenReturn(new NotificationRecipient("user-alice", RecipientType.USER));
        @SuppressWarnings("unchecked")
        DataLoader<UnreadNotificationKey, Integer> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader(UnreadNotificationDataLoader.NAME);
        UnreadNotificationKey expectedKey = new UnreadNotificationKey(
                "user-alice", RecipientType.USER, NotificationEntityType.DEVICE, "m1");
        when(loader.load(expectedKey)).thenReturn(CompletableFuture.completedFuture(3));

        Integer result = fetcher.unreadNotificationCount(dfe).get();

        assertThat(result).isEqualTo(3);
        verify(loader).load(expectedKey);
    }

    @Test
    @DisplayName("tagAssignments: loads the machine's tag assignments through machineTagDataLoader")
    void tagAssignments_loadsTheMachinesAssignmentsThroughTheLoader() throws Exception {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("m1");
        List<MachineTag> assignments = List.of(MachineTag.builder().id("as-1").build());
        when(dfe.getSource()).thenReturn(machine);
        @SuppressWarnings("unchecked")
        DataLoader<String, List<MachineTag>> loader = mock(DataLoader.class);
        doReturn(loader).when(dfe).getDataLoader(MachineTagDataLoader.NAME);
        when(loader.load("m1")).thenReturn(CompletableFuture.completedFuture(assignments));

        // execution
        List<MachineTag> result = fetcher.tagAssignments(dfe).get();

        // verifications
        assertThat(result).isSameAs(assignments);
        verify(loader).load("m1");
    }
}
