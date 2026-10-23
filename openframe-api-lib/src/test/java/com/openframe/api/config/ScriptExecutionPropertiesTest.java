package com.openframe.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class ScriptExecutionPropertiesTest {

    @Test
    void bind_configuredMaximum_preservesExistingPropertyKey() {
        // setup
        MockEnvironment environment = new MockEnvironment()
                .withProperty("openframe.rmm.script.max-timeout-seconds", "913");

        // execution
        ScriptExecutionProperties properties = Binder.get(environment)
                .bind("openframe.rmm.script", ScriptExecutionProperties.class)
                .orElseThrow(IllegalStateException::new);

        // verifications
        assertThat(properties.getMaxTimeoutSeconds()).isEqualTo(913);
    }

    @Test
    void getMaxTimeoutSeconds_missingConfiguration_preservesExistingDefault() {
        // setup
        ScriptExecutionProperties properties = new ScriptExecutionProperties();

        // execution
        int maximum = properties.getMaxTimeoutSeconds();

        // verifications
        assertThat(maximum).isEqualTo(600);
    }
}
