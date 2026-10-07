package com.openframe.api.service.knowledgebase;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseTagServiceTest {

    private static final String ITEM_ID = "article-1";
    private static final String TAG_ID = "tag-1";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private KnowledgeBaseItemRepository itemRepository;

    @Captor private ArgumentCaptor<TagAssignment> assignmentCaptor;

    @InjectMocks private KnowledgeBaseTagService service;

    @Test
    void addTagToItem_unknownTag_throwsTagNotFound() {
        // setup
        when(tagRepository.existsById(TAG_ID)).thenReturn(false);

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
    void addTagToItem_existingTagNotYetAssigned_savesAssignment() {
        // setup
        when(tagRepository.existsById(TAG_ID)).thenReturn(true);
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.empty());

        // execution
        service.addTagToItem(ITEM_ID, TAG_ID);

        // verifications
        verify(tagAssignmentRepository).save(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getValue())
                .returns(ITEM_ID, TagAssignment::getEntityId)
                .returns(TAG_ID, TagAssignment::getTagId)
                .returns(TagEntityType.KNOWLEDGE_ARTICLE, TagAssignment::getEntityType);
    }

    @Test
    void addTagToItem_tagAlreadyAssigned_nothingSaved() {
        // setup
        TagAssignment existing = TagAssignment.builder()
                .entityId(ITEM_ID)
                .tagId(TAG_ID)
                .entityType(TagEntityType.KNOWLEDGE_ARTICLE)
                .build();
        when(tagRepository.existsById(TAG_ID)).thenReturn(true);
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(ITEM_ID, TAG_ID, TagEntityType.KNOWLEDGE_ARTICLE))
                .thenReturn(Optional.of(existing));

        // execution
        service.addTagToItem(ITEM_ID, TAG_ID);

        // verifications
        verify(tagAssignmentRepository, never()).save(any(TagAssignment.class));
    }
}
