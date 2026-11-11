package com.openframe.management.config.pinot;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

// The class has a second, package-private constructor for tests; Spring must still pick the public one.
class PinotConfigInitializerWiringTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(PinotConfigInitializer.class)
            .withPropertyValues("pinot.controller.url=http://pinot-controller:9000", "pinot.config.enabled=false");

    @Test
    void context_createsTheInitializerThroughItsPublicConstructor() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(PinotConfigInitializer.class);
        });
    }
}
