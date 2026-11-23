package com.openframe.client.service.agentregistration;

import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationTagAssignmentServiceCopyTagsTest {

    @Mock
    private TagRepository tagRepository;
    @Mock
    private TagAssignmentRepository tagAssignmentRepository;
    @InjectMocks
    private RegistrationTagAssignmentService service;

    @Test
    void copyTags_assignsEveryDeviceTagOfTheSourceToTheTarget() {
        // setup
        TagAssignment site = TagAssignment.builder().entityId("m-1").tagId("tag-site").entityType(TagEntityType.DEVICE)
                .values(List.of("CHICAGO")).taggedBy("user-1").build();
        TagAssignment owner = TagAssignment.builder().entityId("m-1").tagId("tag-owner").entityType(TagEntityType.DEVICE)
                .build();
        when(tagAssignmentRepository.findByEntityIdAndEntityType("m-1", TagEntityType.DEVICE)).thenReturn(List.of(site, owner));

        // execution
        service.copyTags("m-1", "m-2");

        // verifications
        ArgumentCaptor<TagAssignment> saved = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository, times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(TagAssignment::getEntityId).containsOnly("m-2");
        assertThat(saved.getAllValues()).extracting(TagAssignment::getTagId).containsExactly("tag-site", "tag-owner");
        assertThat(saved.getAllValues().get(0).getValues()).containsExactly("CHICAGO");
        assertThat(saved.getAllValues().get(0).getTaggedBy()).isEqualTo("user-1");
        assertThat(saved.getAllValues().get(1).getValues()).isEmpty();
        assertThat(saved.getAllValues()).extracting(TagAssignment::getId).containsOnlyNulls();
    }

    @Test
    void copyTags_sourceWithoutTags_savesNothing() {
        // setup
        when(tagAssignmentRepository.findByEntityIdAndEntityType("m-1", TagEntityType.DEVICE)).thenReturn(List.of());

        // execution
        service.copyTags("m-1", "m-2");

        // verifications
        verify(tagAssignmentRepository, never()).save(any());
    }
}
