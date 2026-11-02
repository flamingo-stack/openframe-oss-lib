package com.openframe.data.nats.delivery;

import java.util.Map;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliveryRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ScriptScheduleDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String EXECUTION_ID = "exec-1";
    private static final long WINDOW_SECONDS = 7_200L;

    private final EncryptionService encryptionService =
            new EncryptionService("test-encryption-password-of-32-chars!", "74f62c51327175b0");
    private final ScriptScheduleDeliverySpec spec = new ScriptScheduleDeliverySpec(new StaticListableBeanFactory(
            Map.of("encryptionService", encryptionService)).getBeanProvider(EncryptionService.class));

    @Test
    void wireForm_secretsInTheClear_theStoredBatchAndTheDeliveryBlockUntouched() {
        // setup
        ScriptEnvVar sealedSecret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(encryptionService::encrypt);
        ScriptScheduleExecutionItem item = ScriptScheduleExecutionItem.builder().scriptId("script-a")
                .envVars(List.of(sealedSecret)).build();
        DeliveryRef delivery = new DeliveryRef(DeliveryType.SCRIPT_SCHEDULE, EXECUTION_ID, "dispatch-1");
        ScriptScheduleExecutionMessage stored = ScriptScheduleExecutionMessage.builder().executionId(EXECUTION_ID)
                .delivery(delivery).scripts(List.of(item)).build();

        // execution
        ScriptScheduleExecutionMessage onTheWire = spec.wireForm(stored);

        // verifications
        ScriptEnvVar sent = onTheWire.getScripts().get(0).getEnvVars().get(0);
        assertThat(sent.getValue()).isEqualTo("s3cr3t");
        assertThat(sent.isEncrypted()).isFalse();
        assertThat(onTheWire.getDelivery()).isSameAs(delivery);
        ScriptEnvVar kept = stored.getScripts().get(0).getEnvVars().get(0);
        assertThat(kept.isEncrypted()).isTrue();
        assertThat(kept.getValue()).isNotEqualTo("s3cr3t");
    }

    @Test
    void type_scriptSchedule_withTheBatchAsItsPayload_toOneMachineAtATime() {
        // execution + verifications
        assertThat(spec.getType()).isEqualTo(DeliveryType.SCRIPT_SCHEDULE);
        assertThat(spec.getPayloadClass()).isEqualTo(ScriptScheduleExecutionMessage.class);
        assertThat(spec.canDeliverToEveryMachine()).isFalse();
    }

    @Test
    void request_theFiresBatchUnderItsExecutionId_forTheSeedsMachine() {
        // setup
        ScriptScheduleExecutionMessage message = batch();
        ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.skippingOffline(MACHINE_ID, message);

        // execution
        DeliveryRequest<ScriptScheduleExecutionMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getType()).isEqualTo(DeliveryType.SCRIPT_SCHEDULE);
        assertThat(request.getTargetId()).isEqualTo(EXECUTION_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(request.getPayload()).isSameAs(message);
        assertThat(request.getPayload().getDelivery()).isNull();
        assertThat(request.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.SKIP);
        assertThat(request.getReconnectWindowSeconds()).isNull();
    }

    @Test
    void request_aFireThatWaitsForItsMachine_carriesTheSchedulesWindow() {
        // setup
        ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.waitingForReconnect(MACHINE_ID, batch(), WINDOW_SECONDS);

        // execution
        DeliveryRequest<ScriptScheduleExecutionMessage> request = spec.request(seed);

        // verifications
        assertThat(request.getOfflineBehavior()).isEqualTo(DeliveryOfflineBehavior.RETRY_ON_RECONNECT);
        assertThat(request.getReconnectWindowSeconds()).isEqualTo(WINDOW_SECONDS);
    }

    @Test
    void subject_theOneEveryAgentWithTheScheduleListenerSubscribesTo() {
        // execution + verifications
        assertThat(spec.subject(MACHINE_ID)).isEqualTo("machine.mach-42.script-schedule-execution");
    }

    private static ScriptScheduleExecutionMessage batch() {
        ScriptScheduleExecutionItem item = ScriptScheduleExecutionItem.builder().scriptId("script-a").code("echo a").build();
        return ScriptScheduleExecutionMessage.builder()
                .executionId(EXECUTION_ID)
                .scheduleId("sched-1")
                .machineId(MACHINE_ID)
                .initiatedBy("user-1")
                .scripts(List.of(item))
                .build();
    }
}
