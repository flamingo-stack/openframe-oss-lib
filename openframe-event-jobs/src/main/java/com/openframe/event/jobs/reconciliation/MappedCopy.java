package com.openframe.event.jobs.reconciliation;

import lombok.Builder;
import lombok.Getter;

import java.util.function.UnaryOperator;

// A ReconciledCopy with its collections and stored field names, resolved at startup through the mapping metadata.
@Getter
@Builder
public class MappedCopy {

    // The metric tag and the job id, for example tickets.organizationName.
    private final String name;

    private final String targetCollection;
    private final String targetReferenceField;
    private final String targetField;

    private final String sourceCollection;
    private final String sourceKeyField;
    private final String sourceField;

    @Builder.Default
    private final UnaryOperator<Object> expectedCopy = UnaryOperator.identity();
}
