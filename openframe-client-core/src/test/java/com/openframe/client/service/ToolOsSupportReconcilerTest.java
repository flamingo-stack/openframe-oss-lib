package com.openframe.client.service;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.delivery.DeliveryStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDelivery;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.document.toolagent.ToolAgentAsset;
import com.openframe.data.nats.delivery.ToolUninstallDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.ToolInstallationOutcome;
import com.openframe.data.service.ToolInstallationService;
import com.openframe.data.service.ToolOsSupportService;
import com.openframe.data.service.ToolOsSupportService.AgentWithToolType;
import com.openframe.data.service.machine.WithheldToolAgents;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.track.DeliveryTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ToolOsSupportReconcilerTest {

    private static final String MACHINE_ID = "m-1";
    private static final String AGENT_KEY = "fleetmdm-agent";
    private static final String OTHER_AGENT_KEY = "meshcentral-agent";
    private static final String ASSET_ID = "osqueryd";
    private static final String OLD_MAC_VERSION = "11.7.10";
    private static final String NEW_MAC_VERSION = "14.2";

    @Mock private ToolOsSupportService toolOsSupportService;
    @Mock private ToolInstallationService toolInstallationService;
    @Mock private DeliveryRouter deliveryRouter;
    @Mock private MachineRepository machineRepository;
    @Mock private InstalledAgentRepository installedAgentRepository;
    @Mock private ToolConnectionRepository toolConnectionRepository;
    @Mock private WithheldToolAgents withheldToolAgents;
    @Mock private DeviceLifecycleService deviceLifecycleService;
    @Mock private DeliveryTracker deliveryTracker;
    @Mock private IntegratedToolAgentService integratedToolAgentService;

    @Captor private ArgumentCaptor<ToolUninstallDeliverySeed> seedCaptor;
    @Captor private ArgumentCaptor<Collection<String>> agentTypesCaptor;

    @InjectMocks private ToolOsSupportReconciler reconciler;

    private IntegratedToolAgent agent;
    private List<AgentWithToolType> agents;
    private Machine machine;

    @BeforeEach
    void setUp() {
        DownloadConfiguration macos = new DownloadConfiguration();
        macos.setOs("macos");
        macos.setMinOsVersion("13.0");
        ToolAgentAsset osquery = new ToolAgentAsset();
        osquery.setId(ASSET_ID);
        agent = new IntegratedToolAgent();
        agent.setKey(AGENT_KEY);
        agent.setDownloadConfigurations(List.of(macos));
        agent.setAssets(List.of(osquery));
        agents = List.of(new AgentWithToolType(agent, ToolType.FLEET_MDM));
        machine = new Machine();
        machine.setId("id-m-1");
        machine.setMachineId(MACHINE_ID);
        machine.setOsType(OsType.MAC_OS);
        machine.setOsVersion(OLD_MAC_VERSION);
    }

    @Test
    void reconcile_unsupportedWithInstalledRow_uninstallSeedDispatched() {
        // setup
        stubPresentAndCarried();

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue())
                .extracting(ToolUninstallDeliverySeed::getMachineId, ToolUninstallDeliverySeed::getToolAgentId,
                        ToolUninstallDeliverySeed::getToolType)
                .containsExactly(MACHINE_ID, AGENT_KEY, "FLEET_MDM");
    }

    @Test
    void reconcile_unsupportedWithInstalledRow_nothingDeletedAtDispatch() {
        // setup
        stubPresentAndCarried();

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolConnectionRepository, never()).deleteByMachineIdAndToolType(anyString(), any(ToolType.class));
        verify(installedAgentRepository, never()).deleteByMachineIdAndAgentTypeIn(anyString(), anyCollection());
    }

    @Test
    void reconcile_unsupportedWithInstalledRow_withheldAndPromoted() {
        // setup
        stubPresentAndCarried();

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void reconcile_unsupportedWithOnlyAToolConnection_uninstallDispatchedAndWithheld() {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(new ToolConnection()));
        stubNoUninstallDelivery();
        when(deliveryRouter.dispatch(any(ToolUninstallDeliverySeed.class))).thenReturn(true);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue())
                .extracting(ToolUninstallDeliverySeed::getMachineId, ToolUninstallDeliverySeed::getToolAgentId,
                        ToolUninstallDeliverySeed::getToolType)
                .containsExactly(MACHINE_ID, AGENT_KEY, "FLEET_MDM");
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void reconcile_unsupportedWithOnlyAToolConnection_nothingDeletedAtDispatch() {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.of(new ToolConnection()));
        stubNoUninstallDelivery();
        when(deliveryRouter.dispatch(any(ToolUninstallDeliverySeed.class))).thenReturn(true);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolConnectionRepository, never()).deleteByMachineIdAndToolType(anyString(), any(ToolType.class));
        verify(installedAgentRepository, never()).deleteByMachineIdAndAgentTypeIn(anyString(), anyCollection());
    }

    @Test
    void reconcile_unsupportedPresentNoRouteCarriesTheUninstall_nothingDeletedOrWithheld() {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);
        stubNoUninstallDelivery();
        when(deliveryRouter.dispatch(any(ToolUninstallDeliverySeed.class))).thenReturn(false);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolConnectionRepository, never()).deleteByMachineIdAndToolType(anyString(), any(ToolType.class));
        verify(installedAgentRepository, never()).deleteByMachineIdAndAgentTypeIn(anyString(), anyCollection());
        verifyNoInteractions(withheldToolAgents, deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"PENDING", "ACKED"})
    void reconcile_unsupportedPresentUninstallInFlight_uninstallNotDispatchedAgain(DeliveryStatus status) {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);
        stubUninstallDelivery(status);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"PENDING", "ACKED"})
    void reconcile_unsupportedPresentUninstallInFlight_withheldAndPromoted(DeliveryStatus status) {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);
        stubUninstallDelivery(status);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"DONE", "FAILED", "CANCELLED"})
    void reconcile_unsupportedPresentUninstallClosed_uninstallDispatchedAgain(DeliveryStatus status) {
        // setup
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);
        stubUninstallDelivery(status);
        when(deliveryRouter.dispatch(any(ToolUninstallDeliverySeed.class))).thenReturn(true);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        assertThat(seedCaptor.getValue())
                .extracting(ToolUninstallDeliverySeed::getMachineId, ToolUninstallDeliverySeed::getToolAgentId,
                        ToolUninstallDeliverySeed::getToolType)
                .containsExactly(MACHINE_ID, AGENT_KEY, "FLEET_MDM");
    }

    @Test
    void reconcile_unsupportedAbsent_nothingDispatchedButWithheldAndPromoted() {
        // setup
        stubAbsent();

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(deliveryRouter, never()).dispatch(any(DeliverySeed.class));
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void reconcile_unsupportedAbsent_nothingDeleted() {
        // setup
        stubAbsent();

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolConnectionRepository, never()).deleteByMachineIdAndToolType(anyString(), any(ToolType.class));
        verify(installedAgentRepository, never()).deleteByMachineIdAndAgentTypeIn(anyString(), anyCollection());
    }

    @Test
    void reconcile_supportedWithheldWithInstalledRow_releasedWithoutInstall() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubNoUninstallDelivery();
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(withheldToolAgents).release(machine, AGENT_KEY);
        verifyNoInteractions(toolInstallationService);
    }

    @Test
    void reconcile_supportedWithheldNotInstalled_installDispatchedAndReleased() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubNoUninstallDelivery();
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolInstallationService).process(MACHINE_ID, agent);
        verify(withheldToolAgents).release(machine, AGENT_KEY);
    }

    @ParameterizedTest
    @EnumSource(value = ToolInstallationOutcome.class, names = {"NOT_CARRIED", "FAILED", "NOT_SUPPORTED"})
    void reconcile_supportedWithheldInstallNotDispatched_keptWithheld(ToolInstallationOutcome outcome) {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubNoUninstallDelivery();
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(outcome);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(withheldToolAgents, never()).release(any(Machine.class), anyString());
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"PENDING", "ACKED"})
    void reconcile_supportedWithheldUninstallInFlight_keptWithheldWithoutInstall(DeliveryStatus status) {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubUninstallDelivery(status);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verifyNoInteractions(toolInstallationService, installedAgentRepository, withheldToolAgents);
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"DONE", "FAILED", "CANCELLED"})
    void reconcile_supportedWithheldUninstallClosed_installDispatchedAndReleased(DeliveryStatus status) {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubUninstallDelivery(status);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(toolInstallationService).process(MACHINE_ID, agent);
        verify(withheldToolAgents).release(machine, AGENT_KEY);
    }

    @Test
    void reconcile_supportedNotWithheld_nothingDone() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(OTHER_AGENT_KEY));

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verifyNoInteractions(toolInstallationService, deliveryRouter, installedAgentRepository,
                toolConnectionRepository, withheldToolAgents, deviceLifecycleService, deliveryTracker);
    }

    @Test
    void reconcile_unknownVersionWithheld_treatedAsSupportedAndReinstalled() {
        // setup
        machine.setOsVersion(null);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));
        stubNoUninstallDelivery();
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.reconcile(machine, agents);

        // verifications
        verify(withheldToolAgents).release(machine, AGENT_KEY);
    }

    @Test
    void reconcile_machineOnly_agentsWithMinimumLoaded() {
        // setup
        when(toolOsSupportService.agentsWithMinOsVersion()).thenReturn(agents);
        stubAbsent();

        // execution
        reconciler.reconcile(machine);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
    }

    @Test
    void reconcileCurrent_knownMachine_reconciledOnTheReReadMachine() {
        // setup
        Machine current = new Machine();
        current.setMachineId(MACHINE_ID);
        current.setOsType(OsType.MAC_OS);
        current.setOsVersion(OLD_MAC_VERSION);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(current));
        stubAbsent();

        // execution
        reconciler.reconcileCurrent(MACHINE_ID, agents);

        // verifications
        verify(withheldToolAgents).withhold(current, AGENT_KEY);
    }

    @Test
    void reconcileCurrent_unknownMachine_nothingDone() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        reconciler.reconcileCurrent(MACHINE_ID, agents);

        // verifications
        verifyNoInteractions(toolInstallationService, deliveryRouter, installedAgentRepository,
                toolConnectionRepository, withheldToolAgents, deviceLifecycleService, deliveryTracker);
    }

    @Test
    void completeUninstall_knownAgent_toolConnectionDeleted() {
        // setup
        stubUninstalledAgentOnKnownMachine();

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(toolConnectionRepository).deleteByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM);
    }

    @Test
    void completeUninstall_knownAgent_installedAgentAndItsAssetsDeleted() {
        // setup
        stubUninstalledAgentOnKnownMachine();

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(installedAgentRepository).deleteByMachineIdAndAgentTypeIn(eq(MACHINE_ID), agentTypesCaptor.capture());
        assertThat(agentTypesCaptor.getValue()).containsExactly(AGENT_KEY, ASSET_ID);
    }

    @Test
    void completeUninstall_agentWithoutAssets_onlyTheAgentRowDeleted() {
        // setup
        agent.setAssets(null);
        stubUninstalledAgentOnKnownMachine();

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(installedAgentRepository).deleteByMachineIdAndAgentTypeIn(eq(MACHINE_ID), agentTypesCaptor.capture());
        assertThat(agentTypesCaptor.getValue()).containsExactly(AGENT_KEY);
    }

    @Test
    void completeUninstall_unknownAgent_nothingDeletedOrSettled() {
        // setup
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.empty());

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verifyNoInteractions(toolConnectionRepository, installedAgentRepository, machineRepository, withheldToolAgents,
                deviceLifecycleService, toolInstallationService);
    }

    @Test
    void completeUninstall_agentWithUnknownToolType_nothingDeletedOrSettled() {
        // setup
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolOsSupportService.findToolType(agent)).thenReturn(Optional.empty());

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verifyNoInteractions(toolConnectionRepository, installedAgentRepository, machineRepository, withheldToolAgents,
                deviceLifecycleService, toolInstallationService);
    }

    @Test
    void completeUninstall_unknownMachine_recordsDeleted() {
        // setup
        stubUninstalledAgent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(toolConnectionRepository).deleteByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM);
        verify(installedAgentRepository).deleteByMachineIdAndAgentTypeIn(eq(MACHINE_ID), agentTypesCaptor.capture());
        assertThat(agentTypesCaptor.getValue()).containsExactly(AGENT_KEY, ASSET_ID);
    }

    @Test
    void completeUninstall_unknownMachine_nothingSettled() {
        // setup
        stubUninstalledAgent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verifyNoInteractions(withheldToolAgents, deviceLifecycleService, toolInstallationService, deliveryTracker);
    }

    @Test
    void completeUninstall_machineStillUnsupported_withheldAndPromoted() {
        // setup
        stubUninstalledAgentOnKnownMachine();

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(deviceLifecycleService).promoteIfReady(MACHINE_ID);
    }

    @Test
    void completeUninstall_machineStillUnsupported_notReinstalledOrReleased() {
        // setup
        stubUninstalledAgentOnKnownMachine();

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verifyNoInteractions(toolInstallationService, deliveryTracker);
        verify(withheldToolAgents, never()).release(any(Machine.class), anyString());
    }

    @Test
    void completeUninstall_machineNowSupported_withheldThenInstallDispatchedAndReleased() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(DeliveryStatus.DONE);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        InOrder settled = inOrder(withheldToolAgents, toolInstallationService);
        settled.verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        settled.verify(toolInstallationService).process(MACHINE_ID, agent);
        settled.verify(withheldToolAgents).release(machine, AGENT_KEY);
    }

    @Test
    void completeUninstall_machineNowSupported_notPromoted() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(DeliveryStatus.DONE);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verifyNoInteractions(deviceLifecycleService);
    }

    @ParameterizedTest
    @EnumSource(value = ToolInstallationOutcome.class, names = {"NOT_CARRIED", "FAILED", "NOT_SUPPORTED"})
    void completeUninstall_machineNowSupportedInstallNotDispatched_keptWithheld(ToolInstallationOutcome outcome) {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(DeliveryStatus.DONE);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(outcome);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(withheldToolAgents, never()).release(any(Machine.class), anyString());
    }

    @ParameterizedTest
    @EnumSource(value = DeliveryStatus.class, names = {"PENDING", "ACKED"})
    void completeUninstall_machineNowSupportedAnotherUninstallInFlight_keptWithheldWithoutInstall(DeliveryStatus status) {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(status);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(withheldToolAgents).withhold(machine, AGENT_KEY);
        verify(withheldToolAgents, never()).release(any(Machine.class), anyString());
        verifyNoInteractions(toolInstallationService);
    }

    @Test
    void completeUninstall_agentNoLongerHasMinimum_recordsStillDeleted() {
        // setup
        agent.setDownloadConfigurations(List.of());
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(DeliveryStatus.DONE);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(toolConnectionRepository).deleteByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM);
        verify(installedAgentRepository).deleteByMachineIdAndAgentTypeIn(eq(MACHINE_ID), agentTypesCaptor.capture());
        assertThat(agentTypesCaptor.getValue()).containsExactly(AGENT_KEY, ASSET_ID);
    }

    @Test
    void completeUninstall_agentNoLongerHasMinimum_installDispatchedAndReleased() {
        // setup
        agent.setDownloadConfigurations(List.of());
        stubUninstalledAgentOnKnownMachine();
        stubUninstallDelivery(DeliveryStatus.DONE);
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolInstallationService.process(MACHINE_ID, agent)).thenReturn(ToolInstallationOutcome.DISPATCHED);

        // execution
        reconciler.completeUninstall(MACHINE_ID, AGENT_KEY);

        // verifications
        verify(toolInstallationService).process(MACHINE_ID, agent);
        verify(withheldToolAgents).release(machine, AGENT_KEY);
    }

    @Test
    void needsReconcile_machineBelowMinimum_true() {
        // setup

        // execution
        boolean needed = ToolOsSupportReconciler.needsReconcile(machine, agents);

        // verifications
        assertThat(needed).isTrue();
    }

    @Test
    void needsReconcile_supportedMachineWithTheAgentWithheld_true() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(AGENT_KEY));

        // execution
        boolean needed = ToolOsSupportReconciler.needsReconcile(machine, agents);

        // verifications
        assertThat(needed).isTrue();
    }

    @Test
    void needsReconcile_supportedMachineWithAnotherAgentWithheld_false() {
        // setup
        machine.setOsVersion(NEW_MAC_VERSION);
        machine.setWithheldToolAgents(Set.of(OTHER_AGENT_KEY));

        // execution
        boolean needed = ToolOsSupportReconciler.needsReconcile(machine, agents);

        // verifications
        assertThat(needed).isFalse();
    }

    @Test
    void needsReconcile_noAgents_false() {
        // setup

        // execution
        boolean needed = ToolOsSupportReconciler.needsReconcile(machine, List.of());

        // verifications
        assertThat(needed).isFalse();
    }

    private void stubPresentAndCarried() {
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(true);
        stubNoUninstallDelivery();
        when(deliveryRouter.dispatch(any(ToolUninstallDeliverySeed.class))).thenReturn(true);
    }

    private void stubAbsent() {
        when(installedAgentRepository.existsByMachineIdAndAgentType(MACHINE_ID, AGENT_KEY)).thenReturn(false);
        when(toolConnectionRepository.findByMachineIdAndToolType(MACHINE_ID, ToolType.FLEET_MDM))
                .thenReturn(Optional.empty());
    }

    private void stubNoUninstallDelivery() {
        when(deliveryTracker.find(DeliveryType.TOOL_UNINSTALL, AGENT_KEY, MACHINE_ID)).thenReturn(Optional.empty());
    }

    private void stubUninstallDelivery(DeliveryStatus status) {
        MachineDelivery uninstall = MachineDelivery.builder()
                .type(DeliveryType.TOOL_UNINSTALL)
                .targetId(AGENT_KEY)
                .machineId(MACHINE_ID)
                .status(status)
                .build();
        when(deliveryTracker.find(DeliveryType.TOOL_UNINSTALL, AGENT_KEY, MACHINE_ID)).thenReturn(Optional.of(uninstall));
    }

    private void stubUninstalledAgent() {
        when(integratedToolAgentService.findByKey(AGENT_KEY)).thenReturn(Optional.of(agent));
        when(toolOsSupportService.findToolType(agent)).thenReturn(Optional.of(ToolType.FLEET_MDM));
    }

    private void stubUninstalledAgentOnKnownMachine() {
        stubUninstalledAgent();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
    }
}
