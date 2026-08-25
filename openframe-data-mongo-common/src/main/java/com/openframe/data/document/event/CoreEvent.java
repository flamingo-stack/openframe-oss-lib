// services/openframe-core/src/main/java/com/openframe/core/model/CoreEvent.java
package com.openframe.data.document.event;

/**
 * @deprecated This class is legacy/duplicate of {@code Event}, which is the
 * canonical MongoDB document mapped to the "events" collection. Both classes
 * previously mapped to the same collection with divergent shapes (this class
 * added a {@code status} field not present on {@code Event}), risking data
 * drift between writers and readers. Do not use this class for new code;
 * migrate any remaining usages to {@code Event} and remove this class.
 */
@Deprecated
public class CoreEvent {
}

