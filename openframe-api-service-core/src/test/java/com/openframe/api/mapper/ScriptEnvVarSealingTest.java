package com.openframe.api.mapper;

import com.openframe.api.support.TestEncryption;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// ScriptEnvVar lives in openframe-data-mongo-common, which has no tests of its own
class ScriptEnvVarSealingTest {

    private final EncryptionService encryptionService = TestEncryption.SERVICE;

    @Test
    void sealAll_encryptsOnlyNonEmptySecrets_andRevealAllRestoresThem() {
        // setup
        ScriptEnvVar secret = ScriptEnvVar.builder().name("TOKEN").value("s3cr3t").secret(true).build();
        ScriptEnvVar emptySecret = ScriptEnvVar.builder().name("EMPTY").value("").secret(true).build();
        ScriptEnvVar plain = ScriptEnvVar.builder().name("REGION").value("eu").secret(false).build();
        List<ScriptEnvVar> envVars = List.of(secret, emptySecret, plain);

        // execution
        List<ScriptEnvVar> sealed = ScriptEnvVar.sealAll(envVars, encryptionService::encrypt);
        List<ScriptEnvVar> sealedAgain = ScriptEnvVar.sealAll(sealed, encryptionService::encrypt);
        List<ScriptEnvVar> revealed = ScriptEnvVar.revealAll(sealedAgain, encryptionService::decrypt);

        // verifications
        assertThat(sealed.get(0).isEncrypted()).isTrue();
        assertThat(sealed.get(0).getValue()).isNotEqualTo("s3cr3t");
        assertThat(sealed.get(1)).isSameAs(emptySecret);
        assertThat(sealed.get(2)).isSameAs(plain);
        assertThat(sealedAgain.get(0)).isSameAs(sealed.get(0));
        assertThat(revealed).extracting(ScriptEnvVar::getValue).containsExactly("s3cr3t", "", "eu");
        assertThat(revealed).noneMatch(ScriptEnvVar::isEncrypted);
    }

    @Test
    void sealAll_and_revealAll_null_staysNull() {
        // execution + verifications
        assertThat(ScriptEnvVar.sealAll(null, encryptionService::encrypt)).isNull();
        assertThat(ScriptEnvVar.revealAll(null, encryptionService::decrypt)).isNull();
    }
}
