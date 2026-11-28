package com.openframe.data.nats.delivery;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.service.TenantIdProvider;
import java.security.GeneralSecurityException;
import org.springframework.beans.factory.ObjectProvider;
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

import static com.openframe.core.crypto.service.SecretPurpose.AI_PROVIDER_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptScheduleDeliverySpecTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String EXECUTION_ID = "exec-1";
    private static final long WINDOW_SECONDS = 7_200L;

    private static final String TENANT = "tenant-1";
    private static final EncryptionContext SCRIPT_CONTEXT = EncryptionContext.forTenant(TENANT, SCRIPT_ENV_VAR);

    private final EncryptionService encryptionService = tinkEncryption();
    private final StaticListableBeanFactory beans = new StaticListableBeanFactory(Map.of("encryptionService", encryptionService));
    private final ObjectProvider<EncryptionService> encryptionProvider = beans.getBeanProvider(EncryptionService.class);
    private final TenantIdProvider tenantIdProvider = () -> TENANT;
    private final ScriptScheduleDeliverySpec spec = new ScriptScheduleDeliverySpec(encryptionProvider, tenantIdProvider);

    private static EncryptionService tinkEncryption() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ScriptScheduleExecutionMessage storedBatch(ScriptEnvVar envVar) {
        ScriptScheduleExecutionItem item = ScriptScheduleExecutionItem.builder().scriptId("script-a")
                .envVars(List.of(envVar)).build();
        return ScriptScheduleExecutionMessage.builder().executionId(EXECUTION_ID).scripts(List.of(item)).build();
    }

    private ScriptEnvVar secretSealedFor(EncryptionContext context) {
        return ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(value -> encryptionService.encrypt(value, context));
    }

    @Test
    void wireForm_revealsWithThePodTenantAndTheScriptPurpose() {
        // execution
        ScriptScheduleExecutionMessage onTheWire = spec.wireForm(storedBatch(secretSealedFor(SCRIPT_CONTEXT)));

        // verifications
        assertThat(onTheWire.getScripts().get(0).getEnvVars().get(0).getValue()).isEqualTo("s3cr3t");
    }

    @Test
    void wireForm_secretOfAnotherTenant_fails() {
        // setup
        ScriptScheduleExecutionMessage stored = storedBatch(secretSealedFor(EncryptionContext.forTenant("tenant-2", SCRIPT_ENV_VAR)));

        // execution + verifications
        assertThatThrownBy(() -> spec.wireForm(stored)).isInstanceOf(EncryptionException.class);
    }

    @Test
    void wireForm_secretOfAnotherPurpose_fails() {
        // setup
        ScriptScheduleExecutionMessage stored = storedBatch(secretSealedFor(EncryptionContext.forTenant(TENANT, AI_PROVIDER_KEY)));

        // execution + verifications
        assertThatThrownBy(() -> spec.wireForm(stored)).isInstanceOf(EncryptionException.class);
    }

    @Test
    void wireForm_followsTheTenantTheProviderReports() {
        // setup
        ScriptScheduleDeliverySpec otherPod = new ScriptScheduleDeliverySpec(encryptionProvider, () -> "tenant-2");

        // execution + verifications
        assertThatThrownBy(() -> otherPod.wireForm(storedBatch(secretSealedFor(SCRIPT_CONTEXT))))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    void wireForm_secretsInTheClear_theStoredBatchAndTheDeliveryBlockUntouched() {
        // setup
        ScriptEnvVar sealedSecret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(value -> encryptionService.encrypt(value, SCRIPT_CONTEXT));
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
