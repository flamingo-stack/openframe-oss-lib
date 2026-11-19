package com.openframe.api.controller;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.service.agentkey.AgentKeyService;
import com.openframe.api.service.agentkey.AgentKeyType;
import com.openframe.api.service.agentkey.AgentKeyTypeConverter;
import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.exception.BaseGlobalExceptionHandler;
import com.openframe.data.document.audit.AuditAction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.format.support.FormattingConversionService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
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
    @Mock(answer = Answers.CALLS_REAL_METHODS)
    private AuditedMethodRunner auditedMethodRunner;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        FormattingConversionService conversion = new FormattingConversionService();
        conversion.addConverter(new AgentKeyTypeConverter());
        mockMvc = MockMvcBuilders.standaloneSetup(new AgentKeyController(agentKeyService, auditedMethodRunner))
                .setConversionService(conversion)
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

    @Test
    void rotateIs201WithTheNewKey() throws Exception {
        when(agentKeyService.rotate(AgentKeyType.LOG)).thenReturn(KEY);

        mockMvc.perform(post("/agent/keys/log/rotate"))
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

    @ParameterizedTest
    @CsvSource({"REGISTRATION, AGENT_REGISTRATION_SECRET_VIEW", "LOG, AGENT_LOG_KEY_VIEW"})
    void current_keyType_recordedAsTheViewOfThatKey(AgentKeyType type, AuditAction action) {
        new AgentKeyController(agentKeyService, auditedMethodRunner).current(type);

        verify(auditedMethodRunner).run(eq(action), isNull(), any(Supplier.class));
    }

    @ParameterizedTest
    @CsvSource({"REGISTRATION, AGENT_REGISTRATION_SECRET_ROTATE", "LOG, AGENT_LOG_KEY_ROTATE"})
    void rotate_keyType_recordedAsTheRotationOfThatKeyWithoutACompare(AgentKeyType type, AuditAction action) {
        new AgentKeyController(agentKeyService, auditedMethodRunner).rotate(type);

        ArgumentCaptor<AuditCall> call = ArgumentCaptor.forClass(AuditCall.class);
        verify(auditedMethodRunner).run(call.capture(), any());
        assertThat(call.getValue()).extracting(AuditCall::action, AuditCall::compare).containsExactly(action, false);
    }
}
