package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ScriptScheduleDeliverySeed;
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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
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

    @BeforeEach
    void setUp() {
        lenient().when(spec.wireForm(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void covers_theScriptBatchAlone_generationZero() {
        // execution + verifications
        assertThat(route.getTypes()).containsExactly(DeliveryType.SCRIPT_SCHEDULE);
        assertThat(route.getGeneration()).isZero();
    }

    @Test
    void scriptSchedule_reachesOneMachineWhateverItsVersion_neverEveryMachine() {
        // execution + verifications
        assertThat(route.canReach(DeliveryType.SCRIPT_SCHEDULE, "0.0.1")).isTrue();
        assertThat(route.canReach(DeliveryType.SCRIPT_SCHEDULE, "")).isTrue();
        assertThat(route.canReachEveryMachine(DeliveryType.SCRIPT_SCHEDULE)).isFalse();
    }

    @Test
    void holdsForOfflineMachine_aPlainPublishKeepsNothing_false() {
        // execution + verifications
        assertThat(route.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE)).isFalse();
    }

    @Test
    void send_bodyThatCannotBePrepared_nothingPublished_noException() {
        // setup
        ScriptScheduleExecutionMessage stored = ScriptScheduleExecutionMessage.builder().executionId("exec-1").build();
        ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.skippingOffline(MACHINE_ID, stored);
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(DeliveryType.SCRIPT_SCHEDULE).targetId("exec-1").machineId(MACHINE_ID).payload(stored).build();
        doReturn(spec).when(specs).require(DeliveryType.SCRIPT_SCHEDULE);
        doReturn(request).when(spec).request(seed);
        doThrow(new IllegalStateException("cannot decrypt")).when(spec).wireForm(stored);

        // execution
        route.send(seed);

        // verifications
        verifyNoInteractions(natsMessagePublisher);
    }

    @Test
    void send_publishesTheSpecsWireForm_notTheStoredBody() {
        // setup
        ScriptScheduleExecutionMessage stored = ScriptScheduleExecutionMessage.builder().executionId("exec-1").build();
        ScriptScheduleExecutionMessage onTheWire = ScriptScheduleExecutionMessage.builder().executionId("exec-1").initiatedBy("wire").build();
        ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.skippingOffline(MACHINE_ID, stored);
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(DeliveryType.SCRIPT_SCHEDULE).targetId("exec-1").machineId(MACHINE_ID).payload(stored).build();
        doReturn(spec).when(specs).require(DeliveryType.SCRIPT_SCHEDULE);
        doReturn(request).when(spec).request(seed);
        doReturn(onTheWire).when(spec).wireForm(stored);

        // execution
        route.send(seed);

        // verifications
        verify(natsMessagePublisher).publish("machine." + MACHINE_ID + ".script-schedule-execution", onTheWire);
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
        verify(natsMessagePublisher).publish("machine.mach-42.script-schedule-execution", batch);
        verify(natsMessagePublisher, never()).publishPersistent(any(), any());
        assertThat(batch.getDelivery()).isNull();
    }

    // the engine is the only route of every other type, the uninstall, the installation and the two updates included
    @ParameterizedTest
    @EnumSource(value = DeliveryType.class, names = "SCRIPT_SCHEDULE", mode = EnumSource.Mode.EXCLUDE)
    void typeWithoutALegacySubject_refused(DeliveryType type) {
        // execution + verifications
        assertThatThrownBy(() -> route.canReach(type, "1.6.0"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(type.name());
        assertThatThrownBy(() -> route.canReachEveryMachine(type))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> route.holdsForOfflineMachine(type))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
