package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.PackageUpdateMode;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// The agent clamps a countdown to 1-30 minutes, so the API takes only what the agent would run.
class PackageUpdateSettingsInputValidationTest {

    private static final String COUNTDOWN_FIELD = "countdownSeconds";

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @ParameterizedTest
    @ValueSource(ints = {60, 300, 1_800})
    void countdownWithinOneToThirtyMinutes_isValid(int countdownSeconds) {
        Set<ConstraintViolation<PackageUpdateSettingsInput>> violations = validator.validate(settings(countdownSeconds));

        assertThat(violations).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 5, 59, 1_801, 3_600})
    void countdownOutsideOneToThirtyMinutes_isRejected(int countdownSeconds) {
        Set<ConstraintViolation<PackageUpdateSettingsInput>> violations = validator.validate(settings(countdownSeconds));

        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly(COUNTDOWN_FIELD);
    }

    private static PackageUpdateSettingsInput settings(int countdownSeconds) {
        PackageUpdateSettingsInput input = new PackageUpdateSettingsInput();
        input.setMode(PackageUpdateMode.WAIT);
        input.setDeadlineSeconds(60L);
        input.setCountdownSeconds(countdownSeconds);
        return input;
    }
}
