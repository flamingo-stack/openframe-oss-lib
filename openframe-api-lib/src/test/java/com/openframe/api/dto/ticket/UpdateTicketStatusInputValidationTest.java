package com.openframe.api.dto.ticket;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class UpdateTicketStatusInputValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\n"})
    void validate_blankName_rejected(String name) {
        UpdateTicketStatusInput input = UpdateTicketStatusInput.builder().id("status-1").name(name).build();

        assertThat(validator.validate(input))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("name must not be blank");
    }

    @Test
    void validate_nameNotSent_accepted() {
        UpdateTicketStatusInput input = UpdateTicketStatusInput.builder().id("status-1").color("#1A2B3C").build();

        assertThat(validator.validate(input)).isEmpty();
    }

    @Test
    void validate_nameOfSeveralWords_accepted() {
        UpdateTicketStatusInput input = UpdateTicketStatusInput.builder().id("status-1").name("In Review").build();

        assertThat(validator.validate(input)).isEmpty();
    }
}
