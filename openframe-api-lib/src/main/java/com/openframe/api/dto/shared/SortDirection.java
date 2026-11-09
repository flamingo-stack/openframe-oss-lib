package com.openframe.api.dto.shared;

/**
 * Sort direction enum matching GraphQL schema definition
 */
public enum SortDirection {
    ASC, DESC;

    public SortDirection opposite() {
        return this == ASC ? DESC : ASC;
    }
}