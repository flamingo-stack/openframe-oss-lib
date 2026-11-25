package com.openframe.api.controller;

import com.openframe.api.dto.ApiKeyResponse;
import com.openframe.api.dto.CreateApiKeyRequest;
import com.openframe.api.dto.UpdateApiKeyRequest;
import com.openframe.api.service.ApiKeyService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApiKeyControllerAuditTest {

    private static final Instant EXPIRES_AT = Instant.parse("2027-03-01T00:00:00Z");
    private static final AuthPrincipal PRINCIPAL = AuthPrincipal.builder().id("user-1").build();

    @Mock private ApiKeyService apiKeyService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createApiKey_refused_namesTheEventByTheAskedName() {
        audited().createApiKey(createRequest(), PRINCIPAL);

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("CI pipeline");
    }

    @Test
    void createApiKey_refused_keepsTheAskedExpiryInTheDetails() {
        audited().createApiKey(createRequest(), PRINCIPAL);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsOnly(entry("expiresAt", EXPIRES_AT));
    }

    @Test
    void updateApiKey_refused_keepsTheAskedValuesInTheDetails() {
        audited().updateApiKey("key-1", updateRequest(), PRINCIPAL);

        assertThat(capturedCall().detailsFromResult().apply(null)).containsOnly(
                entry("name", "CI pipeline"),
                entry("description", "Deploys from main"),
                entry("enabled", false),
                entry("expiresAt", EXPIRES_AT));
    }

    @Test
    void updateApiKey_saved_keepsNoAskedValueInTheDetails() {
        ApiKeyResponse saved = ApiKeyResponse.builder()
                .id("key-1").name("CI pipeline").description("Deploys from main").enabled(false).expiresAt(EXPIRES_AT)
                .build();

        audited().updateApiKey("key-1", updateRequest(), PRINCIPAL);

        assertThat(capturedCall().detailsFromResult().apply(saved).values()).containsOnlyNulls();
    }

    private ApiKeyController audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(new ApiKeyController(apiKeyService));
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateApiKeyRequest createRequest() {
        return new CreateApiKeyRequest("CI pipeline", "Deploys from main", EXPIRES_AT);
    }

    private static UpdateApiKeyRequest updateRequest() {
        return new UpdateApiKeyRequest("CI pipeline", "Deploys from main", false, EXPIRES_AT);
    }
}
