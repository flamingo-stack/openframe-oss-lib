package com.openframe.api.controller;

import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.service.SSOConfigService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SSOConfigControllerAuditTest {

    @Mock private SSOConfigService ssoConfigService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void getConfig_providerWithAStoredSecret_storesTheSecretView() {
        SSOConfigResponse configured = SSOConfigResponse.builder().provider("google").clientSecret("s3cr3t").build();

        audited().getConfig("google");

        assertThat(capturedCall().storeIf().test(configured)).isTrue();
    }

    @Test
    void getConfig_providerWithoutASecret_storesNoSecretView() {
        SSOConfigResponse notConfigured = SSOConfigResponse.builder().provider("google").build();

        audited().getConfig("google");

        assertThat(capturedCall().storeIf().test(notConfigured)).isFalse();
    }

    private SSOConfigController audited() {
        AspectJProxyFactory proxyFactory =
                new AspectJProxyFactory(new SSOConfigController(ssoConfigService, auditedMethodRunner));
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
