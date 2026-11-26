package com.openframe.external.security;

import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ApiKeyPrincipalResolverAuditTest {

    @Mock private UserRepository userRepository;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private ApiKeyPrincipalResolver resolver;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void resolve_refused_keepsTheTriedMethodAndPathInTheDetails() {
        RequestContextHolder.setRequestAttributes(
                new ServletRequestAttributes(new MockHttpServletRequest("POST", "/api/v1/tickets")));

        audited().resolve("user-1");

        assertThat(capturedCall().detailsFromResult().apply(null)).containsOnly(entry("path", "POST /api/v1/tickets"));
    }

    @Test
    void requestPath_outsideARequest_isNull() {
        assertThat(ApiKeyPrincipalResolver.requestPath()).isNull();
    }

    private ApiKeyPrincipalResolver audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(resolver);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
