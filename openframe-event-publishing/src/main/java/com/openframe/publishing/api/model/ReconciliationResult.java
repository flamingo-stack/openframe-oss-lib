package com.openframe.publishing.api.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

/** What one batch of a reconciliation found: the projected items that no longer match their source. */
@Getter
@AllArgsConstructor
public class ReconciliationResult {

    private final List<Mismatch> mismatches;

    /** Every projected item of the batch matches its source. */
    public static ReconciliationResult allMatch() {
        return new ReconciliationResult(List.of());
    }

    /** One projected item that differs from its source, or whose source is gone. */
    @Getter
    @AllArgsConstructor
    public static class Mismatch {

        private final String tenantId;
        // The _id of the projected item that does not match, for example, the ticket's id.
        private final String projectedItemId;
        private final String reason;
    }
}
