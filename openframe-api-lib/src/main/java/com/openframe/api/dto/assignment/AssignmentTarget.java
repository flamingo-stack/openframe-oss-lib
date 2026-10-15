package com.openframe.api.dto.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;

/**
 * One assignment target, named the way the assignment collection stores it: the target type and
 * the target's own id (an organizationId, a machineId, ...).
 *
 * A target whose id could not be resolved, because the client sent an id of another type, is
 * kept as {@link #unresolvable(AssignmentTargetType)} rather than rejected: a listing filtered by
 * it answers empty, the way it does for a target nothing is assigned to.
 *
 * @param targetType the kind of target
 * @param targetId   the target's id; null when it could not be resolved, which matches nothing
 */
public record AssignmentTarget(AssignmentTargetType targetType, String targetId) {

    public static AssignmentTarget unresolvable(AssignmentTargetType targetType) {
        return new AssignmentTarget(targetType, null);
    }

    public boolean resolvable() {
        return targetId != null;
    }
}
