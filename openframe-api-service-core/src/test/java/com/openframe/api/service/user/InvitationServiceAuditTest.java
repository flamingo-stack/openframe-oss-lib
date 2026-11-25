package com.openframe.api.service.user;

import com.openframe.api.dto.invitation.CreateInvitationRequest;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class InvitationServiceAuditTest {

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private InvitationService invitationService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createInvitation_refused_namesTheEventByTheLowercaseEmail() {
        audited().createInvitation(CreateInvitationRequest.builder().email("Bob@Acme.com").build());

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("bob@acme.com");
    }

    private InvitationService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(invitationService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
