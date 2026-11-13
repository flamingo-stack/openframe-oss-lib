package com.openframe.stream.config;

import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.stream.service.rmm.AgentResultReport;
import com.openframe.stream.service.rmm.ExecutionOutcomeClassifier;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class ExecutionOutcomeConfigTest {

    private static final String FLAG = "openframe.rmm.execution.script-error-status.enabled";
    private static final AgentResultReport NON_ZERO_EXIT = new AgentResultReport(1, false, null, null);

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ExecutionOutcomeConfig.class);

    @Test
    @DisplayName("flag missing: one classifier, and a script's own non-zero exit stays FAILED")
    void flagMissing_legacyClassifier() {
        runner.run(context -> {
            assertThat(context).hasSingleBean(ExecutionOutcomeClassifier.class);
            assertThat(nonZeroExitStatus(context.getBean(ExecutionOutcomeClassifier.class)))
                    .isEqualTo(ExecutionStatus.FAILED);
        });
    }

    @Test
    @DisplayName("flag false: one classifier, and a script's own non-zero exit stays FAILED")
    void flagFalse_legacyClassifier() {
        runner.withPropertyValues(FLAG + "=false").run(context -> {
            assertThat(context).hasSingleBean(ExecutionOutcomeClassifier.class);
            assertThat(nonZeroExitStatus(context.getBean(ExecutionOutcomeClassifier.class)))
                    .isEqualTo(ExecutionStatus.FAILED);
        });
    }

    @Test
    @DisplayName("flag true: one classifier, and a script's own non-zero exit is SCRIPT_ERROR")
    void flagTrue_scriptErrorClassifier() {
        runner.withPropertyValues(FLAG + "=true").run(context -> {
            assertThat(context).hasSingleBean(ExecutionOutcomeClassifier.class);
            assertThat(nonZeroExitStatus(context.getBean(ExecutionOutcomeClassifier.class)))
                    .isEqualTo(ExecutionStatus.SCRIPT_ERROR);
        });
    }

    private static ExecutionStatus nonZeroExitStatus(ExecutionOutcomeClassifier classifier) {
        return classifier.classify(NON_ZERO_EXIT, false).status();
    }
}
