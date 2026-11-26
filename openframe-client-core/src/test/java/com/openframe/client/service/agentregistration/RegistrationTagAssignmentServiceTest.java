package com.openframe.client.service.agentregistration;

import com.openframe.audit.AuditRecorder;
import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DuplicateKeyException;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.TAG_CREATE;
import static com.openframe.data.document.audit.AuditAction.TAG_UPDATE;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.tag.TagEntityType.DEVICE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationTagAssignmentServiceTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private RegistrationTagAssignmentService service;
    @Captor private ArgumentCaptor<TagAssignment> assignmentCaptor;
    @Captor private ArgumentCaptor<AuditEntry> entryCaptor;

    @Test
    void assignTags_tagTheTenantHas_putOnTheDeviceWithTheAskedValues() {
        storedTag("env", "tag-env", List.of("prod"));

        List<String> assigned = service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        assertThat(assigned).containsExactly("env");
        verify(tagAssignmentRepository).save(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getValue())
                .extracting(TagAssignment::getEntityId, TagAssignment::getTagId, TagAssignment::getEntityType,
                        TagAssignment::getValues)
                .containsExactly(MACHINE_ID, "tag-env", DEVICE, List.of("prod"));
    }

    @Test
    void assignTags_tagSentWithoutValues_putOnTheDeviceWithNoValues() {
        storedTag("env", "tag-env", List.of("prod"));

        service.assignTags(MACHINE_ID, List.of(AgentRegistrationTagInput.builder().key("env").build()));

        verify(tagAssignmentRepository).save(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getValue().getValues()).isEmpty();
    }

    @Test
    void assignTags_valueRefusedForOneTag_leavesItOutAndAssignsTheNext() {
        storedTag("env", "tag-env", List.of("prod"));

        List<String> assigned = service.assignTags(MACHINE_ID, List.of(tag("site", "New York"), tag("env", "prod")));

        assertThat(assigned).containsExactly("env");
        verify(tagRepository, never()).findByKeyAndEntityType("site", DEVICE);
    }

    @Test
    void assignTags_keyRefusedForOneTag_leavesItOutAndAssignsTheNext() {
        storedTag("env", "tag-env", List.of("prod"));

        List<String> assigned = service.assignTags(MACHINE_ID, List.of(tag("head office", "hq"), tag("env", "prod")));

        assertThat(assigned).containsExactly("env");
        verify(tagRepository, never()).findByKeyAndEntityType("head office", DEVICE);
    }

    @Test
    void assignTags_deviceAlreadyHasOneTag_leavesItOutAndAssignsTheNext() {
        storedTag("env", "tag-env", List.of("prod"));
        storedTag("site", "tag-site", List.of("chicago"));
        when(tagAssignmentRepository.save(any(TagAssignment.class)))
                .thenThrow(new DuplicateKeyException("entity_tag_unique"))
                .thenAnswer(invocation -> invocation.getArgument(0));

        List<String> assigned = service.assignTags(MACHINE_ID, List.of(tag("env", "prod"), tag("site", "chicago")));

        assertThat(assigned).containsExactly("site");
    }

    @Test
    void assignTags_tagReadFailsForOneTag_leavesItOutAndAssignsTheNext() {
        when(tagRepository.findByKeyAndEntityType("env", DEVICE))
                .thenThrow(new DataAccessResourceFailureException("Mongo unreachable"));
        storedTag("site", "tag-site", List.of("chicago"));

        List<String> assigned = service.assignTags(MACHINE_ID, List.of(tag("env", "prod"), tag("site", "chicago")));

        assertThat(assigned).containsExactly("site");
    }

    @Test
    void assignTags_tagTheTenantLacks_createdAsADeviceTagAndRecorded() {
        when(tagRepository.findByKeyAndEntityType("env", DEVICE)).thenReturn(null);
        when(tagRepository.save(any(Tag.class))).thenReturn(Tag.builder()
                .id("tag-env").key("env").entityType(DEVICE).values(List.of("prod")).build());

        service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetId,
                        AuditEntry::getTargetName, AuditEntry::getDetails)
                .containsExactly(TAG_CREATE, SUCCESS, "tag-env", "env",
                        Map.of("entityType", DEVICE, "key", "env", "values", List.of("prod")));
    }

    @Test
    void assignTags_tagTheTenantLacks_savedWithTheAskedKeyAndValuesForDevices() {
        ArgumentCaptor<Tag> saved = ArgumentCaptor.forClass(Tag.class);
        when(tagRepository.findByKeyAndEntityType("env", DEVICE)).thenReturn(null);
        when(tagRepository.save(saved.capture())).thenReturn(Tag.builder().id("tag-env").key("env").build());

        service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        assertThat(saved.getValue())
                .extracting(Tag::getKey, Tag::getValues, Tag::getEntityType)
                .containsExactly("env", List.of("prod"), DEVICE);
    }

    @Test
    void assignTags_tagTheTenantLacks_putOnTheDeviceUnderTheNewTagsId() {
        when(tagRepository.findByKeyAndEntityType("env", DEVICE)).thenReturn(null);
        when(tagRepository.save(any(Tag.class))).thenReturn(Tag.builder().id("tag-env").key("env").build());

        service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        verify(tagAssignmentRepository).save(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getValue().getTagId()).isEqualTo("tag-env");
    }

    @Test
    void assignTags_storedTagGetsANewValue_valueAddedAndTheUpdateRecorded() {
        Tag stored = storedTag("env", "tag-env", List.of("prod"));

        service.assignTags(MACHINE_ID, List.of(tag("env", "staging")));

        assertThat(stored.getValues()).containsExactlyInAnyOrder("prod", "staging");
        verify(tagRepository).save(stored);
        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetId, AuditEntry::getTargetName,
                        AuditEntry::getDetails, AuditEntry::getChanges)
                .containsExactly(TAG_UPDATE, "tag-env", "env", Map.of("entityType", DEVICE),
                        Map.of("values", new AuditChange(List.of("prod"), stored.getValues())));
    }

    @Test
    void assignTags_storedTagWithoutValuesGetsOne_updateRecordedWithNoValuesBefore() {
        storedTag("env", "tag-env", null);

        service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        verify(auditRecorder).record(entryCaptor.capture());
        assertThat(entryCaptor.getValue().getChanges())
                .containsExactlyEntriesOf(Map.of("values", new AuditChange(List.of(), List.of("prod"))));
    }

    @Test
    void assignTags_storedTagAlreadyHasTheValue_tagNotSavedAndNothingRecorded() {
        Tag stored = storedTag("env", "tag-env", List.of("prod"));

        service.assignTags(MACHINE_ID, List.of(tag("env", "prod")));

        verify(tagRepository, never()).save(stored);
        verifyNoInteractions(auditRecorder);
    }

    private Tag storedTag(String key, String id, List<String> values) {
        Tag stored = Tag.builder().id(id).key(key).entityType(TagEntityType.DEVICE).values(values).build();
        when(tagRepository.findByKeyAndEntityType(key, DEVICE)).thenReturn(stored);
        return stored;
    }

    private static AgentRegistrationTagInput tag(String key, String value) {
        return AgentRegistrationTagInput.builder().key(key).values(List.of(value)).build();
    }
}
