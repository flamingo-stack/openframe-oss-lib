package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.api.service.AssignmentService;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.data.document.audit.AuditAction.KB_ARTICLE_ARCHIVE;
import static com.openframe.data.document.audit.AuditAction.KB_ARTICLE_PUBLISH;
import static com.openframe.data.document.audit.AuditAction.KB_ARTICLE_UNARCHIVE;
import static com.openframe.data.document.audit.AuditAction.KB_FOLDER_DELETE;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_MOVE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceTest {

    private static final String USER_ID = "user-1";
    private static final String UNKNOWN_TAG_ID = "tag-unknown";
    private static final String ITEM_ID = "item-1";
    private static final String FOLDER_ID = "folder-1";
    private static final String TARGET_FOLDER_ID = "folder-2";

    @Mock private KnowledgeBaseItemRepository repository;
    @Mock private KnowledgeBaseTagService knowledgeBaseTagService;
    @Mock private AssignmentService assignmentService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;

    @Captor private ArgumentCaptor<AuditEntry> entries;
    @Captor private ArgumentCaptor<List<AuditEntry>> batch;

    @InjectMocks private KnowledgeBaseService service;

    @Test
    void createArticle_unknownTag_articleNotSaved() {
        // setup
        List<String> tagIds = List.of(UNKNOWN_TAG_ID);
        CreateArticleCommand command = CreateArticleCommand.builder()
                .name("VPN setup")
                .tagIds(tagIds)
                .build();
        NotFoundException tagNotFound = new NotFoundException(ErrorCode.TAG_NOT_FOUND, "Tag not found: " + UNKNOWN_TAG_ID);
        doThrow(tagNotFound).when(knowledgeBaseTagService).requireExistingTags(tagIds);

        // execution
        assertThrows(NotFoundException.class, () -> service.createArticle(USER_ID, command));

        // verifications
        verify(repository, never()).save(any(KnowledgeBaseItem.class));
        verifyNoInteractions(assignmentService);
    }

    @ParameterizedTest
    @CsvSource({"FOLDER, KB_FOLDER_RENAME", "ARTICLE, KB_ARTICLE_UPDATE"})
    void renameFolder_itemType_renamedUnderTheActionOfItsType(KnowledgeBaseItemType type, AuditAction action) {
        givenSavableItem(KnowledgeBaseItem.builder().id(ITEM_ID).type(type).name("Old name").build());
        givenAuditedWorkRunsFor(action);

        KnowledgeBaseItem renamed = service.renameFolder(ITEM_ID, "New name");

        assertThat(renamed.getName()).isEqualTo("New name");
    }

    @Test
    void publishArticle_archivedArticle_publishedUnderUnarchive() {
        givenSavableItem(article(ITEM_ID, "VPN setup", KnowledgeBaseArticleStatus.ARCHIVED));
        givenAuditedWorkRunsFor(KB_ARTICLE_UNARCHIVE);

        KnowledgeBaseItem published = service.publishArticle(ITEM_ID);

        assertThat(published.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.PUBLISHED);
    }

    @Test
    void publishArticle_folder_refusedInsideTheAuditedWork() {
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(folder(ITEM_ID, "Docs")));
        givenAuditedWorkRunsFor(KB_ARTICLE_PUBLISH);

        assertThatThrownBy(() -> service.publishArticle(ITEM_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Only articles can be published.");
    }

    @Test
    void moveToFolder_toTheRoot_auditedWithNoParent() {
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(folder(ITEM_ID, "Docs")));

        service.moveToFolder(ITEM_ID, null);

        verify(auditedMethodRunner).run(eq(KB_ITEM_MOVE), eq(AuditTargetType.KB_FOLDER), eq(ITEM_ID),
                eq(Collections.singletonMap("parentId", null)), any(Supplier.class));
    }

    @Test
    void deleteFolder_moveChildrenIntoAnArticle_refusedWithoutChildEvents() {
        givenFolderWithChildren(article("article-1", "VPN setup", KnowledgeBaseArticleStatus.DRAFT));
        when(repository.findById(TARGET_FOLDER_ID)).thenReturn(Optional.of(
                article(TARGET_FOLDER_ID, "Printer guide", KnowledgeBaseArticleStatus.PUBLISHED)));

        assertThatThrownBy(() -> service.deleteFolder(FOLDER_ID, FolderChildrenAction.MOVE, TARGET_FOLDER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Parent must be a folder: folder-2");

        verifyNoInteractions(auditRecorder);
    }

    @Test
    void deleteFolder_moveChildren_recordsAMoveOfEachChildWithItsType() {
        givenArticleAndSubFolderToMove();

        service.deleteFolder(FOLDER_ID, FolderChildrenAction.MOVE, TARGET_FOLDER_ID);

        verify(auditRecorder).recordAllWithoutLoadingTargets(batch.capture());
        assertThat(batch.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getTargetType,
                        AuditEntry::getTargetName, AuditEntry::getChanges)
                .containsExactly(
                        tuple(KB_ITEM_MOVE, "article-1", AuditTargetType.KB_ARTICLE, "VPN setup",
                                Map.of("parentId", new AuditChange(FOLDER_ID, TARGET_FOLDER_ID))),
                        tuple(KB_ITEM_MOVE, "folder-3", AuditTargetType.KB_FOLDER, "Guides",
                                Map.of("parentId", new AuditChange(FOLDER_ID, TARGET_FOLDER_ID))));
    }

    @Test
    void deleteFolder_archiveNestedFolder_recordsTheSubFolderDeleteAndTheArchiveOfItsArticle() {
        givenSubFolderWithArticle();

        service.deleteFolder(FOLDER_ID, FolderChildrenAction.ARCHIVE, null);

        verify(auditRecorder).record(entries.capture());
        assertThat(entries.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getTargetName)
                .containsExactly(KB_FOLDER_DELETE, "folder-3", "Guides");
        verify(auditRecorder).recordAllWithoutLoadingTargets(batch.capture());
        assertThat(batch.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getTargetName,
                        AuditEntry::getChanges)
                .containsExactly(tuple(KB_ARTICLE_ARCHIVE, "article-1", "VPN setup", Map.of(
                        "status", new AuditChange(KnowledgeBaseArticleStatus.PUBLISHED, KnowledgeBaseArticleStatus.ARCHIVED),
                        "parentId", new AuditChange("folder-3", null))));
    }

    @Test
    void deleteFolder_archiveAlreadyArchivedArticle_recordsOnlyItsMove() {
        givenFolderWithChildren(article("article-1", "VPN setup", KnowledgeBaseArticleStatus.ARCHIVED));

        service.deleteFolder(FOLDER_ID, FolderChildrenAction.ARCHIVE, null);

        verify(auditRecorder).recordAllWithoutLoadingTargets(batch.capture());
        assertThat(batch.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getTargetType,
                        AuditEntry::getChanges)
                .containsExactly(tuple(KB_ITEM_MOVE, "article-1", AuditTargetType.KB_ARTICLE,
                        Map.of("parentId", new AuditChange(FOLDER_ID, null))));
    }

    private void givenSavableItem(KnowledgeBaseItem item) {
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(item));
        when(repository.save(item)).thenReturn(item);
    }

    private void givenAuditedWorkRunsFor(AuditAction action) {
        when(auditedMethodRunner.run(eq(action), eq(ITEM_ID), any(Supplier.class)))
                .thenAnswer(invocation -> invocation.<Supplier<?>>getArgument(2).get());
    }

    private void givenFolderWithChildren(KnowledgeBaseItem... children) {
        when(repository.findById(FOLDER_ID)).thenReturn(Optional.of(folder(FOLDER_ID, "Docs")));
        when(repository.findByParentId(FOLDER_ID)).thenReturn(List.of(children));
    }

    private void givenArticleAndSubFolderToMove() {
        givenFolderWithChildren(article("article-1", "VPN setup", KnowledgeBaseArticleStatus.DRAFT),
                folder("folder-3", "Guides"));
        when(repository.findById(TARGET_FOLDER_ID)).thenReturn(Optional.of(folder(TARGET_FOLDER_ID, "Archive")));
    }

    private void givenSubFolderWithArticle() {
        givenFolderWithChildren(folder("folder-3", "Guides"));
        when(repository.findByParentId("folder-3")).thenReturn(List.of(
                article("article-1", "VPN setup", KnowledgeBaseArticleStatus.PUBLISHED)));
    }

    private static KnowledgeBaseItem folder(String id, String name) {
        return KnowledgeBaseItem.builder().id(id).type(KnowledgeBaseItemType.FOLDER).name(name).build();
    }

    private static KnowledgeBaseItem article(String id, String name, KnowledgeBaseArticleStatus status) {
        return KnowledgeBaseItem.builder()
                .id(id)
                .type(KnowledgeBaseItemType.ARTICLE)
                .name(name)
                .parentId(FOLDER_ID)
                .status(status)
                .build();
    }
}
