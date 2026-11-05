package com.openframe.audit;

import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuditAspectTest {

    @Mock private AuditCapture auditCapture;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    private TicketEndpoints endpoints;

    @BeforeEach
    void setUp() throws Throwable {
        when(auditCapture.capture(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(ProxyConfiguration.class, AuditAspect.class, AuditExpressions.class, RelayIdCodec.class,
                TicketEndpoints.class);
        context.registerBean(AuditCapture.class, () -> auditCapture);
        context.refresh();
        endpoints = context.getBean(TicketEndpoints.class);
    }

    @Test
    void readsTheTargetIdFromTheArgumentsBeforeTheCall() {
        String result = endpoints.archive("ticket-1");

        AuditCall call = capturedCall();
        assertThat(result).isEqualTo("archived ticket-1");
        assertThat(call.action()).isEqualTo(AuditAction.TICKET_ARCHIVE);
        assertThat(call.targetType()).isEqualTo(AuditTargetType.TICKET);
        assertThat(call.targetIdBeforeCall().get()).isEqualTo("ticket-1");
        assertThat(call.targetIdFromResult().apply(result)).isNull();
        assertThat(call.compare()).isTrue();
    }

    @Test
    void readsTheTargetIdOfACreatedRecordFromTheResult() {
        String result = endpoints.create("Printer offline");

        AuditCall call = capturedCall();
        assertThat(call.targetIdBeforeCall().get()).isNull();
        assertThat(call.targetIdFromResult().apply(result)).isEqualTo("Printer offline-id");
    }

    @Test
    void decodesAGraphqlGlobalId() {
        String globalId = new RelayIdCodec().encode(NodeType.values()[0], "raw-7");

        endpoints.archiveByGlobalId(globalId);

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("raw-7");
    }

    @Test
    void namesTheFactsAndSkipsTheCompareOfARelationChange() {
        endpoints.addTag("ticket-1", "tag-9");

        AuditCall call = capturedCall();
        assertThat(call.compare()).isFalse();
        assertThat(call.detailsFromResult().apply("done"))
                .containsEntry("tagId", "tag-9")
                .containsEntry("outcome", "done");
        assertThat(call.detailsFromResult().apply(null)).containsOnlyKeys("tagId");
    }

    @Test
    void takesTheTargetTypeFromTheAnnotationWhenTheActionHasSeveral() {
        endpoints.link("article-1");

        assertThat(capturedCall().targetType()).isEqualTo(AuditTargetType.KB_ARTICLE);
    }

    private AuditCall capturedCall() {
        try {
            verify(auditCapture).capture(callCaptor.capture(), any());
        } catch (Throwable e) {
            throw new AssertionError(e);
        }
        return callCaptor.getValue();
    }

    @Configuration
    @EnableAspectJAutoProxy(proxyTargetClass = true)
    static class ProxyConfiguration {
    }

    static class TicketEndpoints {

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "#id")
        public String archive(String id) {
            return "archived " + id;
        }

        @Audited(action = AuditAction.TICKET_CREATE, targetId = "#result")
        public String create(String title) {
            return title + "-id";
        }

        @Audited(action = AuditAction.TICKET_ARCHIVE, targetId = "rawId(#id)")
        public String archiveByGlobalId(String id) {
            return id;
        }

        @Audited(action = AuditAction.TICKET_TAG_ADD, targetId = "#ticketId",
                details = {"tagId=#tagId", "outcome=#result"}, compare = false)
        public String addTag(String ticketId, String tagId) {
            return "done";
        }

        @Audited(action = AuditAction.LINK_CREATE, targetId = "#targetId", targetType = AuditTargetType.KB_ARTICLE)
        public void link(String targetId) {
        }
    }
}
