package com.openframe.event.jobs.reconciliation;

import lombok.Builder;
import lombok.Getter;

import java.util.function.UnaryOperator;

// One copied field, as a service's bean, by document classes and property names; an unknown property stops the service.
@Getter
@Builder
public class ReconciledCopy {

    // The metric tag and the job id, for example tickets.organizationName.
    private final String name;

    private final Class<?> targetClass;
    private final String targetReferenceProperty;
    private final String targetProperty;

    // The key is a property of the source, such as Organization.organizationId, not necessarily its id.
    private final Class<?> sourceClass;
    private final String sourceKeyProperty;
    private final String sourceProperty;

    // The copy a target should hold for a source value: as is, or for example lower case.
    @Builder.Default
    private final UnaryOperator<Object> expectedCopy = UnaryOperator.identity();
}
