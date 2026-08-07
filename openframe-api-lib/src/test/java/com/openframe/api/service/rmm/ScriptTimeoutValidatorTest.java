package com.openframe.api.service.rmm;

import com.openframe.core.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScriptTimeoutValidatorTest {

    private static ScriptTimeoutValidator withMax(int max) {
        ScriptTimeoutValidator validator = new ScriptTimeoutValidator();
        ReflectionTestUtils.setField(validator, "maxTimeoutSeconds", max);
        return validator;
    }

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
                .hasMessageContaining("600");
    }

    @Test
    void nonPositive_rejected() {
        assertThatThrownBy(() -> validator.validate(0)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> validator.validate(-5)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void thresholdIsConfigurable() {
        ScriptTimeoutValidator higher = withMax(7200);
        assertThatCode(() -> higher.validate(700)).doesNotThrowAnyException();
        assertThatThrownBy(() -> higher.validate(7201)).isInstanceOf(BadRequestException.class);
    }
}
