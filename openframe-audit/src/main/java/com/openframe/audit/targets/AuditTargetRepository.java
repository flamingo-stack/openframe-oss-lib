package com.openframe.audit.targets;

import com.mongodb.ReadPreference;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Repository
@RequiredArgsConstructor
public class AuditTargetRepository {

    private final MongoTemplate mongoTemplate;

    public Optional<LoadedTarget> load(List<AuditTarget<?>> candidates, String id) {
        return candidates.stream()
                .map(target -> loadAs(target, id))
                .flatMap(Optional::stream)
                .findFirst();
    }

    private <T> Optional<LoadedTarget> loadAs(AuditTarget<T> target, String id) {
        Optional<T> document = target.container() == null
                ? Optional.ofNullable(mongoTemplate.findOne(primaryQuery(target.idField(), id), target.documentType()))
                : findElement(target.container(), target.idField(), id);
        return document.map(found -> new LoadedTarget(target, found));
    }

    private <C, T> Optional<T> findElement(AuditTarget.Container<C, T> container, String idField, String id) {
        C parent = mongoTemplate.findOne(primaryQuery(container.elementsField() + "." + idField, id), container.type());
        return Optional.ofNullable(parent).stream()
                .flatMap(found -> container.elements().apply(found).stream())
                .filter(element -> id.equals(container.elementId().apply(element)))
                .findFirst();
    }

    private static Query primaryQuery(String field, String id) {
        return Query.query(where(field).is(id)).withReadPreference(ReadPreference.primary());
    }
}
