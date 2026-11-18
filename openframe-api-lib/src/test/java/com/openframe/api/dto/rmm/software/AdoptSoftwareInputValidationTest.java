package com.openframe.api.dto.rmm.software;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AdoptSoftwareInputValidationTest {

    private static final String SOFTWARE_ID = "42";
    private static final String MACHINE_ID = "m1";

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 100})
    void validate_oneToHundredMachines_accepted(int machineCount) {
        // setup
        AdoptSoftwareInput input = input(Collections.nCopies(machineCount, MACHINE_ID));

        // execution
        Set<ConstraintViolation<AdoptSoftwareInput>> violations = validator.validate(input);

        // verifications
        assertThat(violations).isEmpty();
    }

    @ParameterizedTest
    @NullAndEmptySource
    void validate_noMachines_rejected(List<String> machineIds) {
        // setup
        AdoptSoftwareInput input = input(machineIds);

        // execution
        Set<ConstraintViolation<AdoptSoftwareInput>> violations = validator.validate(input);

        // verifications
        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("machineIds must not be empty");
    }

    @Test
    void validate_moreThanHundredMachines_rejected() {
        // setup
        AdoptSoftwareInput input = input(Collections.nCopies(101, MACHINE_ID));

        // execution
        Set<ConstraintViolation<AdoptSoftwareInput>> violations = validator.validate(input);

        // verifications
        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("machineIds must not exceed 100 machines");
    }

    @Test
    void validate_blankMachineId_rejected() {
        // setup
        AdoptSoftwareInput input = input(List.of(MACHINE_ID, " "));

        // execution
        Set<ConstraintViolation<AdoptSoftwareInput>> violations = validator.validate(input);

        // verifications
        assertThat(violations)
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("machineIds[1].<list element>");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void validate_noSoftwareId_rejected(String softwareId) {
        // setup
        AdoptSoftwareInput input = input(List.of(MACHINE_ID));
        input.setSoftwareId(softwareId);

        // execution
        Set<ConstraintViolation<AdoptSoftwareInput>> violations = validator.validate(input);

        // verifications
        assertThat(violations)
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("softwareId is required");
    }

    private static AdoptSoftwareInput input(List<String> machineIds) {
        AdoptSoftwareInput input = new AdoptSoftwareInput();
        input.setSoftwareId(SOFTWARE_ID);
        input.setMachineIds(machineIds);
        return input;
    }
}
