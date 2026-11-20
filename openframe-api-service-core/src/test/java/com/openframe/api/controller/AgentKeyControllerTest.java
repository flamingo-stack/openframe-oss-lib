package com.openframe.api.controller;

import com.openframe.api.service.agentkey.AgentKeyService;
import com.openframe.api.service.agentkey.AgentKeyType;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AgentKeyControllerTest {

    private static final AgentKeyResponse KEY = new AgentKeyResponse("new-key", Instant.parse("2026-11-16T17:15:30Z"));

    @Mock
    private AgentKeyService agentKeyService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AgentKeyController(agentKeyService))
                .setConversionService(new ApplicationConversionService())
                .setControllerAdvice(new BaseGlobalExceptionHandler())
                .build();
    }

    @Test
    void getReturnsTheCurrentKeyOfThePathType() throws Exception {
        when(agentKeyService.current(AgentKeyType.REGISTRATION)).thenReturn(KEY);

        mockMvc.perform(get("/agent/keys/registration"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.key").value("new-key"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"log", "LOG", "Log"})
    void rotateIs201WithTheNewKeyForAnyCaseOfTheType(String type) throws Exception {
        when(agentKeyService.rotate(AgentKeyType.LOG)).thenReturn(KEY);

        mockMvc.perform(post("/agent/keys/{type}/rotate", type))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("new-key"));
    }

    @Test
    void unknownTypeIs400AndNothingRotates() throws Exception {
        mockMvc.perform(post("/agent/keys/api/rotate"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(agentKeyService);
    }
}
