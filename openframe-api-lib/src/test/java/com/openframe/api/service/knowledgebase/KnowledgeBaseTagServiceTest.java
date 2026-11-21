package com.openframe.api.service.knowledgebase;

import java.util.function.BooleanSupplier;
import com.openframe.data.document.audit.AuditAction;
import java.util.Map;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Answers;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.doAnswer;
import static org.mockito.ArgumentMatchers.eq;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_TAG_ADD;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseTagServiceTest {

    private static final String ITEM_ID = "article-1";
    private static final String TAG_ID = "tag-1";
    private static final String UNKNOWN_TAG_ID = "tag-unknown";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private KnowledgeBaseItemRepository itemRepository;
    @Mock(answer = Answers.CALLS_REAL_METHODS) private AuditedMethodRunner auditedMethodRunner;

    @Captor private ArgumentCaptor<TagAssignment> assignmentCaptor;

    private static final Tag TAG = Tag.builder().id(TAG_ID).key("env").build();

    @InjectMocks private KnowledgeBaseTagService service;

    private Boolean changed;

    @Test
    void addTagToItem_unknownTag_throwsTagNotFound() {
        // setup

        // execution
        NotFoundException exception = assertThrows(NotFoundException.class,
                () -> service.addTagToItem(ITEM_ID, TAG_ID));

        // verifications
        assertThat(exception)
                .hasMessage("Tag not found: " + TAG_ID)
                .returns(ErrorCode.TAG_NOT_FOUND, NotFoundException::getErrorCode);
        verify(tagAssignmentRepository, never()).save(any(TagAssignment.class));
    }

    @Test
    void addTagToItem_missingItem_rejectsWithoutAssignment() {
        // setup
        when(tagRepository.findById(TAG_ID)).thenReturn(Optional.of(TAG));

        // execution
        NotFoundException exception = assertThrows(NotFoundException.class,
                () -> service.addTagToItem(ITEM_ID, TAG_ID));

        // verifications
        assertThat(exception).hasMessageContaining(ITEM_ID);
        verify(tagAssignmentRepository, never()).save(any(TagAssignment.class));
    }

    @Test
    void addTagToItem_existingTagNotYetAssigned_savesAssignment() {
        // setup
        when(tagRepository.findById(TAG_ID)).thenReturn(Optional.of(TAG));
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder().id(ITEM_ID).build()));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.empty());

        reportWhetherAnythingChanged(KB_ITEM_TAG_ADD);

        // execution
        service.addTagToItem(ITEM_ID, TAG_ID);

        // verifications
        assertThat(changed).isTrue();
        verify(tagAssignmentRepository).save(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getValue())
                .returns(ITEM_ID, TagAssignment::getEntityId)
                .returns(TAG_ID, TagAssignment::getTagId)
                .returns(TagEntityType.KNOWLEDGE_ARTICLE, TagAssignment::getEntityType);
        verify(auditedMethodRunner).runWhenChanged(eq(KB_ITEM_TAG_ADD), eq(AuditTargetType.KB_ARTICLE), eq(ITEM_ID),
                eq(Map.of("tagIds", List.of(TAG_ID), "tagKeys", List.of("env"))), any());
    }

    @Test
    void addTagToItem_folder_recordedAgainstTheFolder() {
        when(tagRepository.findById(TAG_ID)).thenReturn(Optional.of(TAG));
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.of(
                KnowledgeBaseItem.builder().id(ITEM_ID).type(KnowledgeBaseItemType.FOLDER).build()));

        service.addTagToItem(ITEM_ID, TAG_ID);

        verify(auditedMethodRunner).runWhenChanged(eq(KB_ITEM_TAG_ADD), eq(AuditTargetType.KB_FOLDER), eq(ITEM_ID),
                eq(Map.of("tagIds", List.of(TAG_ID), "tagKeys", List.of("env"))), any());
    }

    @Test
    void removeTagFromItem_itemAlreadyGone_recordedAgainstAnArticle() {
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.empty());

        service.removeTagFromItem(ITEM_ID, TAG_ID);

        verify(auditedMethodRunner).runWhenChanged(eq(KB_ITEM_TAG_REMOVE), eq(AuditTargetType.KB_ARTICLE),
                eq(ITEM_ID), eq(Map.of("tagIds", List.of(TAG_ID))), any());
    }

    @Test
    void addTagToItem_tagAlreadyAssigned_nothingSaved() {
        // setup
        TagAssignment existing = TagAssignment.builder()
                .entityId(ITEM_ID)
                .tagId(TAG_ID)
                .entityType(TagEntityType.KNOWLEDGE_ARTICLE)
                .build();
        when(tagRepository.findById(TAG_ID)).thenReturn(Optional.of(TAG));
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder().id(ITEM_ID).build()));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.of(existing));

        reportWhetherAnythingChanged(KB_ITEM_TAG_ADD);

        // execution
        service.addTagToItem(ITEM_ID, TAG_ID);

        // verifications
        assertThat(changed).isFalse();
        verify(tagAssignmentRepository, never()).save(any(TagAssignment.class));
    }

    @Test
    void removeTagFromItem_tagAssigned_removedAndReportedAsAChange() {
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder().id(ITEM_ID).build()));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.of(TagAssignment.builder().entityId(ITEM_ID).tagId(TAG_ID).build()));
        reportWhetherAnythingChanged(KB_ITEM_TAG_REMOVE);

        service.removeTagFromItem(ITEM_ID, TAG_ID);

        assertThat(changed).isTrue();
        verify(tagAssignmentRepository).deleteByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE);
    }

    @Test
    void removeTagFromItem_tagNotAssigned_noChangeReported() {
        when(itemRepository.findById(ITEM_ID)).thenReturn(Optional.of(KnowledgeBaseItem.builder().id(ITEM_ID).build()));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.empty());
        reportWhetherAnythingChanged(KB_ITEM_TAG_REMOVE);

        service.removeTagFromItem(ITEM_ID, TAG_ID);

        assertThat(changed).isFalse();
    }

    @Test
    void requireExistingTags_oneUnknown_throwsTagNotFound() {
        // setup
        when(tagRepository.existsById(TAG_ID)).thenReturn(true);
        when(tagRepository.existsById(UNKNOWN_TAG_ID)).thenReturn(false);
        List<String> tagIds = List.of(TAG_ID, UNKNOWN_TAG_ID);

        // execution
        NotFoundException exception = assertThrows(NotFoundException.class,
                () -> service.requireExistingTags(tagIds));

        // verifications
        assertThat(exception)
                .hasMessage("Tag not found: " + UNKNOWN_TAG_ID)
                .returns(ErrorCode.TAG_NOT_FOUND, NotFoundException::getErrorCode);
    }

    @Test
    void requireExistingTags_allExist_passes() {
        // setup
        when(tagRepository.existsById(anyString())).thenReturn(true);
        List<String> tagIds = List.of(TAG_ID);

        // execution
        service.requireExistingTags(tagIds);

        // verifications
        verify(tagRepository).existsById(TAG_ID);
    }

    @Test
    void requireExistingTags_noTags_noLookup() {
        // execution
        service.requireExistingTags(null);

        // verifications
        verifyNoInteractions(tagRepository);
    }

    private void reportWhetherAnythingChanged(AuditAction action) {
        doAnswer(invocation -> {
            changed = invocation.<BooleanSupplier>getArgument(4).getAsBoolean();
            return changed;
        }).when(auditedMethodRunner).runWhenChanged(eq(action), any(), eq(ITEM_ID), any(), any());
    }
}
