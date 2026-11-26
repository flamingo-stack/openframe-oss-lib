package com.openframe.management.config.pinot;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

// The class has a second, package-private constructor for tests; Spring must still pick the public one.
class PinotConfigInitializerWiringTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(PinotConfigInitializer.class, OssPinotTables.class)
            .withPropertyValues("pinot.controller.url=http://pinot-controller:9000", "pinot.config.enabled=false");

    @Test
    void context_createsTheInitializerThroughItsPublicConstructor() {
        contextRunner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(PinotConfigInitializer.class);
        });
    }

    @Test
    void context_registersTheOssTablesAsDefinitions() {
        contextRunner.run(context -> {
            Map<String, PinotTableDefinition> definitions = context.getBeansOfType(PinotTableDefinition.class);
            List<String> names = definitions.values().stream().map(PinotTableDefinition::getName).toList();

            assertThat(names).containsExactlyInAnyOrder("devices", "logs");
        });
    }
}
