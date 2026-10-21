package com.openframe.api.service.rmm;

import com.openframe.api.config.ScriptExecutionProperties;
import com.openframe.api.service.rmm.script.ScriptTimeoutValidator;
import com.openframe.core.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptTimeoutValidatorTest {

    private final ScriptTimeoutValidator validator = withMax(600);

    @Test
    void nullTimeout_allowed_inheritsDefault() {
        assertThatCode(() -> validator.validate(null)).doesNotThrowAnyException();
    }

    @Test
    void withinBounds_allowed() {
        assertThatCode(() -> validator.validate(1)).doesNotThrowAnyException();
        assertThatCode(() -> validator.validate(600)).doesNotThrowAnyException();   // boundary inclusive
    }

    @Test
    void aboveMax_rejected_withThresholdInMessage() {
        assertThatThrownBy(() -> validator.validate(700))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("timeoutSeconds must not exceed 600 seconds");
    }

    @Test
    void nonPositive_rejected() {
        assertThatThrownBy(() -> validator.validate(0)).isInstanceOf(BadRequestException.class)
                .hasMessage("timeoutSeconds must be a positive number of seconds");
        assertThatThrownBy(() -> validator.validate(-5)).isInstanceOf(BadRequestException.class)
                .hasMessage("timeoutSeconds must be a positive number of seconds");
    }

    @Test
    void thresholdIsConfigurable() {
        ScriptTimeoutValidator higher = withMax(7200);
        assertThatCode(() -> higher.validate(700)).doesNotThrowAnyException();
        assertThatThrownBy(() -> higher.validate(7201)).isInstanceOf(BadRequestException.class)
                .hasMessage("timeoutSeconds must not exceed 7200 seconds");
    }

    @Test
    void validateMaximum_omittedTimeout_preservesOptionalDefault() {
        // setup
        Integer timeout = null;

        // execution
        Runnable validation = () -> validator.validateMaximum(timeout, "defaultTimeoutSeconds");

        // verifications
        assertThatCode(validation::run).doesNotThrowAnyException();
    }

    @Test
    void validateMaximum_upperBoundary_acceptsConfiguredMaximum() {
        // setup
        Integer timeout = 600;

        // execution
        Runnable validation = () -> validator.validateMaximum(timeout, "defaultTimeoutSeconds");

        // verifications
        assertThatCode(validation::run).doesNotThrowAnyException();
    }

    @Test
    void validateMaximum_aboveMaximum_reportsProvidedParameterName() {
        // setup
        Integer timeout = 601;

        // execution
        Runnable validation = () -> validator.validateMaximum(timeout, "defaultTimeoutSeconds");

        // verifications
        assertThatThrownBy(validation::run).isInstanceOf(BadRequestException.class)
                .hasMessage("defaultTimeoutSeconds must not exceed 600 seconds");
    }

    @Test
    void validateMaximum_nonPositiveTimeout_doesNotRepeatLowerBoundaryValidation() {
        // setup
        Integer zero = 0;
        Integer negative = -5;

        // execution
        Runnable zeroValidation = () -> validator.validateMaximum(zero, "timeoutSeconds");
        Runnable negativeValidation = () -> validator.validateMaximum(negative, "timeoutSeconds");

        // verifications
        assertThatCode(zeroValidation::run).doesNotThrowAnyException();
        assertThatCode(negativeValidation::run).doesNotThrowAnyException();
    }

    private ScriptTimeoutValidator withMax(int max) {
        ScriptExecutionProperties properties = new ScriptExecutionProperties();
        properties.setMaxTimeoutSeconds(max);
        return new ScriptTimeoutValidator(properties);
    }
}
