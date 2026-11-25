package com.openframe.api.service.ticket;

import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;

import static com.openframe.data.document.audit.AuditAction.TICKET_ARCHIVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TicketLifecycleServiceAuditTest {

    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private TicketLifecycleService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void archiveResolvedTickets_byNonAdmin_isRefused() {
        AuthPrincipal agent = AuthPrincipal.builder().actorType(ActorType.AGENT).build();

        assertThatThrownBy(() -> service.archiveResolvedTickets(agent, null))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Operation requires ADMIN access");
    }

    @Test
    void archiveResolvedTickets_refused_storesNoTicketIds() {
        assertThat(capturedArchiveCall().detailsFromResult().apply(null)).isEmpty();
    }

    @Test
    void archiveResolvedTickets_archiveCall_recordedOnlyWhenTicketsWereArchived() {
        AuditCall archiveCall = capturedArchiveCall();

        assertThat(archiveCall.action()).isEqualTo(TICKET_ARCHIVE);
        assertThat(archiveCall.storeIf())
                .rejects(List.of())
                .accepts(List.of("t-1"));
    }

    @Test
    void archiveResolvedTickets_ticketsArchived_storesTheirIds() {
        assertThat(capturedArchiveCall().detailsFromResult().apply(List.of("t-1", "t-2")))
                .containsOnly(entry("ticketIds", List.of("t-1", "t-2")));
    }

    private AuditCall capturedArchiveCall() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(service);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        TicketLifecycleService audited = proxyFactory.getProxy();
        audited.archiveResolvedTickets(ADMIN, null);
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
