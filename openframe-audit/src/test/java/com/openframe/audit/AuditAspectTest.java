package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.Advisor;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authorization.method.AuthorizationManagerBeforeMethodInterceptor;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {


    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    private final List<AnnotationConfigApplicationContext> contexts = new ArrayList<>();

    @AfterEach
    void closeContexts() {
        contexts.forEach(AnnotationConfigApplicationContext::close);
    }

    @Test
    void capture_preAuthorizeRefusesTheCall_capturesTheRefusal() {
        when(auditedMethodRunner.run(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
        TicketEndpoints endpoints = proxied(TicketEndpoints.class);

        assertThatThrownBy(() -> endpoints.archiveAsAdmin("ticket-1")).isInstanceOf(AccessDeniedException.class);
        verify(auditedMethodRunner).run(any(AuditCall.class), any());
    }

    @Test
    void capture_annotationOnTheImplementationOfAnInterfaceProxy_readsIt() {
        proxied(TicketReopening.class).reopen("ticket-1");

        assertThat(capturedCall().action()).isEqualTo(AuditAction.TICKET_REOPEN);
    }

    @Test
    void capture_markOnAnInterfaceWhoseBeanIsItselfAProxy_readsTheParametersByName() {
        proxied(TicketArchive.class).archive("ticket-1");

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("ticket-1");
    }

    @Test
    void capture_targetTypeNotNamed_takesTheActionsType() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().targetType()).isEqualTo(AuditTargetType.TICKET);
    }

    @Test
    void capture_targetIdFromArguments_readsTheIdBeforeAndAfterTheCall() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall())
                .returns(false, AuditCall::targetIdInResult)
                .returns("ticket-1", call -> call.targetIdBeforeCall().get())
                .returns("ticket-1", call -> call.targetIdFromResult().apply("archived ticket-1"));
    }

    @Test
    void capture_targetIdFromAnArgumentTheMethodFills_readsItAfterTheCall() {
        List<String> idsBeforeTheCall = new ArrayList<>();
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            idsBeforeTheCall.add(invocation.<AuditCall>getArgument(0).targetIdBeforeCall().get());
            return invocation.<AuditedWork<?, ?>>getArgument(1).run();
        });

        proxied(TicketEndpoints.class).file(new TicketDraft());

        assertThat(idsBeforeTheCall).containsExactly((String) null);
        assertThat(capturedCall().targetIdFromResult().apply(null)).isEqualTo("ticket-7");
    }

    @Test
    void capture_markOnAnInterfaceCalledThroughItsGenericParent_readsTheParametersByName() {
        Archiver<String> archiver = proxied(TicketArchive.class);

        archiver.archive("ticket-1");

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("ticket-1");
    }

    @Test
    void capture_targetIdFromResult_readsTheIdOnlyFromTheResult() {
        Ticket ticket = new Ticket("ticket-9", "Printer offline");

        proxied(TicketEndpoints.class).create("Printer offline");

        assertThat(capturedCall())
                .returns(true, AuditCall::targetIdInResult)
                .returns(null, call -> call.targetIdBeforeCall().get())
                .returns("ticket-9", call -> call.targetIdFromResult().apply(ticket));
    }

    @Test
    void capture_targetTypeNamed_takesTheNamedType() {
        proxied(TicketEndpoints.class).link("article-1");

        assertThat(capturedCall().targetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    @Test
    void capture_noCondition_recordsEveryResult() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().recordsResult().test("archived ticket-1")).isTrue();
    }

    private <T> T proxied(Class<T> type) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(ProxyConfiguration.class, AuditAspect.class, TicketEndpoints.class,
                ReopeningEndpoints.class);
        context.getBeanFactory().registerSingleton("auditedMethodRunner", auditedMethodRunner);
        context.getBeanFactory().registerSingleton("auditExpressions", new AuditExpressions(new RelayIdCodec()));
        context.refresh();
        contexts.add(context);
        return context.getBean(type);
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    @Configuration
    @EnableAspectJAutoProxy
    static class ProxyConfiguration {

        @Bean
        static Advisor preAuthorize() {
            return AuthorizationManagerBeforeMethodInterceptor.preAuthorize();
        }

        @Bean
        TicketArchive ticketArchive() {
            InvocationHandler archive = (proxy, method, arguments) -> switch (method.getName()) {
                case "archive" -> "archived " + arguments[0];
                case "equals" -> proxy == arguments[0];
                case "hashCode" -> System.identityHashCode(proxy);
                default -> "ticketArchive";
            };
            return (TicketArchive) Proxy.newProxyInstance(TicketArchive.class.getClassLoader(),
                    new Class<?>[] {TicketArchive.class}, archive);
        }
    }

    record Ticket(String id, String title) {
    }

    static class TicketDraft {

        private String id;

        public String getId() {
            return id;
        }
    }

    static class TicketEndpoints {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public String archive(String id) {
            return "archived " + id;
        }

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        @PreAuthorize("denyAll()")
        public String archiveAsAdmin(String id) {
            return "archived " + id;
        }

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result.id")
        public Ticket create(String title) {
            return new Ticket("ticket-9", title);
        }

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#draft.id")
        public void file(TicketDraft draft) {
            draft.id = "ticket-7";
        }

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#targetId", targetType = AuditTargetType.KB_ARTICLE)
        public void link(String targetId) {
        }

    }

    interface Archiver<T> {

        String archive(T id);
    }

    interface TicketArchive extends Archiver<String> {

        @Override
        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#ticketId")
        String archive(String ticketId);
    }

    interface TicketReopening {

        String reopen(String id);
    }

    static class ReopeningEndpoints implements TicketReopening {

        @Audited(action = AuditAction.TICKET_REOPEN, targetId = "#id")
        @Override
        public String reopen(String id) {
            return "reopened " + id;
        }
    }
}
