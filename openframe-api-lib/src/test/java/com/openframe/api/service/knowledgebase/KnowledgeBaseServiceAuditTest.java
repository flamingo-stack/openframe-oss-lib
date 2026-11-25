package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
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

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus.PUBLISHED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceAuditTest {

    private static final String USER_ID = "user-1";

    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private KnowledgeBaseService knowledgeBaseService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createArticle_refused_namesTheEventByTheAskedName() {
        audited().createArticle(USER_ID, createCommand());

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("VPN setup");
    }

    @Test
    void createArticle_refused_keepsTheAskedArticleInTheDetails() {
        audited().createArticle(USER_ID, createCommand());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "parentId", "folder-1", "status", PUBLISHED, "tagIds", List.of("tag-1"),
                "organizationIds", List.of("org-1"), "deviceIds", List.of("device-1"),
                "ticketIds", List.of("ticket-1"), "articleIds", List.of("article-2"),
                "summary", "Connect to the office VPN", "attachmentTempIds", List.of("temp-1")));
    }

    @Test
    void createFolder_refused_namesTheEventByTheAskedName() {
        audited().createFolder("Guides", "folder-1");

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("Guides");
    }

    private KnowledgeBaseService audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(knowledgeBaseService);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateArticleCommand createCommand() {
        return CreateArticleCommand.builder()
                .name("VPN setup")
                .parentId("folder-1")
                .summary("Connect to the office VPN")
                .status(PUBLISHED)
                .tagIds(List.of("tag-1"))
                .assignedOrganizationIds(List.of("org-1"))
                .assignedDeviceIds(List.of("device-1"))
                .assignedTicketIds(List.of("ticket-1"))
                .assignedKnowledgeArticleIds(List.of("article-2"))
                .attachmentTempIds(List.of("temp-1"))
                .build();
    }
}
