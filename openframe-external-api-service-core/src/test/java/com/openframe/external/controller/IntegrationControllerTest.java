package com.openframe.external.controller;

import com.openframe.external.service.RestProxyService;
import com.openframe.external.support.ExternalApiMockMvc;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class IntegrationControllerTest {

    private static final String TOOL_ID = "tactical-rmm";

    @Mock
    private RestProxyService restProxyService;

    @Captor
    private ArgumentCaptor<HttpServletRequest> requestCaptor;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new IntegrationController(restProxyService));
    }

    @Test
    void getIsHandedToTheProxyWithPathQueryAndHeadersIntact() throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), isNull()))
                .thenReturn(ResponseEntity.ok("{\"agents\":[]}"));

        mockMvc.perform(get("/tools/tactical-rmm/api/v1/agents")
                        .queryParam("status", "online")
                        .queryParam("page", "2")
                        .header("X-Trace-Id", "trace-1"))
                .andExpect(status().isOk())
                .andExpect(content().string("{\"agents\":[]}"));

        verify(restProxyService).proxyApiRequest(eq(TOOL_ID), requestCaptor.capture(), isNull());
        HttpServletRequest proxied = requestCaptor.getValue();
        assertEquals("GET", proxied.getMethod());
        assertEquals("/tools/tactical-rmm/api/v1/agents", proxied.getRequestURI());
        assertEquals("status=online&page=2", proxied.getQueryString());
        assertEquals("trace-1", proxied.getHeader("X-Trace-Id"));
        assertEquals(ExternalApiMockMvc.USER_ID, proxied.getHeader("X-User-Id"));
        assertEquals(ExternalApiMockMvc.API_KEY_ID, proxied.getHeader("X-API-Key-Id"));
    }

    @Test
    void postBodyIsPassedThroughVerbatim() throws Exception {
        String body = "{\"hostname\":\"host-7\",\"tags\":[\"a\",\"b\"]}";
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), eq(body)))
                .thenReturn(ResponseEntity.status(201).body("{\"id\":42}"));

        mockMvc.perform(post("/tools/tactical-rmm/api/v1/agents")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(content().string("{\"id\":42}"));

        verify(restProxyService).proxyApiRequest(eq(TOOL_ID), requestCaptor.capture(), eq(body));
        assertEquals("POST", requestCaptor.getValue().getMethod());
        assertEquals("application/json", requestCaptor.getValue().getContentType());
    }

    @Test
    void nonJsonBodyIsPassedThroughAsText() throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), eq("plain text")))
                .thenReturn(ResponseEntity.ok("ok"));

        mockMvc.perform(post("/tools/tactical-rmm/notes")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("plain text"))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
    void everySupportedMethodReachesTheProxy(String method) throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), isNull()))
                .thenReturn(ResponseEntity.noContent().build());

        mockMvc.perform(request(HttpMethod.valueOf(method), "/tools/tactical-rmm/api/v1/agents/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(restProxyService).proxyApiRequest(eq(TOOL_ID), requestCaptor.capture(), isNull());
        assertEquals(method, requestCaptor.getValue().getMethod());
        assertEquals("/tools/tactical-rmm/api/v1/agents/7", requestCaptor.getValue().getRequestURI());
    }

    @Test
    void toolRootWithoutSubPathIsProxied() throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), isNull())).thenReturn(ResponseEntity.ok("root"));

        mockMvc.perform(get("/tools/tactical-rmm"))
                .andExpect(status().isOk())
                .andExpect(content().string("root"));

        verify(restProxyService).proxyApiRequest(eq(TOOL_ID), requestCaptor.capture(), isNull());
        assertEquals("/tools/tactical-rmm", requestCaptor.getValue().getRequestURI());
        assertNull(requestCaptor.getValue().getQueryString());
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 404, 409, 500, 502})
    void upstreamErrorStatusAndBodyArePassedBack(int upstreamStatus) throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), isNull()))
                .thenReturn(ResponseEntity.status(upstreamStatus).body("{\"detail\":\"upstream says no\"}"));

        mockMvc.perform(get("/tools/tactical-rmm/api/v1/agents"))
                .andExpect(status().is(upstreamStatus))
                .andExpect(content().string("{\"detail\":\"upstream says no\"}"));
    }

    @Test
    void unknownToolAnswerFromTheProxyIsPassedBack() throws Exception {
        when(restProxyService.proxyApiRequest(eq("ghost"), any(), isNull()))
                .thenReturn(ResponseEntity.status(404).body("Tool not found: ghost"));

        mockMvc.perform(get("/tools/ghost/api"))
                .andExpect(status().isNotFound())
                .andExpect(content().string("Tool not found: ghost"));
    }

    @Test
    void proxyExceptionBecomes500WithItsMessage() throws Exception {
        when(restProxyService.proxyApiRequest(eq(TOOL_ID), any(), isNull()))
                .thenThrow(new IllegalStateException("boom"));

        mockMvc.perform(get("/tools/tactical-rmm/api/v1/agents"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string("Internal server error: boom"));
    }
}
