package com.openframe.repository.apikey;

import com.openframe.document.apikey.ApiKeyStats;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApiKeyStatsMongoRepository extends MongoRepository<ApiKeyStats, String> {
} 