package com.openframe.api.service.knowledgebase;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.service.AssignmentService;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.openframe.data.document.audit.AuditAction.KB_ATTACHMENT_DELETE;
import static com.openframe.data.document.audit.AuditAction.KB_FOLDER_RENAME;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_MOVE;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * updateArticle / createArticle as one save: what a single call changes, what it leaves alone, and
 * the order of the writes — the order is the only thing standing in for a transaction here.
 */
class KnowledgeBaseServiceSaveArticleTest {

    private static final String ARTICLE_ID = "a1";
    private static final String USER_ID = "u1";

    private KnowledgeBaseItemRepository repository;
    private KnowledgeBaseTagService tagService;
    private AssignmentService assignmentService;
    private KnowledgeBaseTempAttachmentService tempAttachmentService;
    private KnowledgeBaseAttachmentService attachmentService;
    private AuditedMethodRunner auditedMethodRunner;
    private AuditRecorder auditRecorder;
    private KnowledgeBaseService service;

    @BeforeEach
    void setUp() {
        repository = mock(KnowledgeBaseItemRepository.class);
        tagService = mock(KnowledgeBaseTagService.class);
        assignmentService = mock(AssignmentService.class);
        tempAttachmentService = mock(KnowledgeBaseTempAttachmentService.class);
        attachmentService = mock(KnowledgeBaseAttachmentService.class);
        auditedMethodRunner = mock(AuditedMethodRunner.class, CALLS_REAL_METHODS);
        auditRecorder = mock(AuditRecorder.class);
        when(repository.save(any())).thenAnswer(invocation -> {
            KnowledgeBaseItem item = invocation.getArgument(0);
            if (item.getId() == null) {
                item.setId("new-id");
            }
            return item;
        });
        service = new KnowledgeBaseService(repository, tagService, assignmentService,
                tempAttachmentService, attachmentService, auditedMethodRunner, auditRecorder);
    }

    @Test
    @DisplayName("text and status are saved together, in one document write")
    void textAndStatusAreOneWrite() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");

        KnowledgeBaseItem saved = service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .name("New title")
                .content("New body")
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .build());

        assertThat(saved.getName()).isEqualTo("New title");
        assertThat(saved.getContent()).isEqualTo("New body");
        assertThat(saved.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(saved.getLastModifiedBy()).isEqualTo(USER_ID);
        verify(repository, times(1)).save(any());
    }

    @Test
    @DisplayName("checks first, then tags, assignments and new attachments, then the article, deletions last")
    void writesFollowTheOrderThatSurvivesAFailure() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");
        List<KnowledgeBaseItemAttachment> toDelete = List.of(
                KnowledgeBaseItemAttachment.builder().id("x1").fileName("old.pdf").itemId(ARTICLE_ID).build());
        when(attachmentService.getArticleAttachments(ARTICLE_ID, List.of("x1"))).thenReturn(toDelete);

        service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .tagIds(List.of("t1"))
                .assignedOrganizationIds(List.of("o1"))
                .attachmentTempIds(List.of("tmp1"))
                .deleteAttachmentIds(List.of("x1"))
                .build());

        InOrder inOrder = inOrder(attachmentService, tagService, assignmentService, tempAttachmentService, repository);
        inOrder.verify(attachmentService).getArticleAttachments(ARTICLE_ID, List.of("x1"));
        inOrder.verify(tagService).replaceItemTags(ARTICLE_ID, List.of("t1"));
        inOrder.verify(assignmentService).replaceAssignments(
                ARTICLE_ID, AssignmentItemType.KNOWLEDGE_ARTICLE, AssignmentTargetType.ORGANIZATION, List.of("o1"));
        inOrder.verify(tempAttachmentService).linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp1"), USER_ID);
        inOrder.verify(repository).save(any());
        inOrder.verify(attachmentService).deleteAttachments(toDelete, Set.of());
    }

    @Test
    @DisplayName("an attachment replaced by a file of the same name keeps the file the replacement now owns")
    void replacingAFileOfTheSameNameKeepsTheNewFile() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");
        String sharedPath = "kb-attachments/a1/report.pdf";
        List<KnowledgeBaseItemAttachment> toDelete = List.of(
                KnowledgeBaseItemAttachment.builder().id("x1").fileName("old.pdf").itemId(ARTICLE_ID).storagePath(sharedPath).build());
        when(attachmentService.getArticleAttachments(ARTICLE_ID, List.of("x1"))).thenReturn(toDelete);
        when(tempAttachmentService.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp1"), USER_ID))
                .thenReturn(List.of(KnowledgeBaseItemAttachment.builder().id("n1").fileName("new.pdf").itemId(ARTICLE_ID).storagePath(sharedPath).build()));

        service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .attachmentTempIds(List.of("tmp1"))
                .deleteAttachmentIds(List.of("x1"))
                .build());

        verify(attachmentService).deleteAttachments(toDelete, Set.of(sharedPath));
    }

    @Test
    @DisplayName("a save that is refused has written nothing")
    void aRefusedSaveWritesNothing() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");
        when(attachmentService.getArticleAttachments(any(), any()))
                .thenThrow(new ValidationException("Attachment x9 does not belong to article a1"));

        assertThatThrownBy(() -> service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .name("New title")
                .tagIds(List.of("t1"))
                .deleteAttachmentIds(List.of("x9"))
                .build()))
                .isInstanceOf(ValidationException.class);

        verify(repository, never()).save(any());
        verifyNoInteractions(tagService, assignmentService, tempAttachmentService);
    }

    @Test
    @DisplayName("what the command leaves out is not touched")
    void fieldsLeftOutAreNotTouched() {
        givenArticle(KnowledgeBaseArticleStatus.PUBLISHED, "f1");

        KnowledgeBaseItem saved = service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .name("Only the title")
                .build());

        assertThat(saved.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
        assertThat(saved.getParentId()).isEqualTo("f1");
        assertThat(saved.getContent()).isEqualTo("body");
        verify(tagService, never()).replaceItemTags(any(), any());
        verify(assignmentService, never()).replaceAssignments(any(), any(), any(), any());
    }

    @Test
    @DisplayName("an empty list is a value: it removes every tag")
    void anEmptyListClears() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");

        service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .tagIds(List.of())
                .build());

        verify(tagService).replaceItemTags(ARTICLE_ID, List.of());
    }

    @Test
    @DisplayName("an archived article comes back as the status asked for, not always PUBLISHED")
    void anArchivedArticleIsRestoredAsAsked() {
        givenArticle(KnowledgeBaseArticleStatus.ARCHIVED, null);

        KnowledgeBaseItem saved = service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .status(KnowledgeBaseArticleStatus.DRAFT)
                .build());

        assertThat(saved.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
    }

    @Test
    @DisplayName("moveToRoot clears the parent, which a null parentId cannot ask for")
    void moveToRootClearsTheParent() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");

        KnowledgeBaseItem saved = service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .moveToRoot(true)
                .build());

        assertThat(saved.getParentId()).isNull();
    }

    @Test
    @DisplayName("a folder and moveToRoot in the same save are refused")
    void parentAndMoveToRootTogetherAreRefused() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");

        assertThatThrownBy(() -> service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .parentId("f2")
                .moveToRoot(true)
                .build()))
                .isInstanceOf(ValidationException.class);

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("a folder takes no tags either — only an article has them")
    void aFolderTakesNoTags() {
        when(repository.findById(ARTICLE_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder()
                .id(ARTICLE_ID)
                .type(KnowledgeBaseItemType.FOLDER)
                .name("Folder")
                .build()));

        assertThatThrownBy(() -> service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .tagIds(List.of("t1"))
                .build()))
                .isInstanceOf(ConflictException.class);

        verifyNoInteractions(tagService);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("a folder has no status to set")
    void aFolderHasNoStatus() {
        when(repository.findById(ARTICLE_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder()
                .id(ARTICLE_ID)
                .type(KnowledgeBaseItemType.FOLDER)
                .name("Folder")
                .build()));

        assertThatThrownBy(() -> service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .build()))
                .isInstanceOf(ConflictException.class);

        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("create attaches the files uploaded before the article existed")
    void createAttachesTheUploadedFiles() {
        KnowledgeBaseItem created = service.createArticle(USER_ID, CreateArticleCommand.builder()
                .name("New article")
                .attachmentTempIds(List.of("tmp1"))
                .build());

        assertThat(created.getId()).isEqualTo("new-id");
        verify(tempAttachmentService).linkTempAttachmentsToArticle("new-id", List.of("tmp1"), USER_ID);
    }

    @ParameterizedTest
    @CsvSource({"DRAFT, ARCHIVED, KB_ARTICLE_ARCHIVE", "ARCHIVED, DRAFT, KB_ARTICLE_UNARCHIVE",
            "DRAFT, PUBLISHED, KB_ARTICLE_PUBLISH", "PUBLISHED, DRAFT, KB_ARTICLE_UNPUBLISH"})
    void updateArticle_statusChanged_recordsTheStatusActionWithTheChange(KnowledgeBaseArticleStatus before,
                                                                          KnowledgeBaseArticleStatus after,
                                                                          AuditAction action) {
        givenArticle(before, "f1");

        service.updateArticle(USER_ID, UpdateArticleCommand.builder().id(ARTICLE_ID).status(after).build());

        assertThat(recordedSubChange())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getChanges)
                .containsExactly(action, ARTICLE_ID, Map.of("status", new AuditChange(before, after)));
    }

    @Test
    void updateArticle_movedToAnotherFolder_recordsTheMoveOfTheArticle() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");
        when(repository.findById("f2")).thenReturn(Optional.of(
                KnowledgeBaseItem.builder().id("f2").type(KnowledgeBaseItemType.FOLDER).build()));

        service.updateArticle(USER_ID, UpdateArticleCommand.builder().id(ARTICLE_ID).parentId("f2").build());

        assertThat(recordedSubChange())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetType, AuditEntry::getChanges)
                .containsExactly(KB_ITEM_MOVE, AuditTargetType.KB_ARTICLE,
                        Map.of("parentId", new AuditChange("f1", "f2")));
    }

    @Test
    void updateArticle_sameStatusAndFolder_recordsNoStatusOrMove() {
        givenArticle(KnowledgeBaseArticleStatus.PUBLISHED, "f1");

        service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .status(KnowledgeBaseArticleStatus.PUBLISHED)
                .build());

        verify(auditRecorder, never()).record(any());
    }

    @Test
    void updateArticle_attachmentsLinkedAndDeleted_recordsTheDeletedFiles() {
        givenArticle(KnowledgeBaseArticleStatus.DRAFT, "f1");
        when(attachmentService.getArticleAttachments(ARTICLE_ID, List.of("x1"))).thenReturn(List.of(
                KnowledgeBaseItemAttachment.builder().id("x1").fileName("old.pdf").itemId(ARTICLE_ID).build()));
        when(tempAttachmentService.linkTempAttachmentsToArticle(ARTICLE_ID, List.of("tmp1"), USER_ID)).thenReturn(List.of(
                KnowledgeBaseItemAttachment.builder().id("n1").fileName("new.pdf").itemId(ARTICLE_ID).build()));

        service.updateArticle(USER_ID, UpdateArticleCommand.builder()
                .id(ARTICLE_ID)
                .attachmentTempIds(List.of("tmp1"))
                .deleteAttachmentIds(List.of("x1"))
                .build());

        ArgumentCaptor<AuditEntry> entries = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).record(entries.capture());
        assertThat(entries.getAllValues())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(
                        tuple(KB_ATTACHMENT_DELETE, Map.of("attachmentIds", List.of("x1"), "fileNames", List.of("old.pdf"))));
    }

    @Test
    void updateArticle_folder_recordedAsAFolderRename() {
        when(repository.findById(ARTICLE_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder()
                .id(ARTICLE_ID)
                .type(KnowledgeBaseItemType.FOLDER)
                .name("Old folder")
                .build()));

        service.updateArticle(USER_ID, UpdateArticleCommand.builder().id(ARTICLE_ID).name("New folder").build());

        ArgumentCaptor<AuditCall> call = ArgumentCaptor.forClass(AuditCall.class);
        verify(auditedMethodRunner).run(call.capture(), any());
        assertThat(call.getValue().action()).isEqualTo(KB_FOLDER_RENAME);
    }

    private AuditEntry recordedSubChange() {
        ArgumentCaptor<AuditEntry> entry = ArgumentCaptor.forClass(AuditEntry.class);
        verify(auditRecorder).record(entry.capture());
        return entry.getValue();
    }

    private void givenArticle(KnowledgeBaseArticleStatus status, String parentId) {
        when(repository.findById(ARTICLE_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder()
                .id(ARTICLE_ID)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name("Title")
                .content("body")
                .parentId(parentId)
                .status(status)
                .build()));
    }
}
