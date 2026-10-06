package com.openframe.external.exception;

import com.openframe.core.dto.ErrorResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.pinot.repository.exception.PinotQueryException;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.Instant;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GlobalExceptionHandlerTest {

    private static final String SECRET_DETAIL = "mongo-primary.internal:27017 refused connection";

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new FailingController());
    }

    @Test
    void typeMismatchNamesTheParameterAndTheRejectedValue() {
        MethodArgumentTypeMismatchException ex = new MethodArgumentTypeMismatchException(
                "abc", Integer.class, "limit", null, new NumberFormatException("For input string: \"abc\""));

        ErrorResponse response = handler.handleTypeMismatch(ex);

        assertEquals("TYPE_MISMATCH", response.getCode());
        assertEquals("Invalid value 'abc' for parameter 'limit'", response.getMessage());
        assertDoesNotThrow(() -> Instant.parse(response.getTimestamp()));
        assertNull(response.getFieldErrors());
    }

    @Test
    void pinotFailureGetsAGenericMessage() {
        ErrorResponse response = handler.handlePinotQueryException(new PinotQueryException(SECRET_DETAIL));

        assertEquals(ErrorCode.PINOT_QUERY_ERROR.getCode(), response.getCode());
        assertEquals("Query service temporarily unavailable. Please try again later.", response.getMessage());
        assertNotNull(response.getTimestamp());
    }

    @Test
    void databaseFailureGetsAGenericMessage() {
        ErrorResponse response = handler.handleDataAccessException(new DataAccessResourceFailureException(SECRET_DETAIL));

        assertEquals(ErrorCode.DATABASE_ERROR.getCode(), response.getCode());
        assertEquals("Database operation failed. Please try again later.", response.getMessage());
        assertNotNull(response.getTimestamp());
    }

    @Test
    void runsBeforeEveryOtherAdvice() {
        Order order = GlobalExceptionHandler.class.getAnnotation(Order.class);

        assertNotNull(order);
        assertEquals(Ordered.HIGHEST_PRECEDENCE, order.value());
    }

    @Test
    void nonNumericRequestParamIs400TypeMismatch() throws Exception {
        mockMvc.perform(get("/failing/number").param("limit", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'abc' for parameter 'limit'"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(jsonPath("$.fieldErrors").doesNotExist());
    }

    @Test
    void unknownEnumRequestParamIs400TypeMismatch() throws Exception {
        mockMvc.perform(get("/failing/enum").param("color", "PURPLE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'PURPLE' for parameter 'color'"));
    }

    @Test
    void nonNumericPathVariableIs400TypeMismatch() throws Exception {
        mockMvc.perform(get("/failing/items/not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'not-a-number' for parameter 'id'"));
    }

    @Test
    void convertibleParametersReachTheController() throws Exception {
        mockMvc.perform(get("/failing/number").param("limit", "25"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/failing/enum").param("color", "RED"))
                .andExpect(status().isOk());
    }

    @Test
    void typeMismatchIsHandledByThisAdviceEvenWhenTheBaseAdviceIsRegisteredFirst() throws Exception {
        GlobalExceptionHandler moduleAdvice = spy(new GlobalExceptionHandler());
        BaseGlobalExceptionHandler baseAdvice = spy(new BaseGlobalExceptionHandler());
        MockMvc baseFirst = MockMvcBuilders.standaloneSetup(new FailingController())
                .setControllerAdvice(baseAdvice, moduleAdvice)
                .build();

        baseFirst.perform(get("/failing/number").param("limit", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verify(moduleAdvice).handleTypeMismatch(any());
        verify(baseAdvice, never()).handleMethodArgumentTypeMismatch(any());
    }

    @Test
    void pinotFailureIs503WithoutLeakingTheCause() throws Exception {
        mockMvc.perform(get("/failing/throw/pinot"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PINOT_QUERY_ERROR"))
                .andExpect(jsonPath("$.message").value("Query service temporarily unavailable. Please try again later."))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(content().string(not(containsString(SECRET_DETAIL))));
    }

    @ParameterizedTest
    @ValueSource(strings = {"database", "duplicate-key"})
    void anyDataAccessFailureIs503WithoutLeakingTheCause(String kind) throws Exception {
        mockMvc.perform(get("/failing/throw/" + kind))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_ERROR"))
                .andExpect(jsonPath("$.message").value("Database operation failed. Please try again later."))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(content().string(not(containsString(SECRET_DETAIL))));
    }

    @Test
    void dataAccessFailureWrappedInAPlainRuntimeExceptionIsStill503() throws Exception {
        mockMvc.perform(get("/failing/throw/wrapped-database"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("DATABASE_ERROR"));
    }

    @Test
    void dataAccessFailureIsNotDowngradedToTheBaseCatchAll() throws Exception {
        GlobalExceptionHandler moduleAdvice = spy(new GlobalExceptionHandler());
        BaseGlobalExceptionHandler baseAdvice = spy(new BaseGlobalExceptionHandler());
        MockMvc baseFirst = MockMvcBuilders.standaloneSetup(new FailingController())
                .setControllerAdvice(baseAdvice, moduleAdvice)
                .build();

        baseFirst.perform(get("/failing/throw/database"))
                .andExpect(status().isServiceUnavailable());

        verify(moduleAdvice).handleDataAccessException(any());
        verify(baseAdvice, never()).handleException(any());
    }

    @Test
    void domainExceptionsFallThroughToTheBaseAdvice() throws Exception {
        mockMvc.perform(get("/failing/throw/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Customer not found: cust-1"));
    }

    @Test
    void illegalArgumentFallsThroughToTheBaseAdvice() throws Exception {
        mockMvc.perform(get("/failing/throw/illegal-argument"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("bad input"));
    }

    @Test
    void missingRequiredParamFallsThroughToTheBaseAdvice() throws Exception {
        mockMvc.perform(get("/failing/number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Required parameter 'limit' is missing"));
    }

    @Test
    void unexpectedFailureFallsThroughToTheBaseCatchAllAs500() throws Exception {
        mockMvc.perform(get("/failing/throw/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(content().string(not(containsString(SECRET_DETAIL))));
    }

    enum Color {
        RED
    }

    @RestController
    static class FailingController {

        @GetMapping("/failing/number")
        String number(@RequestParam("limit") int limit) {
            return "ok";
        }

        @GetMapping("/failing/enum")
        String color(@RequestParam("color") Color color) {
            return "ok";
        }

        @GetMapping("/failing/items/{id}")
        String item(@PathVariable("id") Long id) {
            return "ok";
        }

        @GetMapping("/failing/throw/{kind}")
        String fail(@PathVariable("kind") String kind) {
            switch (kind) {
                case "pinot" -> throw new PinotQueryException(SECRET_DETAIL);
                case "database" -> throw new DataAccessResourceFailureException(SECRET_DETAIL);
                case "duplicate-key" -> throw new DuplicateKeyException(SECRET_DETAIL);
                case "wrapped-database" ->
                        throw new RuntimeException("wrapper", new DataAccessResourceFailureException(SECRET_DETAIL));
                case "not-found" -> throw new CustomerNotFoundException("cust-1");
                case "illegal-argument" -> throw new IllegalArgumentException("bad input");
                default -> throw new UnsupportedOperationException(SECRET_DETAIL);
            }
        }
    }
}
