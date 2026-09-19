package com.openframe.api.service.device;

import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.tag.TagEntityType.DEVICE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceTagServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TAG_ID = "tag-1";

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock private MachineRepository machineRepository;

    private DeviceTagService service;

    @BeforeEach
    void setUp() {
        service = new DeviceTagService(tagRepository, tagAssignmentRepository, machineRepository);

        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(new Machine()));
        when(tagRepository.save(any())).thenAnswer(inv -> {
            Tag tag = inv.getArgument(0);
            if (tag.getId() == null) {
                tag.setId(TAG_ID);
            }
            return tag;
        });
        when(tagAssignmentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.empty());
    }

    // ---- assignTag ----

    @Test
    void assignTagCreatesKeyAndAssignmentOnFirstUse() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE)).thenReturn(null);

        Tag result = service.assignTag(MACHINE_ID, "site", List.of("chicago"));

        ArgumentCaptor<Tag> tag = ArgumentCaptor.forClass(Tag.class);
        verify(tagRepository).save(tag.capture());
        assertThat(tag.getValue().getKey()).isEqualTo("site");
        assertThat(tag.getValue().getEntityType()).isEqualTo(DEVICE);
        assertThat(tag.getValue().getValues()).containsExactly("chicago");
        assertThat(tag.getValue().getCreatedAt()).isNotNull();

        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getEntityId()).isEqualTo(MACHINE_ID);
        assertThat(assignment.getValue().getTagId()).isEqualTo(TAG_ID);
        assertThat(assignment.getValue().getEntityType()).isEqualTo(DEVICE);
        assertThat(assignment.getValue().getValues()).containsExactly("chicago");
        assertThat(assignment.getValue().getTaggedAt()).isNotNull();

        assertThat(result.getId()).isEqualTo(TAG_ID);
        assertThat(result.getKey()).isEqualTo("site");
        assertThat(result.getValues()).containsExactly("chicago");
    }

    @Test
    void assignTagWithoutValuesStoresLabelTag() {
        when(tagRepository.findByKeyAndEntityType("vip", DEVICE)).thenReturn(null);

        Tag result = service.assignTag(MACHINE_ID, "vip", null);

        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getValues()).isEmpty();
        assertThat(result.getValues()).isEmpty();
    }

    @Test
    void assignTagRejectsCaseVariantOfExistingKey() {
        when(tagRepository.findByKeyAndEntityType("Site", DEVICE)).thenReturn(null);
        when(tagRepository.existsByKeyIgnoreCaseAndEntityType("Site", DEVICE)).thenReturn(true);

        assertThatThrownBy(() -> service.assignTag(MACHINE_ID, "Site", List.of("chicago")))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Site");

        verify(tagRepository, never()).save(any());
        verify(tagAssignmentRepository, never()).save(any());
    }

    @Test
    void assignTagReusesExistingKeyWithoutResavingItWhenValuesAreKnown() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston"));

        service.assignTag(MACHINE_ID, "site", List.of("boston"));

        // Tag.save republishes every device carrying the key — must not fire for a no-op merge.
        verify(tagRepository, never()).save(any());
        verify(tagAssignmentRepository).save(any());
    }

    @Test
    void assignTagAppendsUnseenValuesToTheKeysOptionsKeepingOrder() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston"));

        service.assignTag(MACHINE_ID, "site", List.of("boston", "austin"));

        ArgumentCaptor<Tag> tag = ArgumentCaptor.forClass(Tag.class);
        verify(tagRepository).save(tag.capture());
        assertThat(tag.getValue().getId()).isEqualTo(TAG_ID);
        assertThat(tag.getValue().getValues()).containsExactly("chicago", "boston", "austin");
    }

    @Test
    void assignTagMergesIntoTheDevicesExistingValuesInsteadOfReplacing() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston"));
        TagAssignment current = existingAssignment("chicago");
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(current));

        Tag result = service.assignTag(MACHINE_ID, "site", List.of("boston"));

        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getId()).isEqualTo("assignment-1");
        assertThat(assignment.getValue().getValues()).containsExactly("chicago", "boston");
        assertThat(result.getValues()).containsExactly("chicago", "boston");
    }

    @Test
    void assignTagIsIdempotentForValuesTheDeviceAlreadyCarries() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston"));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago", "boston")));

        Tag result = service.assignTag(MACHINE_ID, "site", List.of("boston", "chicago"));

        verify(tagRepository, never()).save(any());
        verify(tagAssignmentRepository, never()).save(any());
        assertThat(result.getValues()).containsExactly("chicago", "boston");
    }

    @Test
    void assignTagReturnsTheDevicesValuesNotTheKeysFullOptionList() {
        Tag tag = existingTag("chicago", "boston", "austin");
        tag.setDescription("Office location");
        tag.setColor("#FF8800");
        when(tagRepository.findByKeyAndEntityType("site", DEVICE)).thenReturn(tag);

        Tag result = service.assignTag(MACHINE_ID, "site", List.of("austin"));

        assertThat(result.getValues()).containsExactly("austin");
        assertThat(result.getDescription()).isEqualTo("Office location");
        assertThat(result.getColor()).isEqualTo("#FF8800");
        // The stored key must keep its full option list — the return value is a copy.
        assertThat(tag.getValues()).containsExactly("chicago", "boston", "austin");
    }

    @Test
    void assignTagFailsForUnknownDeviceBeforeTouchingTags() {
        when(machineRepository.findByMachineId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignTag("ghost", "site", List.of("chicago")))
                .isInstanceOf(DeviceNotFoundException.class)
                .hasMessageContaining("ghost");

        verifyNoInteractions(tagRepository, tagAssignmentRepository);
    }

    @Test
    void assignTagRejectsInvalidKeyBeforeAnyLookup() {
        assertThatThrownBy(() -> service.assignTag(MACHINE_ID, "bad key!", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bad key!");

        verifyNoInteractions(machineRepository, tagRepository, tagAssignmentRepository);
    }

    @Test
    void assignTagRejectsInvalidValueBeforeAnyLookup() {
        assertThatThrownBy(() -> service.assignTag(MACHINE_ID, "site", List.of("chicago", "new york")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("new york");

        verifyNoInteractions(machineRepository, tagRepository, tagAssignmentRepository);
    }

    @Test
    void assignTagDropsDuplicateValuesFromTheRequest() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE)).thenReturn(null);

        Tag result = service.assignTag(MACHINE_ID, "site", List.of("chicago", "chicago", "boston"));

        ArgumentCaptor<Tag> tag = ArgumentCaptor.forClass(Tag.class);
        verify(tagRepository).save(tag.capture());
        assertThat(tag.getValue().getValues()).containsExactly("chicago", "boston");
        assertThat(result.getValues()).containsExactly("chicago", "boston");
    }

    // ---- setTagValues ----

    @Test
    void setTagValuesReplacesTheDevicesValuesSoASingleValueCanBeRemoved() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston", "austin"));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago", "boston", "austin")));

        Tag result = service.setTagValues(MACHINE_ID, "site", List.of("chicago", "austin"));

        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getId()).isEqualTo("assignment-1");
        assertThat(assignment.getValue().getValues()).containsExactly("chicago", "austin");
        assertThat(result.getValues()).containsExactly("chicago", "austin");
    }

    @Test
    void setTagValuesKeepsTheDroppedValueInTheKeysOptions() {
        Tag tag = existingTag("chicago", "boston");
        when(tagRepository.findByKeyAndEntityType("site", DEVICE)).thenReturn(tag);
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago", "boston")));

        service.setTagValues(MACHINE_ID, "site", List.of("chicago"));

        // Other devices may still carry "boston"; the key's options only ever grow.
        verify(tagRepository, never()).save(any());
        assertThat(tag.getValues()).containsExactly("chicago", "boston");
    }

    @Test
    void setTagValuesAppendsUnseenValuesToTheKeysOptions() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago"));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago")));

        Tag result = service.setTagValues(MACHINE_ID, "site", List.of("austin"));

        ArgumentCaptor<Tag> tag = ArgumentCaptor.forClass(Tag.class);
        verify(tagRepository).save(tag.capture());
        assertThat(tag.getValue().getValues()).containsExactly("chicago", "austin");
        assertThat(result.getValues()).containsExactly("austin");
    }

    @Test
    void setTagValuesWithNoValuesKeepsTheKeyOnTheDeviceAsALabel() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago"));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago")));

        Tag result = service.setTagValues(MACHINE_ID, "site", null);

        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getValues()).isEmpty();
        assertThat(result.getValues()).isEmpty();
        verify(tagAssignmentRepository, never()).deleteByEntityIdAndTagIdAndEntityType(any(), any(), any());
    }

    @Test
    void setTagValuesCreatesKeyAndAssignmentOnFirstUse() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE)).thenReturn(null);

        Tag result = service.setTagValues(MACHINE_ID, "site", List.of("chicago"));

        verify(tagRepository).save(any());
        ArgumentCaptor<TagAssignment> assignment = ArgumentCaptor.forClass(TagAssignment.class);
        verify(tagAssignmentRepository).save(assignment.capture());
        assertThat(assignment.getValue().getEntityId()).isEqualTo(MACHINE_ID);
        assertThat(assignment.getValue().getValues()).containsExactly("chicago");
        assertThat(result.getValues()).containsExactly("chicago");
    }

    @Test
    void setTagValuesSkipsTheSaveWhenNothingChanges() {
        when(tagRepository.findByKeyAndEntityType("site", DEVICE))
                .thenReturn(existingTag("chicago", "boston"));
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago", "boston")));

        service.setTagValues(MACHINE_ID, "site", List.of("chicago", "boston"));

        verify(tagRepository, never()).save(any());
        verify(tagAssignmentRepository, never()).save(any());
    }

    @Test
    void setTagValuesAppliesTheSameGuardsAsAssignTag() {
        when(machineRepository.findByMachineId("ghost")).thenReturn(Optional.empty());
        when(tagRepository.findByKeyAndEntityType("Site", DEVICE)).thenReturn(null);
        when(tagRepository.existsByKeyIgnoreCaseAndEntityType("Site", DEVICE)).thenReturn(true);

        assertThatThrownBy(() -> service.setTagValues("ghost", "site", List.of("chicago")))
                .isInstanceOf(DeviceNotFoundException.class);
        assertThatThrownBy(() -> service.setTagValues(MACHINE_ID, "site", List.of("new york")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.setTagValues(MACHINE_ID, "Site", List.of("chicago")))
                .isInstanceOf(ConflictException.class);

        verify(tagRepository, never()).save(any());
        verify(tagAssignmentRepository, never()).save(any());
    }

    // ---- removeTag ----

    @Test
    void removeTagDeletesThroughTheAspectInterceptedMethodAndKeepsTheKey() {
        when(tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE))
                .thenReturn(Optional.of(existingAssignment("chicago")));

        boolean removed = service.removeTag(MACHINE_ID, TAG_ID);

        assertThat(removed).isTrue();
        // Only this delete is intercepted by MachineTagEventAspect; any other one skips the Pinot re-sync.
        verify(tagAssignmentRepository).deleteByEntityIdAndTagIdAndEntityType(MACHINE_ID, TAG_ID, DEVICE);
        verify(tagAssignmentRepository, never()).deleteByTagId(any());
        verify(tagAssignmentRepository, never()).deleteByEntityIdAndEntityType(any(), any());
        verify(tagAssignmentRepository, never()).delete(any());
        verifyNoInteractions(tagRepository);
    }

    @Test
    void removeTagReturnsFalseWhenTheDeviceDoesNotCarryTheTag() {
        boolean removed = service.removeTag(MACHINE_ID, TAG_ID);

        assertThat(removed).isFalse();
        verify(tagAssignmentRepository, never()).deleteByEntityIdAndTagIdAndEntityType(any(), any(), any());
    }

    @Test
    void removeTagFailsForUnknownDevice() {
        when(machineRepository.findByMachineId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeTag("ghost", TAG_ID))
                .isInstanceOf(DeviceNotFoundException.class);

        verifyNoInteractions(tagAssignmentRepository);
    }

    private static Tag existingTag(String... values) {
        return Tag.builder()
                .id(TAG_ID)
                .key("site")
                .entityType(DEVICE)
                .values(new ArrayList<>(List.of(values)))
                .createdAt(Instant.parse("2026-01-01T00:00:00Z"))
                .build();
    }

    private static TagAssignment existingAssignment(String... values) {
        return TagAssignment.builder()
                .id("assignment-1")
                .entityId(MACHINE_ID)
                .tagId(TAG_ID)
                .entityType(DEVICE)
                .values(new ArrayList<>(List.of(values)))
                .build();
    }
}
