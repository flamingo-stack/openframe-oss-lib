package com.openframe.api.mapper;

import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.api.mapper.ScriptMapperRevealTest.noSealer;
import static com.openframe.api.mapper.ScriptMapperRevealTest.provider;
import static com.openframe.api.mapper.ScriptMapperRevealTest.tinkEncryption;
import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptScheduleMapperRevealTest {

    private static final String TENANT = "tenant-1";
    private static final String SCRIPT_ID = "6a8b9460e0e12b4188881ae2";

    private final EncryptionService encryptionService = tinkEncryption();
    private final TenantIdProvider tenantIdProvider = () -> TENANT;
    private final ScriptScheduleMapper mapper =
            new ScriptScheduleMapper(provider(encryptionService), noSealer(), tenantIdProvider);

    @Test
    @DisplayName("toResponse: a secret override sealed for the pod's tenant comes back in clear")
    void toResponse_overrideOfThePodTenant_revealed() {
        ScheduleScript entity = scheduleWithSecretSealedFor(TENANT);

        List<ScriptEnvVar> envVars = mapper.toResponse(entity).getScriptCustomParams().get(0).getEnvVars();

        assertThat(envVars).singleElement()
                .extracting(ScriptEnvVar::getName, ScriptEnvVar::getValue, ScriptEnvVar::isSecret, ScriptEnvVar::isEncrypted)
                .containsExactly("TOKEN", "s3cr3t", true, false);
    }

    @Test
    @DisplayName("toResponse: a secret override sealed for another tenant fails instead of coming back")
    void toResponse_overrideOfAnotherTenant_fails() {
        ScheduleScript entity = scheduleWithSecretSealedFor("tenant-2");

        assertThatThrownBy(() -> mapper.toResponse(entity)).isInstanceOf(EncryptionException.class);
    }

    private ScheduleScript scheduleWithSecretSealedFor(String tenantId) {
        EncryptionContext context = EncryptionContext.forTenant(tenantId, SCRIPT_ENV_VAR);
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build()
                .sealed(plain -> encryptionService.encrypt(plain, context));
        ScheduledScriptCustomParams params = ScheduledScriptCustomParams.builder()
                .scriptId(SCRIPT_ID).envVars(List.of(secret)).build();
        return ScheduleScript.builder().tenantId(TENANT).scriptCustomParams(List.of(params)).build();
    }
}
