package com.openframe.client.aspect;

import com.openframe.data.aspect.MachineTagEventAspect;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.service.MachineTagEventService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests for MachineTagEventAspect to ensure proper interception of repository operations.
 */
@ExtendWith(MockitoExtension.class)
class MachineTagEventAspectTest {

    @Mock
    private MachineTagEventService machineTagEventService;

    @Mock
    private ProceedingJoinPoint proceedingJoinPoint;

    private MachineTagEventAspect machineTagEventAspect;

    @BeforeEach
    void setUp() {
        machineTagEventAspect = new MachineTagEventAspect(machineTagEventService);
    }

    @Test
    void testMachineSaveAspect() {
        // Arrange
        Machine machine = new Machine();
        machine.setId("machine-1");
        machine.setHostname("test-machine");

        // Act - directly call the aspect method
        machineTagEventAspect.afterMachineSave(null, machine, machine);

        // Assert
        verify(machineTagEventService, times(1)).processMachineSave(machine);
    }

    @Test
    void testMachineSaveAllAspect() {
        // Arrange
        Machine machine1 = new Machine();
        machine1.setId("machine-1");
        machine1.setHostname("test-machine-1");

        Machine machine2 = new Machine();
        machine2.setId("machine-2");
        machine2.setHostname("test-machine-2");

        List<Machine> machines = Arrays.asList(machine1, machine2);

        // Act - directly call the aspect method
        machineTagEventAspect.afterMachineSaveAll(null, machines, machines);

        // Assert
        verify(machineTagEventService, times(1)).processMachineSaveAll(machines);
    }

    @Test
    void testTagAssignmentSaveAspect() {
        // Arrange
        TagAssignment assignment = new TagAssignment();
        assignment.setId("assignment-1");
        assignment.setEntityId("machine-1");
        assignment.setTagId("tag-1");
        assignment.setEntityType(TagEntityType.DEVICE);

        // Act - directly call the aspect method
        machineTagEventAspect.afterTagAssignmentSave(null, assignment, assignment);

        // Assert
        verify(machineTagEventService, times(1)).processTagAssignmentSave(assignment);
    }

    @Test
    void testTagAssignmentSaveAllAspect() {
        // Arrange
        TagAssignment assignment1 = new TagAssignment();
        assignment1.setId("assignment-1");
        assignment1.setEntityId("machine-1");
        assignment1.setTagId("tag-1");
        assignment1.setEntityType(TagEntityType.DEVICE);

        TagAssignment assignment2 = new TagAssignment();
        assignment2.setId("assignment-2");
        assignment2.setEntityId("machine-2");
        assignment2.setTagId("tag-2");
        assignment2.setEntityType(TagEntityType.DEVICE);

        List<TagAssignment> assignments = Arrays.asList(assignment1, assignment2);

        // Act - directly call the aspect method
        machineTagEventAspect.afterTagAssignmentSaveAll(null, assignments, assignments);

        // Assert
        verify(machineTagEventService, times(1)).processTagAssignmentSaveAll(assignments);
    }

    @Test
    void testAroundTagSave_ExistingTag() throws Throwable {
        // Arrange
        Tag tag = new Tag();
        tag.setId("tag-1");
        tag.setKey("test-tag");
        tag.setColor("#FF0000");

        when(proceedingJoinPoint.proceed()).thenReturn(tag);

        // Act
        Object result = machineTagEventAspect.aroundTagSave(proceedingJoinPoint, tag);

        // Assert
        verify(proceedingJoinPoint, times(1)).proceed();
        verify(machineTagEventService, times(1)).processTagSave(tag);
        assertEquals(tag, result);
    }

    @Test
    void testAroundTagSave_NewTag() throws Throwable {
        // Arrange
        Tag tag = new Tag();
        tag.setKey("new-tag");
        tag.setColor("#FF0000");
        // Note: No ID set, so this is a new tag

        when(proceedingJoinPoint.proceed()).thenReturn(tag);

        // Act
        Object result = machineTagEventAspect.aroundTagSave(proceedingJoinPoint, tag);

        // Assert
        verify(proceedingJoinPoint, times(1)).proceed();
        verify(machineTagEventService, never()).processTagSave(any(Tag.class));
        assertEquals(tag, result);
    }

    @Test
    void testAroundTagSaveAll_ExistingTags() throws Throwable {
        // Arrange
        Tag tag1 = new Tag();
        tag1.setId("tag-1");
        tag1.setKey("test-tag-1");
        tag1.setColor("#FF0000");

        Tag tag2 = new Tag();
        tag2.setId("tag-2");
        tag2.setKey("test-tag-2");
        tag2.setColor("#00FF00");

        List<Tag> tags = Arrays.asList(tag1, tag2);
        List<Tag> results = Arrays.asList(tag1, tag2);

        when(proceedingJoinPoint.proceed()).thenReturn(results);

        // Act
        Object result = machineTagEventAspect.aroundTagSaveAll(proceedingJoinPoint, tags);

        // Assert
        verify(proceedingJoinPoint, times(1)).proceed();
        verify(machineTagEventService, times(1)).processTagSave(tag1);
        verify(machineTagEventService, times(1)).processTagSave(tag2);
        assertEquals(results, result);
    }

    @Test
    void testAroundTagSaveAll_MixedTags() throws Throwable {
        // Arrange
        Tag existingTag = new Tag();
        existingTag.setId("tag-1");
        existingTag.setKey("existing-tag");
        existingTag.setColor("#FF0000");

        Tag newTag = new Tag();
        newTag.setKey("new-tag");
        newTag.setColor("#00FF00");

        List<Tag> tags = Arrays.asList(existingTag, newTag);
        List<Tag> results = Arrays.asList(existingTag, newTag);

        when(proceedingJoinPoint.proceed()).thenReturn(results);

        // Act
        Object result = machineTagEventAspect.aroundTagSaveAll(proceedingJoinPoint, tags);

        // Assert
        verify(proceedingJoinPoint, times(1)).proceed();
        verify(machineTagEventService, times(1)).processTagSave(existingTag);
        verify(machineTagEventService, never()).processTagSave(newTag);
        assertEquals(results, result);
    }

    @Test
    void testAroundTagSaveAll_NewTagsOnly() throws Throwable {
        // Arrange
        Tag newTag1 = new Tag();
        newTag1.setKey("new-tag-1");
        newTag1.setColor("#FF0000");

        Tag newTag2 = new Tag();
        newTag2.setKey("new-tag-2");
        newTag2.setColor("#00FF00");

        List<Tag> tags = Arrays.asList(newTag1, newTag2);
        List<Tag> results = Arrays.asList(newTag1, newTag2);

        when(proceedingJoinPoint.proceed()).thenReturn(results);

        // Act
        Object result = machineTagEventAspect.aroundTagSaveAll(proceedingJoinPoint, tags);

        // Assert
        verify(proceedingJoinPoint, times(1)).proceed();
        verify(machineTagEventService, never()).processTagSave(any(Tag.class));
        assertEquals(results, result);
    }

    // --- Delete interception tests ---

    @Test
    void testTagAssignmentDelete_DelegatesToServiceBeforeProceed() throws Throwable {
        // Arrange
        String entityId = "machine-1";
        String tagId = "tag-1";
        when(proceedingJoinPoint.proceed()).thenReturn(null);

        // Act
        machineTagEventAspect.aroundTagAssignmentDelete(proceedingJoinPoint, entityId, tagId, TagEntityType.DEVICE);

        // Assert - service called before proceed
        var inOrder = inOrder(machineTagEventService, proceedingJoinPoint);
        inOrder.verify(machineTagEventService).processTagAssignmentDelete(entityId, tagId);
        inOrder.verify(proceedingJoinPoint).proceed();
    }

    @Test
    void testTagAssignmentDeleteByTagId_DelegatesToServiceBeforeProceed() throws Throwable {
        // Arrange
        String tagId = "tag-1";
        when(proceedingJoinPoint.proceed()).thenReturn(null);

        // Act
        machineTagEventAspect.aroundTagAssignmentDeleteByTagId(proceedingJoinPoint, tagId);

        // Assert - service called before proceed
        var inOrder = inOrder(machineTagEventService, proceedingJoinPoint);
        inOrder.verify(machineTagEventService).processTagAssignmentDeleteByTagId(tagId);
        inOrder.verify(proceedingJoinPoint).proceed();
    }

    @Test
    void testTagAssignmentDelete_ProceedsEvenWhenServiceThrows() throws Throwable {
        // Arrange
        String entityId = "machine-1";
        String tagId = "tag-1";
        doThrow(new RuntimeException("Kafka error"))
                .when(machineTagEventService).processTagAssignmentDelete(entityId, tagId);
        when(proceedingJoinPoint.proceed()).thenReturn(null);

        // Act - should not throw
        machineTagEventAspect.aroundTagAssignmentDelete(proceedingJoinPoint, entityId, tagId, TagEntityType.DEVICE);

        // Assert - delete still proceeds despite service error
        verify(proceedingJoinPoint, times(1)).proceed();
    }

    @Test
    void testTagAssignmentDeleteByTagId_ProceedsEvenWhenServiceThrows() throws Throwable {
        // Arrange
        String tagId = "tag-1";
        doThrow(new RuntimeException("Kafka error"))
                .when(machineTagEventService).processTagAssignmentDeleteByTagId(tagId);
        when(proceedingJoinPoint.proceed()).thenReturn(null);

        // Act - should not throw
        machineTagEventAspect.aroundTagAssignmentDeleteByTagId(proceedingJoinPoint, tagId);

        // Assert - delete still proceeds despite service error
        verify(proceedingJoinPoint, times(1)).proceed();
    }

    // --- Existing error handling tests ---

    @Test
    void testErrorHandling_MachineSave() {
        // Arrange
        Machine machine = new Machine();
        machine.setId("machine-1");
        machine.setHostname("test-machine");

        doThrow(new RuntimeException("Service error"))
            .when(machineTagEventService).processMachineSave(machine);

        // Act & Assert - should not throw exception
        machineTagEventAspect.afterMachineSave(null, machine, machine);

        // Should still call the service
        verify(machineTagEventService, times(1)).processMachineSave(machine);
    }

    @Test
    void testErrorHandling_TagAssignmentSave() {
        // Arrange
        TagAssignment assignment = new TagAssignment();
        assignment.setId("assignment-1");
        assignment.setEntityId("machine-1");
        assignment.setTagId("tag-1");
        assignment.setEntityType(TagEntityType.DEVICE);

        doThrow(new RuntimeException("Service error"))
            .when(machineTagEventService).processTagAssignmentSave(assignment);

        // Act & Assert - should not throw exception
        machineTagEventAspect.afterTagAssignmentSave(null, assignment, assignment);

        // Should still call the service
        verify(machineTagEventService, times(1)).processTagAssignmentSave(assignment);
    }

    @Test
    void testErrorHandling_ProceedingJoinPointThrowsException() throws Throwable {
        // Arrange
        Tag tag = new Tag();
        tag.setId("tag-1");
        tag.setKey("test-tag");
        tag.setColor("#FF0000");

        when(proceedingJoinPoint.proceed()).thenThrow(new RuntimeException("Database error"));

        // Act & Assert - should propagate the exception
        assertThrows(RuntimeException.class, () -> {
            machineTagEventAspect.aroundTagSave(proceedingJoinPoint, tag);
        });

        // Should not call the service because the save operation failed
        verify(machineTagEventService, never()).processTagSave(any(Tag.class));
    }

    @Test
    void testErrorHandling_InvalidCast() {
        // Arrange
        Object invalidObject = "not a machine";

        // Act & Assert - should not throw exception
        machineTagEventAspect.afterMachineSave(null, invalidObject, invalidObject);

        // Should not call the service due to ClassCastException
        verify(machineTagEventService, never()).processMachineSave(any());
    }
}
