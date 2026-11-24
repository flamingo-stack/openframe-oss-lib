package com.openframe.data.nats.delivery;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.nats.model.ToolUninstallMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ToolUninstallDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";
    private static final String TOOL_TYPE = "FLEET_MDM";

    private final ToolUninstallDeliverySpec spec = new ToolUninstallDeliverySpec();

    @Test
    void getType_toolUninstall() {
        // setup

        // execution
        DeliveryType type = spec.getType();

        // verifications
        assertThat(type).isEqualTo(DeliveryType.TOOL_UNINSTALL);
    }

    @Test
    void getPayloadClass_toolUninstallMessage() {
        // setup

        // execution
        Class<ToolUninstallMessage> payloadClass = spec.getPayloadClass();

        // verifications
        assertThat(payloadClass).isEqualTo(ToolUninstallMessage.class);
    }

    @Test
    void request_seed_requestToThatMachineTargetingTheAgent() {
        // setup
        ToolUninstallDeliverySeed seed = new ToolUninstallDeliverySeed(MACHINE_ID, TOOL_AGENT_KEY, TOOL_TYPE);

        // execution
        DeliveryRequest<ToolUninstallMessage> request = spec.request(seed);

        // verifications
        assertThat(request)
                .extracting(DeliveryRequest::getType, DeliveryRequest::getTargetId, DeliveryRequest::getMachineId,
                        DeliveryRequest::getAudience)
                .containsExactly(DeliveryType.TOOL_UNINSTALL, TOOL_AGENT_KEY, MACHINE_ID, DeliveryAudience.MACHINE);
    }

    @Test
    void request_seed_payloadNamesAgentAndToolType() {
        // setup
        ToolUninstallDeliverySeed seed = new ToolUninstallDeliverySeed(MACHINE_ID, TOOL_AGENT_KEY, TOOL_TYPE);

        // execution
        DeliveryRequest<ToolUninstallMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getPayload())
                .extracting(ToolUninstallMessage::getToolAgentId, ToolUninstallMessage::getToolType,
                        ToolUninstallMessage::getDelivery)
                .containsExactly(TOOL_AGENT_KEY, TOOL_TYPE, null);
    }

    @Test
    void seed_targetIdAndType_agentKeyAndToolUninstall() {
        // setup
        ToolUninstallDeliverySeed seed = new ToolUninstallDeliverySeed(MACHINE_ID, TOOL_AGENT_KEY, TOOL_TYPE);

        // execution
        String targetId = seed.getTargetId();

        // verifications
        assertThat(targetId).isEqualTo(TOOL_AGENT_KEY);
        assertThat(seed.getType()).isEqualTo(DeliveryType.TOOL_UNINSTALL);
    }

    @Test
    void subject_machineId_toolUninstallSubjectPerMachine() {
        // setup

        // execution
        String subject = spec.subject(MACHINE_ID);

        // verifications
        assertThat(subject).isEqualTo("machine.mach-42.tool-uninstall.v2");
    }

    @Test
    void canDeliverToEveryMachine_toolUninstall_false() {
        // setup

        // execution
        boolean everyMachine = spec.canDeliverToEveryMachine();

        // verifications
        assertThat(everyMachine).isFalse();
    }

    @Test
    void admits_anyMachine_true() {
        // setup
        Machine machine = new Machine();

        // execution
        boolean admitted = spec.admits(machine, new ToolUninstallMessage());

        // verifications
        assertThat(admitted).isTrue();
    }
}
