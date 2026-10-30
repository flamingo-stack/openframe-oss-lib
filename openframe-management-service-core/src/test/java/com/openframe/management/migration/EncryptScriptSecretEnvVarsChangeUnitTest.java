package com.openframe.management.migration;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.mock.env.MockEnvironment;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EncryptScriptSecretEnvVarsChangeUnitTest {

    private static final String TENANT = "tenant-1";

    private final EncryptionService encryptionService =
            new EncryptionService("test-encryption-password-of-32-chars!", "74f62c51327175b0");
    private final EncryptScriptSecretEnvVarsChangeUnit changeUnit = new EncryptScriptSecretEnvVarsChangeUnit();
    private final MockEnvironment enabled =
            new MockEnvironment().withProperty("openframe.features.scripts.secret-encryption.enabled", "true");

    @Mock
    private MongoTemplate mongoTemplate;
    @Mock
    private TenantIdProvider tenantIdProvider;

    @BeforeEach
    void setUp() {
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    @Test
    @DisplayName("flag off or absent: nothing is read or rewritten")
    void flagOff_touchesNothing() {
        changeUnit.execution(mongoTemplate, new MockEnvironment(), tenantIdProvider, encryptionService);
        changeUnit.execution(mongoTemplate,
                new MockEnvironment().withProperty("openframe.features.scripts.secret-encryption.enabled", "false"),
                tenantIdProvider, encryptionService);

        verifyNoInteractions(mongoTemplate);
    }

    @Test
    @DisplayName("a script's plaintext secret is encrypted; its plain var and an already-encrypted secret are kept")
    void encryptsPlaintextScriptSecrets() {
        ScriptEnvVar alreadyEncrypted = secret("OLD", "kept").sealed(encryptionService::encrypt);
        Script script = Script.builder().id("script-1").tenantId(TENANT).envVars(List.of(
                secret("TOKEN", "s3cr3t"),
                ScriptEnvVar.builder().name("REGION").value("eu").build(),
                alreadyEncrypted)).build();
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of(script));
        when(mongoTemplate.find(any(Query.class), eq(ScheduleScript.class))).thenReturn(List.of());

        changeUnit.execution(mongoTemplate, enabled, tenantIdProvider, encryptionService);

        List<ScriptEnvVar> written = writtenField("envVars", Script.class);
        assertThat(written.get(0).isEncrypted()).isTrue();
        assertThat(encryptionService.decrypt(written.get(0).getValue())).isEqualTo("s3cr3t");
        assertThat(written.get(1).getValue()).isEqualTo("eu");
        assertThat(written.get(1).isEncrypted()).isFalse();
        assertThat(written.get(2)).isSameAs(alreadyEncrypted);
    }

    @Test
    @DisplayName("a schedule's plaintext secret override is encrypted")
    void encryptsPlaintextScheduleOverrides() {
        ScheduleScript schedule = ScheduleScript.builder().id("schedule-1").tenantId(TENANT)
                .scriptCustomParams(List.of(ScheduledScriptCustomParams.builder()
                        .scriptId("script-1").envVars(List.of(secret("TOKEN", "s3cr3t"))).build()))
                .build();
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());
        when(mongoTemplate.find(any(Query.class), eq(ScheduleScript.class))).thenReturn(List.of(schedule));

        changeUnit.execution(mongoTemplate, enabled, tenantIdProvider, encryptionService);

        List<ScheduledScriptCustomParams> written = writtenField("scriptCustomParams", ScheduleScript.class);
        ScriptEnvVar stored = written.get(0).getEnvVars().get(0);
        assertThat(stored.isEncrypted()).isTrue();
        assertThat(encryptionService.decrypt(stored.getValue())).isEqualTo("s3cr3t");
    }

    @Test
    @DisplayName("nothing to encrypt: no document is rewritten")
    void nothingToEncrypt_writesNothing() {
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());
        when(mongoTemplate.find(any(Query.class), eq(ScheduleScript.class))).thenReturn(List.of());

        changeUnit.execution(mongoTemplate, enabled, tenantIdProvider, encryptionService);

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), any(Class.class));
    }

    @SuppressWarnings("unchecked")
    private <T> List<T> writtenField(String field, Class<?> entityClass) {
        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(any(Query.class), update.capture(), eq(entityClass));
        return (List<T>) update.getValue().getUpdateObject().get("$set", org.bson.Document.class).get(field);
    }

    private static ScriptEnvVar secret(String name, String value) {
        return ScriptEnvVar.builder().name(name).value(value).secret(true).build();
    }
}
