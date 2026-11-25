package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.ticket.Ticket;
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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TicketServiceAuditTest {

    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private TicketService ticketService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createTicket_noStatusAsked_storesTheStatusTheTicketGot() {
        audited().createTicket(ADMIN, CreateTicketInput.builder().title("Printer offline").build());

        assertThat(capturedCall().detailsFromResult().apply(Ticket.builder().id("t-1").statusId("st-got").build()))
                .containsEntry("statusId", "st-got");
    }

    @Test
    void createTicket_refused_namesTheEventByTheAskedTitle() {
        audited().createTicket(ADMIN, askedCreate());

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("Printer offline");
    }

    @Test
    void createTicket_refused_keepsTheAskedStatusDeviceAndCustomerInTheDetails() {
        audited().createTicket(ADMIN, askedCreate());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsAllEntriesOf(Map.of(
                "statusId", "st-asked", "deviceId", "device-other", "organizationId", "org-1"));
    }

    @Test
    void createTicket_refused_setsTheEventsCustomerAndDeviceToTheAskedOnes() {
        audited().createTicket(ADMIN, askedCreate());

        assertThat(capturedCall())
                .extracting(call -> call.organizationIdOf().apply(null), call -> call.deviceIdOf().apply(null))
                .containsExactly("org-1", "device-other");
    }

    @Test
    void updateTicket_refused_keepsTheAskedTitleDeviceCustomerAssigneeAndTagsInTheDetails() {
        audited().updateTicket(ADMIN, "t-1", UpdateTicketInput.builder().id("t-1").title("Printer offline")
                .deviceId("device-other").organizationId("org-1").assigneeId("u-1").tagIds(List.of("tag-1")).build());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "title", "Printer offline", "deviceId", "device-other", "organizationId", "org-1",
                "assigneeId", "u-1", "tagIds", List.of("tag-1")));
    }

    private TicketService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(ticketService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateTicketInput askedCreate() {
        return CreateTicketInput.builder().title("Printer offline").statusId("st-asked").deviceId("device-other")
                .organizationId("org-1").build();
    }
}
