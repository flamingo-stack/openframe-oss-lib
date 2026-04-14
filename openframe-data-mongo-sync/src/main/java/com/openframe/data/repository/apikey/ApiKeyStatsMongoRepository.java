package com.openframe.data.repository.apikey;

import com.openframe.data.document.apikey.ApiKeyStats;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ApiKeyStatsMongoRepository extends MongoRepository<ApiKeyStats, String> {
} 