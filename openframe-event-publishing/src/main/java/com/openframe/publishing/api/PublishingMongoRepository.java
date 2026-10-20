package com.openframe.publishing.api;

import com.openframe.publishing.repository.PublishedWrite;
import com.openframe.publishing.repository.PublishesChange;
import com.openframe.publishing.repository.PublishesDelete;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.List;

// A published document's repository (S names its spec): the base writes below and the derived deletes are published.
@NoRepositoryBean
public interface PublishingMongoRepository<D, ID, S extends PublishedAggregateSpec<? super D, ?>> extends MongoRepository<D, ID> {

    @Override
    @PublishesChange
    <T extends D> T save(T document);

    @Override
    @PublishesChange
    <T extends D> List<T> saveAll(Iterable<T> documents);

    @Override
    @PublishesChange
    <T extends D> T insert(T document);

    @Override
    @PublishesChange
    <T extends D> List<T> insert(Iterable<T> documents);

    @Override
    @PublishesDelete(PublishedWrite.DELETE_BY_ID)
    void deleteById(ID id);

    @Override
    @PublishesDelete(PublishedWrite.DELETE_DOCUMENT)
    void delete(D document);

    @Override
    @PublishesDelete(PublishedWrite.DELETE_ALL_BY_ID)
    void deleteAllById(Iterable<? extends ID> ids);

    @Override
    @PublishesDelete(PublishedWrite.DELETE_DOCUMENTS)
    void deleteAll(Iterable<? extends D> documents);

    @Override
    @PublishesDelete(PublishedWrite.DELETE_ALL)
    void deleteAll();
}
