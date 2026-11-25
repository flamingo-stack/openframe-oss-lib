package com.openframe.api.service.knowledgebase;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseAttachmentServiceAuditTest {

    @Mock private KnowledgeBaseItemAttachmentRepository attachmentRepository;
    @Mock private GcsPresignedUrlService gcsPresignedUrlService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private KnowledgeBaseAttachmentService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    private Object workResult;

    @Test
    void generateDownloadUrl_attachmentFound_eventTargetsItsArticleAndNamesTheFile() {
        runTheWork();

        service.generateDownloadUrl("x1", KnowledgeBaseAttachmentServiceAuditTest::attachment);

        AuditCall call = auditCall();
        assertThat(call.targetIdFromResult().apply(workResult)).isEqualTo("article-1");
        assertThat(call.detailsFromResult().apply(workResult)).containsOnly(
                entry("attachmentIds", List.of("x1")),
                entry("fileNames", List.of("manual.pdf")));
    }

    @Test
    void deleteAttachment_attachmentNotFound_failedEventKeepsTheAskedId() {
        runTheWork();
        when(attachmentRepository.findById("x1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteAttachment("x1", () -> service.getAttachment("x1")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Attachment not found: x1");

        assertThat(auditCall().detailsFromResult().apply(null)).containsOnly(entry("attachmentIds", List.of("x1")));
    }

    private void runTheWork() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenAnswer(invocation -> {
            workResult = invocation.<AuditedWork<?, ?>>getArgument(1).run();
            return workResult;
        });
    }

    private AuditCall auditCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static KnowledgeBaseItemAttachment attachment() {
        return KnowledgeBaseItemAttachment.builder()
                .id("x1")
                .itemId("article-1")
                .fileName("manual.pdf")
                .storagePath("kb-attachments/article-1/manual.pdf")
                .build();
    }
}
