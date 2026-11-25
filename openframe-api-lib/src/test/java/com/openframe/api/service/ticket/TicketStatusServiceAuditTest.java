package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.CreateTicketStatusInput;
import com.openframe.api.dto.ticket.DeleteTicketStatusInput;
import com.openframe.api.dto.ticket.UpdateTicketStatusInput;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketStatusServiceAuditTest {

    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private TicketStatusService ticketStatusService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void create_refused_namesTheEventByTheAskedName() {
        audited().create(ADMIN, askedCreate());

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("On Hold");
    }

    @Test
    void create_refused_keepsTheAskedColorAndStaleTimeInTheDetails() {
        audited().create(ADMIN, askedCreate());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "color", "#ff0000", "staleAfterMinutes", 240));
    }

    @Test
    void update_refused_keepsTheAskedNameColorAndStaleTimeInTheDetails() {
        audited().update(ADMIN, UpdateTicketStatusInput.builder().id("st-wait").name("On Hold").color("#00ff00")
                .staleAfterMinutes(60).build());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "name", "On Hold", "color", "#00ff00", "staleAfterMinutes", 60));
    }

    @Test
    void delete_refused_keepsTheAskedReplacement() {
        deleteThroughTheAudit();

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(Map.of("replacementStatusId", "st-tech"));
    }

    @Test
    void delete_anEmptyStatusWithAReplacementPicked_storesNoReplacement() {
        deleteThroughTheAudit();

        assertThat(capturedCall().detailsFromResult().apply(0L))
                .containsEntry("ticketsMoved", 0L)
                .containsEntry("replacementStatusId", null);
    }

    @Test
    void delete_aPopulatedStatus_storesTheMovedCountAndTheReplacement() {
        deleteThroughTheAudit();

        assertThat(capturedCall().detailsFromResult().apply(7L))
                .containsExactlyInAnyOrderEntriesOf(Map.of("ticketsMoved", 7L, "replacementStatusId", "st-tech"));
    }

    private void deleteThroughTheAudit() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenReturn(0L);
        audited().delete(ADMIN, DeleteTicketStatusInput.builder().id("st-hold").replacementStatusId("st-tech").build());
    }

    private TicketStatusService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(ticketStatusService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateTicketStatusInput askedCreate() {
        return CreateTicketStatusInput.builder().name("On Hold").color("#ff0000").staleAfterMinutes(240).build();
    }
}
