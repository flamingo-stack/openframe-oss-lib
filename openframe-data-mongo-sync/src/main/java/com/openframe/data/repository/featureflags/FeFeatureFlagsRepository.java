package com.openframe.data.repository.featureflags;

import com.openframe.data.document.featureflags.FeFeatureFlags;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FeFeatureFlagsRepository extends MongoRepository<FeFeatureFlags, String> {
}
