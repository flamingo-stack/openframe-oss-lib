package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.filter.ToolQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class CustomIntegratedToolRepositoryImpl implements CustomIntegratedToolRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    
    private static final List<String> SORTABLE_FIELDS = List.of(
            "_id",
            "name",
            "type",
            "category",
            "enabled"
    );
    private static final String DEFAULT_SORT_FIELD = "_id";

    private final MongoTemplate mongoTemplate;

    @Override
    public Query buildToolQuery(ToolQueryFilter filter, String search) {
        Query query = new Query();

        if (filter != null) {
            if (filter.getEnabled() != null) {
                query.addCriteria(Criteria.where("enabled").is(filter.getEnabled()));
            }

            if (filter.getType() != null) {
                query.addCriteria(Criteria.where("type").is(filter.getType()));
            }

            if (filter.getCategory() != null) {
                query.addCriteria(Criteria.where("category").is(filter.getCategory()));
            }

            if (filter.getPlatformCategory() != null) {
                query.addCriteria(Criteria.where("platformCategory").is(filter.getPlatformCategory()));
            }
        }

        if (search != null && !search.trim().isEmpty()) {
            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("name").regex(search, "i"),
                    Criteria.where("description").regex(search, "i")
            );
            query.addCriteria(searchCriteria);
        }

        return query;
    }

    @Override
    public List<IntegratedTool> findToolsWithFilters(ToolQueryFilter filter, String search) {
        Query query = buildToolQuery(filter, search);
        return mongoTemplate.find(query, IntegratedTool.class);
    }
    
    @Override
    public List<IntegratedTool> findToolsWithFiltersAndSort(ToolQueryFilter filter, String search, 
                                                              String sortField, String sortDirection) {
        Query query = buildToolQuery(filter, search);
        
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
        
        return mongoTemplate.find(query, IntegratedTool.class);
    }

    @Override
    public List<String> findDistinctTypes() {
        return mongoTemplate.findDistinct(new Query(), "type", IntegratedTool.class, String.class)
                .stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
    }

    @Override
    public List<String> findDistinctCategories() {
        return mongoTemplate.findDistinct(new Query(), "category", IntegratedTool.class, String.class)
                .stream()
                .filter(Objects::nonNull)
                .sorted()
                .collect(Collectors.toList());
    }

    @Override
    public List<String> findDistinctPlatformCategories() {
        return mongoTemplate.findDistinct(new Query(), "platformCategory", IntegratedTool.class, String.class)
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