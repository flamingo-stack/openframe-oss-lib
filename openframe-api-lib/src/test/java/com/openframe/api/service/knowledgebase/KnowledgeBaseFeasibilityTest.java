package com.openframe.api.service.knowledgebase;

import com.openframe.core.exception.ConflictException;
import com.openframe.core.exception.NotFoundException;
import com.openframe.core.exception.ValidationException;
import com.openframe.api.dto.knowledgebase.FolderChildrenAction;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseFeasibilityTest {

    private static final String ITEM_ID = "item-1";
    private static final String DESTINATION_ID = "destination-1";

    @Mock private KnowledgeBaseItemRepository repository;

    @InjectMocks private KnowledgeBaseService service;

    @Test
    void requireDeleteItem_article_ignoresFolderOptions() {
        // setup
        KnowledgeBaseItem item = item(KnowledgeBaseItemType.ARTICLE);
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(item));

        // execution
        service.requireDeleteItem(ITEM_ID, null, DESTINATION_ID);

        // verifications
        verify(repository, never()).findByParentId(ITEM_ID);
        verify(repository, never()).findById(DESTINATION_ID);
        verify(repository, never()).save(any());
    }

    @Test
    void requireDeleteItem_emptyFolder_ignoresUnusedDestination() {
        // setup
        KnowledgeBaseItem item = item(KnowledgeBaseItemType.FOLDER);
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(item));

        // execution
        service.requireDeleteItem(ITEM_ID, null, DESTINATION_ID);

        // verifications
        verify(repository, never()).findById(DESTINATION_ID);
        verify(repository, never()).deleteById(ITEM_ID);
    }

    @Test
    void requireDeleteItem_nonemptyFolderWithoutAction_rejects() {
        // setup
        stubNonemptyFolder();

        // execution
        Throwable failure = catchThrowable(() -> service.requireDeleteItem(ITEM_ID, null, null));

        // verifications
        assertThat(failure).isInstanceOf(ValidationException.class);
        verify(repository, never()).deleteById(ITEM_ID);
    }

    @Test
    void requireDeleteItem_moveChildrenToRoot_doesNotLookupDestination() {
        // setup
        stubNonemptyFolder();

        // execution
        service.requireDeleteItem(ITEM_ID, FolderChildrenAction.MOVE, null);

        // verifications
        verify(repository, never()).findById(null);
        verify(repository, never()).saveAll(any());
    }

    @Test
    void requireDeleteItem_missingMoveDestination_rejects() {
        // setup
        stubNonemptyFolder();

        // execution
        Throwable failure = catchThrowable(() -> service.requireDeleteItem(ITEM_ID, FolderChildrenAction.MOVE, DESTINATION_ID));

        // verifications
        assertThat(failure).isInstanceOf(NotFoundException.class).hasMessageContaining(DESTINATION_ID);
        verify(repository, never()).saveAll(any());
    }

    @Test
    void requireDeleteItem_existingArticleDestination_addsNoUnselectedTypeRestriction() {
        // setup
        stubNonemptyFolder();
        KnowledgeBaseItem destination = item(KnowledgeBaseItemType.ARTICLE);
        when(repository.findById(DESTINATION_ID)).thenReturn(Optional.of(destination));

        // execution
        Throwable failure = catchThrowable(() -> service.requireDeleteItem(ITEM_ID, FolderChildrenAction.MOVE, DESTINATION_ID));

        // verifications
        assertThat(failure).isNull();
        verify(repository, never()).saveAll(any());
    }

    @Test
    void requireArchivedItem_draft_rejectsWithoutChangingStatus() {
        // setup
        KnowledgeBaseItem item = item(KnowledgeBaseItemType.ARTICLE);
        item.setStatus(KnowledgeBaseArticleStatus.DRAFT);
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(item));

        // execution
        Throwable failure = catchThrowable(() -> service.requireArchivedItem(ITEM_ID));

        // verifications
        assertThat(failure).isInstanceOf(ConflictException.class);
        assertThat(item.getStatus()).isEqualTo(KnowledgeBaseArticleStatus.DRAFT);
        verify(repository, never()).save(any());
    }

    @Test
    void validateParentIsFolder_root_performsNoLookup() {
        // setup
        String parentId = null;

        // execution
        service.validateParentIsFolder(parentId);

        // verifications
        verifyNoInteractions(repository);
    }

    private void stubNonemptyFolder() {
        KnowledgeBaseItem folder = item(KnowledgeBaseItemType.FOLDER);
        when(repository.findById(ITEM_ID)).thenReturn(Optional.of(folder));
        when(repository.findByParentId(ITEM_ID)).thenReturn(List.of(new KnowledgeBaseItem()));
    }

    private static KnowledgeBaseItem item(KnowledgeBaseItemType type) {
        return KnowledgeBaseItem.builder().id(ITEM_ID).type(type).build();
    }
}
