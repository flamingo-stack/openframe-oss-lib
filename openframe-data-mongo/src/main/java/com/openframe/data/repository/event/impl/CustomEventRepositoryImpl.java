package com.openframe.data.repository.event.impl;

import com.openframe.data.document.event.Event;
import com.openframe.data.document.event.filter.EventQueryFilter;
import com.openframe.data.repository.event.CustomEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class CustomEventRepositoryImpl implements CustomEventRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    
    private static final List<String> SORTABLE_FIELDS = List.of(
            "_id",
            "type",
            "userId",
            "timestamp"
    );
    private static final String DEFAULT_SORT_FIELD = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public Query buildEventQuery(EventQueryFilter filter, String search) {
        Query query = new Query();

        if (filter != null) {
            if (filter.getUserIds() != null && !filter.getUserIds().isEmpty()) {
                query.addCriteria(Criteria.where("userId").in(filter.getUserIds()));
            }

            if (filter.getEventTypes() != null && !filter.getEventTypes().isEmpty()) {
                query.addCriteria(Criteria.where("type").in(filter.getEventTypes()));
            }

            if (filter.getStartDate() != null || filter.getEndDate() != null) {
                Criteria dateCriteria = Criteria.where("timestamp");

                if (filter.getStartDate() != null) {
                    Instant startInstant = filter.getStartDate()
                            .atTime(LocalTime.MIN)
                            .toInstant(ZoneOffset.UTC);
                    dateCriteria.gte(startInstant);
                }

                if (filter.getEndDate() != null) {
                    Instant endInstant = filter.getEndDate()
                            .atTime(LocalTime.MAX)
                            .toInstant(ZoneOffset.UTC);
                    dateCriteria.lte(endInstant);
                }

                query.addCriteria(dateCriteria);
            }
        }

        if (search != null && !search.trim().isEmpty()) {
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("type").regex(search, "i"),
                    Criteria.where("data").regex(search, "i")
            );
            query.addCriteria(searchCriteria);
        }

        return query;
    }

    @Override
    public List<Event> findEventsWithCursor(Query query, String cursor, int limit, 
                                             String sortField, String sortDirection) {
        if (cursor != null && !cursor.trim().isEmpty()) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                if (SORT_DESC.equalsIgnoreCase(sortDirection)) {
                    query.addCriteria(Criteria.where(ID_FIELD).lt(cursorId));
                } else {
                    query.addCriteria(Criteria.where(ID_FIELD).gt(cursorId));
                }
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
        }
        query.limit(limit);
        
        Sort.Direction mongoSortDirection = SORT_DESC.equalsIgnoreCase(sortDirection) ? 
            Sort.Direction.DESC : Sort.Direction.ASC;
            
        if (ID_FIELD.equals(sortField)) {
            query.with(Sort.by(mongoSortDirection, ID_FIELD));
        } else {
            query.with(Sort.by(
                Sort.Order.by(sortField).with(mongoSortDirection),
                Sort.Order.by(ID_FIELD).with(mongoSortDirection)
            ));
        }

        return mongoTemplate.find(query, Event.class);
    }

    @Override
    public List<String> findDistinctUserIds() {
        return mongoTemplate.findDistinct(new Query(), "userId", Event.class, String.class)
                .stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
    }

    @Override
    public List<String> findDistinctEventTypes() {
        return mongoTemplate.findDistinct(new Query(), "type", Event.class, String.class)
                .stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
    }
    
    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }
    
    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }
}