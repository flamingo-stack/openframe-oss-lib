package com.openframe.data.repository.sequence;

/**
 * Repository for managing atomic sequences.
 * Uses MongoDB findAndModify for thread-safe, cluster-safe increments.
 */
public interface SequenceRepository {

    /**
     * Gets the next value for a named sequence using atomic increment.
     *
     * @param sequenceName the name of the sequence (e.g., "ticket_number")
     * @return next value (starts at 1)
     */
    int getNextValue(String sequenceName);
}
