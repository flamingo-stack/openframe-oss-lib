package com.openframe.external.web;

import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.ServletWebRequest;

import java.lang.reflect.Method;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApiCallerArgumentResolverTest {

    private final ApiCallerArgumentResolver resolver = new ApiCallerArgumentResolver();

    @Test
    void supportsOnlyApiCallerParameters() {
        assertTrue(resolver.supportsParameter(parameter(0)));
        assertFalse(resolver.supportsParameter(parameter(1)));
        assertFalse(resolver.supportsParameter(parameter(2)));
    }

    @Test
    void bindsBothGatewayHeaders() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_USER_ID, "user-42");
        request.addHeader(X_API_KEY_ID, "ak_42");

        assertEquals(new ApiCaller("user-42", "ak_42"), resolve(request));
    }

    @Test
    void headerNamesAreCaseInsensitive() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-user-id", "user-42");
        request.addHeader("X-API-KEY-ID", "ak_42");

        assertEquals(new ApiCaller("user-42", "ak_42"), resolve(request));
    }

    @Test
    void missingHeadersBecomeNullsInsteadOfFailing() {
        assertEquals(new ApiCaller(null, null), resolve(new MockHttpServletRequest()));
    }

    @Test
    void eachHeaderIsBoundIndependently() {
        MockHttpServletRequest onlyUser = new MockHttpServletRequest();
        onlyUser.addHeader(X_USER_ID, "user-42");
        MockHttpServletRequest onlyKey = new MockHttpServletRequest();
        onlyKey.addHeader(X_API_KEY_ID, "ak_42");

        assertEquals(new ApiCaller("user-42", null), resolve(onlyUser));
        assertEquals(new ApiCaller(null, "ak_42"), resolve(onlyKey));
    }

    @Test
    void headerValuesAreNotTrimmedOrNormalized() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(X_USER_ID, " ");
        request.addHeader(X_API_KEY_ID, "");

        assertEquals(new ApiCaller(" ", ""), resolve(request));
    }

    @Test
    void controllersReceiveTheCallerFromRequestHeaders() throws Exception {
        MockMvc mockMvc = ExternalApiMockMvc.standalone(new WhoAmIController());

        mockMvc.perform(get("/whoami"))
                .andExpect(status().isOk())
                .andExpect(content().string(ExternalApiMockMvc.USER_ID + "/" + ExternalApiMockMvc.API_KEY_ID));

        mockMvc.perform(get("/whoami").header(X_USER_ID, "user-42").header(X_API_KEY_ID, "ak_42"))
                .andExpect(status().isOk())
                .andExpect(content().string("user-42/ak_42"));
    }

    private ApiCaller resolve(MockHttpServletRequest request) {
        return (ApiCaller) resolver.resolveArgument(parameter(0), null, new ServletWebRequest(request), null);
    }

    private static MethodParameter parameter(int index) {
        try {
            Method method = WhoAmIController.class.getDeclaredMethod("handler", ApiCaller.class, String.class, Object.class);
            return new MethodParameter(method, index);
        } catch (NoSuchMethodException e) {
            throw new IllegalStateException(e);
        }
    }

    @RestController
    static class WhoAmIController {

        @GetMapping("/whoami")
        String whoAmI(ApiCaller caller) {
            return caller.userId() + "/" + caller.apiKeyId();
        }

        void handler(ApiCaller caller, String userId, Object other) {
        }
    }
}
