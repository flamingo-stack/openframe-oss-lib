package com.openframe.data.service.machine;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class MachineLifecycleStatusPublishingPropertiesTest {

    private static final String SWITCH = "openframe.events.machines.publish-lifecycle-status.enabled";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withBean(MongoTemplate.class, () -> mock(MongoTemplate.class))
            .withUserConfiguration(MachineWriter.class);

    @Test
    void context_onlyMachineWriterImported_switchRegisteredAndOff() {
        // execution
        runner.run(context -> {

            // verifications
            assertThat(context).hasSingleBean(MachineWriter.class);
            assertThat(context.getBean(MachineLifecycleStatusPublishingProperties.class).isEnabled()).isFalse();
        });
    }

    @Test
    void context_switchOn_boundFromTheProperty() {
        // setup
        ApplicationContextRunner switchedOn = runner.withPropertyValues(SWITCH + "=true");

        // execution
        switchedOn.run(context -> {

            // verifications
            assertThat(context.getBean(MachineLifecycleStatusPublishingProperties.class).isEnabled()).isTrue();
        });
    }
}
