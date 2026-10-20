package com.openframe.publishing.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class PublishingSwitchedOffAutoConfigurationTest {

    private static final String WARNING = "openframe.events.topics.organizations.publish is true, but openframe.events.publishing.enabled is off";

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(PublishingSwitchedOffAutoConfiguration.class));

    @Test
    void aTopicOn_withTheModuleOff_logsAWarning(CapturedOutput output) {
        runner.withPropertyValues("openframe.events.topics.organizations.publish=true")
                .run(context -> assertThat(context).hasNotFailed());

        assertThat(output).contains(WARNING);
    }

    @Test
    void aTopicOff_withTheModuleOff_logsNothing(CapturedOutput output) {
        runner.run(context -> assertThat(context).hasNotFailed());

        assertThat(output).doesNotContain(WARNING);
    }

    @Test
    void theModuleOn_leavesNoWarningBean() {
        runner.withPropertyValues("openframe.events.publishing.enabled=true", "openframe.events.topics.organizations.publish=true")
                .run(context -> assertThat(context).doesNotHaveBean(PublishingSwitchedOffAutoConfiguration.class));
    }
}
