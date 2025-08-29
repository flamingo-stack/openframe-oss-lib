package com.openframe.сonfig;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

@Configuration
public class MongoIndexConfig {

    @Autowired
    private MongoTemplate mongoTemplate;

    @PostConstruct
    public void initIndexes() {
        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("userId", Sort.Direction.ASC)
                                  .on("timestamp", Sort.Direction.DESC));
        
        mongoTemplate.indexOps("application_events")
            .ensureIndex(new Index().on("type", Sort.Direction.ASC)
                                  .on("metadata.tags", Sort.Direction.ASC));
    }
}