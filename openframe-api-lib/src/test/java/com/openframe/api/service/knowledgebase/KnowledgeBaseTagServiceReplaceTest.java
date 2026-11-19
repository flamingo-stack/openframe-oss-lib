package com.openframe.api.service.knowledgebase;

import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KnowledgeBaseTagServiceReplaceTest {

    private static final TagEntityType TYPE = TagEntityType.KNOWLEDGE_ARTICLE;

    private final TagRepository tags = mock(TagRepository.class);
    private final TagAssignmentRepository assignments = mock(TagAssignmentRepository.class);
    private final KnowledgeBaseItemRepository items = mock(KnowledgeBaseItemRepository.class);
    private final KnowledgeBaseTagService service = new KnowledgeBaseTagService(
            tags, assignments, items, mock(AuditedMethodRunner.class, CALLS_REAL_METHODS));

    @Test
    @DisplayName("replacing tags adds the missing ones, removes the rest and leaves the kept ones alone")
    void replaceAppliesOnlyTheDifference() {
        when(items.findById("a1")).thenReturn(Optional.of(KnowledgeBaseItem.builder().id("a1").build()));
        when(tags.existsById("t2")).thenReturn(true);
        when(tags.existsById("t3")).thenReturn(true);
        when(assignments.findByEntityIdAndEntityType("a1", TYPE)).thenReturn(List.of(tagged("t1"), tagged("t2")));
        when(assignments.findByEntityIdAndTagIdAndEntityType("a1", "t1", TYPE)).thenReturn(Optional.of(tagged("t1")));

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
        when(assignments.findByEntityIdAndTagIdAndEntityType("a1", "t1", TYPE)).thenReturn(Optional.of(tagged("t1")));

        service.replaceItemTags("a1", List.of());

        verify(assignments).deleteByEntityIdAndTagIdAndEntityType("a1", "t1", TYPE);
        verify(assignments, never()).save(any());
    }

    @Test
    @DisplayName("an unknown tag is rejected before any tag is removed or added")
    void unknownTagRejectedBeforeAnyChange() {
        when(tags.existsById("t9")).thenReturn(false);

        assertThatThrownBy(() -> service.replaceItemTags("a1", List.of("t9")))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("Tag not found: t9");

        verify(assignments, never()).deleteByEntityIdAndTagIdAndEntityType(any(), any(), any());
        verify(assignments, never()).save(any());
    }

    private static TagAssignment tagged(String tagId) {
        return TagAssignment.builder().entityId("a1").tagId(tagId).entityType(TYPE).build();
    }
}
