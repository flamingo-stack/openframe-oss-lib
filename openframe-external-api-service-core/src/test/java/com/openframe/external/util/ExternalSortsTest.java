package com.openframe.external.util;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.ValidationException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ExternalSortsTest {

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t\n"})
    void absentCustomerSortFieldMeansDefaultOrder(String sortField) {
        assertNull(ExternalSorts.requireCustomerSortField(sortField));
    }

    @ParameterizedTest
    @ValueSource(strings = {"name", "createdAt", "updatedAt"})
    void documentedCustomerSortFieldIsReturnedAsIs(String sortField) {
        assertEquals(sortField, ExternalSorts.requireCustomerSortField(sortField));
    }

    @ParameterizedTest
    @ValueSource(strings = {" name", "createdAt ", "\tupdatedAt\n"})
    void documentedCustomerSortFieldIsTrimmed(String sortField) {
        assertEquals(sortField.trim(), ExternalSorts.requireCustomerSortField(sortField));
    }

    @ParameterizedTest
    @ValueSource(strings = {"foo", "Name", "CREATEDAT", "_id", "organizationId", "id", "name,createdAt", "name;drop"})
    void unknownCustomerSortFieldIsValidationErrorNotDefaultOrder(String sortField) {
        ValidationException ex = assertThrows(ValidationException.class,
                () -> ExternalSorts.requireCustomerSortField(sortField));

        assertEquals("Unknown sort field: " + sortField, ex.getMessage());
        assertEquals(ErrorCode.VALIDATION_ERROR, ex.getErrorCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        assertEquals(1, ex.getFieldErrors().size());
        assertEquals("sortField", ex.getFieldErrors().get(0).field());
        assertEquals("must be one of: name, createdAt, updatedAt", ex.getFieldErrors().get(0).message());
    }
}
