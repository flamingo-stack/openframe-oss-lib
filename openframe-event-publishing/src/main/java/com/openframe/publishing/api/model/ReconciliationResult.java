package com.openframe.publishing.api.model;

import lombok.AccessLevel;
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
    @AllArgsConstructor(access = AccessLevel.PRIVATE)
    public static class Mismatch {

        private final String tenantId;
        // The _id of the projected item that does not match, for example, the ticket's id.
        private final String projectedItemId;
        // Published again to repair the item, or, when sourceGone, the id whose missed delete is applied.
        private final String sourceId;
        private final boolean sourceGone;
        private final String reason;

        public Mismatch(String tenantId, String projectedItemId, String sourceId, String reason) {
            this(tenantId, projectedItemId, sourceId, false, reason);
        }

        /** An item whose source is deleted, for a projection that removes its copies on delete. */
        public static Mismatch buildForGoneSource(String tenantId, String projectedItemId, String sourceId, String reason) {
            return new Mismatch(tenantId, projectedItemId, sourceId, true, reason);
        }
    }
}
