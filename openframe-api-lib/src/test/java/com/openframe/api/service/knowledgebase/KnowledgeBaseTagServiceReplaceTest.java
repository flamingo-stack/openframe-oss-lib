package com.openframe.api.service.knowledgebase;

import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgeBaseTagServiceReplaceTest {

    private static final TagEntityType TYPE = TagEntityType.KNOWLEDGE_ARTICLE;

    private final TagAssignmentRepository assignments = mock(TagAssignmentRepository.class);
    private final KnowledgeBaseTagService service = new KnowledgeBaseTagService(
            mock(TagRepository.class), assignments, mock(KnowledgeBaseItemRepository.class));

    @Test
    @DisplayName("replacing tags adds the missing ones, removes the rest and leaves the kept ones alone")
    void replaceAppliesOnlyTheDifference() {
        when(assignments.findByEntityIdAndEntityType("a1", TYPE)).thenReturn(List.of(tagged("t1"), tagged("t2")));

        service.replaceItemTags("a1", List.of("t2", "t3"));

        verify(assignments).deleteByEntityIdAndTagIdAndEntityType("a1", "t1", TYPE);
        verify(assignments, never()).deleteByEntityIdAndTagIdAndEntityType(eq("a1"), eq("t2"), any());

        ArgumentCaptor<TagAssignment> added = ArgumentCaptor.forClass(TagAssignment.class);
        verify(assignments).save(added.capture());
        assertThat(added.getValue().getEntityId()).isEqualTo("a1");
        assertThat(added.getValue().getTagId()).isEqualTo("t3");
    }

    @Test
    @DisplayName("an empty list removes every tag and adds none")
    void emptyListClears() {
        when(assignments.findByEntityIdAndEntityType("a1", TYPE)).thenReturn(List.of(tagged("t1")));

        service.replaceItemTags("a1", List.of());

        verify(assignments).deleteByEntityIdAndTagIdAndEntityType("a1", "t1", TYPE);
        verify(assignments, never()).save(any());
    }

    private static TagAssignment tagged(String tagId) {
        return TagAssignment.builder().entityId("a1").tagId(tagId).entityType(TYPE).build();
    }
}
