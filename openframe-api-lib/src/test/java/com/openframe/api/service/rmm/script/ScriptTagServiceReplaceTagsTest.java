package com.openframe.api.service.rmm.script;

import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditAction.SCRIPT_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.SCRIPT_TAG_REMOVE;
import static com.openframe.data.document.tag.TagEntityType.SCRIPT;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptTagServiceReplaceTagsTest {

    private static final String SCRIPT_ID = "script-1";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private ScriptTagService service;
    @Captor private ArgumentCaptor<List<AuditEntry>> entriesCaptor;

    @Test
    void replaceTags_tagsChanged_recordsAnAddPerNewTagAndARemovePerDroppedTag() {
        assignedBefore("t1", "t2");
        when(tagRepository.findAllById(List.of("t3", "t1"))).thenReturn(List.of(tag("t3", "region"), tag("t1", "env")));

        service.replaceTags(SCRIPT_ID, List.of("t2", "t3"));

        assertThat(recordedEntries())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactlyInAnyOrder(
                        tuple(SCRIPT_TAG_ADD, SCRIPT_ID, Map.of("tagIds", List.of("t3"), "tagKeys", List.of("region"))),
                        tuple(SCRIPT_TAG_REMOVE, SCRIPT_ID, Map.of("tagIds", List.of("t1"), "tagKeys", List.of("env"))));
    }

    @Test
    void replaceTags_sameTagsInAnotherOrder_recordsNothing() {
        assignedBefore("t1", "t2");

        service.replaceTags(SCRIPT_ID, List.of("t2", "t1"));

        verifyNoInteractions(auditRecorder);
    }

    @Test
    void replaceTags_tagIdsNull_recordsARemoveForTheAssignedTag() {
        assignedBefore("t1");
        when(tagRepository.findAllById(List.of("t1"))).thenReturn(List.of(tag("t1", "env")));

        service.replaceTags(SCRIPT_ID, null);

        assertThat(recordedEntries())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(tuple(SCRIPT_TAG_REMOVE, Map.of("tagIds", List.of("t1"), "tagKeys", List.of("env"))));
    }

    @Test
    void replaceTags_tagIdRepeated_recordsOneAdd() {
        assignedBefore();
        when(tagRepository.findAllById(List.of("t1"))).thenReturn(List.of(tag("t1", "env")));

        service.replaceTags(SCRIPT_ID, List.of("t1", "t1"));

        assertThat(recordedEntries())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(tuple(SCRIPT_TAG_ADD, Map.of("tagIds", List.of("t1"), "tagKeys", List.of("env"))));
    }

    @Test
    void replaceTags_tagRecordNotFound_recordsTheEventWithoutTagKeys() {
        assignedBefore();
        when(tagRepository.findAllById(List.of("t1"))).thenReturn(List.of());

        service.replaceTags(SCRIPT_ID, List.of("t1"));

        assertThat(recordedEntries())
                .extracting(AuditEntry::getAction, AuditEntry::getDetails)
                .containsExactly(tuple(SCRIPT_TAG_ADD, Map.of("tagIds", List.of("t1"))));
    }

    @Test
    void replaceTags_tagsReplaced_readsTheAssignedTagsBeforeDeletingThem() {
        service.replaceTags(SCRIPT_ID, List.of("t1"));

        InOrder order = inOrder(tagAssignmentRepository);
        order.verify(tagAssignmentRepository).findByEntityIdAndEntityType(SCRIPT_ID, SCRIPT);
        order.verify(tagAssignmentRepository).deleteByEntityIdAndEntityType(SCRIPT_ID, SCRIPT);
    }

    private void assignedBefore(String... tagIds) {
        when(tagAssignmentRepository.findByEntityIdAndEntityType(SCRIPT_ID, SCRIPT))
                .thenReturn(Stream.of(tagIds).map(ScriptTagServiceReplaceTagsTest::assignment).toList());
    }

    private List<AuditEntry> recordedEntries() {
        verify(auditRecorder).recordAll(entriesCaptor.capture());
        return entriesCaptor.getValue();
    }

    private static TagAssignment assignment(String tagId) {
        return TagAssignment.builder().entityId(SCRIPT_ID).tagId(tagId).entityType(SCRIPT).build();
    }

    private static Tag tag(String id, String key) {
        return Tag.builder().id(id).key(key).build();
    }
}
