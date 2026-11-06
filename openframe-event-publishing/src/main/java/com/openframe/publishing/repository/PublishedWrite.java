package com.openframe.publishing.repository;

// Internal: what a published repository method writes, so PublishingRepositoryInterceptor knows which rows to write.
public enum PublishedWrite {
    CHANGE,
    DELETE_BY_ID,
    DELETE_ALL_BY_ID,
    DELETE_DOCUMENT,
    DELETE_DOCUMENTS,
    DELETE_ALL,
    DERIVED_DELETE,
    NONE
}
