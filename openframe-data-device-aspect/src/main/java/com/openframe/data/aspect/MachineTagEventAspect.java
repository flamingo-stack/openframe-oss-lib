package com.openframe.data.aspect;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.service.MachineTagEventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * AOP aspect to intercept repository save operations and delegate to RepositoryEventService.
 * Handles Machine, TagAssignment, and Tag entity changes.
 */
@Aspect
@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.device.aspect.enabled", havingValue = "true", matchIfMissing = true)
public class MachineTagEventAspect {

    private final MachineTagEventService machineTagEventService;

    /**
     * Intercepts Machine repository save operations.
     */
    @AfterReturning(
            pointcut = "execution(* com.openframe.data.repository.device.MachineRepository.save(..)) && args(machine)",
            returning = "result",
            argNames = "joinPoint,machine,result"
    )
    public void afterMachineSave(JoinPoint joinPoint, Object machine, Object result) {
        try {
            log.debug("Machine save operation detected, delegating to service");
            Machine machineEntity = (Machine) machine;
            machineTagEventService.processMachineSave(machineEntity);
        } catch (Exception e) {
            log.error("Error in afterMachineSave aspect: {}", e.getMessage(), e);
        }
    }

    /**
     * Intercepts Machine repository saveAll operations.
     * Delegates to RepositoryEventService for processing.
     */
    @AfterReturning(
            pointcut = "execution(* com.openframe.data.repository.device.MachineRepository.saveAll(..)) && args(machines)",
            returning = "result",
            argNames = "joinPoint,machines,result"
    )
    public void afterMachineSaveAll(JoinPoint joinPoint, Object machines, Object result) {
        try {
            log.debug("Machine saveAll operation detected, delegating to service");
            Iterable<Machine> machineEntities = (Iterable<Machine>) machines;
            machineTagEventService.processMachineSaveAll(machineEntities);
        } catch (Exception e) {
            log.error("Error in afterMachineSaveAll aspect: {}", e.getMessage(), e);
        }
    }

    /**
     * Intercepts TagAssignment repository save operations.
     */
    @AfterReturning(
            pointcut = "execution(* com.openframe.data.repository.tag.TagAssignmentRepository.save(..)) && args(assignment)",
            returning = "result",
            argNames = "joinPoint,assignment,result"
    )
    public void afterTagAssignmentSave(JoinPoint joinPoint, Object assignment, Object result) {
        try {
            log.debug("TagAssignment save operation detected, delegating to service");
            TagAssignment assignmentEntity = (TagAssignment) assignment;
            machineTagEventService.processTagAssignmentSave(assignmentEntity);
        } catch (Exception e) {
            log.error("Error in afterTagAssignmentSave aspect: {}", e.getMessage(), e);
        }
    }

    /**
     * Intercepts TagAssignment repository saveAll operations.
     */
    @AfterReturning(
            pointcut = "execution(* com.openframe.data.repository.tag.TagAssignmentRepository.saveAll(..)) && args(assignments)",
            returning = "result",
            argNames = "joinPoint,assignments,result"
    )
    public void afterTagAssignmentSaveAll(JoinPoint joinPoint, Object assignments, Object result) {
        try {
            log.debug("TagAssignment saveAll operation detected, delegating to service");
            Iterable<TagAssignment> assignmentEntities = (Iterable<TagAssignment>) assignments;
            machineTagEventService.processTagAssignmentSaveAll(assignmentEntities);
        } catch (Exception e) {
            log.error("Error in afterTagAssignmentSaveAll aspect: {}", e.getMessage(), e);
        }
    }

    /**
     * Intercepts TagAssignment repository deleteByEntityIdAndTagIdAndEntityType operations.
     * Uses @Around to capture affected entity BEFORE the delete, then re-syncs to Pinot.
     */
    @Around("execution(* com.openframe.data.repository.tag.TagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(..)) && args(entityId, tagId, entityType)")
    public Object aroundTagAssignmentDelete(ProceedingJoinPoint joinPoint, String entityId, String tagId, Object entityType) throws Throwable {
        try {
            log.debug("TagAssignment delete operation detected for entityId={}, tagId={}, entityType={}", entityId, tagId, entityType);
            if (entityType != null && "DEVICE".equals(entityType.toString())) {
                machineTagEventService.processTagAssignmentDelete(entityId, tagId);
            }
        } catch (Exception e) {
            log.error("Error in pre-delete processing for entityId={}, tagId={}: {}", entityId, tagId, e.getMessage(), e);
        }
        return joinPoint.proceed();
    }

    /**
     * Intercepts TagAssignment repository deleteByTagId operations.
     * Uses @Around to capture all affected machineIds BEFORE the delete, then re-syncs to Pinot.
     */
    @Around("execution(* com.openframe.data.repository.tag.TagAssignmentRepository.deleteByTagId(..)) && args(tagId)")
    public Object aroundTagAssignmentDeleteByTagId(ProceedingJoinPoint joinPoint, String tagId) throws Throwable {
        try {
            log.debug("TagAssignment deleteByTagId operation detected for tagId={}", tagId);
            machineTagEventService.processTagAssignmentDeleteByTagId(tagId);
        } catch (Exception e) {
            log.error("Error in pre-delete processing for tagId={}: {}", tagId, e.getMessage(), e);
        }
        return joinPoint.proceed();
    }

    /**
     * Intercepts Tag repository save operations using @Around advice.
     * Captures original state before save and processes after successful save.
     */
    @Around("execution(* com.openframe.data.repository.tag.TagRepository.save(..)) && args(tag)")
    public Object aroundTagSave(ProceedingJoinPoint joinPoint, Object tag) throws Throwable {
        try {
            log.debug("Tag save operation detected, capturing state and delegating to service");
            Tag tagEntity = (Tag) tag;

            Tag result = (Tag) joinPoint.proceed();

            if (tagEntity != null && tagEntity.getId() != null) {
                machineTagEventService.processTagSave(tagEntity);
            }
            return result;
        } catch (Exception e) {
            log.error("Error in aroundTagSave aspect: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Intercepts Tag repository saveAll operations using @Around advice.
     * Captures original states before save and processes after successful save.
     */
    @Around("execution(* com.openframe.data.repository.tag.TagRepository.saveAll(..)) && args(tags)")
    public Object aroundTagSaveAll(ProceedingJoinPoint joinPoint, Object tags) throws Throwable {
        try {
            log.debug("Tag saveAll operation detected, capturing states and delegating to service");
            Iterable<Tag> tagEntities = (Iterable<Tag>) tags;

            Map<String, Tag> originalTags = new HashMap<>();
            for (Tag tag : tagEntities) {
                if (tag.getId() != null) {
                    originalTags.put(tag.getId(), tag);
                    log.debug("Captured original tag state for ID: {}", tag.getId());
                }
            }

            Iterable<Tag> results = (Iterable<Tag>) joinPoint.proceed();

            for (Tag tag : results) {
                if (originalTags.containsKey(tag.getId())) {
                    machineTagEventService.processTagSave(tag);
                }
            }
            return results;
        } catch (Exception e) {
            log.error("Error in aroundTagSaveAll aspect: {}", e.getMessage(), e);
            throw e;
        }
    }
}
