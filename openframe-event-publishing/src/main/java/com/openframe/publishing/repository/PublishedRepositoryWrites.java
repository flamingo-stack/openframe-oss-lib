package com.openframe.publishing.repository;

import java.util.List;

// Internal: the Spring Data writes PublishingRepositoryInterceptor publishes, matched by signature on any repository of a document with a spec.
interface PublishedRepositoryWrites<D, ID> {

    @PublishesChange
    <T extends D> T save(T document);

    @PublishesChange
    <T extends D> List<T> saveAll(Iterable<T> documents);

    @PublishesChange
    <T extends D> T insert(T document);

    @PublishesChange
    <T extends D> List<T> insert(Iterable<T> documents);

    @PublishesDelete(PublishedWrite.DELETE_BY_ID)
    void deleteById(ID id);

    @PublishesDelete(PublishedWrite.DELETE_DOCUMENT)
    void delete(D document);

    @PublishesDelete(PublishedWrite.DELETE_ALL_BY_ID)
    void deleteAllById(Iterable<? extends ID> ids);

    @PublishesDelete(PublishedWrite.DELETE_DOCUMENTS)
    void deleteAll(Iterable<? extends D> documents);

    @PublishesDelete(PublishedWrite.DELETE_ALL)
    void deleteAll();
}
