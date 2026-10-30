package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface PackageAutoUpdatePolicyRepository extends MongoRepository<PackageAutoUpdatePolicy, String>, CustomPackageAutoUpdatePolicyRepository {

    List<PackageAutoUpdatePolicy> findByTenantIdAndEnabledTrue(String tenantId);

    List<PackageAutoUpdatePolicy> findByTenantIdAndSoftwareIdIn(String tenantId, Collection<String> softwareIds);

    List<PackageAutoUpdatePolicy> findByTenantIdAndMachineIdAndSoftwareIdIn(String tenantId, String machineId,
                                                                            Collection<String> softwareIds);

    List<PackageAutoUpdatePolicy> findByTenantIdAndSoftwareIdAndMachineIdIn(String tenantId, String softwareId,
                                                                            Collection<String> machineIds);

    @Query("{ '_id': { '$in': ?0 } }")
    @Update("{ '$set': { 'lastVersion': ?1 } }")
    long markOrdered(Collection<String> policyIds, String version);
}
