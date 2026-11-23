package com.openframe.client.controller;

import com.openframe.client.dto.agent.AgentRegistrationResponse;
import com.openframe.client.exception.IdentitySplitNotRequestedException;
import com.openframe.client.service.identitysplit.AgentIdentitySplitService;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AgentIdentitySplitControllerTest {

    @Mock
    private AgentIdentitySplitService agentIdentitySplitService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AgentIdentitySplitController(agentIdentitySplitService))
                .setControllerAdvice(new BaseGlobalExceptionHandler())
                .build();
    }

    @Test
    void split_returnsTheNewMachinesCredentials() throws Exception {
        // setup
        when(agentIdentitySplitService.split("m-1", "secret-1", "s-1"))
                .thenReturn(new AgentRegistrationResponse("m-2", "agent_m-2", "secret-2"));

        // execution / verifications
        mockMvc.perform(post("/api/agents/split")
                        .header("X-Machine-Id", "m-1")
                        .header("X-Client-Secret", "secret-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"s-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.machineId").value("m-2"))
                .andExpect(jsonPath("$.clientId").value("agent_m-2"))
                .andExpect(jsonPath("$.clientSecret").value("secret-2"));
    }

    @Test
    void split_notRequested_conflict() throws Exception {
        // setup
        when(agentIdentitySplitService.split("m-1", "secret-1", "s-1"))
                .thenThrow(new IdentitySplitNotRequestedException("No identity split was requested for this session"));

        // execution / verifications
        mockMvc.perform(post("/api/agents/split")
                        .header("X-Machine-Id", "m-1")
                        .header("X-Client-Secret", "secret-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionId\":\"s-1\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void split_withoutSession_badRequest() throws Exception {
        // execution / verifications
        mockMvc.perform(post("/api/agents/split")
                        .header("X-Machine-Id", "m-1")
                        .header("X-Client-Secret", "secret-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(agentIdentitySplitService);
    }
}
