package com.openframe.api.service.knowledgebase;

import com.google.cloud.storage.StorageException;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.ticket.TempAttachment;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditEntry.AuditEntryBuilder;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import com.openframe.data.repository.ticket.TempAttachmentRepository;
import com.openframe.data.service.GcsPresignedUrlService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.KB_ATTACHMENT_ADD;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseTempAttachmentServiceTest {

    private static final String ARTICLE_ID = "article-1";
    private static final String USER_ID = "user-1";

    @Mock private TempAttachmentRepository tempAttachmentRepository;
    @Mock private KnowledgeBaseItemAttachmentRepository attachmentRepository;
    @Mock private GcsPresignedUrlService gcsPresignedUrlService;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private KnowledgeBaseTempAttachmentService service;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;
    @Captor private ArgumentCaptor<AuditEntryBuilder> failedEntryCaptor;
    private final TempAttachment neverUploaded = temp("tmp-missing", "never-uploaded.pdf");
    private final StorageException moveFailure =
            new StorageException(404, "No such object: temp/tmp-missing/never-uploaded.pdf");

    @Test
    void linkTempAttachmentsToArticle_twoFilesMoved_recordsOneAddWithBothSavedIdsAndNames() {
        TempAttachment report = temp("tmp-1", "report.pdf");
        TempAttachment screenshot = temp("tmp-2", "screenshot.png");
        when(tempAttachmentRepository.findByIdIn(List.of("tmp-1", "tmp-2"))).thenReturn(List.of(report, screenshot));
        when(attachmentRepository.saveAll(List.of(moved(report), moved(screenshot))))
                .thenReturn(List.of(saved("att-1", "report.pdf"), saved("att-2", "screenshot.png")));

        service.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp-1", "tmp-2"), USER_ID);

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(KB_ATTACHMENT_ADD, SUCCESS, ARTICLE_ID, Map.of(
                        "attachmentIds", List.of("att-1", "att-2"),
                        "fileNames", List.of("report.pdf", "screenshot.png")));
    }

    @Test
    void linkTempAttachmentsToArticle_fileFailsToMove_recordsAFailedAddWithItsFileName() {
        when(tempAttachmentRepository.findByIdIn(List.of("tmp-missing"))).thenReturn(List.of(neverUploaded));
        neverUploadedFailsToMove();

        service.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp-missing"), USER_ID);

        verify(auditRecorder).recordFailure(failedEntryCaptor.capture(), eq(moveFailure));
        assertThat(failedEntryCaptor.getValue().build())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(KB_ATTACHMENT_ADD, ARTICLE_ID, Map.of("fileNames", List.of("never-uploaded.pdf")));
    }

    @Test
    void linkTempAttachmentsToArticle_oneOfTwoFilesFailsToMove_savesAndRecordsOnlyTheMovedFile() {
        TempAttachment screenshot = temp("tmp-2", "screenshot.png");
        when(tempAttachmentRepository.findByIdIn(List.of("tmp-missing", "tmp-2")))
                .thenReturn(List.of(neverUploaded, screenshot));
        neverUploadedFailsToMove();
        when(attachmentRepository.saveAll(List.of(moved(screenshot))))
                .thenReturn(List.of(saved("att-2", "screenshot.png")));

        service.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp-missing", "tmp-2"), USER_ID);

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue().getDetails()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "attachmentIds", List.of("att-2"),
                "fileNames", List.of("screenshot.png")));
    }

    @Test
    void linkTempAttachmentsToArticle_noFileMoved_savesNothingAndRecordsNoSuccess() {
        when(tempAttachmentRepository.findByIdIn(List.of("tmp-missing"))).thenReturn(List.of(neverUploaded));
        neverUploadedFailsToMove();

        service.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp-missing"), USER_ID);

        verifyNoInteractions(attachmentRepository);
        verify(auditRecorder, never()).record(any(AuditEntry.class));
    }

    private void neverUploadedFailsToMove() {
        doThrow(moveFailure).when(gcsPresignedUrlService)
                .moveFile("temp/tmp-missing/never-uploaded.pdf", "kb-attachments/article-1/never-uploaded.pdf");
    }

    private static TempAttachment temp(String id, String fileName) {
        return TempAttachment.builder()
                .id(id)
                .fileName(fileName)
                .contentType("application/pdf")
                .fileSize(2048L)
                .storagePath("temp/" + id + "/" + fileName)
                .uploadedBy("uploader-1")
                .build();
    }

    private static KnowledgeBaseItemAttachment moved(TempAttachment temp) {
        return KnowledgeBaseItemAttachment.builder()
                .itemId(ARTICLE_ID)
                .fileName(temp.getFileName())
                .contentType(temp.getContentType())
                .fileSize(temp.getFileSize())
                .storagePath("kb-attachments/article-1/" + temp.getFileName())
                .uploadedBy(USER_ID)
                .build();
    }

    private static KnowledgeBaseItemAttachment saved(String id, String fileName) {
        return KnowledgeBaseItemAttachment.builder()
                .id(id)
                .itemId(ARTICLE_ID)
                .fileName(fileName)
                .storagePath("kb-attachments/article-1/" + fileName)
                .build();
    }
}
