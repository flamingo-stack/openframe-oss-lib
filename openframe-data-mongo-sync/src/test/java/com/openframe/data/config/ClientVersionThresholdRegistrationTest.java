package com.openframe.data.config;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Import;
import org.springframework.stereotype.Component;

import static org.assertj.core.api.Assertions.assertThat;

// The machine repository needs the threshold in every app with Mongo sync on, including apps that do not scan
// com.openframe.data; both sync configs import it, and it is no @Component so a scan never registers it twice.
class ClientVersionThresholdRegistrationTest {

    @ParameterizedTest
    @ValueSource(classes = {MongoSyncConfig.class, TenantAwareSyncConfig.class})
    void syncConfig_importsClientVersionThreshold(Class<?> syncConfig) {
        // execution
        Import imports = syncConfig.getAnnotation(Import.class);

        // verifications
        assertThat(imports).isNotNull();
        assertThat(imports.value()).contains(ClientVersionThreshold.class);
    }

    @Test
    void clientVersionThreshold_notAScannedComponent() {
        // execution
        boolean component = ClientVersionThreshold.class.isAnnotationPresent(Component.class);

        // verifications
        assertThat(component).isFalse();
    }
}
