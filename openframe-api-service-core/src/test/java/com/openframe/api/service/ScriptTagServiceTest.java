package com.openframe.api.service;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptTagServiceTest {

    private static final TagEntityType SCRIPT = TagEntityType.SCRIPT;

    @Mock
    private TagRepository tagRepository;
    @Mock
    private TagAssignmentRepository tagAssignmentRepository;

    private ScriptTagService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new ScriptTagService(tagRepository, tagAssignmentRepository);
    }

    @Test
    @DisplayName("getTagsByScriptIds: returns tags per script aligned with input order; a script with no tags gets an empty list")
    void getTagsByScriptIds_alignedPerScript() {
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(List.of("s1", "s2"), SCRIPT))
                .thenReturn(List.of(assignment("s1", "t1"), assignment("s1", "t2")));
        when(tagRepository.findAllById(any()))
                .thenReturn(List.of(tag("t1"), tag("t2")));

        List<List<Tag>> result = service.getTagsByScriptIds(List.of("s1", "s2"));

        assertThat(result).hasSize(2);
        assertThat(result.get(0)).extracting(Tag::getId).containsExactlyInAnyOrder("t1", "t2");
        assertThat(result.get(1)).isEmpty();
    }

    @Test
    @DisplayName("getTagsByScriptIds: empty input short-circuits with no repository access")
    void getTagsByScriptIds_empty() {
        assertThat(service.getTagsByScriptIds(List.of())).isEmpty();
        verifyNoInteractions(tagAssignmentRepository, tagRepository);
    }

    @Test
    @DisplayName("replaceTags: clears existing assignments then saves one per distinct tag id")
    void replaceTags_deletesThenSavesDistinct() {
        service.replaceTags("s1", List.of("t1", "t2", "t1"));

        verify(tagAssignmentRepository).deleteByEntityIdAndEntityType("s1", SCRIPT);
        ArgumentCaptor<TagAssignment> captor = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(TagAssignment::getTagId)
                .containsExactlyInAnyOrder("t1", "t2");
        assertThat(captor.getAllValues()).allSatisfy(a -> {
            assertThat(a.getEntityId()).isEqualTo("s1");
            assertThat(a.getEntityType()).isEqualTo(SCRIPT);
        });
    }

    @Test
    @DisplayName("replaceTags: null/empty tag ids clears all assignments and saves nothing")
    void replaceTags_nullClears() {
        service.replaceTags("s1", null);

        verify(tagAssignmentRepository).deleteByEntityIdAndEntityType("s1", SCRIPT);
        verify(tagAssignmentRepository, never()).save(any());
    }

    private static TagAssignment assignment(String entityId, String tagId) {
        return TagAssignment.builder().entityId(entityId).tagId(tagId).entityType(SCRIPT).build();
    }

    private static Tag tag(String id) {
        return Tag.builder().id(id).build();
    }
}
