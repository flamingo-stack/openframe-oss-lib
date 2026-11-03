package com.openframe.api.dto.organization;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

class OrganizationRequestValidationTest {

    private static final LocalDate START = LocalDate.of(2026, 6, 1);
    private static final LocalDate BEFORE_START = LocalDate.of(2026, 1, 1);
    private static final LocalDate AFTER_START = LocalDate.of(2026, 12, 31);
    private static final String CONTRACT_PERIOD_MESSAGE = "Contract end date must not be before the start date";
    private static final String BLANK_NAME_MESSAGE = "Name must not be blank";

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void createRequest_contractEndsBeforeStart_violationOnContractEndDate() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
                .name("Acme")
                .contractStartDate(START)
                .contractEndDate(BEFORE_START)
                .build();

        // execution
        Set<ConstraintViolation<CreateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage)
                .containsExactly(tuple("contractEndDate", CONTRACT_PERIOD_MESSAGE));
    }

    @Test
    void createRequest_contractEndsOnStartDay_valid() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
                .name("Acme")
                .contractStartDate(START)
                .contractEndDate(START)
                .build();

        // execution
        Set<ConstraintViolation<CreateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void createRequest_contractEndsAfterStart_valid() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
                .name("Acme")
                .contractStartDate(START)
                .contractEndDate(AFTER_START)
                .build();

        // execution
        Set<ConstraintViolation<CreateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void createRequest_onlyEndDate_valid() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
                .name("Acme")
                .contractEndDate(BEFORE_START)
                .build();

        // execution
        Set<ConstraintViolation<CreateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void createRequest_onlyStartDate_valid() {
        // setup
        CreateOrganizationRequest request = CreateOrganizationRequest.builder()
                .name("Acme")
                .contractStartDate(START)
                .build();

        // execution
        Set<ConstraintViolation<CreateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void updateRequest_contractEndsBeforeStart_violationOnContractEndDate() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .contractStartDate(START)
                .contractEndDate(BEFORE_START)
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage)
                .containsExactly(tuple("contractEndDate", CONTRACT_PERIOD_MESSAGE));
    }

    @Test
    void updateRequest_contractEndsOnStartDay_valid() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .contractStartDate(START)
                .contractEndDate(START)
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void updateRequest_onlyEndDate_valid() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .contractEndDate(BEFORE_START)
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "   ", "\t", "\n", " \t\r\n "})
    void updateRequest_blankName_violationOnName(String name) {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .name(name)
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations)
                .extracting(v -> v.getPropertyPath().toString(), ConstraintViolation::getMessage)
                .containsExactly(tuple("name", BLANK_NAME_MESSAGE));
    }

    @Test
    void updateRequest_nullName_valid() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .numberOfEmployees(3)
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }

    @Test
    void updateRequest_multiLineNameWithText_valid() {
        // setup
        UpdateOrganizationRequest request = UpdateOrganizationRequest.builder()
                .name("Acme\nCorporation")
                .build();

        // execution
        Set<ConstraintViolation<UpdateOrganizationRequest>> violations = validator.validate(request);

        // verifications
        assertThat(violations).isEmpty();
    }
}
