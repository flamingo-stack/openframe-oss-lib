package com.openframe.api.dto.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;

// targetId is null when the client's id could not be resolved to this targetType; callers treat that as matching nothing rather than rejecting it.
public record AssignmentTarget(AssignmentTargetType targetType, String targetId) {

    public static AssignmentTarget unresolvable(AssignmentTargetType targetType) {
        return new AssignmentTarget(targetType, null);
    }

    public boolean resolvable() {
        return targetId != null;
    }
}

