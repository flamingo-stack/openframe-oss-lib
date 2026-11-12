package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    private static final Method ASSIGN = endpoint("assign", String.class, String.class, String.class, String.class);
    private static final Object[] ASSIGN_ARGUMENTS = {"ticket-1", "tenant-1", "org-1", "device-1"};
    private static final Ticket ASSIGNED = new Ticket("ticket-1", "Printer offline");

    @Mock private AuditCapture auditCapture;
    @Mock private AuditExpressions expressions;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<AuditedWork<?, ?>> workCaptor;

    @Test
    void capture_auditedMethod_handsTheMethodToTheCaptureAsItsWork() throws Throwable {
        proxied(TicketEndpoints.class).archive("ticket-1");

        verify(auditCapture).capture(any(AuditCall.class), workCaptor.capture());
        assertThat(workCaptor.getValue().run()).isEqualTo("archived ticket-1");
    }

    @Test
    void capture_auditedMethod_answersWhatTheCaptureReturns() {
        when(auditCapture.capture(any(AuditCall.class), any())).thenReturn("captured");

        assertThat(proxied(TicketEndpoints.class).archive("ticket-1")).isEqualTo("captured");
    }

    @Test
    void capture_preAuthorizeRefusesTheCall_capturesTheRefusal() {
        when(auditCapture.capture(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
        TicketEndpoints endpoints = proxied(TicketEndpoints.class);

        assertThatThrownBy(() -> endpoints.archiveAsAdmin("ticket-1")).isInstanceOf(AccessDeniedException.class);
        verify(auditCapture).capture(any(AuditCall.class), any());
    }

    @Test
    void capture_annotationOnTheImplementationOfAnInterfaceProxy_readsIt() {
        proxied(TicketReopening.class).reopen("ticket-1");

        assertThat(capturedCall().action()).isEqualTo(AuditAction.TICKET_REOPEN);
    }

    @Test
    void capture_auditedMethod_namesItsAction() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().action()).isEqualTo(AuditAction.TICKET_ARCHIVE);
    }

    @Test
    void capture_targetTypeNotNamed_takesTheActionsType() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().targetType()).isEqualTo(AuditTargetType.TICKET);
    }

    @Test
    void capture_compareNotTurnedOff_comparesTheTarget() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().compare()).isTrue();
    }

    @Test
    void capture_targetIdFromArguments_readsTheIdBeforeTheCall() {
        when(expressions.readsResult("#id")).thenReturn(false);
        when(expressions.evaluate("#id", endpoint("archive", String.class), new Object[]{"ticket-1"}, null))
                .thenReturn("ticket-1");

        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall())
                .returns(false, AuditCall::targetIdInResult)
                .returns("ticket-1", call -> call.targetIdBeforeCall().get())
                .returns(null, call -> call.targetIdFromResult().apply("archived ticket-1"));
    }

    @Test
    void capture_targetIdFromResult_readsTheIdOnlyFromTheResult() {
        Ticket ticket = new Ticket("ticket-9", "Printer offline");
        when(expressions.readsResult("#result.id")).thenReturn(true);
        when(expressions.evaluate("#result.id", endpoint("create", String.class), new Object[]{"Printer offline"},
                ticket)).thenReturn("ticket-9");

        proxied(TicketEndpoints.class).create("Printer offline");

        assertThat(capturedCall())
                .returns(true, AuditCall::targetIdInResult)
                .returns(null, call -> call.targetIdBeforeCall().get())
                .returns("ticket-9", call -> call.targetIdFromResult().apply(ticket));
    }

    @Test
    void capture_targetIdFromResultAndNoResult_hasNoTargetId() {
        when(expressions.readsResult("#result.id")).thenReturn(true);

        proxied(TicketEndpoints.class).create("Printer offline");

        assertThat(capturedCall().targetIdFromResult().apply(null)).isNull();
        verify(expressions, never())
                .evaluate("#result.id", endpoint("create", String.class), new Object[]{"Printer offline"}, null);
    }

    @Test
    void capture_noTargetId_evaluatesNoIdBeforeTheCall() {
        when(expressions.readsResult("")).thenReturn(false);

        proxied(TicketEndpoints.class).updateTenant("Acme");

        assertThat(capturedCall().targetIdBeforeCall().get()).isNull();
        verify(expressions, never()).evaluate("", endpoint("updateTenant", String.class), new Object[]{"Acme"}, null);
    }

    @Test
    void capture_compareTurnedOff_skipsTheCompare() {
        proxied(TicketEndpoints.class).addTag("ticket-1", "tag-9");

        assertThat(capturedCall().compare()).isFalse();
    }

    @Test
    void capture_detailsNamed_evaluatesThemOnTheResult() {
        when(expressions.details(new String[]{"tagId=#tagId"}, endpoint("addTag", String.class, String.class),
                new Object[]{"ticket-1", "tag-9"}, "tagged")).thenReturn(Map.of("tagId", "tag-9"));

        proxied(TicketEndpoints.class).addTag("ticket-1", "tag-9");

        assertThat(capturedCall().detailsFromResult().apply("tagged")).isEqualTo(Map.of("tagId", "tag-9"));
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

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void capture_conditionOnResult_recordsWhenTheConditionHolds(boolean changed) {
        TicketChange change = new TicketChange(changed);
        when(expressions.test("#result.changed", endpoint("update", String.class), new Object[]{"ticket-1"}, change))
                .thenReturn(changed);

        proxied(TicketEndpoints.class).update("ticket-1");

        assertThat(capturedCall().recordsResult().test(change)).isEqualTo(changed);
    }

    @Test
    void capture_conditionOnResultAndNoResult_skipsTheEvent() {
        proxied(TicketEndpoints.class).update("ticket-1");
        AuditCall call = capturedCall();
        when(expressions.readsResult("#result.changed")).thenReturn(true);

        assertThat(call.recordsResult().test(null)).isFalse();
        verify(expressions, never())
                .test("#result.changed", endpoint("update", String.class), new Object[]{"ticket-1"}, null);
    }

    @Test
    void capture_conditionOnArgumentsAndNoResult_testsTheCondition() {
        proxied(TicketEndpoints.class).escalate("ticket-1", false);
        AuditCall call = capturedCall();
        when(expressions.readsResult("!#dryRun")).thenReturn(false);
        when(expressions.test("!#dryRun", endpoint("escalate", String.class, boolean.class),
                new Object[]{"ticket-1", false}, null)).thenReturn(true);

        assertThat(call.recordsResult().test(null)).isTrue();
    }

    @ParameterizedTest
    @MethodSource("afterCallValues")
    void capture_afterCallExpression_evaluatesItOnTheResult(String expression,
                                                            Function<AuditCall, Function<Object, String>> value,
                                                            String evaluated) {
        when(expressions.evaluate(expression, ASSIGN, ASSIGN_ARGUMENTS, ASSIGNED)).thenReturn(evaluated);

        AuditCall call = assignCall();

        assertThat(value.apply(call).apply(ASSIGNED)).isEqualTo(evaluated);
    }

    @Test
    void capture_noAfterCallExpression_hasNoValue() {
        proxied(TicketEndpoints.class).archive("ticket-1");

        assertThat(capturedCall().deviceIdOf().apply("archived ticket-1")).isNull();
        verify(expressions, never())
                .evaluate("", endpoint("archive", String.class), new Object[]{"ticket-1"}, "archived ticket-1");
    }

    @Test
    void capture_afterCallExpressionOnResultAndNoResult_hasNoValue() {
        AuditCall call = assignCall();
        when(expressions.readsResult("#result.title")).thenReturn(true);

        assertThat(call.targetNameOf().apply(null)).isNull();
        verify(expressions, never()).evaluate("#result.title", ASSIGN, ASSIGN_ARGUMENTS, null);
    }

    @Test
    void capture_afterCallExpressionOnArgumentsAndNoResult_evaluatesIt() {
        AuditCall call = assignCall();
        when(expressions.readsResult("#deviceId")).thenReturn(false);
        when(expressions.evaluate("#deviceId", ASSIGN, ASSIGN_ARGUMENTS, null)).thenReturn("device-1");

        assertThat(call.deviceIdOf().apply(null)).isEqualTo("device-1");
    }

    static Stream<Arguments> afterCallValues() {
        return Stream.of(
                afterCallValue("#tenantId", AuditCall::tenantIdOf, "tenant-1"),
                afterCallValue("#result.title", AuditCall::targetNameOf, "Printer offline"),
                afterCallValue("#organizationId", AuditCall::organizationIdOf, "org-1"),
                afterCallValue("#deviceId", AuditCall::deviceIdOf, "device-1"));
    }

    private static Arguments afterCallValue(String expression, Function<AuditCall, Function<Object, String>> value,
                                            String evaluated) {
        return Arguments.of(expression, value, evaluated);
    }

    private AuditCall assignCall() {
        proxied(TicketEndpoints.class).assign("ticket-1", "tenant-1", "org-1", "device-1");
        return capturedCall();
    }

    private <T> T proxied(Class<T> type) {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(ProxyConfiguration.class, AuditAspect.class, TicketEndpoints.class,
                ReopeningEndpoints.class);
        context.getBeanFactory().registerSingleton("auditCapture", auditCapture);
        context.getBeanFactory().registerSingleton("auditExpressions", expressions);
        context.refresh();
        return context.getBean(type);
    }

    private AuditCall capturedCall() {
        verify(auditCapture).capture(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static Method endpoint(String name, Class<?>... parameterTypes) {
        return ReflectionUtils.findMethod(TicketEndpoints.class, name, parameterTypes);
    }

    @Configuration
    @EnableAspectJAutoProxy
    static class ProxyConfiguration {

        @Bean
        static Advisor preAuthorize() {
            return AuthorizationManagerBeforeMethodInterceptor.preAuthorize();
        }
    }

    record Ticket(String id, String title) {
    }

    record TicketChange(boolean changed) {
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

        @Audited(action = AuditAction.TENANT_UPDATE)
        public void updateTenant(String name) {
        }

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId", details = "tagId=#tagId",
                compare = false)
        public String addTag(String ticketId, String tagId) {
            return "tagged";
        }

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#targetId", targetType = AuditTargetType.KB_ARTICLE)
        public void link(String targetId) {
        }

        @Audited(action = AuditAction.TICKET_UPDATE, targetId = "#id", condition = "#result.changed")
        public TicketChange update(String id) {
            return new TicketChange(true);
        }

        @Audited(action = AuditAction.TICKET_ESCALATE, targetId = "#id", condition = "!#dryRun")
        public void escalate(String id, boolean dryRun) {
        }

        @Audited(action = AuditAction.TICKET_ASSIGN, targetId = "#id", tenantId = "#tenantId",
                targetName = "#result.title", organizationId = "#organizationId", deviceId = "#deviceId")
        public Ticket assign(String id, String tenantId, String organizationId, String deviceId) {
            return new Ticket(id, "Printer offline");
        }
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
