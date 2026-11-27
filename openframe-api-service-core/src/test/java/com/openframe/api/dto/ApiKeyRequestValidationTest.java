package com.openframe.api.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class ApiKeyRequestValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void validate_createWithoutAName_rejected(String name) {
        CreateApiKeyRequest request = CreateApiKeyRequest.builder().name(name).description("Reporting").build();

        assertThat(validator.validate(request))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("name must not be blank");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "\n"})
    void validate_updateToABlankName_rejected(String name) {
        UpdateApiKeyRequest request = UpdateApiKeyRequest.builder().name(name).build();

        assertThat(validator.validate(request))
                .extracting(ConstraintViolation::getMessage)
                .containsExactly("name must not be blank");
    }

    @Test
    void validate_updateWithoutAName_accepted() {
        UpdateApiKeyRequest request = UpdateApiKeyRequest.builder().enabled(false).build();

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void validate_updateToANameOfSeveralWords_accepted() {
        UpdateApiKeyRequest request = UpdateApiKeyRequest.builder().name("Reporting key").build();

        assertThat(validator.validate(request)).isEmpty();
    }
}
