package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ClientUninstallDeliverySeed;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.ScriptScheduleDeliverySeed;
import com.openframe.data.nats.delivery.ToolInstallationDeliverySeed;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.model.ClientUninstallMessage;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class LegacyDeliveryRouteTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private DeliverySpecRegistry specs;
    @Mock private NatsMessagePublisher natsMessagePublisher;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;
    @InjectMocks private LegacyDeliveryRoute route;

    private ClientUninstallMessage message;

    @BeforeEach
    void setUp() {
        message = new ClientUninstallMessage();
        message.setIssuedAt("2026-10-28T10:00:00Z");
    }

    @Test
    void covers_theFiveTypesTheAgentsBeforeTheEngineListenTo_generationZero() {
        // execution + verifications
        assertThat(route.getTypes()).containsExactlyInAnyOrder(DeliveryType.CLIENT_UNINSTALL, DeliveryType.TOOL_INSTALLATION,
                DeliveryType.CLIENT_UPDATE, DeliveryType.TOOL_UPDATE, DeliveryType.SCRIPT_SCHEDULE);
        assertThat(route.getGeneration()).isZero();
    }

    @Test
    void send_scriptSchedule_aPlainPublishOnTheMachinesSubject_noStreamBehindIt() {
        // setup
        ScriptScheduleExecutionMessage batch = ScriptScheduleExecutionMessage.builder().executionId("exec-1").build();
        ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.skippingOffline(MACHINE_ID, batch);
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(DeliveryType.SCRIPT_SCHEDULE)
                .targetId("exec-1")
                .machineId(MACHINE_ID)
                .payload(batch)
                .build();
        doReturn(spec).when(specs).require(DeliveryType.SCRIPT_SCHEDULE);
        doReturn(request).when(spec).request(seed);

        // execution
        route.send(seed);

        // verifications
        assertThat(route.canReach(DeliveryType.SCRIPT_SCHEDULE, "0.0.1")).isTrue();
        assertThat(route.canReachEveryMachine(DeliveryType.SCRIPT_SCHEDULE)).isFalse();
        verify(natsMessagePublisher).publish("machine.mach-42.script-schedule-execution", batch);
        verify(natsMessagePublisher, never()).publishPersistent(any(), any());
        assertThat(batch.getDelivery()).isNull();
    }

    @Test
    void perMachineTypes_reachOneMachineWhateverItsVersion_neverEveryMachine() {
        // execution + verifications
        assertThat(route.canReach(DeliveryType.CLIENT_UNINSTALL, "0.0.1")).isTrue();
        assertThat(route.canReach(DeliveryType.TOOL_INSTALLATION, "")).isTrue();
        assertThat(route.canReachEveryMachine(DeliveryType.CLIENT_UNINSTALL)).isFalse();
        assertThat(route.canReachEveryMachine(DeliveryType.TOOL_INSTALLATION)).isFalse();
    }

    @Test
    void broadcastTypes_reachEveryMachine_neverOneMachine() {
        // execution + verifications
        assertThat(route.canReachEveryMachine(DeliveryType.CLIENT_UPDATE)).isTrue();
        assertThat(route.canReachEveryMachine(DeliveryType.TOOL_UPDATE)).isTrue();
        assertThat(route.canReach(DeliveryType.CLIENT_UPDATE, "0.0.1")).isFalse();
        assertThat(route.canReach(DeliveryType.TOOL_UPDATE, "0.0.1")).isFalse();
    }

    @Test
    void send_uninstall_theSpecsMessageOnTheMachinesLegacySubject() {
        // setup
        ClientUninstallDeliverySeed seed = new ClientUninstallDeliverySeed(MACHINE_ID);
        specBuilds(DeliveryType.CLIENT_UNINSTALL, seed);

        // execution
        route.send(seed);

        // verifications
        verify(natsMessagePublisher).publishPersistent("machine.mach-42.client-uninstall", message);
        assertThat(message.getDelivery()).isNull();
    }

    @Test
    void send_toolInstallation_onTheMachinesLegacySubject() {
        // setup
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey("fleetmdm-agent");
        ToolInstallationDeliverySeed seed = new ToolInstallationDeliverySeed(MACHINE_ID, toolAgent, new IntegratedTool(), false);
        specBuilds(DeliveryType.TOOL_INSTALLATION, seed);

        // execution
        route.send(seed);

        // verifications
        verify(natsMessagePublisher).publishPersistent("machine.mach-42.tool-installation", message);
    }

    @Test
    void sendToEveryMachine_clientUpdate_oneBroadcastOnTheLegacySubject() {
        // setup
        ClientUpdateDeliverySeed seed = ClientUpdateDeliverySeed.forEveryMachine(OpenFrameClientConfiguration.builder().version("1.6.0").build());
        specBuilds(DeliveryType.CLIENT_UPDATE, seed);

        // execution
        route.sendToEveryMachine(seed);

        // verifications
        verify(natsMessagePublisher).publishPersistent("machine.all.client-update", message);
    }

    @Test
    void sendToEveryMachine_toolUpdate_theToolNamedInTheLegacySubject() {
        // setup
        IntegratedToolAgent toolAgent = new IntegratedToolAgent();
        toolAgent.setKey("fleetmdm-agent");
        ToolUpdateDeliverySeed seed = ToolUpdateDeliverySeed.forEveryMachine(toolAgent);
        specBuilds(DeliveryType.TOOL_UPDATE, seed);

        // execution
        route.sendToEveryMachine(seed);

        // verifications
        verify(natsMessagePublisher).publishPersistent("machine.all.tool.fleetmdm-agent.update", message);
    }

    @Test
    void typeWithoutALegacySubject_refused() {
        // execution + verifications
        assertThatThrownBy(() -> route.canReach(DeliveryType.CLIENT_FEATURE_FLAGS, "1.6.0"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private void specBuilds(DeliveryType type, DeliverySeed seed) {
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(type)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .audience(seed.getAudience())
                .payload(message)
                .build();
        doReturn(spec).when(specs).require(type);
        doReturn(request).when(spec).request(any());
    }
    @Test
    void holdsForOfflineMachine_streamBehindTheSubjectKeepsIt_plainPublishDoesNot() {
        // execution + verifications
        assertThat(route.holdsForOfflineMachine(DeliveryType.TOOL_INSTALLATION)).isTrue();
        assertThat(route.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE)).isFalse();
    }
}
