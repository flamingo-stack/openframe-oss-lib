package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PackageAutoUpdatePolicyRepository extends MongoRepository<PackageAutoUpdatePolicy, String>, CustomPackageAutoUpdatePolicyRepository {
}
